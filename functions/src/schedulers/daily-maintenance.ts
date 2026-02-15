import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();

/**
 * Consolidated Daily Maintenance Scheduler
 * Runs all daily maintenance tasks at 2 AM UTC
 * Combines: cleanup, expiration checks, and queue management
 */
export const dailyMaintenance = onSchedule({
  schedule: '0 2 * * *', // 2 AM UTC daily
  timeZone: 'UTC',
  timeoutSeconds: 540,
  memory: '512MiB',
  cpu: 1,
  minInstances: 0
}, async (event) => {
  logger.info('Starting daily maintenance tasks');
  
  const results = {
    duplicateTrackersRemoved: 0,
    oldSuggestionsRemoved: 0,
    expiredTrackersChecked: 0,
    expiredTrialsChecked: 0
  };
  
  try {
    // Run all maintenance tasks in parallel
    await Promise.all([
      cleanupDuplicateTrackers(results),
      cleanupOldSuggestions(results),
      checkExpiredTrackers(results),
      checkExpiredTrials(results)
    ]);
    
    logger.info('Daily maintenance completed', results);
  } catch (error) {
    logger.error('Error in daily maintenance', error);
    throw error;
  }
});

/**
 * Clean up duplicate trackers
 */
async function cleanupDuplicateTrackers(results: any): Promise<void> {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const trackersSnapshot = await db.collection('trackers')
        .where('userId', '==', userId)
        .get();
      
      // Group by name to find duplicates
      const trackersByName = new Map<string, any[]>();
      trackersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const name = data.name;
        if (!trackersByName.has(name)) {
          trackersByName.set(name, []);
        }
        trackersByName.get(name)!.push({ id: doc.id, ...data });
      });
      
      // Delete duplicates (keep the most recent)
      for (const [name, trackers] of trackersByName) {
        if (trackers.length > 1) {
          // Sort by createdAt, keep newest
          trackers.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
          const toDelete = trackers.slice(1); // All except first (newest)
          
          for (const tracker of toDelete) {
            await db.collection('trackers').doc(tracker.id).delete();
            results.duplicateTrackersRemoved++;
            logger.info(`Deleted duplicate tracker: ${name} (${tracker.id})`);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up duplicate trackers', error);
  }
}

/**
 * Clean up old suggestions (older than 35 days)
 */
async function cleanupOldSuggestions(results: any): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 35);
    const cutoffKey = cutoffDate.toISOString().split('T')[0];
    
    const oldSuggestionsSnapshot = await db.collection('tracker-specific-suggestions')
      .where('dateKey', '<', cutoffKey)
      .limit(100)
      .get();
    
    if (!oldSuggestionsSnapshot.empty) {
      const batch = db.batch();
      oldSuggestionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      results.oldSuggestionsRemoved = oldSuggestionsSnapshot.size;
      logger.info(`Cleaned up ${oldSuggestionsSnapshot.size} old suggestions`);
    }
  } catch (error) {
    logger.error('Error cleaning up old suggestions', error);
  }
}

/**
 * Check and mark expired trackers as inactive
 */
async function checkExpiredTrackers(results: any): Promise<void> {
  try {
    const now = new Date();
    const trackersSnapshot = await db.collection('trackers')
      .where('isActive', '==', true)
      .where('isOngoing', '==', false)
      .get();
    
    const batch = db.batch();
    let expiredCount = 0;
    
    for (const doc of trackersSnapshot.docs) {
      const tracker = doc.data();
      const endDate = tracker.endDate?.toDate();
      
      if (endDate && endDate < now) {
        batch.update(doc.ref, {
          isActive: false,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      await batch.commit();
      results.expiredTrackersChecked = expiredCount;
      logger.info(`Marked ${expiredCount} trackers as expired`);
    }
  } catch (error) {
    logger.error('Error checking expired trackers', error);
  }
}

/**
 * Check and handle expired trial subscriptions
 */
async function checkExpiredTrials(results: any): Promise<void> {
  try {
    const now = new Date();
    const usersSnapshot = await db.collection('users')
      .where('subscriptionStatus', '==', 'trial')
      .get();
    
    const batch = db.batch();
    let expiredCount = 0;
    
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const trialEndDate = user.trialEndDate?.toDate();
      
      if (trialEndDate && trialEndDate < now) {
        batch.update(doc.ref, {
          subscriptionStatus: 'expired',
          updatedAt: FieldValue.serverTimestamp()
        });
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      await batch.commit();
      results.expiredTrialsChecked = expiredCount;
      logger.info(`Marked ${expiredCount} trials as expired`);
    }
  } catch (error) {
    logger.error('Error checking expired trials', error);
  }
}
