/**
 * Firebase Functions for Statistics System
 * Daily calculation scheduler and data access API
 * // Force permission update
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { calculateUserDailyStats, getActiveUsers } from './statistics.service';
import { incrementUserDailyStats } from './statistics-helpers';

const db = getFirestore();

// ===============================
// TASK QUEUE FUNCTIONS
// ===============================

/**
 * Task to calculate daily stats for a single user
 */
export const calculateUserStatsTask = onTaskDispatched({
	retryConfig: {
		maxAttempts: 3,
		minBackoffSeconds: 60,
	},
	rateLimits: {
		maxConcurrentDispatches: 50,
	},
	timeoutSeconds: 300,
}, async (req) => {
	const { userId, date } = req.data;
	if (!userId || !date) {
		console.error("❌ Missing userId or date in task data");
		return;
	}

	console.log(`🔄 [TASK] Calculating stats for user ${userId} on ${date}`);
	try {
		await calculateUserDailyStats(userId, date);
		console.log(`✅ [TASK] Stats calculated for user ${userId}`);
	} catch (error) {
		console.error(`❌ [TASK] Failed to calculate stats for user ${userId}:`, error);
		throw error; // Throw to trigger retry
	}
});

// ===============================
// MAIN SCHEDULER FUNCTION
// ===============================

/**
 * Daily statistics calculation scheduler
 * Runs every day at 2 AM UTC to calculate stats for all active users
 */
export const calculateAllDailyStats = onSchedule({
	schedule: '0 2 * * *', // 2 AM UTC daily
	timeoutSeconds: 540,
	memory: '512MiB',
}, async () => {
	console.log('🕐 Starting daily statistics calculation (Scheduling Tasks) at 2 AM UTC');

	try {
		const targetDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		console.log(`📊 Scheduling stats calculation for date: ${targetDate}`);

		// Get all active users (last activity within 30 days)
		const activeUsers = await getActiveUsers();
		console.log(`👥 Found ${activeUsers.length} active users`);

		if (activeUsers.length === 0) {
			console.log('ℹ️ No active users found, skipping calculation');
			return;
		}

		const queue = getFunctions().taskQueue("calculateUserStatsTask");
		const promises = activeUsers.map(async (user) => {
			await queue.enqueue({
				userId: user.id,
				date: targetDate
			});
		});

		await Promise.all(promises);

		console.log(`🎉 Daily statistics calculation scheduled!`);
		console.log(`📈 Queued tasks for ${activeUsers.length} users`);

		// Log completion stats
		await db.collection('system-logs').add({
			type: 'daily_stats_scheduling',
			date: targetDate,
			totalUsers: activeUsers.length,
			scheduledAt: new Date(),
		});

	} catch (error) {
		console.error('💥 Fatal error in daily statistics scheduling:', error);

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
 * LIGHTWEIGHT MODE: Increments counters instead of full recalculation
 */
export const onTrackerEntryCreated = onDocumentCreated(
	'tracker-entries/{entryId}',
	async (event) => {
		const entry = event.data?.data();
		if (!entry) return;

		console.log(`🔄 Incrementing stats for tracker entry: ${event.params.entryId}`);

		try {
			const today = new Date().toISOString().split('T')[0];

			// Lightweight increment
			await incrementUserDailyStats(entry.userId, today, {
				activityType: 'tracker',
				category: entry.tracker?.category,
				mood: entry.mood,
				energy: entry.energy
			});

		} catch (error) {
			console.error(`❌ Failed to increment stats:`, error);
		}
	}
);

/**
 * Update stats when journal entry is created/updated
 * LIGHTWEIGHT MODE: Increments counters instead of full recalculation
 */
export const onJournalEntryWritten = onDocumentWritten(
	'journal-entries/{entryId}',
	async (event) => {
		const entry = event.data?.after.data();
		// Only increment on creation (when before doesn't exist)
		// We avoid decrement logic on updates for simplicity tailored to "totals" syncing at night
		const isNew = !event.data?.before.exists;

		if (!entry || !isNew) return;

		console.log(`🔄 Incrementing stats for journal entry: ${event.params.entryId}`);

		try {
			const entryDate = entry.date;

			await incrementUserDailyStats(entry.userId, entryDate, {
				activityType: 'journal',
				mood: entry.mood,
				energy: entry.energy
			});

		} catch (error) {
			console.error(`❌ Failed to increment stats:`, error);
		}
	}
);

/**
 * Update stats when activity is created
 * LIGHTWEIGHT MODE: Increments counters instead of full recalculation
 */
export const onActivityCreated = onDocumentCreated(
	'activities/{activityId}',
	async (event) => {
		const activity = event.data?.data();
		if (!activity) return;

		console.log(`🔄 Incrementing stats for activity: ${event.params.activityId}`);

		try {
			const today = new Date().toISOString().split('T')[0];

			await incrementUserDailyStats(activity.userId, today, {
				activityType: 'activity',
				category: activity.type // Assuming type maps to category often, or generic
			});

		} catch (error) {
			console.error(`❌ Failed to increment stats:`, error);
		}
	}
);

// ===============================
// DATA ACCESS API FUNCTIONS
// ===============================

/**
 * Unified statistics getter to reduce cold starts and quota usage
 */
export const getStatistics = onCall({
	cors: ["https://localhost", "http://localhost:4200"],
	invoker: 'public'
}, async (request) => {
	const { auth, data } = request;

	if (!auth) {
		throw new HttpsError('unauthenticated', 'User must be authenticated');
	}

	const { type } = data;

	try {
		switch (type) {
			case 'user-daily': {
				const { userId, date, startDate, endDate, days = 7 } = data;
				const targetUserId = userId || auth.uid;

				if (targetUserId !== auth.uid) {
					throw new HttpsError('permission-denied', 'Cannot access other user statistics');
				}

				if (date) {
					const doc = await db.collection('user-daily-stats').doc(`${targetUserId}_${date}`).get();
					return doc.exists ? doc.data() : null;
				}

				// Date range query logic
				let query = db.collection('user-daily-stats').where('userId', '==', targetUserId);

				if (startDate && endDate) {
					query = query.where('date', '>=', startDate).where('date', '<=', endDate);
				} else {
					const end = new Date().toISOString().split('T')[0];
					const start = new Date();
					start.setDate(start.getDate() - days + 1);
					query = query.where('date', '>=', start.toISOString().split('T')[0]).where('date', '<=', end);
				}

				const snapshot = await query.orderBy('date', 'desc').get();
				return snapshot.docs.map(doc => doc.data());
			}

			case 'tracker-daily': {
				const { trackerId, startDate, endDate, days = 30 } = data;
				if (!trackerId) throw new HttpsError('invalid-argument', 'trackerId is required');

				const trackerDoc = await db.collection('trackers').doc(trackerId).get();
				if (!trackerDoc.exists || trackerDoc.data()?.userId !== auth.uid) {
					throw new HttpsError('permission-denied', 'Cannot access this tracker');
				}

				let query = db.collection('tracker-daily-stats').where('trackerId', '==', trackerId);

				if (startDate && endDate) {
					query = query.where('date', '>=', startDate).where('date', '<=', endDate);
				} else {
					const end = new Date().toISOString().split('T')[0];
					const start = new Date();
					start.setDate(start.getDate() - days + 1);
					query = query.where('date', '>=', start.toISOString().split('T')[0]).where('date', '<=', end);
				}

				const snapshot = await query.orderBy('date', 'desc').get();
				return snapshot.docs.map(doc => doc.data());
			}

			case 'journal-daily': {
				const { startDate, endDate, days = 30 } = data;
				let query = db.collection('journal-daily-stats').where('userId', '==', auth.uid);

				if (startDate && endDate) {
					query = query.where('date', '>=', startDate).where('date', '<=', endDate);
				} else {
					const end = new Date().toISOString().split('T')[0];
					const start = new Date();
					start.setDate(start.getDate() - days + 1);
					query = query.where('date', '>=', start.toISOString().split('T')[0]).where('date', '<=', end);
				}

				const snapshot = await query.orderBy('date', 'desc').get();
				return snapshot.docs.map(doc => doc.data());
			}

			case 'weekly-mood': {
				const { weeksBack = 4 } = data;
				const start = new Date();
				start.setDate(start.getDate() - (weeksBack * 7));

				const snapshot = await db.collection('user-daily-stats')
					.where('userId', '==', auth.uid)
					.where('date', '>=', start.toISOString().split('T')[0])
					.orderBy('date', 'asc')
					.get();

				return aggregateByWeek(snapshot.docs.map(d => d.data()), 'overallAverageMood');
			}

			case 'performance': {
				const { days = 30 } = data;
				const start = new Date();
				start.setDate(start.getDate() - days + 1);

				const snapshot = await db.collection('user-daily-stats')
					.where('userId', '==', auth.uid)
					.where('date', '>=', start.toISOString().split('T')[0])
					.orderBy('date', 'desc')
					.get();

				const dailyStats = snapshot.docs.map(d => d.data());
				if (dailyStats.length === 0) {
					return {
						bestPerformanceHour: 10,
						peakProductivityDays: [],
						energyProductivityIndex: 0,
						consistencyScore: 0,
						categoryEngagement: { mind: 0, body: 0, soul: 0, beauty: 0 }
					};
				}

				const bestHours = dailyStats.map(s => s.bestHour).filter(h => h != null);
				const bestPerformanceHour = bestHours.length > 0 ?
					Math.round(bestHours.reduce((sum, h) => sum + h, 0) / bestHours.length) : 10;

				const peakDays = dailyStats
					.filter(s => s.energyProductivity > 70)
					.map(s => s.date)
					.slice(0, 7);

				const avgEnergy = dailyStats.reduce((sum, s) => sum + (s.energyProductivity || 0), 0) / dailyStats.length;
				const avgConsistency = dailyStats.reduce((sum, s) => sum + (s.consistencyIndex || 0), 0) / dailyStats.length;

				return {
					bestPerformanceHour,
					peakProductivityDays: peakDays,
					energyProductivityIndex: Math.round(avgEnergy),
					consistencyScore: Math.round(avgConsistency),
					categoryEngagement: {
						mind: dailyStats.reduce((sum, s) => sum + (s.mindMinutes || 0), 0) / dailyStats.length,
						body: dailyStats.reduce((sum, s) => sum + (s.bodyActivities || 0), 0) / dailyStats.length,
						soul: dailyStats.reduce((sum, s) => sum + (s.soulActivities || 0), 0) / dailyStats.length,
						beauty: dailyStats.reduce((sum, s) => sum + (s.beautyRoutines || 0), 0) / dailyStats.length
					}
				};
			}

			default:
				throw new HttpsError('invalid-argument', `Unknown statistics type: ${type}`);
		}
	} catch (error) {
		console.error(`Error in getStatistics (${type}):`, error);
		if (error instanceof HttpsError) throw error;
		throw new HttpsError('internal', 'Failed to fetch statistics');
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