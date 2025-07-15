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
        totalMeditationMinutes: 0,
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

  const {statType, value} = data;
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
    case 'meditationMinutes':
      updateData['stats.totalMeditationMinutes'] = FieldValue.increment(value);
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
 * Generate tracker-specific AI suggestions with 30-day context
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
        const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
        const userName = userData.displayName || 'Champion';
        
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

${userName.toUpperCase()}'S TRACKER:
- Name: ${trackerData.name}
- Goal: ${trackerData.target} ${trackerData.unit} ${trackerData.frequency}
- Category: ${trackerData.category}
- Today: ${today}
- ${journeyInfo}

${userName.toUpperCase()}'S PROFILE:
${userAge ? `- Age: ${userAge} years old` : ''}
${userGender ? `- Gender: ${userGender}` : ''}
- Focus Areas: ${(userData.focusAreas || []).join(', ')}
- Commitment Level: ${userData.commitmentLevel || 'moderate'}

TRACKING HISTORY:`;

        if (isNewTracker) {
          prompt += `
- ${userName} just created this tracker and hasn't logged any entries yet! 🚀
- This is their chance to start strong and build momentum
- Focus on getting that first log entry today`;
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
- NEVER start with "Since today is Monday and you usually..." if there's no performance data
- Vary your opening structures: "What if...", "Try this...", "Here's something fun...", "Challenge yourself...", "${userName}, imagine if..."
- Avoid repetitive time-based patterns unless you have actual data about their best performing days
- Focus on creative approaches rather than generic "start your day by..." advice
- Make each action feel completely different from previous ones

YOUR COACHING MISSION:
${isNewTracker?
    `- Name: ${trackerData.name}
- Goal: ${trackerData.target} ${trackerData.unit} ${trackerData.frequency}
- Category: ${trackerData.category}
- Today: ${today}
- ${journeyInfo}
Help ${userName} get excited and take their FIRST step (they haven't started yet)! Focus on encouragement, making it easy to start, and building confidence.`
    : `Analyze ${userName}'s patterns and give them personalized insights to improve their ${trackerData.name.toLowerCase()} habit.`
}

YOUR PERSONALITY:
- Fun, witty, and encouraging - like an enthusiastic friend who's also a wellness expert
- Add clever wordplay and unexpected analogies
- ${isNewTracker ? 'Focus on getting started and building momentum' : 'Reference their actual data and patterns'}

COACHING STYLE:
- Feel free to use ${userName}'s name when appropriate, don't make it sound forced.
- Keep it engaging for everyone with humor and motivation
- Use playful language and creative metaphors
- Be encouraging but never boring or generic
- Mix practical advice with wit and charm
- Naturally consider their demographics (age, gender) when making suggestions (activities, references, energy levels, communication style) but don't mention demographics explicitly
- Tailor examples and metaphors to resonate naturally with their background

Return ONLY a JSON object:
{
  "todayAction": {
    "text": "${isNewTracker ? `Encouraging advice for ${userName} to log their first entry today` : `Specific action for ${userName} today based on their patterns`}",
    "icon": "${isNewTracker ? '🚀' : '📅'}",
    "reason": "${isNewTracker ? `Why this first step will set ${userName} up for success` : `Why this will work for ${userName} specifically`}"
  },
  "suggestions": [
    {
      "text": "${isNewTracker ? `Practical tip for ${userName} to build this new habit` : `Insight about ${userName}'s patterns with helpful advice`}",
      "type": "${isNewTracker ? 'getting_started' : 'performance'}",
      "icon": "relevant emoji",
      "dataPoint": "${isNewTracker ? 'Fresh start' : 'Use actual data like: completion_rate_75%, current_streak_5_days, avg_value_8.2, trend_improving, best_days_monday_tuesday, etc.'}"
    }
  ],
  "motivationalQuote": {
    "text": "Custom made motivational quip that feels personal to ${userName}",
    "author": "Your Personal Coach",
    "context": "${isNewTracker ? `Perfect for ${userName} starting their ${trackerData.name.toLowerCase()} journey` : `Why this quote applies to ${userName}'s current progress`}"
  }
}

🎨 MOTIVATIONAL QUOTE CREATIVITY REQUIREMENTS:
- NEVER use the same structure twice - vary the format completely each time
- Alternative formats: Questions ("What if...?"), Declarations ("Today..."), Metaphors ("Like a...")
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

        const responseText = await (openaiService as any).callOpenAI(prompt);
                
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
        
        console.log(`Processing job ${jobId}: user ${job.userId}, tracker ${job.trackerId}`);
        
        // Generate the suggestion using existing logic
        const result = await generateSingleTrackerSuggestion(
          db,
          job.userId,
          job.trackerId,
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
async function generateSingleTrackerSuggestion(
  db: any,
  userId: string,
  trackerId: string,
  dateKey: string,
  openaiService: any
): Promise<{success: boolean; error?: string}> {
  try {
    // Get user and tracker data
    const [userDoc, trackerDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('trackers').doc(trackerId).get()
    ]);

    if (!userDoc.exists || !trackerDoc.exists) {
      throw new Error('User or tracker not found');
    }

    const userData = userDoc.data();
    const trackerData = trackerDoc.data();

    // Verify tracker belongs to user
    if (trackerData.userId !== userId) {
      throw new Error('Tracker does not belong to user');
    }

    // Calculate tracker analytics
    const trackerAnalytics = await calculateTrackerAnalytics(db, trackerId, userId, 30, trackerData);
    const isNewTracker = trackerAnalytics.hasEntries === false;

    // Get previous suggestions to avoid repetition (limited for performance)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const previousSuggestionsQuery = await db.collection('tracker-specific-suggestions')
      .where('userId', '==', userId)
      .where('trackerId', '==', trackerId)
      .where('dateKey', '>=', thirtyDaysAgo.toISOString().split('T')[0])
      .where('dateKey', '<', dateKey)
      .orderBy('dateKey', 'desc')
      .limit(5) // Reduced for performance
      .get();

    const previousSuggestions: string[] = [];
    previousSuggestionsQuery.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.todayAction?.text) {
        previousSuggestions.push(data.todayAction.text);
      }
    });

    // Generate AI suggestions with simplified prompt
    const userName = userData.displayName || 'Champion';
    
    // Calculate user demographics
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

    // Simplified prompt for batch processing
    const prompt = `You are ${userName}'s personal wellness coach. Generate a brief daily suggestion for their ${trackerData.name} tracker.

USER: ${userName}
${userAge ? `Age: ${userAge}` : ''}
${userGender ? `Gender: ${userGender}` : ''}
Tracker: ${trackerData.name} (${trackerData.category})
Goal: ${trackerData.target} ${trackerData.unit} ${trackerData.frequency}
${isNewTracker ? 'NEW TRACKER - First time!' : `Progress: ${trackerAnalytics.completionRate}% completion rate`}

${previousSuggestions.length > 0 ? `Avoid repeating: ${previousSuggestions.slice(0, 2).join(', ')}` : ''}

Return ONLY JSON:
{
  "todayAction": {
    "text": "Brief encouraging action for ${userName} today",
    "icon": "📅",
    "reason": "Why this will help ${userName}"
  },
  "suggestions": [{
    "text": "Quick tip for ${userName}",
    "type": "${isNewTracker ? 'getting_started' : 'performance'}",
    "icon": "💡",
    "dataPoint": "${isNewTracker ? 'Fresh start' : 'completion_rate_' + (trackerAnalytics.completionRate || 0) + '%'}"
  }],
  "motivationalQuote": {
    "text": "Personal motivation for ${userName}",
    "author": "Your Coach",
    "context": "Daily encouragement"
  }
}`;

    const responseText = await (openaiService as any).callOpenAI(prompt);
    const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const suggestionData = JSON.parse(cleanContent);

    if (!suggestionData.todayAction || !suggestionData.suggestions || !suggestionData.motivationalQuote) {
      throw new Error('Invalid AI response structure');
    }

    // Save suggestions
    const suggestionsRef = db.collection('tracker-specific-suggestions').doc(`${userId}_${trackerId}_${dateKey}`);
    const trackerSuggestions = {
      userId,
      trackerId,
      date: dateKey,
      dateKey: dateKey,
      ...suggestionData,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source: 'ai_batch',
      model: 'gpt-4o',
      trackerInfo: {
        name: trackerData.name,
        target: trackerData.target,
        unit: trackerData.unit,
        frequency: trackerData.frequency,
        category: trackerData.category
      },
      analytics: trackerAnalytics,
      batchGenerated: true
    };

    await suggestionsRef.set(trackerSuggestions);
    
    return {success: true};

  } catch (error) {
    console.error(`Error generating suggestion for user ${userId}, tracker ${trackerId}:`, error);
    return {success: false, error: (error as Error).message};
  }
}

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