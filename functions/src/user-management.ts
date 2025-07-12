import {FieldValue} from "firebase-admin/firestore";
import {onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {OpenAIService} from "./openai.service";
import { 
  createTrackerFromTemplate, 
  getFallbackDailySuggestions, 
} from './shared-config';

// Define the OpenAI API key secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Get Firestore instance (Firebase Admin initialized in index.ts)
const db = getFirestore();

// ===============================
// USER CREATION & ONBOARDING
// ===============================

/**
 * Complete user onboarding - SERVER SIDE
 * Critical for data integrity and complex operations
 */
export const completeUserOnboarding = onCall(async (request) => {
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
export const updateUserStats = onCall(async (request) => {
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
 * Generate daily suggestions using AI - only once per 24 hours per user
 */
export const getDailySuggestions = onCall({
  maxInstances: 5,
  secrets: [openaiApiKey],
}, async (request) => {
  const {auth} = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = auth.uid;

  try {
    // Use UTC date to ensure consistent caching across timezones
    const now = new Date();
    const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayKey = utcToday.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const suggestionsRef = db.collection('daily-suggestions').doc(`${userId}_${todayKey}`);
    const existingSuggestions = await suggestionsRef.get();

    if (existingSuggestions.exists) {
      const cachedData = existingSuggestions.data();
      console.log('Returning cached daily suggestions for user:', userId, 'date:', todayKey);
      
      // Update last accessed timestamp for cache management
      await suggestionsRef.update({
        lastAccessed: FieldValue.serverTimestamp()
      });
      
      return cachedData;
    }

    // Cleanup old cache entries (older than 7 days) for this user
    const sevenDaysAgo = new Date(utcToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const oldSuggestionsQuery = await db.collection('daily-suggestions')
      .where('userId', '==', userId)
      .where('dateKey', '<', sevenDaysAgo.toISOString().split('T')[0])
      .limit(10) // Limit cleanup batch size
      .get();

    // Delete old entries in batch
    if (!oldSuggestionsQuery.empty) {
      const batch = db.batch();
      oldSuggestionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleaned up ${oldSuggestionsQuery.size} old cache entries for user:`, userId);
    }

    // Get user profile and active trackers
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    // Get active trackers
    const trackersSnapshot = await db.collection('trackers')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const activeTrackers = trackersSnapshot.docs.map(doc => ({
      name: doc.data().name,
      category: doc.data().category,
      target: doc.data().target,
      unit: doc.data().unit,
      frequency: doc.data().frequency
    }));

    // Generate suggestions using OpenAI service (same pattern as getTrackerRecommendations)
    const openaiService = new OpenAIService(openaiApiKey.value());
    let suggestions: any[] = [];
    let source = 'fallback';
    let model = 'default';

    if (openaiService.isAvailable()) {
      try {
        // Use OpenAI to generate suggestions
        const prompt = `Generate 3-4 personalized daily suggestions for a wellness app user:

FOCUS AREAS: ${(userData.focusAreas || []).join(', ')}
GOALS: ${(userData.wellnessGoals || []).join(', ')}
COMMITMENT LEVEL: ${userData.commitmentLevel || 'moderate'}
ACTIVE TRACKERS: ${activeTrackers.map(t => `${t.name} (${t.target} ${t.unit} ${t.frequency})`).join(', ')}
CURRENT DAY: ${userData.currentDay || 1} of their journey

Return ONLY a JSON object:
{
  "suggestions": [
    {
      "text": "Start your day with 5 minutes of mindful breathing",
      "type": "mindfulness",
      "icon": "🧘"
    }
  ]
}`;

        const responseText = await (openaiService as any).callOpenAI(prompt);
        const cleanContent = responseText.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanContent);
        
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          suggestions = parsed.suggestions;
          source = 'ai';
          model = 'gpt-4o';
        }
      } catch (error) {
        console.log('OpenAI failed, using fallback suggestions:', error);
      }
    }

    // Use centralized fallback suggestions if AI fails
    if (suggestions.length === 0) {
      suggestions = getFallbackDailySuggestions();
    }

    // Add metadata for caching
    const dailySuggestions = {
      userId,
      date: todayKey,
      dateKey: todayKey,
      suggestions,
      generatedAt: FieldValue.serverTimestamp(),
      lastAccessed: FieldValue.serverTimestamp(),
      source,
      model,
      userProfile: {
        focusAreas: userData.focusAreas || [],
        goalCount: (userData.wellnessGoals || []).length,
        trackerCount: activeTrackers.length,
        commitmentLevel: userData.commitmentLevel || 'moderate'
      }
    };

    // Cache for 24+ hours
    await suggestionsRef.set(dailySuggestions);

    console.log('Generated and cached new daily suggestions for user:', userId, 'date:', todayKey);
    return dailySuggestions;

  } catch (error) {
    console.error('Error generating daily suggestions:', error);
    throw new HttpsError('internal', 'Failed to generate daily suggestions');
  }
});

/**
 * Scheduled function to clean up old daily suggestion cache entries
 * Runs daily at 2:00 AM UTC to clean up suggestions older than 7 days
 */
export const cleanupOldSuggestions = onSchedule('0 2 * * *', async () => {
  try {
    console.log('Starting cleanup of old daily suggestions...');
    
    // Calculate cutoff date (7 days ago)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log('Cleaning up suggestions older than:', cutoffDate);
    
    // Query old suggestions in batches
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const oldSuggestionsQuery = await db.collection('daily-suggestions')
        .where('dateKey', '<', cutoffDate)
        .limit(100) // Process in batches to avoid timeout
        .get();
      
      if (oldSuggestionsQuery.empty) {
        hasMore = false;
        break;
      }
      
      // Delete batch of old entries
      const batch = db.batch();
      oldSuggestionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += oldSuggestionsQuery.size;
      
      console.log(`Deleted batch of ${oldSuggestionsQuery.size} old suggestions`);
      
      // If we got fewer than the limit, we're done
      if (oldSuggestionsQuery.size < 100) {
        hasMore = false;
      }
    }
    
    console.log(`Daily suggestions cleanup completed. Total deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('Error during daily suggestions cleanup:', error);
  }
});

/**
 * Clean up duplicate trackers for users who experienced the duplication bug
 */
export const cleanupDuplicateTrackers = onCall(async (request) => {
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