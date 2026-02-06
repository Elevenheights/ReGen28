/**
 * Firebase Functions for Statistics System
 * Daily calculation scheduler and data access API
 */

import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onCall} from 'firebase-functions/v2/https';
import {onDocumentCreated, onDocumentWritten} from 'firebase-functions/v2/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {calculateUserDailyStats, getActiveUsers} from './statistics.service';

const db = getFirestore();

// ===============================
// MAIN SCHEDULER FUNCTION
// ===============================

/**
 * Daily statistics calculation scheduler
 * Runs every day at 2 AM UTC to calculate stats for all active users
 */
export const calculateAllDailyStats = onSchedule({
  schedule: '0 2 * * *', // 2 AM UTC daily
}, async () => {
  console.log('🕐 Starting daily statistics calculation at 2 AM UTC');
  
  try {
    const targetDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`📊 Calculating stats for date: ${targetDate}`);
    
    // Get all active users (last activity within 30 days)
    const activeUsers = await getActiveUsers();
    console.log(`👥 Found ${activeUsers.length} active users`);
    
    if (activeUsers.length === 0) {
      console.log('ℹ️ No active users found, skipping calculation');
      return;
    }
    
    // Process in batches to avoid timeout
    const batchSize = 50;
    let totalProcessed = 0;
    let totalSuccessful = 0;
    
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeUsers.length / batchSize)} (${batch.length} users)`);
      
      const batchPromises = batch.map(async (user) => {
        try {
          await calculateUserDailyStats(user.id, targetDate);
          return {userId: user.id, success: true};
        } catch (error) {
          console.error(`❌ Failed to calculate stats for user ${user.id}:`, error);
          return {userId: user.id, success: false, error};
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const batchSuccessful = batchResults.filter(r => r.success).length;
      
      totalProcessed += batchResults.length;
      totalSuccessful += batchSuccessful;
      
      console.log(`✅ Batch completed: ${batchSuccessful}/${batchResults.length} successful`);
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < activeUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`🎉 Daily statistics calculation completed!`);
    console.log(`📈 Results: ${totalSuccessful}/${totalProcessed} users processed successfully`);
    
    // Log completion stats
    await db.collection('system-logs').add({
      type: 'daily_stats_calculation',
      date: targetDate,
      totalUsers: activeUsers.length,
      processedUsers: totalProcessed,
      successfulUsers: totalSuccessful,
      failedUsers: totalProcessed - totalSuccessful,
      completedAt: new Date(),
      durationMs: Date.now() - Date.now() // Fixed since we don't have event.scheduleTime
    });
    
  } catch (error) {
    console.error('💥 Fatal error in daily statistics calculation:', error);
    
    // Log error for monitoring
    await db.collection('system-logs').add({
      type: 'daily_stats_error',
      error: String(error),
      timestamp: new Date()
    });
    
    throw error;
  }
});

// ===============================
// REAL-TIME TRIGGER FUNCTIONS
// ===============================

/**
 * Update stats when tracker entry is created
 */
export const onTrackerEntryCreated = onDocumentCreated(
  'tracker-entries/{entryId}',
  async (event) => {
    const entry = event.data?.data();
    if (!entry) return;
    
    console.log(`🔄 Recalculating stats due to new tracker entry: ${event.params.entryId}`);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Recalculate today's stats for affected user
      await calculateUserDailyStats(entry.userId, today);
      
      console.log(`✅ Stats recalculated for user ${entry.userId} after tracker entry`);
    } catch (error) {
      console.error(`❌ Failed to recalculate stats after tracker entry:`, error);
      // Don't throw - this is a background update
    }
  }
);

/**
 * Update stats when journal entry is created/updated
 */
export const onJournalEntryWritten = onDocumentWritten(
  'journal-entries/{entryId}',
  async (event) => {
    const entry = event.data?.after.data();
    if (!entry) return;
    
    console.log(`🔄 Recalculating stats due to journal entry change: ${event.params.entryId}`);
    
    try {
      const entryDate = entry.date; // Already in YYYY-MM-DD format
      
      // Recalculate stats for the entry's date
      await calculateUserDailyStats(entry.userId, entryDate);
      
      console.log(`✅ Stats recalculated for user ${entry.userId} after journal entry`);
    } catch (error) {
      console.error(`❌ Failed to recalculate stats after journal entry:`, error);
      // Don't throw - this is a background update
    }
  }
);

/**
 * Update stats when activity is created
 */
export const onActivityCreated = onDocumentCreated(
  'activities/{activityId}',
  async (event) => {
    const activity = event.data?.data();
    if (!activity) return;
    
    console.log(`🔄 Recalculating stats due to new activity: ${event.params.activityId}`);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Recalculate today's stats for affected user
      await calculateUserDailyStats(activity.userId, today);
      
      console.log(`✅ Stats recalculated for user ${activity.userId} after activity`);
    } catch (error) {
      console.error(`❌ Failed to recalculate stats after activity:`, error);
      // Don't throw - this is a background update
    }
  }
);

// ===============================
// DATA ACCESS API FUNCTIONS
// ===============================

/**
 * Get user daily stats for a specific date or date range
 */
export const getUserDailyStats = onCall({
  cors: ["https://localhost", "http://localhost:4200"], // Explicitly allow Capacitor and local dev
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { userId, date, startDate, endDate, days = 7 } = data;
  const targetUserId = userId || auth.uid;
  
  // Users can only access their own stats
  if (targetUserId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Cannot access other user statistics');
  }
  
  try {
    if (date) {
      // Single date request
      const doc = await db.collection('user-daily-stats').doc(`${targetUserId}_${date}`).get();
      return doc.exists ? doc.data() : null;
    } else if (startDate && endDate) {
      // Date range request
      const snapshot = await db.collection('user-daily-stats')
        .where('userId', '==', targetUserId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc')
        .get();
      
      return snapshot.docs.map(doc => doc.data());
    } else {
      // Default: last N days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const snapshot = await db.collection('user-daily-stats')
        .where('userId', '==', targetUserId)
        .where('date', '>=', startDateStr)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc')
        .get();
      
      return snapshot.docs.map(doc => doc.data());
    }
  } catch (error) {
    console.error('Error fetching user daily stats:', error);
    throw new HttpsError('internal', 'Failed to fetch user statistics');
  }
});

/**
 * Get tracker daily stats for a date range
 */
export const getTrackerDailyStats = onCall({
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { trackerId, startDate, endDate, days = 30 } = data;
  
  if (!trackerId) {
    throw new HttpsError('invalid-argument', 'trackerId is required');
  }
  
  try {
    // Verify user owns this tracker
    const trackerDoc = await db.collection('trackers').doc(trackerId).get();
    if (!trackerDoc.exists || trackerDoc.data()?.userId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Cannot access this tracker');
    }
    
    let query = db.collection('tracker-daily-stats')
      .where('trackerId', '==', trackerId);
    
    if (startDate && endDate) {
      query = query.where('date', '>=', startDate).where('date', '<=', endDate);
    } else {
      // Default: last N days
      const endDateStr = new Date().toISOString().split('T')[0];
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - days + 1);
      const startDateStr = startDateObj.toISOString().split('T')[0];
      
      query = query.where('date', '>=', startDateStr).where('date', '<=', endDateStr);
    }
    
    const snapshot = await query.orderBy('date', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
    
  } catch (error) {
    console.error('Error fetching tracker daily stats:', error);
    throw new HttpsError('internal', 'Failed to fetch tracker statistics');
  }
});

/**
 * Get journal daily stats for a date range
 */
export const getJournalDailyStats = onCall({
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { startDate, endDate, days = 30 } = data;
  
  try {
    let query = db.collection('journal-daily-stats')
      .where('userId', '==', auth.uid);
    
    if (startDate && endDate) {
      query = query.where('date', '>=', startDate).where('date', '<=', endDate);
    } else {
      // Default: last N days
      const endDateStr = new Date().toISOString().split('T')[0];
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - days + 1);
      const startDateStr = startDateObj.toISOString().split('T')[0];
      
      query = query.where('date', '>=', startDateStr).where('date', '<=', endDateStr);
    }
    
    const snapshot = await query.orderBy('date', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
    
  } catch (error) {
    console.error('Error fetching journal daily stats:', error);
    throw new HttpsError('internal', 'Failed to fetch journal statistics');
  }
});

/**
 * Get weekly mood trend analysis
 */
export const getWeeklyMoodTrend = onCall({
  cors: ["https://localhost", "http://localhost:4200"], // Explicitly allow Capacitor and local dev
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { weeksBack = 4 } = data;
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksBack * 7));
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const snapshot = await db.collection('user-daily-stats')
      .where('userId', '==', auth.uid)
      .where('date', '>=', startDateStr)
      .orderBy('date', 'asc')
      .get();
    
    const dailyStats = snapshot.docs.map(doc => doc.data());
    
    // Aggregate by week
    const weeklyData = aggregateByWeek(dailyStats, 'overallAverageMood');
    
    return weeklyData;
    
  } catch (error) {
    console.error('Error fetching weekly mood trend:', error);
    throw new HttpsError('internal', 'Failed to fetch mood trend');
  }
});

/**
 * Get performance insights for a user
 */
export const getPerformanceInsights = onCall({
  cors: ["https://localhost", "http://localhost:4200"], // Explicitly allow Capacitor and local dev
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { days = 30 } = data;
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const snapshot = await db.collection('user-daily-stats')
      .where('userId', '==', auth.uid)
      .where('date', '>=', startDateStr)
      .orderBy('date', 'desc')
      .get();
    
    const dailyStats = snapshot.docs.map(doc => doc.data());
    
    if (dailyStats.length === 0) {
      return {
        bestPerformanceHour: 10,
        peakProductivityDays: [],
        energyProductivityIndex: 0,
        consistencyScore: 0,
        categoryEngagement: { mind: 0, body: 0, soul: 0, beauty: 0 }
      };
    }
    
    // Calculate performance insights
    const bestHours = dailyStats.map(s => s.bestHour).filter(h => h != null);
    const bestPerformanceHour = bestHours.length > 0 ? 
      Math.round(bestHours.reduce((sum, h) => sum + h, 0) / bestHours.length) : 10;
    
    const peakDays = dailyStats
      .filter(s => s.energyProductivity > 70)
      .map(s => s.date)
      .slice(0, 7);
    
    const avgEnergyProductivity = dailyStats.length > 0 ?
      dailyStats.reduce((sum, s) => sum + (s.energyProductivity || 0), 0) / dailyStats.length : 0;
    
    const avgConsistency = dailyStats.length > 0 ?
      dailyStats.reduce((sum, s) => sum + (s.consistencyIndex || 0), 0) / dailyStats.length : 0;
    
    // Calculate category engagement averages
    const categoryEngagement = {
      mind: dailyStats.reduce((sum, s) => sum + (s.mindMinutes || 0), 0) / dailyStats.length,
      body: dailyStats.reduce((sum, s) => sum + (s.bodyActivities || 0), 0) / dailyStats.length,
      soul: dailyStats.reduce((sum, s) => sum + (s.soulActivities || 0), 0) / dailyStats.length,
      beauty: dailyStats.reduce((sum, s) => sum + (s.beautyRoutines || 0), 0) / dailyStats.length
    };
    
    return {
      bestPerformanceHour,
      peakProductivityDays: peakDays,
      energyProductivityIndex: Math.round(avgEnergyProductivity),
      consistencyScore: Math.round(avgConsistency),
      categoryEngagement
    };
    
  } catch (error) {
    console.error('Error fetching performance insights:', error);
    throw new HttpsError('internal', 'Failed to fetch performance insights');
  }
});

// ===============================
// MANUAL TRIGGER FUNCTIONS
// ===============================

/**
 * Manual trigger for calculating stats (admin/dev use)
 */
export const triggerStatsCalculation = onCall({
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { date, userId, forceAll = false } = data;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const targetUserId = userId || auth.uid;
  
  // Only allow users to trigger their own stats (unless admin)
  if (targetUserId !== auth.uid && !forceAll) {
    throw new HttpsError('permission-denied', 'Cannot trigger stats for other users');
  }
  
  try {
    console.log(`🔄 Manual stats calculation triggered for user: ${targetUserId}, date: ${targetDate}`);
    
    await calculateUserDailyStats(targetUserId, targetDate);
    
    console.log(`✅ Manual stats calculation completed for user: ${targetUserId}`);
    
    return {
      success: true,
      message: `Statistics calculated for ${targetUserId} on ${targetDate}`,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Error in manual stats calculation:', error);
    throw new HttpsError('internal', 'Failed to calculate statistics');
  }
});

// ===============================
// BACKFILL FUNCTIONS
// ===============================

/**
 * Backfill historical statistics for a user
 */
export const backfillUserStats = onCall({
  invoker: 'public'
}, async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { daysBack = 30, userId } = data;
  const targetUserId = userId || auth.uid;
  
  // Only allow users to backfill their own stats
  if (targetUserId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Cannot backfill stats for other users');
  }
  
  try {
    console.log(`🔄 Starting backfill for user: ${targetUserId}, days: ${daysBack}`);
    
    const today = new Date();
    const promises = [];
    
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      promises.push(calculateUserDailyStats(targetUserId, dateStr));
    }
    
    await Promise.all(promises);
    
    console.log(`✅ Backfill completed for user: ${targetUserId}`);
    
    return {
      success: true,
      message: `Backfilled ${daysBack} days of statistics`,
      userId: targetUserId,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Error in backfill operation:', error);
    throw new HttpsError('internal', 'Failed to backfill statistics');
  }
});

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Aggregate daily data by week
 */
function aggregateByWeek(dailyStats: any[], field: string): any[] {
  const weeklyData: { [week: string]: { sum: number; count: number; dates: string[] } } = {};
  
  dailyStats.forEach(stat => {
    const date = new Date(stat.date);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { sum: 0, count: 0, dates: [] };
    }
    
    const value = stat[field];
    if (value != null) {
      weeklyData[weekKey].sum += value;
      weeklyData[weekKey].count++;
    }
    weeklyData[weekKey].dates.push(stat.date);
  });
  
  return Object.keys(weeklyData)
    .sort()
    .map(week => ({
      week,
      averageMood: weeklyData[week].count > 0 ? 
        Math.round((weeklyData[week].sum / weeklyData[week].count) * 10) / 10 : 0,
      entryCount: weeklyData[week].count,
      dates: weeklyData[week].dates
    }));
}

/**
 * Get start of week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
} 