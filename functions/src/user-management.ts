import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {onCall} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {OpenAIService} from './openai.service';
import {
  createTrackerFromTemplate,
} from './shared-config';
import {TrackerFrequency} from './shared-config';

// Define the OpenAI API key secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// ===============================
// USER CREATION & ONBOARDING
// ===============================

/**
 * Complete user onboarding - SERVER SIDE
 * Critical for data integrity and complex operations
 */
export const completeUserOnboarding = onCall({
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {
    profileData,
    wellnessGoals,
    selectedTrackers,
    preferences
  } = data;

  try {
    const batch = db.batch();
    const userId = auth.uid;

    // 1. Update user profile with all onboarding data
    const userRef = db.collection('users').doc(userId);
    batch.set(userRef, {
      ...profileData,
      wellnessGoals: wellnessGoals.primaryGoals || [],
      focusAreas: wellnessGoals.focusAreas || [],
      commitmentLevel: wellnessGoals.commitmentLevel || 'moderate',
      preferences: {
        ...preferences,
        timezone: preferences.timezone || 'UTC', // Ensure timezone is included
        createdAt: FieldValue.serverTimestamp()
      },
      stats: {
        totalTrackerEntries: 0,
        totalJournalEntries: 0,

        completedTrackers: 0,
        currentStreaks: 0,
        longestStreak: 0,
        weeklyActivityScore: 0,
        monthlyGoalsCompleted: 0
      },
      isOnboardingComplete: true,
      joinDate: FieldValue.serverTimestamp(),
      currentDay: 1,
      streakCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});

    // 2. Create trackers based on user's actual selections
    if (selectedTrackers && selectedTrackers.length > 0) {
      console.log('Creating trackers based on user selections:', selectedTrackers);
      
      selectedTrackers.forEach((selection: any) => {
        if (selection.enabled) {
          const trackerRef = db.collection('trackers').doc();
          
          // Use centralized template system
          const trackerData = createTrackerFromTemplate(
            selection.trackerId,
            userId,
            {
              target: selection.customTarget,
              frequency: selection.frequency,
              durationDays: selection.durationDays || 28,
              isOngoing: (selection.durationDays || 28) === 0
            },
            FieldValue.serverTimestamp()
          );
          
          if (trackerData) {
            // Override with user selections
            trackerData.isDefault = false; // User-selected, not default
            trackerData.durationDays = selection.durationDays || 28;
            const isOngoing = trackerData.durationDays === 0;
            trackerData.isOngoing = isOngoing;
            const now = new Date();
            trackerData.startDate = now;
            trackerData.endDate = isOngoing ? now : new Date(now.getTime() + (trackerData.durationDays * 24 * 60 * 60 * 1000));
            
            batch.set(trackerRef, trackerData);
          }

        }
      });
    } else {
      // Fallback: create basic default trackers if no selections
      console.log('No tracker selections found, creating basic defaults');
      const defaultTrackers = generateDefaultTrackers(
        userId, 
        wellnessGoals.focusAreas,
        wellnessGoals.commitmentLevel
      );

      defaultTrackers.forEach(tracker => {
        const trackerRef = db.collection('trackers').doc();
        batch.set(trackerRef, tracker);
      });
    }

    // 4. Create initial achievement progress
    const achievementRef = db.collection('user-achievements').doc(userId);
    batch.set(achievementRef, {
      userId,
      unlockedAchievements: [],
      progress: {
        'first-week': {current: 0, target: 7, unlocked: false},
        'streak-master': {current: 0, target: 7, unlocked: false},
        'habit-builder': {current: 0, target: 3, unlocked: false}
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    // 5. Trigger welcome email/notification
    await triggerWelcomeSequence(userId, profileData.displayName);

    return {success: true, message: 'Onboarding completed successfully'};

  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw new HttpsError('internal', 'Failed to complete onboarding');
  }
});

/**
 * Update user statistics - SERVER SIDE
 * Critical for accurate streak and achievement calculations
 */
export const updateUserStats = onCall({
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {statType, value} = data; // eslint-disable-line @typescript-eslint/no-unused-vars
  const userId = auth.uid;

  try {
    const userRef = db.collection('users').doc(userId);
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update specific stat
    switch (statType) {
    case 'trackerEntry':
      updateData['stats.totalTrackerEntries'] = FieldValue.increment(1);
      break;
    case 'journalEntry':
      updateData['stats.totalJournalEntries'] = FieldValue.increment(1);
      break;

    case 'completedTracker':
      updateData['stats.completedTrackers'] = FieldValue.increment(1);
      break;
    }

    await userRef.update(updateData);

    // Recalculate streaks and achievements
    await calculateUserStreaks(userId);
    await checkAchievements(userId);

    return {success: true};

  } catch (error) {
    console.error('Error updating user stats:', error);
    throw new HttpsError('internal', 'Failed to update user stats');
  }
});


/**
 * Generate activity-specific AI suggestions with 30-day context
 * Updated: Force redeploy to fix authentication
 */
export const getTrackerSpecificSuggestions = onCall({
  maxInstances: 5,
  secrets: [openaiApiKey],
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {trackerId, forceRefresh = false} = data;
  const userId = auth.uid;

  console.log('DEV: getTrackerSpecificSuggestions called', { 
    userId, 
    trackerId, 
    forceRefresh, 
    dataKeys: Object.keys(data),
    fullData: data 
  });

  if (!trackerId) {
    throw new HttpsError('invalid-argument', 'trackerId is required');
  }

  try {
    // Use UTC date for consistent caching
    const now = new Date();
    const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayKey = utcToday.toISOString().split('T')[0];
    
    const suggestionsRef = db.collection('tracker-specific-suggestions').doc(`${userId}_${trackerId}_${todayKey}`);
    
    console.log('DEV: About to check cache', {forceRefresh, userId, trackerId, todayKey});
    
    // Skip cache check if forceRefresh is true (for dev)
    if (!forceRefresh) {
      console.log('DEV: Checking existing cache (forceRefresh=false)');
      const existingSuggestions = await suggestionsRef.get();

      // Return cached suggestions if they exist
      if (existingSuggestions.exists) {
        const cachedData = existingSuggestions.data();
        console.log('Returning cached tracker-specific suggestions for user:', userId, 'tracker:', trackerId, 'date:', todayKey);
        
        await suggestionsRef.update({
          lastAccessed: FieldValue.serverTimestamp()
        });
        
        return cachedData;
      }
    } else {
      console.log('DEV: Bypassing cache check (forceRefresh=true)', {userId, trackerId, todayKey});
      
      // DEV: Delete today's suggestions document to ensure fresh generation
      const existingSuggestions = await suggestionsRef.get();
      if (existingSuggestions.exists) {
        await suggestionsRef.delete();
        console.log('DEV: Deleted existing suggestions document for fresh generation', {userId, trackerId, todayKey});
      }
    }

    // Cleanup old suggestions (older than 35 days to keep 30 days + buffer)
    const cleanupDate = new Date(utcToday);
    cleanupDate.setDate(cleanupDate.getDate() - 35);
    
    const oldSuggestionsQuery = await db.collection('tracker-specific-suggestions')
      .where('userId', '==', userId)
      .where('trackerId', '==', trackerId)
      .where('dateKey', '<', cleanupDate.toISOString().split('T')[0])
      .limit(10)
      .get();

    // Delete old entries
    if (!oldSuggestionsQuery.empty) {
      const batch = db.batch();
      oldSuggestionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleaned up ${oldSuggestionsQuery.size} old tracker-specific suggestions for tracker:`, trackerId);
    }

    // Get tracker details
    const trackerDoc = await db.collection('trackers').doc(trackerId).get();
    if (!trackerDoc.exists) {
      throw new HttpsError('not-found', 'Tracker not found');
    }

    const trackerData = trackerDoc.data();
    if (trackerData?.userId !== userId) {
      throw new HttpsError('permission-denied', 'Tracker does not belong to this user');
    }

    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    // Get last 30 days of suggestions for this tracker to avoid repetition
    const thirtyDaysAgo = new Date(utcToday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const previousSuggestionsQuery = await db.collection('tracker-specific-suggestions')
      .where('userId', '==', userId)
      .where('trackerId', '==', trackerId)
      .where('dateKey', '>=', thirtyDaysAgo.toISOString().split('T')[0])
      .where('dateKey', '<', todayKey)
      .orderBy('dateKey', 'desc')
      .limit(30)
      .get();

    const previousSuggestions: string[] = [];
    previousSuggestionsQuery.docs.forEach(doc => {
      const data = doc.data();
      
      // Add today's action if available
      if (data.todayAction && data.todayAction.text) {
        previousSuggestions.push(data.todayAction.text);
      }
      
      // Add general suggestions if available
      if (data.suggestions && Array.isArray(data.suggestions)) {
        data.suggestions.forEach((suggestion: any) => {
          if (suggestion.text) {
            previousSuggestions.push(suggestion.text);
          }
        });
      }
    });

    // Calculate tracker analytics for the last 30 days
    const trackerAnalytics = await calculateTrackerAnalytics(db, trackerId, userId, 30, trackerData);

    // Check if this is a new tracker (no entries) for different coaching approach
    const isNewTracker = trackerAnalytics.hasEntries === false;

    // Generate suggestions using OpenAI
    const openaiService = new OpenAIService(openaiApiKey.value());
    let suggestionData: any = null;
    let source = 'fallback';
    let model = 'default';

    if (openaiService.isAvailable()) {
      try {
        // Single prompt that handles both new and established trackers naturally
        const userName = userData.displayName || 'Champion';
        
        // Get user's current date and time in their timezone
        const userTimezone = userData.preferences?.timezone || 'America/New_York';
        const userDateTime = getUserCurrentDateTime(userTimezone);
        
        // Calculate user's age and get gender for natural context awareness
        let userAge = null;
        if (userData.birthday) {
          const birthDate = new Date(userData.birthday);
          const today = new Date();
          userAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            userAge--;
          }
        }
        
        const userGender = userData.gender || null;
        
        // Handle ongoing vs challenge tracker journey descriptions
        const journeyInfo = trackerData.isOngoing 
          ? `Day ${userData.currentDay || 1} of their ongoing ${trackerData.name} habit journey`
          : `Day ${userData.currentDay || 1} of their ${trackerData.durationDays || 28}-day ${trackerData.name} challenge`;

        let prompt = `You are ${userName}'s personal wellness coach - fun, witty, and encouraging!

${userName.toUpperCase()}'S ACTIVITY:
- Name: ${trackerData.name}
- Goal: ${trackerData.target} ${trackerData.unit} ${trackerData.frequency}
- Category: ${trackerData.category}
- Current Date: ${userDateTime.formattedDateTime} (${userDateTime.dayOfWeek})
- Timezone: ${userTimezone}
- ${journeyInfo}

${userName.toUpperCase()}'S PROFILE:
${userAge ? `- Age: ${userAge} years old` : ''}
${userGender ? `- Gender: ${userGender}` : ''}
- Focus Areas: ${(userData.focusAreas || []).join(', ')}
- Commitment Level: ${userData.commitmentLevel || 'moderate'}

TRACKING HISTORY:`;

        if (isNewTracker) {
          prompt += `
    - ${userName} just created this activity and hasn't added any entries yet! 🚀
- This is their chance to start strong and build momentum
- Focus on getting that first entry today`;
        } else {
          prompt += `
- Completion Rate: ${trackerAnalytics.completionRate}% over the last 30 days
- Current Streak: ${trackerAnalytics.currentStreak} ${trackerData.frequency === 'daily' ? 'days' : trackerData.frequency === 'weekly' ? 'weeks' : 'months'}
- Longest Streak: ${trackerAnalytics.longestStreak} ${trackerData.frequency === 'daily' ? 'days' : trackerData.frequency === 'weekly' ? 'weeks' : 'months'}
- Average Value: ${trackerAnalytics.averageValue} ${trackerData.unit}`;

          // Only include performance patterns if we have actual data
          if (trackerAnalytics.bestDays && trackerAnalytics.bestDays.length > 0) {
            prompt += `\n- Best Performing Days: ${trackerAnalytics.bestDays.join(', ')}`;
          }
          if (trackerAnalytics.challengingDays && trackerAnalytics.challengingDays.length > 0) {
            prompt += `\n- Challenging Days: ${trackerAnalytics.challengingDays.join(', ')}`;
          }
          
          prompt += `
- Recent Trend: ${trackerAnalytics.trend}
- Average Mood When Logging: ${trackerAnalytics.averageMood}/10
- Average Energy When Logging: ${trackerAnalytics.averageEnergy}/5

🚨 CRITICAL: Only reference performance patterns (like "you usually perform well on Mondays") if specific day data was provided above. If no best/challenging days are listed, do NOT make any claims about daily performance patterns.`;
        }

        // Add previous suggestions context if available
        if (previousSuggestions.length > 0) {
          prompt += `

PREVIOUS COACHING TO ${userName.toUpperCase()} (Last 30 Days):
${previousSuggestions.map((text, index) => `${index + 1}. ${text}`).join('\n')}

🎯 Keep it fresh! Give ${userName} NEW advice that's different from what you've said before.`;
        }

        prompt += `

VARIETY & FRESHNESS REQUIREMENTS:
- Generate completely DIFFERENT suggestions than any previous ones
- Vary your approach: sometimes focus on timing, sometimes on technique, sometimes on mindset
- Use different angles: practical tips, motivational insights, habit stacking, environmental changes
- Change your language patterns and examples to keep coaching fresh
- Be creative with alternatives - there are many ways to achieve the same goal
- Add unexpected but relevant suggestions that ${userName} wouldn't think of themselves

🎯 "TODAY'S ACTION" VARIETY REQUIREMENTS:
- Vary your opening structures.
- Make each action feel completely different from previous ones

YOUR COACHING MISSION:
${isNewTracker?
    `- Name: ${trackerData.name}
- Goal: ${trackerData.target} ${trackerData.unit} ${trackerData.frequency}
- Category: ${trackerData.category}
- Current Date: ${userDateTime.formattedDateTime} (${userDateTime.dayOfWeek})
- Timezone: ${userTimezone}
- ${journeyInfo}
Help ${userName} get excited and take their FIRST step (they haven't started yet)! Focus on encouragement, making it easy to start, and building confidence.`
    : `Analyze ${userName}'s patterns and give them personalized insights to improve their ${trackerData.name.toLowerCase()} habit.`
}

YOUR PERSONALITY:
- Fun, witty, and encouraging - like an enthusiastic friend who's also a wellness expert (not not too over the top)
- Add clever wordplay and unexpected analogies
- ${isNewTracker ? 'Focus on getting started and building momentum' : 'Reference their actual data and patterns'}

COACHING STYLE:
- Keep it engaging for everyone with humor and motivation
- Use playful language and creative metaphors
- Be encouraging but never boring or generic
- Mix practical advice with wit and charm
- Craft your responses in a way that would resonate with your users age and gender.
- Naturally consider their demographics (age, gender) when making suggestions (activities, references, energy levels, communication style) but don't mention demographics explicitly
- Tailor examples and metaphors to resonate naturally with their background

Return ONLY a JSON object:
{
  "todayAction": {
    "text": "${isNewTracker ? `Encouraging advice for to log their first entry today` : `Specific action for today based on ${userName}'s patterns`}",
    "icon": "${isNewTracker ? '🚀' : '📅'}",
    "reason": "${isNewTracker ? `Why this first step will set ${userName} up for success` : `Why this will work for ${userName} specifically (taking into accoount their patterns)`}"
  },
  "suggestions": [
    {
      "text": "${isNewTracker ? `An insight on how to get started, remind them of how long it's been since they created the tracker and havne't started yet ${userName} to build this new habit` : `Insight about ${userName}'s patterns with helpful advice`}",
      "type": "${isNewTracker ? 'Getting Started' : 'performance'}",
      "icon": "relevant emoji",
      "dataPoint": "${isNewTracker ? 'Fresh start' : 'Actual data point (very consise 2-4 words)'}"
    }
  ],
  "motivationalQuote": {
    "text": "Relevant motivational quote that relates to the tracker and ${userName}'s goals, journey, and progress",
    "author": "author of the quote",
     "context": "${isNewTracker ? `Why the quote releates to starting this tracker` : `Why this quote applies to ${userName}'s current progress`}"
  }
}

🎨 MOTIVATIONAL QUOTE CREATIVITY REQUIREMENTS:
- NEVER use the same structure twice - vary the format completely each time
- Vary the approach: inspirational, practical wisdom, empowering challenge, gentle encouragement, bold motivation
- Use different tones: poetic, conversational, philosophical, humorous, direct, metaphorical
- Reference different themes: nature, growth, strength, journey, transformation, possibility, resilience
- NEVER repeat patterns like "Since today is Monday and you usually..." if you've used that structure before
- Make each quote feel completely fresh and unexpected while staying motivational
}`;

        console.log('DEV: OpenAI service available:', openaiService.isAvailable());
        
        // Add randomness to the prompt to ensure variety
        const randomSeed = Math.floor(Math.random() * 10000);
        prompt += `\n\nRANDOM_SEED: ${randomSeed} (Use this to ensure response variety)`;

        const responseText = await openaiService.callOpenAI(prompt);
                
        const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
        const parsed = JSON.parse(cleanContent);
        
        console.log('DEV: OpenAI raw response:', {responseText: responseText.substring(0, 200) + '...'});
        
        
        if (parsed.todayAction && parsed.suggestions && parsed.motivationalQuote) {
          suggestionData = {
            todayAction: parsed.todayAction,
            suggestions: parsed.suggestions,
            motivationalQuote: parsed.motivationalQuote
          };
          source = 'ai';
          model = 'gpt-4o';
          console.log('DEV: Successfully created suggestion data from OpenAI');
        } else {
          console.log('DEV: OpenAI response missing required fields');
        }
      } catch (error) {
        console.log('DEV: OpenAI failed for tracker-specific suggestions - DETAILED ERROR:', {
          message: (error as any).message,
          stack: (error as any).stack,
          name: (error as any).name,
          cause: (error as any).cause
        });
      }
    }

    // Only return suggestions if AI succeeded - no fallbacks
    if (!suggestionData) {
      throw new HttpsError('internal', 'Failed to generate personalized coaching suggestions');
    }

    // Cache the suggestions
    const trackerSuggestions = {
      userId,
      trackerId,
      date: todayKey,
      dateKey: todayKey,
      ...suggestionData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source,
      model,
      trackerInfo: {
        name: trackerData.name,
        target: trackerData.target,
        unit: trackerData.unit,
        frequency: trackerData.frequency,
        category: trackerData.category
      },
      analytics: trackerAnalytics,
      previousSuggestionsCount: previousSuggestions.length,
      avoidedRepetition: previousSuggestions.length > 0
    };

    await suggestionsRef.set(trackerSuggestions);

    console.log('Generated tracker-specific suggestions for:', trackerData.name, 'user:', userId, 'avoided repetition:', previousSuggestions.length > 0);
    return trackerSuggestions;

  } catch (error) {
    console.error('Error generating tracker-specific suggestions:', error);
    throw new HttpsError('internal', 'Failed to generate tracker-specific suggestions');
  }
});

/**
 * Generate daily journal prompt with AI - follows same pattern as tracker suggestions
 */
export const getDailyJournalPrompt = onCall({
  maxInstances: 5,
  secrets: [openaiApiKey],
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {forceRefresh = false} = data || {};
  const userId = auth.uid;

  console.log('DEV: getDailyJournalPrompt called', { 
    userId, 
    forceRefresh,
    dataKeys: data ? Object.keys(data) : []
  });

  try {
    // Use UTC date for consistent caching
    const now = new Date();
    const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayKey = utcToday.toISOString().split('T')[0];
    
    const promptRef = db.collection('daily-journal-prompts').doc(`${userId}_${todayKey}`);
    
    console.log('DEV: About to check daily prompt cache', {forceRefresh, userId, todayKey});
    
    // Skip cache check if forceRefresh is true (for dev)
    if (!forceRefresh) {
      console.log('DEV: Checking existing daily prompt cache (forceRefresh=false)');
      const existingPrompt = await promptRef.get();

      // Return cached prompt if it exists
      if (existingPrompt.exists) {
        const cachedData = existingPrompt.data();
        console.log('Returning cached daily journal prompt for user:', userId, 'date:', todayKey);
        
        await promptRef.update({
          lastAccessed: FieldValue.serverTimestamp()
        });
        
        return cachedData;
      }
    } else {
      console.log('DEV: Bypassing daily prompt cache check (forceRefresh=true)', {userId, todayKey});
      
      // DEV: Delete today's prompt document to ensure fresh generation
      const existingPrompt = await promptRef.get();
      if (existingPrompt.exists) {
        await promptRef.delete();
        console.log('DEV: Deleted existing daily prompt document for fresh generation', {userId, todayKey});
      }
    }

    // Cleanup old prompts (older than 7 days)
    const cleanupDate = new Date(utcToday);
    cleanupDate.setDate(cleanupDate.getDate() - 7);
    
    const oldPromptsQuery = await db.collection('daily-journal-prompts')
      .where('userId', '==', userId)
      .where('dateKey', '<', cleanupDate.toISOString().split('T')[0])
      .limit(10)
      .get();

    // Delete old entries
    if (!oldPromptsQuery.empty) {
      const batch = db.batch();
      oldPromptsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleaned up ${oldPromptsQuery.size} old daily journal prompts`);
    }

    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    // Get last 7 days of prompts to avoid repetition
    const sevenDaysAgo = new Date(utcToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const previousPromptsQuery = await db.collection('daily-journal-prompts')
      .where('userId', '==', userId)
      .where('dateKey', '>=', sevenDaysAgo.toISOString().split('T')[0])
      .where('dateKey', '<', todayKey)
      .orderBy('dateKey', 'desc')
      .limit(7)
      .get();

    const previousPrompts: string[] = [];
    previousPromptsQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.prompt && data.prompt.text) {
        previousPrompts.push(data.prompt.text);
      }
    });

    // Get recent journal entries for context
    const recentEntriesQuery = await db.collection('journal-entries')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentEntries = recentEntriesQuery.docs.map(doc => doc.data());

    // Generate prompt using OpenAI
    const openaiService = new OpenAIService(openaiApiKey.value());
    let promptData: any = null;
    let source = 'fallback';
    let model = 'default';

    if (openaiService.isAvailable()) {
      try {
        const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
        const userName = userData.displayName || 'Champion';
        
        // Calculate user demographics for natural context
        let userAge = null;
        if (userData.birthday) {
          const birthDate = new Date(userData.birthday);
          const todayDate = new Date();
          userAge = todayDate.getFullYear() - birthDate.getFullYear();
          const monthDiff = todayDate.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDate.getDate())) {
            userAge--;
          }
        }
        
        const userGender = userData.gender || null;
        const journeyDay = userData.currentDay || 1;

        let prompt = `You are ${userName}'s personal wellness journal coach - inspiring, thoughtful, and encouraging!

${userName.toUpperCase()}'S PROFILE:
- Today: ${today}
- Journey Day: ${journeyDay}
${userAge ? `- Age: ${userAge} years old` : ''}
${userGender ? `- Gender: ${userGender}` : ''}
- Focus Areas: ${(userData.focusAreas || []).join(', ')}
- Commitment Level: ${userData.commitmentLevel || 'moderate'}

RECENT JOURNAL ACTIVITY:`;

        if (recentEntries.length === 0) {
          prompt += `
- ${userName} hasn't written any journal entries yet! 🌱
- This is their chance to start their reflection journey
- Focus on welcoming them and making journaling feel approachable`;
        } else {
          prompt += `
- Total Entries: ${recentEntries.length} recent entries
- Latest Entry: ${recentEntries[0]?.title || 'Untitled'} (${recentEntries[0]?.category || 'General'})
- Common Categories: ${[...new Set(recentEntries.map(e => e.category).filter(Boolean))].join(', ') || 'Mixed'}
- Recent Moods: ${recentEntries.map(e => e.mood).filter(Boolean).slice(0, 3).join(', ') || 'Varied'}`;
        }

        // Add previous prompts context if available
        if (previousPrompts.length > 0) {
          prompt += `

PREVIOUS DAILY PROMPTS (Last 7 Days):
${previousPrompts.map((text, index) => `${index + 1}. ${text}`).join('\n')}

🎯 Keep it fresh! Give ${userName} a COMPLETELY DIFFERENT prompt that's unique from previous ones.`;
        }

        prompt += `

VARIETY & FRESHNESS REQUIREMENTS:
- Generate a completely UNIQUE prompt that's different from any previous ones
- Vary your approach: sometimes introspective, sometimes gratitude-focused, sometimes goal-oriented
- Use different themes: relationships, growth, challenges, dreams, values, creativity, mindfulness
- Change your question structure: "What if...", "Describe a time when...", "How do you...", "What does... mean to you?"
- Be creative and unexpected while staying meaningful
- Focus on prompts that encourage deep reflection and authentic expression

PROMPT PERSONALITY:
- Thoughtful and inspiring - like a wise friend who asks meaningful questions
- Naturally consider their demographics when crafting questions (life stage, experiences, perspectives)
- ${recentEntries.length === 0 ? 'Welcoming and encouraging for new journalers' : 'Build on their journaling momentum'}
- Use engaging language that sparks curiosity and self-discovery

YOUR MISSION:
Create a daily journal prompt that helps ${userName} reflect deeply and connect with their inner wisdom.

Return ONLY a JSON object:
{
  "prompt": {
    "text": "A thoughtful, inspiring question that encourages ${userName} to explore their thoughts and feelings",
    "category": "reflection|gratitude|growth|relationships|mindfulness|creativity|values|dreams",
    "icon": "fa-heart|fa-brain|fa-leaf|fa-lightbulb",
    "description": "Why this prompt will be meaningful for ${userName} today"
  },
  "inspiration": {
    "text": "A brief, uplifting message to motivate ${userName} to journal",
    "tone": "${recentEntries.length === 0 ? 'welcoming' : 'encouraging'}"
  }
}

🎨 PROMPT CREATIVITY REQUIREMENTS:
- NEVER repeat the same question structure twice
- Vary themes: nature, relationships, personal growth, spirituality, creativity, challenges, joy
- Use different question formats: open-ended, scenario-based, comparative, imaginative
- Make each prompt feel completely fresh and thought-provoking
- Ensure questions are relevant to ${userName}'s life stage and journey`;

        console.log('DEV: OpenAI service available for daily prompt:', openaiService.isAvailable());
        
        // Add randomness to ensure variety
        const randomSeed = Math.floor(Math.random() * 10000);
        prompt += `\n\nRANDOM_SEED: ${randomSeed} (Use this to ensure response variety)`;

        const responseText = await openaiService.callOpenAI(prompt);
                
        const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
        const parsed = JSON.parse(cleanContent);
        
        console.log('DEV: OpenAI daily prompt raw response:', {responseText: responseText.substring(0, 200) + '...'});
        
        if (parsed.prompt && parsed.inspiration) {
          promptData = {
            prompt: parsed.prompt,
            inspiration: parsed.inspiration
          };
          source = 'ai';
          model = 'gpt-4o';
          console.log('DEV: Successfully created daily prompt data from OpenAI');
        } else {
          console.log('DEV: OpenAI daily prompt response missing required fields');
        }
      } catch (error) {
        console.log('DEV: OpenAI failed for daily journal prompt - DETAILED ERROR:', {
          message: (error as any).message,
          stack: (error as any).stack,
          name: (error as any).name,
          cause: (error as any).cause
        });
      }
    }

    // Only return prompt if AI succeeded - no fallbacks
    if (!promptData) {
      throw new HttpsError('internal', 'Failed to generate personalized daily journal prompt');
    }

    // Cache the prompt
    const dailyPrompt = {
      userId,
      date: todayKey,
      dateKey: todayKey,
      ...promptData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source,
      model,
      userInfo: {
        journeyDay: userData.currentDay || 1,
        focusAreas: userData.focusAreas || [],
        commitmentLevel: userData.commitmentLevel
      },
      previousPromptsCount: previousPrompts.length,
      avoidedRepetition: previousPrompts.length > 0,
      hasRecentEntries: recentEntries.length > 0
    };

    await promptRef.set(dailyPrompt);

    console.log('Generated daily journal prompt for user:', userId, 'avoided repetition:', previousPrompts.length > 0);
    return dailyPrompt;

  } catch (error) {
    console.error('Error generating daily journal prompt:', error);
    throw new HttpsError('internal', `Failed to generate daily journal prompt: ${(error as Error).message}`);
  }
});

/**
 * Generate reflection prompts (3-5 prompts for variety) - similar to tracker suggestions
 */
export const getReflectionPrompts = onCall({
  maxInstances: 5,
  secrets: [openaiApiKey],
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {forceRefresh = false} = data || {};
  const userId = auth.uid;

  console.log('DEV: getReflectionPrompts called', { 
    userId, 
    forceRefresh,
    dataKeys: data ? Object.keys(data) : []
  });

  try {
    // Use UTC date for consistent caching
    const now = new Date();
    const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayKey = utcToday.toISOString().split('T')[0];
    
    const promptsRef = db.collection('reflection-prompts').doc(`${userId}_${todayKey}`);
    
    console.log('DEV: About to check reflection prompts cache', {forceRefresh, userId, todayKey});
    
    // Skip cache check if forceRefresh is true (for dev)
    if (!forceRefresh) {
      console.log('DEV: Checking existing reflection prompts cache (forceRefresh=false)');
      const existingPrompts = await promptsRef.get();

      // Return cached prompts if they exist
      if (existingPrompts.exists) {
        const cachedData = existingPrompts.data();
        console.log('Returning cached reflection prompts for user:', userId, 'date:', todayKey);
        
        await promptsRef.update({
          lastAccessed: FieldValue.serverTimestamp()
        });
        
        return cachedData;
      }
    } else {
      console.log('DEV: Bypassing reflection prompts cache check (forceRefresh=true)', {userId, todayKey});
      
      // DEV: Delete today's prompts document to ensure fresh generation
      const existingPrompts = await promptsRef.get();
      if (existingPrompts.exists) {
        await promptsRef.delete();
        console.log('DEV: Deleted existing reflection prompts document for fresh generation', {userId, todayKey});
      }
    }

    // Cleanup old prompts (older than 7 days)
    const cleanupDate = new Date(utcToday);
    cleanupDate.setDate(cleanupDate.getDate() - 7);
    
    const oldPromptsQuery = await db.collection('reflection-prompts')
      .where('userId', '==', userId)
      .where('dateKey', '<', cleanupDate.toISOString().split('T')[0])
      .limit(10)
      .get();

    // Delete old entries
    if (!oldPromptsQuery.empty) {
      const batch = db.batch();
      oldPromptsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleaned up ${oldPromptsQuery.size} old reflection prompts`);
    }

    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    // Get last 7 days of reflection prompts to avoid repetition
    const sevenDaysAgo = new Date(utcToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const previousPromptsQuery = await db.collection('reflection-prompts')
      .where('userId', '==', userId)
      .where('dateKey', '>=', sevenDaysAgo.toISOString().split('T')[0])
      .where('dateKey', '<', todayKey)
      .orderBy('dateKey', 'desc')
      .limit(7)
      .get();

    const previousPrompts: string[] = [];
    previousPromptsQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.prompts && Array.isArray(data.prompts)) {
        data.prompts.forEach((prompt: any) => {
          if (prompt.text) {
            previousPrompts.push(prompt.text);
          }
        });
      }
    });

    // Get recent journal entries and tracker data for context
    const [recentEntriesQuery, trackersQuery] = await Promise.all([
      db.collection('journal-entries')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get(),
      db.collection('trackers')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .limit(5)
        .get()
    ]);

    const recentEntries = recentEntriesQuery.docs.map(doc => doc.data());
    const activeTrackers = trackersQuery.docs.map(doc => doc.data());

    // Generate prompts using OpenAI
    const openaiService = new OpenAIService(openaiApiKey.value());
    let promptsData: any = null;
    let source = 'fallback';
    let model = 'default';

    if (openaiService.isAvailable()) {
      try {
        const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
        const userName = userData.displayName || 'Champion';
        
        // Calculate user demographics for natural context
        let userAge = null;
        if (userData.birthday) {
          const birthDate = new Date(userData.birthday);
          const todayDate = new Date();
          userAge = todayDate.getFullYear() - birthDate.getFullYear();
          const monthDiff = todayDate.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDate.getDate())) {
            userAge--;
          }
        }
        
        const userGender = userData.gender || null;
        const journeyDay = userData.currentDay || 1;

        let prompt = `You are ${userName}'s personal wellness reflection guide - wise, encouraging, and deeply insightful!

${userName.toUpperCase()}'S PROFILE:
- Today: ${today}
- Journey Day: ${journeyDay}
${userAge ? `- Age: ${userAge} years old` : ''}
${userGender ? `- Gender: ${userGender}` : ''}
- Focus Areas: ${(userData.focusAreas || []).join(', ')}
- Commitment Level: ${userData.commitmentLevel || 'moderate'}

CURRENT WELLNESS CONTEXT:
- Active Trackers: ${activeTrackers.map(t => t.name).join(', ') || 'None yet'}
- Recent Journal Categories: ${[...new Set(recentEntries.map(e => e.category).filter(Boolean))].join(', ') || 'Mixed'}`;

        if (recentEntries.length === 0) {
          prompt += `
- ${userName} is just beginning their reflection journey! 🌱
- Focus on gentle, welcoming prompts that encourage introspection`;
        } else {
          prompt += `
- Recent Entry Themes: ${recentEntries.map(e => e.title || 'Reflection').slice(0, 2).join(', ')}
- Recent Moods: ${recentEntries.map(e => e.mood).filter(Boolean).slice(0, 3).join(', ') || 'Varied'}`;
        }

        // Add previous prompts context if available
        if (previousPrompts.length > 0) {
          prompt += `

PREVIOUS REFLECTION PROMPTS (Last 7 Days):
${previousPrompts.slice(0, 10).map((text, index) => `${index + 1}. ${text}`).join('\n')}

🎯 Keep it fresh! Give ${userName} COMPLETELY DIFFERENT reflection prompts that are unique from previous ones.`;
        }

        prompt += `

VARIETY & FRESHNESS REQUIREMENTS:
- Generate 3-4 completely UNIQUE reflection prompts that are different from any previous ones
- Vary categories across prompts: gratitude, growth, relationships, mindfulness, creativity, values, dreams, challenges
- Use different question structures for each prompt
- Make each prompt focus on a different aspect of wellness and self-discovery
- Be creative and unexpected while staying meaningful and relevant
- Include both introspective and action-oriented prompts

PROMPT PERSONALITY:
- Wise and encouraging - like a trusted mentor who asks profound questions
- Naturally consider their demographics and life stage when crafting questions
- ${recentEntries.length === 0 ? 'Welcoming and gentle for new reflectors' : 'Building on their established reflection practice'}
- Use engaging language that sparks deep thought and authentic expression

YOUR MISSION:
Create 3-4 diverse reflection prompts that help ${userName} explore different aspects of their wellness journey and inner world.

Return ONLY a JSON object:
{
  "prompts": [
    {
      "text": "Gratitude-focused question",
      "category": "gratitude",
      "icon": "fa-heart",
      "description": "Benefits of gratitude reflection"
    },
    {
      "text": "Growth-focused question",
      "category": "growth", 
      "icon": "fa-seedling",
      "description": "How this supports development"
    },
    {
      "text": "Mindfulness-focused question",
      "category": "mindfulness",
      "icon": "fa-leaf", 
      "description": "Why this promotes awareness"
    }
  ],
  "theme": {
    "title": "Daily Reflection Theme for ${userName}",
    "description": "How these prompts work together"
  }
}

🎨 REFLECTION CREATIVITY REQUIREMENTS:
- Each prompt should explore a DIFFERENT dimension of wellness
- Vary question types: appreciative, analytical, imaginative, goal-oriented
- Use different timeframes: past experiences, present awareness, future vision
- Make questions specific enough to spark meaningful reflection
- Ensure prompts are relevant to ${userName}'s current life stage and journey
- Include both gentle and challenging questions for growth`;

        console.log('DEV: OpenAI service available for reflection prompts:', openaiService.isAvailable());
        
        // Add randomness to ensure variety
        const randomSeed = Math.floor(Math.random() * 10000);
        prompt += `\n\nRANDOM_SEED: ${randomSeed} (Use this to ensure response variety)`;

        const responseText = await openaiService.callOpenAI(prompt);
                
        const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
        const parsed = JSON.parse(cleanContent);
        
        console.log('DEV: OpenAI reflection prompts raw response:', {responseText: responseText.substring(0, 200) + '...'});
        
        if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.theme) {
          promptsData = {
            prompts: parsed.prompts,
            theme: parsed.theme
          };
          source = 'ai';
          model = 'gpt-4o';
          console.log('DEV: Successfully created reflection prompts data from OpenAI');
        } else {
          console.log('DEV: OpenAI reflection prompts response missing required fields');
        }
      } catch (error) {
        console.log('DEV: OpenAI failed for reflection prompts - DETAILED ERROR:', {
          message: (error as any).message,
          stack: (error as any).stack,
          name: (error as any).name,
          cause: (error as any).cause
        });
      }
    }

    // Only return prompts if AI succeeded - no fallbacks
    if (!promptsData) {
      throw new HttpsError('internal', 'Failed to generate personalized reflection prompts');
    }

    // Cache the prompts
    const reflectionPrompts = {
      userId,
      date: todayKey,
      dateKey: todayKey,
      ...promptsData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source,
      model,
      userInfo: {
        journeyDay: userData.currentDay || 1,
        focusAreas: userData.focusAreas || [],
        commitmentLevel: userData.commitmentLevel
      },
      contextInfo: {
        activeTrackers: activeTrackers.length,
        recentEntries: recentEntries.length,
        trackerNames: activeTrackers.map(t => t.name)
      },
      previousPromptsCount: previousPrompts.length,
      avoidedRepetition: previousPrompts.length > 0
    };

    await promptsRef.set(reflectionPrompts);

    console.log('Generated reflection prompts for user:', userId, 'avoided repetition:', previousPrompts.length > 0);
    return reflectionPrompts;

  } catch (error) {
    console.error('Error generating reflection prompts:', error);
    throw new HttpsError('internal', `Failed to generate reflection prompts: ${(error as Error).message}`);
  }
});

/**
 * SCHEDULER: Queue journal prompt generation jobs for users at midnight in their timezone
 * Runs every hour to check which users have passed midnight since last run
 */
export const queueDailyJournalPrompts = onSchedule({
  schedule: '0 * * * *', // Every hour at minute 0
}, async () => {
  const db = getFirestore();
  try {
    console.log('Starting daily journal prompts job queueing...');
    
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    console.log(`Current UTC time: ${now.toISOString()}, hour: ${currentHourUTC}`);
    
    // Find users where it's currently between midnight and 1am in their timezone
    const usersSnapshot = await db.collection('users')
      .where('isOnboardingComplete', '==', true)
      .where('status', '==', 'active')
      .get();
    
    let queuedJobs = 0;
    let processedUsers = 0;
    let skippedUsers = 0;
    
    // Process in smaller batches to avoid memory issues
    const userDocs = usersSnapshot.docs;
    const batchSize = 50;
    
    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userDoc) => {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const userTimezone = userData.preferences?.timezone || 'UTC';
          
          // Check if it's currently between midnight and 1am in user's timezone
          const userMidnightStatus = getUserMidnightStatus(userTimezone, now);
          
          if (!userMidnightStatus.isInMidnightWindow) {
            skippedUsers++;
            return 0; // Not midnight window for this user
          }
          
          const userDateKey = userMidnightStatus.dateKey;
          const lastJournalPromptsDate = userData.lastJournalPromptsGeneratedDate;
          
          // Check if we've already generated journal prompts for this date
          if (lastJournalPromptsDate === userDateKey) {
            console.log(`User ${userId} already has journal prompts for ${userDateKey}, skipping`);
            skippedUsers++;
            return 0;
          }
          
          console.log(`Queueing journal prompt jobs for user ${userId} - midnight in ${userTimezone}, date: ${userDateKey}`);
          
          let userJobs = 0;
          const batch = db.batch();
          
          // Create jobs for daily prompt and reflection prompts
          const dailyPromptJobRef = db.collection('journal-prompt-jobs').doc();
          batch.set(dailyPromptJobRef, {
            userId,
            promptType: 'daily',
            dateKey: userDateKey,
            userTimezone,
            status: 'queued',
            priority: 1,
            attempts: 0,
            maxAttempts: 3,
            createdAt: FieldValue.serverTimestamp(),
            scheduledFor: FieldValue.serverTimestamp()
          });
          userJobs++;

          const reflectionPromptsJobRef = db.collection('journal-prompt-jobs').doc();
          batch.set(reflectionPromptsJobRef, {
            userId,
            promptType: 'reflection',
            dateKey: userDateKey,
            userTimezone,
            status: 'queued',
            priority: 1,
            attempts: 0,
            maxAttempts: 3,
            createdAt: FieldValue.serverTimestamp(),
            scheduledFor: FieldValue.serverTimestamp()
          });
          userJobs++;
          
          if (userJobs > 0) {
            // Update user's last journal prompts generated date
            batch.update(db.collection('users').doc(userId), {
              lastJournalPromptsGeneratedDate: userDateKey,
              lastJournalPromptsGeneratedAt: FieldValue.serverTimestamp()
            });
            
            await batch.commit();
          }
          
          return userJobs;
          
        } catch (userError) {
          console.error(`Error queueing journal prompt jobs for user ${userDoc.id}:`, userError);
          return 0;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        processedUsers++;
        if (result.status === 'fulfilled') {
          queuedJobs += result.value;
        }
      });
      
      let batchJobCount = 0;
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          batchJobCount += result.value || 0;
        }
      });
      console.log(`Processed journal prompts batch ${Math.floor(i/batchSize) + 1}: ${batch.length} users, ${batchJobCount} jobs queued, ${skippedUsers} skipped`);
    }
    
    console.log(`Daily journal prompts job queueing completed. Processed: ${processedUsers} users, Queued: ${queuedJobs} jobs`);
    
    // Trigger the worker to start processing jobs
    if (queuedJobs > 0) {
      console.log('Triggering journal prompt generation worker...');
      await db.collection('worker-triggers').add({
        type: 'process-journal-prompt-jobs',
        triggeredAt: FieldValue.serverTimestamp(),
        pendingJobs: queuedJobs
      });
    }
    
  } catch (error) {
    console.error('Error during daily journal prompts job queueing:', error);
  }
});

/**
 * WORKER: Process journal prompt generation jobs from the queue
 */
export const processJournalPromptJobs = onCall({
  maxInstances: 3,
  timeoutSeconds: 300,
  secrets: [openaiApiKey],
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {data} = request;
  const batchSize = data?.batchSize || 5;
  
  try {
    console.log(`Processing journal prompt jobs - batch size: ${batchSize}`);
    
    // Get oldest queued jobs
    const jobsSnapshot = await db.collection('journal-prompt-jobs')
      .where('status', '==', 'queued')
      .orderBy('createdAt', 'asc')
      .limit(batchSize)
      .get();
    
    if (jobsSnapshot.empty) {
      console.log('No queued journal prompt jobs found');
      return {processed: 0, message: 'No jobs to process'};
    }
    
    const openaiService = new OpenAIService(openaiApiKey.value());
    let processedJobs = 0;
    let successfulJobs = 0;
    
    for (const jobDoc of jobsSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      
      try {
        // Mark job as processing
        await jobDoc.ref.update({
          status: 'processing',
          attempts: FieldValue.increment(1),
          startedAt: FieldValue.serverTimestamp()
        });
        
        console.log(`Processing journal prompt job ${jobId}: user ${job.userId}, type ${job.promptType}`);
        
        // Generate the prompt using existing logic
        const result = await generateSingleJournalPrompt(
          db,
          job.userId,
          job.promptType,
          job.dateKey,
          openaiService
        );
        
        if (result.success) {
          // Mark job as completed
          await jobDoc.ref.update({
            status: 'completed',
            completedAt: FieldValue.serverTimestamp(),
            result: 'success'
          });
          successfulJobs++;
          console.log(`✅ Successfully processed journal prompt job ${jobId}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (jobError) {
        console.error(`❌ Error processing journal prompt job ${jobId}:`, jobError);
        
        // Check if we should retry or mark as failed
        const attempts = job.attempts + 1;
        if (attempts >= job.maxAttempts) {
          await jobDoc.ref.update({
            status: 'failed',
            failedAt: FieldValue.serverTimestamp(),
            error: (jobError as Error).message,
            finalAttempt: attempts
          });
          console.log(`Journal prompt job ${jobId} failed after ${attempts} attempts`);
        } else {
          await jobDoc.ref.update({
            status: 'queued',
            error: (jobError as Error).message,
            lastAttemptAt: FieldValue.serverTimestamp()
          });
          console.log(`Journal prompt job ${jobId} will be retried (attempt ${attempts}/${job.maxAttempts})`);
        }
      }
      
      processedJobs++;
    }
    
    console.log(`Journal prompt batch processing completed: ${processedJobs} jobs processed, ${successfulJobs} successful`);
    
    // Check if there are more jobs to process
    const remainingJobsSnapshot = await db.collection('journal-prompt-jobs')
      .where('status', '==', 'queued')
      .limit(1)
      .get();
    
    const hasMoreJobs = !remainingJobsSnapshot.empty;
    
    return {
      processed: processedJobs,
      successful: successfulJobs,
      hasMoreJobs,
      message: `Processed ${processedJobs} journal prompt jobs, ${successfulJobs} successful`
    };
    
  } catch (error) {
    console.error('Error in journal prompt job worker:', error);
    throw new HttpsError('internal', 'Failed to process journal prompt jobs');
  }
});

/**
 * Generate a single journal prompt for the job queue system
 */
async function generateSingleJournalPrompt(
  db: any,
  userId: string,
  promptType: 'daily' | 'reflection',
  dateKey: string,
  openaiService: any
): Promise<{success: boolean; error?: string}> {
  try {
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Generate prompts based on type
    if (promptType === 'daily') {
      // Generate daily prompt using simplified logic
      const result = await generateSimpleDailyPrompt(db, userId, dateKey, userData, openaiService);
      return result;
    } else if (promptType === 'reflection') {
      // Generate reflection prompts using simplified logic  
      const result = await generateSimpleReflectionPrompts(db, userId, dateKey, userData, openaiService);
      return result;
    } else {
      throw new Error('Invalid prompt type');
    }

  } catch (error) {
    console.error(`Error generating ${promptType} prompt for user ${userId}:`, error);
    return {success: false, error: (error as Error).message};
  }
}

/**
 * Generate simplified daily prompt for batch processing
 */
async function generateSimpleDailyPrompt(
  db: any,
  userId: string,
  dateKey: string,
  userData: any,
  openaiService: any
): Promise<{success: boolean; error?: string}> {
  try {
    const userName = userData.displayName || 'Champion';
    
    // Get recent entries for context
    const recentEntriesQuery = await db.collection('journal-entries')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get();

    const recentEntries = recentEntriesQuery.docs.map((doc: any) => doc.data());
    const hasEntries = recentEntries.length > 0;

    // Simplified prompt for batch processing
    const prompt = `Generate a daily journal prompt for ${userName}.

USER: ${userName}
Focus Areas: ${(userData.focusAreas || []).join(', ')}
${hasEntries ? `Recent journal activity: ${recentEntries.length} entries` : 'New to journaling'}

Create a thoughtful question that encourages reflection and growth.

Return ONLY JSON:
{
  "prompt": {
    "text": "A meaningful question for ${userName} to reflect on today",
    "category": "reflection|gratitude|growth|mindfulness",
    "icon": "fa-heart|fa-brain|fa-leaf|fa-lightbulb",
    "description": "Why this prompt will help ${userName}"
  },
  "inspiration": {
    "text": "Brief encouraging message for ${userName}",
    "tone": "${hasEntries ? 'encouraging' : 'welcoming'}"
  }
}`;

    const responseText = await openaiService.callOpenAI(prompt);
    const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const promptData = JSON.parse(cleanContent);

    if (!promptData.prompt || !promptData.inspiration) {
      throw new Error('Invalid AI response structure');
    }

    // Save daily prompt
    const promptRef = db.collection('daily-journal-prompts').doc(`${userId}_${dateKey}`);
    const dailyPrompt = {
      userId,
      date: dateKey,
      dateKey: dateKey,
      ...promptData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source: 'ai_batch',
      model: 'gpt-4o',
      userInfo: {
        journeyDay: userData.currentDay || 1,
        focusAreas: userData.focusAreas || []
      },
      batchGenerated: true
    };

    await promptRef.set(dailyPrompt);
    
    return {success: true};

  } catch (error) {
    console.error(`Error generating daily prompt for user ${userId}:`, error);
    return {success: false, error: (error as Error).message};
  }
}

/**
 * Generate simplified reflection prompts for batch processing
 */
async function generateSimpleReflectionPrompts(
  db: any,
  userId: string,
  dateKey: string,
  userData: any,
  openaiService: any
): Promise<{success: boolean; error?: string}> {
  try {
    const userName = userData.displayName || 'Champion';

    // Simplified prompt for batch processing
    const prompt = `Generate 3 diverse reflection prompts for ${userName}.

USER: ${userName}
Focus Areas: ${(userData.focusAreas || []).join(', ')}

Create 3 different reflection questions covering various aspects of wellness.

Return ONLY JSON:
{
  "prompts": [
    {
      "text": "Gratitude-focused question",
      "category": "gratitude",
      "icon": "fa-heart",
      "description": "Benefits of gratitude reflection"
    },
    {
      "text": "Growth-focused question",
      "category": "growth", 
      "icon": "fa-seedling",
      "description": "How this supports development"
    },
    {
      "text": "Mindfulness-focused question",
      "category": "mindfulness",
      "icon": "fa-leaf", 
      "description": "Why this promotes awareness"
    }
  ],
  "theme": {
    "title": "Daily Reflection Theme",
    "description": "How these prompts work together"
  }
}`;

    const responseText = await openaiService.callOpenAI(prompt);
    const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const promptsData = JSON.parse(cleanContent);

    if (!promptsData.prompts || !Array.isArray(promptsData.prompts) || !promptsData.theme) {
      throw new Error('Invalid AI response structure');
    }

    // Save reflection prompts
    const promptsRef = db.collection('reflection-prompts').doc(`${userId}_${dateKey}`);
    const reflectionPrompts = {
      userId,
      date: dateKey,
      dateKey: dateKey,
      ...promptsData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source: 'ai_batch',
      model: 'gpt-4o',
      userInfo: {
        journeyDay: userData.currentDay || 1,
        focusAreas: userData.focusAreas || []
      },
      batchGenerated: true
    };

    await promptsRef.set(reflectionPrompts);
    
    return {success: true};

  } catch (error) {
    console.error(`Error generating reflection prompts for user ${userId}:`, error);
    return {success: false, error: (error as Error).message};
  }
}

/**
 * SCHEDULER: Queue suggestion generation jobs for users at midnight in their timezone
 * Runs every hour to check which users have passed midnight since last run
 */
export const queueDailyTrackerSuggestions = onSchedule({
  schedule: '0 * * * *', // Every hour at minute 0
}, async () => {
  const db = getFirestore();
  try {
    console.log('Starting daily tracker suggestions job queueing...');
    
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    console.log(`Current UTC time: ${now.toISOString()}, hour: ${currentHourUTC}`);
    
    // Find users where it's currently between midnight and 1am in their timezone
    // This ensures we catch users even if the scheduler doesn't run exactly at midnight
    const usersSnapshot = await db.collection('users')
      .where('isOnboardingComplete', '==', true)
      .where('status', '==', 'active')
      .get();
    
    let queuedJobs = 0;
    let processedUsers = 0;
    let skippedUsers = 0;
    
    // Process in smaller batches to avoid memory issues
    const userDocs = usersSnapshot.docs;
    const batchSize = 50;
    
    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userDoc) => {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const userTimezone = userData.preferences?.timezone || 'UTC';
          
          // Check if it's currently between midnight and 1am in user's timezone
          const userMidnightStatus = getUserMidnightStatus(userTimezone, now);
          
          if (!userMidnightStatus.isInMidnightWindow) {
            skippedUsers++;
            return 0; // Not midnight window for this user
          }
          
          const userDateKey = userMidnightStatus.dateKey;
          const lastSuggestionsDate = userData.lastSuggestionsGeneratedDate;
          
          // Check if we've already generated suggestions for this date
          if (lastSuggestionsDate === userDateKey) {
            console.log(`User ${userId} already has suggestions for ${userDateKey}, skipping`);
            skippedUsers++;
            return 0;
          }
          
          console.log(`Queueing jobs for user ${userId} - midnight in ${userTimezone}, date: ${userDateKey}`);
          
          // Get user's active trackers
          const trackersSnapshot = await db.collection('trackers')
            .where('userId', '==', userId)
            .where('isActive', '==', true)
            .get();
          
          let userJobs = 0;
          const batch = db.batch();
          
          for (const trackerDoc of trackersSnapshot.docs) {
            const trackerId = trackerDoc.id;
            
            // Create a job in the suggestion-jobs queue
            const jobRef = db.collection('suggestion-jobs').doc();
            batch.set(jobRef, {
              userId,
              trackerId,
              dateKey: userDateKey,
              userTimezone,
              status: 'queued',
              priority: 1, // Daily suggestions are high priority
              attempts: 0,
              maxAttempts: 3,
              createdAt: FieldValue.serverTimestamp(),
              scheduledFor: FieldValue.serverTimestamp() // Process immediately
            });
            
            userJobs++;
          }
          
          if (userJobs > 0) {
            // Update user's last suggestions generated date
            batch.update(db.collection('users').doc(userId), {
              lastSuggestionsGeneratedDate: userDateKey,
              lastSuggestionsGeneratedAt: FieldValue.serverTimestamp()
            });
            
            await batch.commit();
          }
          
          return userJobs;
          
        } catch (userError) {
          console.error(`Error queueing jobs for user ${userDoc.id}:`, userError);
          return 0;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        processedUsers++;
        if (result.status === 'fulfilled') {
          queuedJobs += result.value;
        }
      });
      
      let batchJobCount = 0;
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          batchJobCount += result.value || 0;
        }
      });
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}: ${batch.length} users, ${batchJobCount} jobs queued, ${skippedUsers} skipped`);
    }
    
    console.log(`Daily suggestions job queueing completed. Processed: ${processedUsers} users, Queued: ${queuedJobs} jobs`);
    
    // Trigger the worker to start processing jobs
    if (queuedJobs > 0) {
      console.log('Triggering suggestion generation worker...');
      await db.collection('worker-triggers').add({
        type: 'process-suggestion-jobs',
        triggeredAt: FieldValue.serverTimestamp(),
        pendingJobs: queuedJobs
      });
    }
    
  } catch (error) {
    console.error('Error during daily suggestions job queueing:', error);
  }
});

/**
 * WORKER: Process suggestion generation jobs from the queue
 * Processes jobs one at a time to avoid timeouts, can be triggered multiple times
 */
export const processSuggestionJobs = onCall({
  maxInstances: 3, // Allow multiple workers to run concurrently
  timeoutSeconds: 300, // 5 minutes timeout
  secrets: [openaiApiKey],
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {data} = request;
  const batchSize = data?.batchSize || 5; // Process 5 jobs at a time
  
  try {
    console.log(`Processing suggestion jobs - batch size: ${batchSize}`);
    
    // Get oldest queued jobs
    const jobsSnapshot = await db.collection('suggestion-jobs')
      .where('status', '==', 'queued')
      .orderBy('createdAt', 'asc')
      .limit(batchSize)
      .get();
    
    if (jobsSnapshot.empty) {
      console.log('No queued suggestion jobs found');
      return {processed: 0, message: 'No jobs to process'};
    }
    
    let processedJobs = 0;
    let successfulJobs = 0;
    
    for (const jobDoc of jobsSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      
      try {
        // Mark job as processing
        await jobDoc.ref.update({
          status: 'processing',
          attempts: FieldValue.increment(1),
          startedAt: FieldValue.serverTimestamp()
        });
        
        console.log(`Processing job ${jobId}: user ${job.userId}, tracker ${job.trackerId}`);
        
        // Generate the suggestion using the same comprehensive logic as getTrackerSpecificSuggestions
        const result = await callTrackerSpecificSuggestionsForBatch(
          db,
          job.userId,
          job.trackerId
        );
        
        if (result.success) {
          // Mark job as completed
          await jobDoc.ref.update({
            status: 'completed',
            completedAt: FieldValue.serverTimestamp(),
            result: 'success'
          });
          successfulJobs++;
          console.log(`✅ Successfully processed job ${jobId}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (jobError) {
        console.error(`❌ Error processing job ${jobId}:`, jobError);
        
        // Check if we should retry or mark as failed
        const attempts = job.attempts + 1;
        if (attempts >= job.maxAttempts) {
          await jobDoc.ref.update({
            status: 'failed',
            failedAt: FieldValue.serverTimestamp(),
            error: (jobError as Error).message,
            finalAttempt: attempts
          });
          console.log(`Job ${jobId} failed after ${attempts} attempts`);
        } else {
          await jobDoc.ref.update({
            status: 'queued', // Retry later
            error: (jobError as Error).message,
            lastAttemptAt: FieldValue.serverTimestamp()
          });
          console.log(`Job ${jobId} will be retried (attempt ${attempts}/${job.maxAttempts})`);
        }
      }
      
      processedJobs++;
    }
    
    console.log(`Batch processing completed: ${processedJobs} jobs processed, ${successfulJobs} successful`);
    
    // Check if there are more jobs to process
    const remainingJobsSnapshot = await db.collection('suggestion-jobs')
      .where('status', '==', 'queued')
      .limit(1)
      .get();
    
    const hasMoreJobs = !remainingJobsSnapshot.empty;
    
    return {
      processed: processedJobs,
      successful: successfulJobs,
      hasMoreJobs,
      message: `Processed ${processedJobs} jobs, ${successfulJobs} successful`
    };
    
  } catch (error) {
    console.error('Error in suggestion job worker:', error);
    throw new HttpsError('internal', 'Failed to process suggestion jobs');
  }
});

/**
 * AUTO-TRIGGER: Automatically process more jobs when jobs are available
 * Triggered by Firestore changes to keep the queue moving
 */
export const onSuggestionJobCreated = onDocumentCreated(
  'suggestion-jobs/{jobId}',
  async () => {
    const db = getFirestore();
    
    try {
      // Small delay to let other jobs accumulate
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if there are multiple queued jobs to process
      const queuedJobsSnapshot = await db.collection('suggestion-jobs')
        .where('status', '==', 'queued')
        .limit(10)
        .get();
      
      if (queuedJobsSnapshot.size >= 3) {
        console.log(`Auto-triggering job processing for ${queuedJobsSnapshot.size} queued jobs`);
        
        // Trigger worker by creating a trigger document (avoid direct function calls)
        await db.collection('worker-triggers').add({
          type: 'process-suggestion-jobs',
          triggeredAt: FieldValue.serverTimestamp(),
          pendingJobs: queuedJobsSnapshot.size,
          batchSize: 5
        });
      }
      
    } catch (error) {
      console.error('Error in auto-trigger for suggestion jobs:', error);
    }
  }
);

/**
 * Generate a single tracker suggestion for the job queue system
 */

/**
 * Get user's midnight status including date key and if they're in midnight window
 * Returns object with:
 * - isInMidnightWindow: true if current time is between midnight and 1am in user's timezone
 * - dateKey: the date (YYYY-MM-DD) in user's timezone
 */
function getUserMidnightStatus(userTimezone: string, currentUTC: Date): { isInMidnightWindow: boolean; dateKey: string } {
  try {
    // Handle UTC case
    if (!userTimezone || userTimezone === 'UTC') {
      const hour = currentUTC.getUTCHours();
      const dateKey = currentUTC.toISOString().split('T')[0];
      return {
        isInMidnightWindow: hour === 0, // Midnight hour in UTC
        dateKey
      };
    }
    
    // Get current time in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(currentUTC);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    
    const dateKey = `${year}-${month}-${day}`;
    
    return {
      isInMidnightWindow: hour === 0, // Between midnight and 1am
      dateKey
    };
    
  } catch (error) {
    console.warn(`Invalid timezone ${userTimezone}, falling back to UTC`, error);
    const hour = currentUTC.getUTCHours();
    const dateKey = currentUTC.toISOString().split('T')[0];
    return {
      isInMidnightWindow: hour === 0,
      dateKey
    };
  }
}

/**
 * Get user's current date and time formatted for their timezone
 * Returns object with formatted date/time and day of week
 */
function getUserCurrentDateTime(userTimezone: string): { formattedDateTime: string; dayOfWeek: string; dateKey: string } {
  try {
    const now = new Date();
    
    // Fallback to NYC time if no timezone provided
    const effectiveTimezone = userTimezone || 'America/New_York';
    
    // Get formatted date in user's timezone (or NYC fallback)
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    
    const dateParts = dateFormatter.formatToParts(now);
    const year = dateParts.find(p => p.type === 'year')?.value;
    const month = dateParts.find(p => p.type === 'month')?.value;
    const day = dateParts.find(p => p.type === 'day')?.value;
    const dayOfWeek = dateParts.find(p => p.type === 'weekday')?.value || 'Unknown';
    
    // Get numeric month and day for dateKey
    const numericDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const numericParts = numericDateFormatter.formatToParts(now);
    const numericYear = numericParts.find(p => p.type === 'year')?.value;
    const numericMonth = numericParts.find(p => p.type === 'month')?.value;
    const numericDay = numericParts.find(p => p.type === 'day')?.value;
    const dateKey = `${numericYear}-${numericMonth}-${numericDay}`;
    
    return {
      formattedDateTime: `${month} ${day}, ${year}`,
      dayOfWeek,
      dateKey
    };
    
  } catch (error) {
    console.warn(`Invalid timezone ${userTimezone}, falling back to NYC time`, error);
    // Fallback to NYC time instead of UTC
    try {
      const now = new Date();
      const nycFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
      
      const dateParts = nycFormatter.formatToParts(now);
      const year = dateParts.find(p => p.type === 'year')?.value;
      const month = dateParts.find(p => p.type === 'month')?.value;
      const day = dateParts.find(p => p.type === 'day')?.value;
      const dayOfWeek = dateParts.find(p => p.type === 'weekday')?.value || 'Unknown';
      
      // Get dateKey for NYC time
      const numericFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const numericParts = numericFormatter.formatToParts(now);
      const numericYear = numericParts.find(p => p.type === 'year')?.value;
      const numericMonth = numericParts.find(p => p.type === 'month')?.value;
      const numericDay = numericParts.find(p => p.type === 'day')?.value;
      const dateKey = `${numericYear}-${numericMonth}-${numericDay}`;
      
      return {
        formattedDateTime: `${month} ${day}, ${year}`,
        dayOfWeek,
        dateKey
      };
    } catch (nycError) {
      // Final fallback to UTC if NYC time also fails
      console.error('Failed to get NYC time, falling back to UTC', nycError);
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getUTCDay()];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const month = monthNames[now.getUTCMonth()];
      const day = now.getUTCDate();
      const year = now.getUTCFullYear();
      return {
        formattedDateTime: `${month} ${day}, ${year}`,
        dayOfWeek,
        dateKey
      };
    }
  }
}

/**
 * Update user subscription status
 * Call this when user subscribes, trial expires, or cancels subscription
 */
export const updateUserSubscriptionStatus = onCall({
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth, data} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {subscriptionType, status, trialEndsAt} = data;
  const userId = auth.uid;

  try {
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp()
    };

    // Update subscription fields
    if (subscriptionType) {
      updateData.subscriptionType = subscriptionType;
    }
    if (status) {
      updateData.status = status;
    }
    if (trialEndsAt) {
      updateData.trialEndsAt = new Date(trialEndsAt);
    }

    await db.collection('users').doc(userId).update(updateData);

    console.log(`Updated subscription status for user ${userId}:`, {subscriptionType, status});

    return {success: true, message: 'Subscription status updated'};

  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw new HttpsError('internal', 'Failed to update subscription status');
  }
});

/**
 * Check and update expired trials
 * Runs daily to check for expired trials and update user status
 */
export const checkExpiredTrials = onSchedule('0 3 * * *', async () => {
  const db = getFirestore();
  try {
    console.log('Checking for expired trials...');
    
    const now = new Date();
    
    // Find users with expired trials
    const expiredTrialsSnapshot = await db.collection('users')
      .where('subscriptionType', '==', 'trial')
      .where('status', '==', 'active')
      .where('trialEndsAt', '<=', now)
      .get();

    if (expiredTrialsSnapshot.empty) {
      console.log('No expired trials found');
      return;
    }

    const batch = db.batch();
    let processedUsers = 0;

    expiredTrialsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'inactive', // Deactivate AI suggestions
        subscriptionType: 'expired', // Mark as expired trial
        updatedAt: FieldValue.serverTimestamp()
      });
      processedUsers++;
    });

    await batch.commit();

    console.log(`Processed ${processedUsers} expired trials`);

  } catch (error) {
    console.error('Error checking expired trials:', error);
  }
});

/**
 * Scheduled function to clean up old suggestion cache entries
 * Runs daily at 2:00 AM UTC to clean up suggestions older than their retention period
 */
export const cleanupOldSuggestions = onSchedule('0 2 * * *', async () => {
  const db = getFirestore();
  try {
    console.log('Starting cleanup of old suggestions...');
    
    // Calculate cutoff dates
    const now = new Date();
    
    // Daily suggestions: keep 7 days
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyCutoffDate = sevenDaysAgo.toISOString().split('T')[0];
    
    // Tracker-specific suggestions: keep 35 days (30 + 5 buffer)
    const thirtyFiveDaysAgo = new Date(now);
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
    const trackerCutoffDate = thirtyFiveDaysAgo.toISOString().split('T')[0];
    
    console.log('Cleaning up daily suggestions older than:', dailyCutoffDate);
    console.log('Cleaning up tracker-specific suggestions older than:', trackerCutoffDate);
    
    let totalDeleted = 0;
    
    // Clean up daily suggestions
    let hasMore = true;
    while (hasMore) {
      const oldSuggestionsQuery = await db.collection('daily-suggestions')
        .where('dateKey', '<', dailyCutoffDate)
        .limit(100)
        .get();
      
      if (oldSuggestionsQuery.empty) {
        hasMore = false;
        break;
      }
      
      const batch = db.batch();
      oldSuggestionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += oldSuggestionsQuery.size;
      
      console.log(`Deleted batch of ${oldSuggestionsQuery.size} old daily suggestions`);
      
      if (oldSuggestionsQuery.size < 100) {
        hasMore = false;
      }
    }
    
    // Clean up tracker-specific suggestions
    hasMore = true;
    let trackerSuggestionsDeleted = 0;
    
    while (hasMore) {
      const oldTrackerSuggestionsQuery = await db.collection('tracker-specific-suggestions')
        .where('dateKey', '<', trackerCutoffDate)
        .limit(100)
        .get();
      
      if (oldTrackerSuggestionsQuery.empty) {
        hasMore = false;
        break;
      }
      
      const batch = db.batch();
      oldTrackerSuggestionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      trackerSuggestionsDeleted += oldTrackerSuggestionsQuery.size;
      totalDeleted += oldTrackerSuggestionsQuery.size;
      
      console.log(`Deleted batch of ${oldTrackerSuggestionsQuery.size} old tracker-specific suggestions`);
      
      if (oldTrackerSuggestionsQuery.size < 100) {
        hasMore = false;
      }
    }
    
    console.log(`Suggestions cleanup completed. Total deleted: ${totalDeleted} (Daily: ${totalDeleted - trackerSuggestionsDeleted}, Tracker-specific: ${trackerSuggestionsDeleted})`);
    
  } catch (error) {
    console.error('Error during suggestions cleanup:', error);
  }
});

/**
 * Clean up duplicate trackers for users who experienced the duplication bug
 */
export const cleanupDuplicateTrackers = onCall({
  cors: true,
  invoker: 'public',
}, async (request) => {
  const db = getFirestore();
  const {auth} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = auth.uid;

  try {
    // Get all user's trackers
    const trackersSnapshot = await db.collection('trackers')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const trackers = trackersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{id: string; name: string; createdAt: any}>;

    // Group trackers by name to find duplicates
    const trackerGroups: {[name: string]: any[]} = {};
    trackers.forEach(tracker => {
      if (!trackerGroups[tracker.name]) {
        trackerGroups[tracker.name] = [];
      }
      trackerGroups[tracker.name].push(tracker);
    });

    const batch = db.batch();
    let deletedCount = 0;

    // For each group with duplicates, keep the most recent one
    Object.values(trackerGroups).forEach((groupTrackers) => {
      if (groupTrackers.length > 1) {
        // Sort by creation date, keep the newest
        groupTrackers.sort((a, b) => 
          new Date(b.createdAt?.toDate() || b.createdAt).getTime() - 
          new Date(a.createdAt?.toDate() || a.createdAt).getTime()
        );

        // Delete all but the first (newest) tracker
        for (let i = 1; i < groupTrackers.length; i++) {
          const trackerRef = db.collection('trackers').doc(groupTrackers[i].id);
          batch.update(trackerRef, {isActive: false});
          deletedCount++;
        }
      }
    });

    await batch.commit();

    return {
      success: true,
      message: `Cleaned up ${deletedCount} duplicate trackers`,
      deletedCount
    };

  } catch (error) {
    console.error('Error cleaning up duplicate trackers:', error);
    throw new HttpsError('internal', 'Failed to cleanup duplicate trackers');
  }
});

// ===============================
// AUTOMATIC TRIGGERS
// ===============================

/**
 * Auto-trigger when tracker entry is created
 */
export const onTrackerEntryCreated = onDocumentCreated(
  'tracker-entries/{entryId}',
  async (event) => {
    const db = getFirestore();
    const entry = event.data?.data();
    if (!entry) return;

    const {userId, trackerId} = entry;

    try {
      // Update user stats
      await db.collection('users').doc(userId).update({
        'stats.totalTrackerEntries': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update tracker stats
      await updateTrackerStats(trackerId);

      // Check for achievements
      await checkAchievements(userId);

      // Update streaks
      await calculateUserStreaks(userId);

    } catch (error) {
      console.error('Error processing tracker entry:', error);
    }
  }
);

/**
 * Auto-check expired trackers daily
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const checkExpiredTrackers = onCall(async (_request) => {
  const db = getFirestore();
  try {
    const now = new Date();
    
    // Get all active, non-ongoing trackers that have expired
    const expiredTrackers = await db.collection('trackers')
      .where('isActive', '==', true)
      .where('isOngoing', '==', false)
      .where('isCompleted', '==', false)
      .where('endDate', '<=', now)
      .get();

    const batch = db.batch();

    expiredTrackers.docs.forEach(doc => {
      batch.update(doc.ref, {
        isCompleted: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return {processedTrackers: expiredTrackers.size};

  } catch (error) {
    console.error('Error checking expired trackers:', error);
    throw new HttpsError('internal', 'Failed to check expired trackers');
  }
});

// ===============================
// HELPER FUNCTIONS
// ===============================

// Template function now uses centralized config - no local implementation needed

function generateDefaultTrackers(userId: string, focusAreas: string[], commitmentLevel: string) {
  const basicTrackers = [];
  
  // Basic mood tracker for everyone
  const moodTracker = createTrackerFromTemplate('mood', userId, {}, FieldValue.serverTimestamp());
  if (moodTracker) basicTrackers.push(moodTracker);

  // Add focus area specific trackers using centralized templates
  if (focusAreas.includes('MIND')) {
    const meditationTracker = createTrackerFromTemplate('meditation', userId, {
      target: commitmentLevel === 'intensive' ? 20 : commitmentLevel === 'moderate' ? 10 : 5
    }, FieldValue.serverTimestamp());
    if (meditationTracker) basicTrackers.push(meditationTracker);
  }

  if (focusAreas.includes('BODY')) {
    const exerciseTracker = createTrackerFromTemplate('exercise', userId, {
      target: commitmentLevel === 'intensive' ? 6 : commitmentLevel === 'moderate' ? 4 : 3
    }, FieldValue.serverTimestamp());
    if (exerciseTracker) basicTrackers.push(exerciseTracker);
  }

  if (focusAreas.includes('SOUL')) {
    const gratitudeTracker = createTrackerFromTemplate('gratitude', userId, {}, FieldValue.serverTimestamp());
    if (gratitudeTracker) basicTrackers.push(gratitudeTracker);
  }

  if (focusAreas.includes('BEAUTY')) {
    const skincareTracker = createTrackerFromTemplate('skincare', userId, {}, FieldValue.serverTimestamp());
    if (skincareTracker) basicTrackers.push(skincareTracker);
  }

  return basicTrackers;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function calculateUserStreaks(_userId: string) {
  // Complex streak calculation logic here
  // This would analyze tracker entries and calculate current streaks
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkAchievements(_userId: string) {
  // Achievement checking logic here
  // This would check various conditions and unlock achievements
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateTrackerStats(_trackerId: string) {
  // Update tracker-specific statistics
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function triggerWelcomeSequence(_userId: string, _displayName: string) {
  // Send welcome email, schedule onboarding reminders, etc.
} 

/**
 * Calculate comprehensive analytics for a specific tracker
 */
async function calculateTrackerAnalytics(db: any, trackerId: string, userId: string, days: number, trackerData?: any) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateKey = startDate.toISOString().split('T')[0];

  // Get all entries for this tracker in the last N days
  const entriesSnapshot = await db.collection('tracker-entries')
    .where('trackerId', '==', trackerId)
    .where('userId', '==', userId)
    .where('date', '>=', startDateKey)
    .orderBy('date', 'desc')
    .get();

  const entries = entriesSnapshot.docs.map((doc: any) => doc.data());
  
  // Return simple state for no entries instead of fake data
  if (entries.length === 0) {
    return {
      hasEntries: false,
      totalEntries: 0
    };
  }

  // Calculate real analytics only when we have actual data
  const completionRate = Math.round((entries.length / days) * 100);

  // Calculate frequency-aware streaks using tracker's frequency
  const trackerFrequency = trackerData?.frequency || TrackerFrequency.DAILY;
  const {currentStreak, longestStreak} = calculateStreaks(entries, days, trackerFrequency);

  // Calculate averages
  const averageValue = entries.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0) / entries.length;
  const averageMood = entries.filter((e: any) => e.mood).reduce((sum: number, entry: any) => sum + entry.mood, 0) / 
                     Math.max(entries.filter((e: any) => e.mood).length, 1);
  const averageEnergy = entries.filter((e: any) => e.energy).reduce((sum: number, entry: any) => sum + entry.energy, 0) / 
                       Math.max(entries.filter((e: any) => e.energy).length, 1);

  // Analyze day patterns
  const dayStats = analyzeDayPatterns(entries);
  
  // Determine trend
  const recentEntries = entries.slice(0, 7);
  const olderEntries = entries.slice(-7);
  const recentAvg = recentEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0) / Math.max(recentEntries.length, 1);
  const olderAvg = olderEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0) / Math.max(olderEntries.length, 1);
  
  let trend = 'stable';
  if (recentAvg > olderAvg * 1.1) trend = 'improving';
  else if (recentAvg < olderAvg * 0.9) trend = 'declining';

  return {
    hasEntries: true,
    totalEntries: entries.length,
    completionRate,
    currentStreak,
    longestStreak,
    averageValue: Math.round(averageValue * 10) / 10,
    bestDays: dayStats.best,
    challengingDays: dayStats.challenging,
    trend,
    averageMood: Math.round(averageMood * 10) / 10,
    averageEnergy: Math.round(averageEnergy * 10) / 10
  };
}

/**
 * Calculate current and longest streaks - FREQUENCY AWARE
 */
function calculateStreaks(entries: any[], totalDays: number, frequency: TrackerFrequency = TrackerFrequency.DAILY) {
  if (entries.length === 0) return {currentStreak: 0, longestStreak: 0};

  // Sort entries by date
  const sortedEntries = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  switch (frequency) {
  case TrackerFrequency.DAILY:
    return calculateDailyStreaks(sortedEntries, totalDays);
  case TrackerFrequency.WEEKLY:
    return calculateWeeklyStreaks(sortedEntries);
  case TrackerFrequency.MONTHLY:
    return calculateMonthlyStreaks(sortedEntries);
  default:
    return calculateDailyStreaks(sortedEntries, totalDays);
  }
}

/**
 * Calculate daily streaks (original logic)
 */
function calculateDailyStreaks(sortedEntries: any[], totalDays: number) {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Check for current streak starting from today
  const today = new Date();
  let checkDate = new Date(today);
  
  for (let i = 0; i < totalDays; i++) {
    const dateKey = checkDate.toISOString().split('T')[0];
    const hasEntry = sortedEntries.some(entry => entry.date === dateKey);
    
    if (hasEntry) {
      if (i === 0 || currentStreak > 0) currentStreak++;
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === 0) currentStreak = 0;
      tempStreak = 0;
    }
    
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {currentStreak, longestStreak};
}

/**
 * Calculate weekly streaks - must have at least one entry per week
 */
function calculateWeeklyStreaks(sortedEntries: any[]) {
  let currentStreak = 0;
  let longestStreak = 0;

  // Group entries by week (ISO week)
  const entriesByWeek = new Map<string, any[]>();
  
  sortedEntries.forEach(entry => {
    const entryDate = new Date(entry.date);
    const weekKey = getISOWeek(entryDate);
    
    if (!entriesByWeek.has(weekKey)) {
      entriesByWeek.set(weekKey, []);
    }
    entriesByWeek.get(weekKey)!.push(entry);
  });

  // Calculate current streak
  const currentWeek = getISOWeek(new Date());
  const lastWeek = getISOWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  
  if (entriesByWeek.has(currentWeek)) {
    currentStreak = 1;
    let checkWeek = getPreviousWeek(currentWeek);
    
    while (entriesByWeek.has(checkWeek) && currentStreak < 52) { // Max 1 year
      currentStreak++;
      checkWeek = getPreviousWeek(checkWeek);
    }
  } else if (entriesByWeek.has(lastWeek)) {
    currentStreak = 1;
    let checkWeek = getPreviousWeek(lastWeek);
    
    while (entriesByWeek.has(checkWeek) && currentStreak < 52) {
      currentStreak++;
      checkWeek = getPreviousWeek(checkWeek);
    }
  }

  // Calculate longest streak
  const sortedWeeks = Array.from(entriesByWeek.keys()).sort();
  let tempStreak = 0;
  let lastWeekKey = '';
  
  for (const weekKey of sortedWeeks) {
    if (!lastWeekKey || isConsecutiveWeek(lastWeekKey, weekKey)) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
    lastWeekKey = weekKey;
  }

  return {currentStreak, longestStreak};
}

/**
 * Calculate monthly streaks - must have at least one entry per month
 */
function calculateMonthlyStreaks(sortedEntries: any[]) {
  let currentStreak = 0;
  let longestStreak = 0;

  // Group entries by month
  const entriesByMonth = new Map<string, any[]>();
  
  sortedEntries.forEach(entry => {
    const entryDate = new Date(entry.date);
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (!entriesByMonth.has(monthKey)) {
      entriesByMonth.set(monthKey, []);
    }
    entriesByMonth.get(monthKey)!.push(entry);
  });

  // Calculate current streak
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`;
  
  if (entriesByMonth.has(currentMonth)) {
    currentStreak = 1;
    let checkMonth = getPreviousMonth(currentMonth);
    
    while (entriesByMonth.has(checkMonth) && currentStreak < 24) { // Max 2 years
      currentStreak++;
      checkMonth = getPreviousMonth(checkMonth);
    }
  } else if (entriesByMonth.has(lastMonth)) {
    currentStreak = 1;
    let checkMonth = getPreviousMonth(lastMonth);
    
    while (entriesByMonth.has(checkMonth) && currentStreak < 24) {
      currentStreak++;
      checkMonth = getPreviousMonth(checkMonth);
    }
  }

  // Calculate longest streak
  const sortedMonths = Array.from(entriesByMonth.keys()).sort();
  let tempStreak = 0;
  let lastMonthKey = '';
  
  for (const monthKey of sortedMonths) {
    if (!lastMonthKey || isConsecutiveMonth(lastMonthKey, monthKey)) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
    lastMonthKey = monthKey;
  }

  return {currentStreak, longestStreak};
}

// Helper functions for frequency-aware streak calculation

function getISOWeek(date: Date): string {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
  const week1 = new Date(temp.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${temp.getFullYear()}-${String(weekNumber).padStart(2, '0')}`;
}

function getPreviousWeek(weekKey: string): string {
  const [year, week] = weekKey.split('-').map(Number);
  const date = getDateFromWeek(year, week);
  date.setDate(date.getDate() - 7);
  return getISOWeek(date);
}

function getPreviousMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  } else {
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }
}

function isConsecutiveWeek(week1: string, week2: string): boolean {
  const date1 = getDateFromWeek(...week1.split('-').map(Number) as [number, number]);
  const date2 = getDateFromWeek(...week2.split('-').map(Number) as [number, number]);
  const daysDiff = Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff === 7;
}

function isConsecutiveMonth(month1: string, month2: string): boolean {
  const [year1, m1] = month1.split('-').map(Number);
  const [year2, m2] = month2.split('-').map(Number);
  
  if (year1 === year2) {
    return Math.abs(m2 - m1) === 1;
  } else if (year2 === year1 + 1) {
    return m1 === 12 && m2 === 1;
  } else if (year1 === year2 + 1) {
    return m2 === 12 && m1 === 1;
  }
  
  return false;
}

function getDateFromWeek(year: number, week: number): Date {
  const date = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

/**
 * Analyze which days of the week are best/challenging
 */
function analyzeDayPatterns(entries: any[]) {
  const dayCount: {[key: number]: number} = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}; // Sunday = 0
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  entries.forEach(entry => {
    const dayOfWeek = new Date(entry.date).getDay();
    dayCount[dayOfWeek]++;
  });

  const sortedDays = Object.entries(dayCount)
    .sort(([,a], [,b]) => b - a)
    .map(([day,]) => dayNames[parseInt(day)]);

  return {
    best: sortedDays.slice(0, 2),
    challenging: sortedDays.slice(-2).reverse()
  };
} 

/**
 * Wrapper function to call getTrackerSpecificSuggestions logic from batch processing
 * This allows the batch system to use the same comprehensive logic as the on-demand system
 */
async function callTrackerSpecificSuggestionsForBatch(
  db: any,
  userId: string,
  trackerId: string
): Promise<{success: boolean; error?: string}> {
  try {
    // Create a mock request object that matches the Cloud Function interface
    const mockRequest = {
      auth: {uid: userId},
      data: {
        trackerId: trackerId,
        forceRefresh: false // Don't force refresh for batch generation
      }
    };
    
    // Call the same handler function that getTrackerSpecificSuggestions uses
    const handler = (getTrackerSpecificSuggestions as any).handler;
    await handler(mockRequest);
    
    return {success: true};
  } catch (error) {
    console.error(`Error calling tracker suggestions for batch - user ${userId}, tracker ${trackerId}:`, error);
    return {success: false, error: (error as Error).message};
  }
} 