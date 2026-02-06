/**
 * Statistics Calculation Service
 * Handles all daily statistics calculations for users, trackers, and journals
 */

import { getFirestore } from 'firebase-admin/firestore';
import { TrackerFrequency } from './shared-config';

const db = getFirestore();

// ===============================
// INTERFACES (SHARED)
// ===============================

interface UserDailyStats {
	id: string;
	userId: string;
	date: string; // YYYY-MM-DD
	totalActivities: number;
	totalTrackerEntries: number;
	totalJournalEntries: number;
	overallAverageMood: number;
	overallAverageEnergy: number;
	moodSources: {
		journal: number;
		trackers: number;
		moodEntries: number;
	};
	overallStreak: number;
	journalStreak: number;
	trackerStreak: number;
	mindMinutes: number;
	bodyActivities: number;
	soulActivities: number;
	beautyRoutines: number;
	achievementsEarned: string[];
	pointsEarned: number;
	engagementRate: number;
	consistencyIndex: number;
	categoryDiversity: number;
	energyProductivity: number;
	dataQualityScore: number;
	bestHour: number;
	hourlyActivity: number[];
	moodCorrelationByCategory: {
		mind: number;
		body: number;
		soul: number;
		beauty: number;
		custom: number;
	};
	calculatedAt: Date;
	version: number;
}

interface TrackerDailyStats {
	id: string;
	trackerId: string;
	userId: string;
	date: string;
	entriesCount: number;
	totalValue: number;
	averageValue: number;
	averageMood?: number;
	averageEnergy?: number;
	averageQuality?: number;
	currentStreak: number;
	longestStreakToDate: number;
	wasCompleted: boolean;
	adherence: number;
	completionRate: number;
	weeklyTrend: 'improving' | 'declining' | 'stable';
	monthlyTrend: 'improving' | 'declining' | 'stable';
	nextMilestone: number;
	milestoneProgress: number;
	moodCorrelation: number;
	calculatedAt: Date;
	version: number;
}

interface JournalDailyStats {
	id: string;
	userId: string;
	date: string;
	entriesCount: number;
	totalWords: number;
	averageWordsPerEntry: number;
	averageMood?: number;
	averageEnergy?: number;
	moodRange: { min: number; max: number };
	categoriesUsed: string[];
	tagsUsed: string[];
	sentimentScore?: number;
	currentStreak: number;
	longestStreakToDate: number;
	calculatedAt: Date;
	version: number;
}

// ===============================
// MAIN CALCULATOR FUNCTIONS
// ===============================

/**
 * Calculate all daily statistics for a specific user and date
 */
export async function calculateUserDailyStats(userId: string, date: string): Promise<void> {
	try {
		console.log(`Calculating daily stats for user: ${userId}, date: ${date}`);

		// 1. Calculate user-level daily stats
		const userStats = await calculateUserDailyStatsForDate(userId, date);
		await saveUserDailyStats(userId, date, userStats);

		// 2. Calculate stats for each tracker
		const userTrackers = await getUserTrackers(userId);
		for (const tracker of userTrackers) {
			const trackerStats = await calculateTrackerDailyStatsForDate(
				userId, tracker.id, date
			);
			await saveTrackerDailyStats(tracker.id, date, trackerStats);
		}

		// 3. Calculate journal stats (if user has journal entries)
		const journalStats = await calculateJournalDailyStatsForDate(userId, date);
		if (journalStats) {
			await saveJournalDailyStats(userId, date, journalStats);
		}

		// 4. Update user's overall stats (weekly/monthly aggregates)
		await updateUserOverallStats(userId, date);

		console.log(`✅ Daily stats calculation completed for user: ${userId}, date: ${date}`);

	} catch (error) {
		console.error(`❌ Failed to calculate stats for user ${userId}, date ${date}:`, error);
		// Don't throw - let other users continue processing
	}
}

/**
 * Calculate user daily stats for a specific date
 */
async function calculateUserDailyStatsForDate(
	userId: string,
	date: string
): Promise<UserDailyStats> {
	const [
		activities,
		trackerEntries,
		journalEntries,
		moodEntries,
		previousStats
	] = await Promise.all([
		getActivitiesForDate(userId, date),
		getTrackerEntriesForDate(userId, date),
		getJournalEntriesForDate(userId, date),
		getMoodEntriesForDate(userId, date),
		getUserDailyStats(userId, getPreviousDate(date))
	]);

	// Calculate mood aggregation from all sources
	const overallMoodData = calculateOverallMoodFromAllSources({
		journalMoods: journalEntries.map(j => j.mood).filter(Boolean),
		trackerMoods: trackerEntries.map(t => t.mood).filter(Boolean),
		dedicatedMoods: moodEntries.map(m => m.moodLevel)
	});

	// Calculate category breakdowns
	const categoryBreakdown = calculateCategoryBreakdown(trackerEntries);

	// Calculate streaks
	const wasActiveToday = activities.length > 0;
	const yesterday = getPreviousDate(date);
	const overallStreak = calculateOverallStreak(wasActiveToday, previousStats, yesterday);
	const journalStreak = await calculateJournalStreak(userId, date);
	const trackerStreak = await calculateTrackerStreak(userId, date);

	// Calculate engagement metrics
	const consistencyScore = calculateConsistencyScore(activities, trackerEntries);
	const engagementRate = await calculateEngagementRate(userId, date);
	const categoryDiversity = calculateCategoryDiversity(trackerEntries);

	return {
		id: `${userId}_${date}`,
		userId,
		date,
		totalActivities: activities.length,
		totalTrackerEntries: trackerEntries.length,
		totalJournalEntries: journalEntries.length,
		overallAverageMood: overallMoodData.average,
		overallAverageEnergy: calculateAverageEnergy(trackerEntries, journalEntries),
		moodSources: {
			journal: journalEntries.filter(j => j.mood != null).length,
			trackers: trackerEntries.filter(t => t.mood != null).length,
			moodEntries: moodEntries.length
		},
		overallStreak,
		journalStreak,
		trackerStreak,
		mindMinutes: categoryBreakdown.mind || 0,
		bodyActivities: categoryBreakdown.body || 0,
		soulActivities: categoryBreakdown.soul || 0,
		beautyRoutines: categoryBreakdown.beauty || 0,
		achievementsEarned: [], // TODO: Integration with achievements service
		pointsEarned: 0,
		engagementRate,
		consistencyIndex: consistencyScore,
		categoryDiversity,
		energyProductivity: calculateEnergyProductivity(activities, overallMoodData.average),
		dataQualityScore: calculateDataQualityScore(trackerEntries, journalEntries),
		bestHour: calculateBestHour(activities),
		hourlyActivity: calculateHourlyActivity(activities),
		moodCorrelationByCategory: calculateMoodCorrelationByCategory(trackerEntries),
		calculatedAt: new Date(),
		version: 1
	};
}

/**
 * Calculate tracker daily stats for a specific date
 */
async function calculateTrackerDailyStatsForDate(
	userId: string,
	trackerId: string,
	date: string
): Promise<TrackerDailyStats> {
	const [
		entriesForDate,
		tracker,
		historicalEntries,
		previousStats
	] = await Promise.all([
		getTrackerEntriesForDate(userId, trackerId, date),
		getTracker(trackerId),
		getTrackerEntriesForPeriod(userId, trackerId, getLast30Days(date)),
		getTrackerDailyStats(trackerId, getPreviousDate(date))
	]);

	if (!tracker) {
		throw new Error(`Tracker not found: ${trackerId}`);
	}

	const currentStreak = calculateFrequencyAwareStreak(
		tracker.frequency,
		historicalEntries,
		date
	);

	const adherence = calculateAdherence(tracker.frequency, entriesForDate, date);
	const wasCompleted = adherence >= 1.0;

	return {
		id: `${trackerId}_${date}`,
		trackerId,
		userId,
		date,
		entriesCount: entriesForDate.length,
		totalValue: entriesForDate.reduce((sum, e) => sum + (e.value || 0), 0),
		averageValue: entriesForDate.length > 0 ?
			entriesForDate.reduce((sum, e) => sum + (e.value || 0), 0) / entriesForDate.length : 0,
		averageMood: calculateAverageMood(entriesForDate.map(e => e.mood).filter(Boolean)),
		averageEnergy: calculateAverageEnergy(entriesForDate, []),
		averageQuality: calculateAverageQuality(entriesForDate.map(e => e.quality).filter(Boolean)),
		currentStreak,
		longestStreakToDate: Math.max(currentStreak, previousStats?.longestStreakToDate || 0),
		wasCompleted,
		adherence,
		completionRate: calculateCompletionRate(historicalEntries, tracker.frequency),
		weeklyTrend: calculateTrend(historicalEntries, 'weekly'),
		monthlyTrend: calculateTrend(historicalEntries, 'monthly'),
		nextMilestone: getNextMilestone(currentStreak),
		milestoneProgress: calculateMilestoneProgress(currentStreak),
		moodCorrelation: calculateMoodCorrelation(historicalEntries),
		calculatedAt: new Date(),
		version: 1
	};
}

/**
 * Calculate journal daily stats for a specific date
 */
async function calculateJournalDailyStatsForDate(
	userId: string,
	date: string
): Promise<JournalDailyStats | null> {
	const entries = await getJournalEntriesForDate(userId, date);
	if (entries.length === 0) return null;

	const moodValues = entries.map(e => e.mood).filter(Boolean);
	const moodRange = moodValues.length > 0 ?
		{ min: Math.min(...moodValues), max: Math.max(...moodValues) } :
		{ min: 0, max: 0 };

	const currentStreak = await calculateJournalStreak(userId, date);

	return {
		id: `${userId}_journal_${date}`,
		userId,
		date,
		entriesCount: entries.length,
		totalWords: entries.reduce((sum, e) => sum + countWords(e.content), 0),
		averageWordsPerEntry: entries.length > 0 ?
			entries.reduce((sum, e) => sum + countWords(e.content), 0) / entries.length : 0,
		averageMood: calculateAverageMood(moodValues),
		averageEnergy: calculateAverageEnergy([], entries),
		moodRange,
		categoriesUsed: [...new Set(entries.map(e => e.category).filter(Boolean))],
		tagsUsed: [...new Set(entries.flatMap(e => e.tags || []))],
		sentimentScore: undefined, // TODO: Implement AI sentiment analysis
		currentStreak,
		longestStreakToDate: currentStreak, // TODO: Track historical max
		calculatedAt: new Date(),
		version: 1
	};
}

// ===============================
// UNIVERSAL UTILITY FUNCTIONS
// ===============================

/**
 * Universal adherence calculation (works for any tracker frequency)
 */
function calculateAdherence(
	frequency: TrackerFrequency,
	entries: any[],
	date: string
): number {
	const target = getTargetForFrequency(frequency, date);
	const actual = entries.length;
	return Math.min(actual / target, 1.0);
}

/**
 * Get target count based on tracker frequency
 */
function getTargetForFrequency(frequency: TrackerFrequency, date: string): number {
	switch (frequency) {
		case TrackerFrequency.DAILY:
			return 1;
		case TrackerFrequency.WEEKLY:
			// For weekly trackers, target is 1/7 per day
			return 1 / 7;
		case TrackerFrequency.MONTHLY:
			// For monthly trackers, target is 1/30 per day  
			return 1 / 30;
		default:
			return 1;
	}
}

/**
 * Universal mood correlation (works for any data with mood)
 */
function calculateMoodCorrelation(
	entries: { value?: number; mood?: number }[]
): number {
	const validEntries = entries.filter(e => e.value != null && e.mood != null);
	if (validEntries.length < 2) return 0;

	return calculatePearsonCorrelation(
		validEntries.map(e => e.value!),
		validEntries.map(e => e.mood!)
	);
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
	if (x.length !== y.length || x.length < 2) return 0;

	const n = x.length;
	const sumX = x.reduce((a, b) => a + b, 0);
	const sumY = y.reduce((a, b) => a + b, 0);
	const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
	const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
	const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

	const numerator = n * sumXY - sumX * sumY;
	const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

	if (denominator === 0) return 0;

	return numerator / denominator;
}

/**
 * Universal category breakdown (works for any tracker structure)
 */
function calculateCategoryBreakdown(
	entries: any[]
): { [category: string]: number } {
	const breakdown: { [key: string]: number } = {};

	entries.forEach(entry => {
		const category = entry.tracker?.category?.toLowerCase() || 'uncategorized';
		breakdown[category] = (breakdown[category] || 0) + 1;
	});

	return breakdown;
}

/**
 * Calculate overall mood from all sources
 */
function calculateOverallMoodFromAllSources(sources: {
	journalMoods: number[];
	trackerMoods: number[];
	dedicatedMoods: number[];
}): { average: number; count: number } {
	const allMoods = [
		...sources.journalMoods,
		...sources.trackerMoods,
		...sources.dedicatedMoods
	].filter(mood => mood != null && mood > 0);

	if (allMoods.length === 0) return { average: 0, count: 0 };

	const average = allMoods.reduce((sum, mood) => sum + mood, 0) / allMoods.length;
	return { average: Math.round(average * 10) / 10, count: allMoods.length };
}

/**
 * Calculate average mood from mood values
 */
function calculateAverageMood(moodValues: number[]): number | undefined {
	if (moodValues.length === 0) return undefined;
	return moodValues.reduce((sum, mood) => sum + mood, 0) / moodValues.length;
}

/**
 * Calculate average energy from entries
 */
function calculateAverageEnergy(trackerEntries: any[], journalEntries: any[]): number {
	const energyValues = [
		...trackerEntries.map(e => e.energy).filter(Boolean),
		...journalEntries.map(e => e.energy).filter(Boolean)
	];

	if (energyValues.length === 0) return 0;
	return energyValues.reduce((sum, energy) => sum + energy, 0) / energyValues.length;
}

/**
 * Calculate average quality from quality values
 */
function calculateAverageQuality(qualityValues: number[]): number | undefined {
	if (qualityValues.length === 0) return undefined;
	return qualityValues.reduce((sum, quality) => sum + quality, 0) / qualityValues.length;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
	if (!text || typeof text !== 'string') return 0;
	return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate frequency-aware streak
 */
/**
 * Calculate frequency-aware streak
 */
function calculateFrequencyAwareStreak(
	frequency: TrackerFrequency,
	entries: any[],
	currentDate: string
): number {
	if (!entries || entries.length === 0) return 0;

	// Sort entries by date descending
	const sortedEntries = [...entries]
		.filter(e => e.date <= currentDate) // Exclude future entries
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	if (sortedEntries.length === 0) return 0;

	// Check if there's an entry for the current date (or relevant period) to keep streak alive
	const latestEntryDate = sortedEntries[0].date;
	const current = new Date(currentDate);
	const latest = new Date(latestEntryDate);

	// If latest entry is too old, streak is broken (0)
	// For daily: must be today or yesterday
	// For weekly: must be this week or last week
	// For monthly: must be this month or last month

	const diffTime = current.getTime() - latest.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	let isStreakAlive = false;

	switch (frequency) {
		case TrackerFrequency.DAILY:
			isStreakAlive = diffDays <= 1; // Today or Yesterday
			break;
		case TrackerFrequency.WEEKLY:
			isStreakAlive = diffDays <= 7; // Within last 7 days
			break;
		case TrackerFrequency.MONTHLY:
			const diffMonths = (current.getFullYear() - latest.getFullYear()) * 12 + (current.getMonth() - latest.getMonth());
			isStreakAlive = diffMonths <= 1; // This month or last month
			break;
		default:
			isStreakAlive = diffDays <= 1;
	}

	if (!isStreakAlive) return 0;

	// Calculate Streak
	// We need to group entries by period

	let streak = 0;
	const entryDates = new Set(sortedEntries.map(e => e.date));
	let checkDate = new Date(latestEntryDate); // Start from the latest valid entry

	// Iterate backwards in time
	while (true) {
		const checkDateStr = checkDate.toISOString().split('T')[0];

		// Check if we satisfy the requirement for this period
		let satisfied = false;

		// For daily, satisfied if entry exists on date
		if (frequency === TrackerFrequency.DAILY) {
			satisfied = entryDates.has(checkDateStr);
		}
		// For weekly/monthly we'd need more complex logic checking intervals
		// Simplified: Check if ANY entry exists in the period window
		else if (frequency === TrackerFrequency.WEEKLY) {
			// Check if any entry in the week ending on checkDate
			// For simplicity, let's just count consecutive entries that are <= 7 days apart
			// This is an approximation. A robust solution needs defined week boundaries.
			// Re-implementing with strict checking:

			// Let's use a simpler approach for weekly/monthly: 
			// Just count how many consecutive periods have at least one entry
			break; // Delegate to simpler logic below
		} else {
			break; // Delegate
		}

		if (satisfied) {
			streak++;
			checkDate.setDate(checkDate.getDate() - 1); // Move back one day
		} else {
			break;
		}
	}

	// Alternative logic for Weekly/Monthly (and Daily fallback)
	if (frequency !== TrackerFrequency.DAILY) {
		streak = 1;
		let lastDate = new Date(latestEntryDate);

		for (let i = 1; i < sortedEntries.length; i++) {
			const entryDate = new Date(sortedEntries[i].date);
			const diff = (lastDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);

			let maxGap = 0;
			if (frequency === TrackerFrequency.WEEKLY) maxGap = 8; // Allow slightly more than 7 days
			else if (frequency === TrackerFrequency.MONTHLY) maxGap = 32;

			if (diff <= maxGap) {
				streak++;
				lastDate = entryDate;
			} else {
				break;
			}
		}
	}

	return streak;
}

/**
 * Calculate trend direction
 */
function calculateTrend(
	entries: any[],
	timeframe: 'weekly' | 'monthly'
): 'improving' | 'declining' | 'stable' {
	if (!entries || entries.length < 2) return 'stable';

	// Sort by date ascending to analyze progression
	const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	const days = timeframe === 'weekly' ? 7 : 30;
	if (sorted.length < days / 2) return 'stable'; // Not enough data

	// Split into two halves
	const mid = Math.floor(sorted.length / 2);
	const firstHalf = sorted.slice(0, mid);
	const secondHalf = sorted.slice(mid);

	const getAvg = (arr: any[]) => {
		const vals = arr.map(e => e.value || (e.isCompleted ? 1 : 0)).filter(v => v != null);
		if (vals.length === 0) return 0;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	};

	const avg1 = getAvg(firstHalf);
	const avg2 = getAvg(secondHalf);

	const diff = avg2 - avg1;
	const threshold = avg1 * 0.1; // 10% change

	if (diff > threshold) return 'improving';
	if (diff < -threshold) return 'declining';
	return 'stable';
}

/**
 * Get next milestone threshold
 */
function getNextMilestone(currentStreak: number): number {
	const milestones = [7, 14, 30, 60, 100, 200, 365];
	return milestones.find(m => m > currentStreak) || currentStreak + 100;
}

/**
 * Calculate milestone progress
 */
function calculateMilestoneProgress(currentStreak: number): number {
	const next = getNextMilestone(currentStreak);
	const previous = currentStreak === 0 ? 0 :
		[0, 7, 14, 30, 60, 100, 200, 365].reverse().find(m => m <= currentStreak) || 0;

	if (next === previous) return 1;
	return (currentStreak - previous) / (next - previous);
}

/**
 * Calculate completion rate
 */
/**
 * Calculate completion rate
 */
function calculateCompletionRate(entries: any[], frequency: TrackerFrequency): number {
	if (!entries || entries.length === 0) return 0;

	// Determine date range from entries
	const dates = entries.map(e => new Date(e.date).getTime());
	const minDate = new Date(Math.min(...dates));
	const maxDate = new Date(Math.max(...dates));
	const diffDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

	let expectedEntries = 0;
	switch (frequency) {
		case TrackerFrequency.DAILY:
			expectedEntries = diffDays;
			break;
		case TrackerFrequency.WEEKLY:
			expectedEntries = Math.ceil(diffDays / 7);
			break;
		case TrackerFrequency.MONTHLY:
			expectedEntries = Math.ceil(diffDays / 30);
			break;
	}

	return Math.min(1.0, entries.length / expectedEntries);
}

/**
 * Calculate consistency score (0-100)
 */
function calculateConsistencyScore(activities: any[], trackerEntries: any[]): number {
	if (activities.length === 0 && trackerEntries.length === 0) return 0;

	// Combine all dates with activity
	const activeDates = new Set([
		...activities.map(a => a.date),
		...trackerEntries.map(e => e.date)
	]);

	const dates = Array.from(activeDates).map(d => new Date(d).getTime());
	const minDate = new Date(Math.min(...dates));
	const maxDate = new Date(Math.max(...dates));
	const totalDays = Math.max(7, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))); // Minimum 7 days denominator

	return Math.round((activeDates.size / totalDays) * 100);
}

/**
 * Calculate engagement rate (0-1)
 */
async function calculateEngagementRate(userId: string, date: string): Promise<number> {
	// Check activity over last 7 days
	const endDate = new Date(date);
	const startDate = new Date(endDate);
	startDate.setDate(startDate.getDate() - 6);

	const activities = await getActivitiesForDateRange(userId, startDate.toISOString().split('T')[0], date);
	const activeDays = new Set(activities.map(a => a.date)).size;

	return activeDays / 7;
}

/**
 * Calculate category diversity
 */
function calculateCategoryDiversity(trackerEntries: any[]): number {
	const categories = new Set(trackerEntries.map(e => e.tracker?.category).filter(Boolean));
	const totalCategories = 5; // mind, body, soul, beauty, mood
	return Math.min(1.0, categories.size / totalCategories);
}

/**
 * Calculate energy productivity index
 */
function calculateEnergyProductivity(activities: any[], averageMood: number): number {
	if (activities.length === 0) return 0;
	// mood (1-5 or 1-10) * log(activity count)
	// Assuming mood is 1-5, normalize to 10. If 1-10, keep.
	// Let's assume averageMood is 1-10 scale.
	const moodFactor = averageMood || 5;
	return Math.min(100, Math.round(moodFactor * Math.log2(activities.length + 1) * 10));
}

/**
 * Calculate data quality score
 */
function calculateDataQualityScore(trackerEntries: any[], journalEntries: any[]): number {
	let totalPoints = 0;
	let maxPoints = 0;

	// Tracker quality
	trackerEntries.forEach(e => {
		maxPoints += 3; // base + note + mood
		totalPoints += 1; // base
		if (e.note) totalPoints += 1;
		if (e.mood) totalPoints += 1;
	});

	// Journal quality
	journalEntries.forEach(j => {
		maxPoints += 3; // base + long content + tags
		totalPoints += 1;
		if (j.content && j.content.length > 50) totalPoints += 1;
		if (j.tags && j.tags.length > 0) totalPoints += 1;
	});

	if (maxPoints === 0) return 0;
	return Math.round((totalPoints / maxPoints) * 100);
}

/**
 * Calculate best performance hour
 */
function calculateBestHour(activities: any[]): number {
	if (activities.length === 0) return 10; // Default

	const hourCounts = new Array(24).fill(0);
	activities.forEach(a => {
		const d = a.createdAt ? new Date(a.createdAt) : null;
		if (d) hourCounts[d.getHours()]++;
	});

	const maxCount = Math.max(...hourCounts);
	return hourCounts.indexOf(maxCount);
}

/**
 * Calculate hourly activity distribution
 */
function calculateHourlyActivity(activities: any[]): number[] {
	const hourlyCount = new Array(24).fill(0);
	activities.forEach(activity => {
		if (activity.createdAt) {
			// Handle if createdAt is a Firestore Timestamp or Date string
			const dateVal = activity.createdAt.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt);
			const hour = dateVal.getHours();
			if (hour >= 0 && hour < 24) hourlyCount[hour]++;
		}
	});
	return hourlyCount;
}

/**
 * Calculate mood correlation by category
 */
function calculateMoodCorrelationByCategory(trackerEntries: any[]): {
	mind: number; body: number; soul: number; beauty: number; custom: number;
} {
	const result = { mind: 0, body: 0, soul: 0, beauty: 0, custom: 0 };

	const entriesByCategory: { [key: string]: any[] } = {};

	trackerEntries.forEach(e => {
		const cat = (e.tracker?.category || 'custom').toLowerCase();
		if (!entriesByCategory[cat]) entriesByCategory[cat] = [];
		entriesByCategory[cat].push(e);
	});

	Object.keys(result).forEach(cat => {
		if (entriesByCategory[cat]) {
			result[cat as keyof typeof result] = calculateMoodCorrelation(entriesByCategory[cat]);
		}
	});

	return result;
}

/**
 * Calculate various streak types
 */
function calculateOverallStreak(wasActiveToday: boolean, previousStats: any, yesterdayDate: string): number {
	const prevStreak = previousStats?.overallStreak || 0;
	const prevDate = previousStats?.date;

	if (wasActiveToday) {
		// If previous stats date was yesterday, increment
		if (prevDate === yesterdayDate) return prevStreak + 1;
		// If yesterday missing but active today, streak is 1 (or recovering if we have grace period)
		return 1;
	}

	return 0;
}


async function calculateJournalStreak(userId: string, date: string): Promise<number> {
	// Query last 365 days of journal entries? Expensive.
	// Ideally rely on `user-daily-stats` of yesterday.

	const yesterday = getPreviousDate(date);
	const prevStats = await getUserDailyStats(userId, yesterday);
	const entriesToday = await getJournalEntriesForDate(userId, date);

	if (entriesToday.length > 0) {
		return (prevStats?.journalStreak || 0) + 1;
	}
	return 0;
}

async function calculateTrackerStreak(userId: string, date: string): Promise<number> {
	const yesterday = getPreviousDate(date);
	const prevStats = await getUserDailyStats(userId, yesterday);
	const entriesToday = await getTrackerEntriesForDate(userId, date);

	if (entriesToday.length > 0) {
		return (prevStats?.trackerStreak || 0) + 1;
	}
	return 0;
}

// ===============================
// DATA ACCESS HELPERS
// ===============================

async function getActivitiesForDate(userId: string, date: string): Promise<any[]> {
	const snapshot = await db.collection('activities')
		.where('userId', '==', userId)
		.where('date', '==', date)
		.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getActivitiesForDateRange(userId: string, startDate: string, endDate: string): Promise<any[]> {
	const snapshot = await db.collection('activities')
		.where('userId', '==', userId)
		.where('date', '>=', startDate)
		.where('date', '<=', endDate)
		.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getTrackerEntriesForDate(userId: string, date: string): Promise<any[]>;
async function getTrackerEntriesForDate(userId: string, trackerId: string, date: string): Promise<any[]>;
async function getTrackerEntriesForDate(userId: string, dateOrTrackerId: string, date?: string): Promise<any[]> {
	let query = db.collection('tracker-entries').where('userId', '==', userId);

	if (date) {
		// Three parameter version: userId, trackerId, date
		query = query.where('trackerId', '==', dateOrTrackerId).where('date', '==', date);
	} else {
		// Two parameter version: userId, date
		query = query.where('date', '==', dateOrTrackerId);
	}

	const snapshot = await query.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getJournalEntriesForDate(userId: string, date: string): Promise<any[]> {
	const snapshot = await db.collection('journal-entries')
		.where('userId', '==', userId)
		.where('date', '==', date)
		.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getMoodEntriesForDate(userId: string, date: string): Promise<any[]> {
	const snapshot = await db.collection('mood-entries')
		.where('userId', '==', userId)
		.where('date', '==', date)
		.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getUserTrackers(userId: string): Promise<any[]> {
	const snapshot = await db.collection('trackers')
		.where('userId', '==', userId)
		.where('isActive', '==', true)
		.get();
	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getTracker(trackerId: string): Promise<any | null> {
	const doc = await db.collection('trackers').doc(trackerId).get();
	return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getTrackerEntriesForPeriod(userId: string, trackerId: string, days: number): Promise<any[]> {
	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const snapshot = await db.collection('tracker-entries')
		.where('userId', '==', userId)
		.where('trackerId', '==', trackerId)
		.where('createdAt', '>=', startDate)
		.where('createdAt', '<=', endDate)
		.get();

	return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getUserDailyStats(userId: string, date: string): Promise<any | null> {
	const doc = await db.collection('user-daily-stats').doc(`${userId}_${date}`).get();
	return doc.exists ? doc.data() : null;
}

async function getTrackerDailyStats(trackerId: string, date: string): Promise<any | null> {
	const doc = await db.collection('tracker-daily-stats').doc(`${trackerId}_${date}`).get();
	return doc.exists ? doc.data() : null;
}

// ===============================
// DATA SAVING FUNCTIONS
// ===============================

async function saveUserDailyStats(userId: string, date: string, stats: UserDailyStats): Promise<void> {
	await db.collection('user-daily-stats').doc(`${userId}_${date}`).set(stats);
}

async function saveTrackerDailyStats(trackerId: string, date: string, stats: TrackerDailyStats): Promise<void> {
	// Save daily stat
	await db.collection('tracker-daily-stats').doc(`${trackerId}_${date}`).set(stats);

	// Also update the main tracker document with the latest stats for quick access
	// We strictly only update if this stat is for today or yesterday (latest relevant data)
	// to avoid overwriting with historical backfills
	const today = new Date().toISOString().split('T')[0];
	const yesterday = getPreviousDate(today);

	if (date >= yesterday) {
		try {
			await db.collection('trackers').doc(trackerId).update({
				'stats': {
					trackerId: trackerId,
					currentStreak: stats.currentStreak,
					longestStreak: stats.longestStreakToDate,
					completionRate: stats.completionRate,
					weeklyCount: 0, // Placeholder
					monthlyCount: 0, // Placeholder
					weeklyAverage: 0, // Placeholder
					monthlyAverage: 0, // Placeholder
					lastWeekChange: stats.weeklyTrend === 'improving' ? 10 : (stats.weeklyTrend === 'declining' ? -10 : 0),
					lastMonthChange: 0,
					averageMoodWhenCompleted: stats.averageMood || 0,
					moodCorrelation: stats.moodCorrelation || 0,
					lastUpdated: new Date()
				}
			});
		} catch (error) {
			console.error(`Failed to update parent tracker ${trackerId} with stats:`, error);
			// Swallow error to ensuring daily stat saving isn't rolled back effectively (though explicit transaction would be better)
		}
	}
}

async function saveJournalDailyStats(userId: string, date: string, stats: JournalDailyStats): Promise<void> {
	await db.collection('journal-daily-stats').doc(`${userId}_journal_${date}`).set(stats);
}

async function updateUserOverallStats(userId: string, date: string): Promise<void> {
	try {
		// Fetch recent stats to calculate aggregates
		const endDate = new Date(date);
		const startDate = new Date(endDate);
		startDate.setDate(startDate.getDate() - 30);

		const snapshot = await db.collection('user-daily-stats')
			.where('userId', '==', userId)
			.where('date', '>=', startDate.toISOString().split('T')[0])
			.orderBy('date', 'desc')
			.get();

		const recentStats = snapshot.docs.map(doc => doc.data());

		if (recentStats.length === 0) return;

		// Determine trends
		// ... logic for trends

		const latestStat = recentStats[0]; // Assuming date is latest

		// Update user document
		await db.collection('users').doc(userId).update({
			'stats.currentStreaks': latestStat.overallStreak || 0,
			'stats.lastStatsCalculated': new Date(),
			'stats.weeklyActivityScore': latestStat.consistencyIndex || 0
			// Add more fields as needed mapping from UserOverviewStats
		});

	} catch (error) {
		console.error(`Failed to update overall stats for user ${userId}:`, error);
	}
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

function getPreviousDate(date: string): string {
	const d = new Date(date);
	d.setDate(d.getDate() - 1);
	return d.toISOString().split('T')[0];
}

function getLast30Days(date: string): number {
	return 30;
}

// ===============================
// BATCH PROCESSING HELPERS
// ===============================

/**
 * Get all users eligible for stats calculation (used by scheduler)
 * Only calculates stats for active subscribers and trial users (regardless of activity)
 */
export async function getActiveUsers(): Promise<{ id: string }[]> {
	// Get all paid users (regardless of last activity)
	const activeSubscribersSnapshot = await db.collection('users')
		.where('status', '==', 'active')
		.select('id')
		.get();

	// Get all trial users (regardless of last activity)
	const trialUsersSnapshot = await db.collection('users')
		.where('status', '==', 'trial')
		.select('id')
		.get();

	// Combine both groups
	const eligibleUsers = [
		...activeSubscribersSnapshot.docs.map(doc => ({ id: doc.id })),
		...trialUsersSnapshot.docs.map(doc => ({ id: doc.id }))
	];

	// Remove duplicates (if any)
	const uniqueUsers = eligibleUsers.filter((user, index, self) =>
		index === self.findIndex(u => u.id === user.id)
	);

	return uniqueUsers;
}

/**
 * Get all users (for backfill operations)
 */
export async function getAllUsers(): Promise<{ id: string }[]> {
	const snapshot = await db.collection('users').select('id').get();
	return snapshot.docs.map(doc => ({ id: doc.id }));
}

// ===============================
// BACKFILL SYSTEM
// ===============================

/**
 * Backfill progress tracking interface
 */
interface BackfillProgress {
	userId: string;
	startDate: string;
	endDate: string;
	currentDate: string;
	daysProcessed: number;
	totalDays: number;
	status: 'pending' | 'in-progress' | 'completed' | 'failed';
	errors: string[];
	startedAt: Date;
	completedAt?: Date;
	lastResumedAt?: Date;
}

/**
 * Backfill daily stats for a user over a date range
 * Supports resume capability - will skip already calculated dates
 */
export async function backfillUserDailyStats(
	userId: string,
	options: {
		startDate?: string;
		endDate?: string;
		days?: number;
		forceRecalculate?: boolean;
		batchSize?: number;
	} = {}
): Promise<BackfillProgress> {
	const endDate = options.endDate || new Date().toISOString().split('T')[0];
	const startDate = options.startDate ||
		new Date(Date.now() - (options.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	const batchSize = options.batchSize || 10;
	const forceRecalculate = options.forceRecalculate || false;

	// Calculate total days
	const start = new Date(startDate);
	const end = new Date(endDate);
	const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

	// Initialize or resume progress
	const progressDocRef = db.collection('backfill-progress').doc(userId);
	let progress: BackfillProgress;

	const existingProgress = await progressDocRef.get();
	if (existingProgress.exists && !forceRecalculate) {
		const existing = existingProgress.data() as BackfillProgress;
		if (existing.status === 'completed' && existing.endDate >= endDate) {
			console.log(`Backfill already completed for user ${userId}`);
			return existing;
		}
		// Resume from where we left off
		progress = {
			...existing,
			status: 'in-progress',
			lastResumedAt: new Date()
		};
	} else {
		progress = {
			userId,
			startDate,
			endDate,
			currentDate: startDate,
			daysProcessed: 0,
			totalDays,
			status: 'in-progress',
			errors: [],
			startedAt: new Date()
		};
	}

	// Save initial progress
	await progressDocRef.set(progress);

	// Generate date range
	const dates: string[] = [];
	let currentDate = new Date(progress.currentDate);
	while (currentDate <= end) {
		dates.push(currentDate.toISOString().split('T')[0]);
		currentDate.setDate(currentDate.getDate() + 1);
	}

	// Process in batches
	for (let i = 0; i < dates.length; i += batchSize) {
		const batch = dates.slice(i, i + batchSize);

		await Promise.all(batch.map(async (date) => {
			try {
				// Check if stats already exist (unless force recalculate)
				if (!forceRecalculate) {
					const existingStats = await getUserDailyStats(userId, date);
					if (existingStats) {
						console.log(`Stats already exist for ${userId} on ${date}, skipping`);
						return;
					}
				}

				// Calculate stats for this date
				await calculateUserDailyStats(userId, date);
				console.log(`Calculated stats for ${userId} on ${date}`);
			} catch (error) {
				const errorMsg = `Failed to calculate stats for ${date}: ${error}`;
				console.error(errorMsg);
				progress.errors.push(errorMsg);
			}
		}));

		// Update progress
		progress.daysProcessed = Math.min(i + batchSize, dates.length);
		progress.currentDate = batch[batch.length - 1];
		await progressDocRef.update({
			daysProcessed: progress.daysProcessed,
			currentDate: progress.currentDate,
			errors: progress.errors
		});

		// Small delay to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	// Mark as completed
	progress.status = progress.errors.length > 0 ? 'completed' : 'completed';
	progress.completedAt = new Date();
	await progressDocRef.set(progress);

	console.log(`Backfill completed for user ${userId}. Processed ${progress.daysProcessed} days with ${progress.errors.length} errors.`);
	return progress;
}

/**
 * Backfill stats for all users
 */
export async function backfillAllUsers(
	options: {
		days?: number;
		forceRecalculate?: boolean;
		maxConcurrentUsers?: number;
	} = {}
): Promise<{ processed: number; failed: number; results: BackfillProgress[] }> {
	const users = await getAllUsers();
	const maxConcurrent = options.maxConcurrentUsers || 5;
	const results: BackfillProgress[] = [];
	let processed = 0;
	let failed = 0;

	// Process in batches of concurrent users
	for (let i = 0; i < users.length; i += maxConcurrent) {
		const userBatch = users.slice(i, i + maxConcurrent);

		const batchResults = await Promise.all(
			userBatch.map(async (user) => {
				try {
					const progress = await backfillUserDailyStats(user.id, {
						days: options.days,
						forceRecalculate: options.forceRecalculate
					});
					processed++;
					return progress;
				} catch (error) {
					console.error(`Failed to backfill user ${user.id}:`, error);
					failed++;
					return {
						userId: user.id,
						startDate: '',
						endDate: '',
						currentDate: '',
						daysProcessed: 0,
						totalDays: 0,
						status: 'failed' as const,
						errors: [`${error}`],
						startedAt: new Date()
					};
				}
			})
		);

		results.push(...batchResults);
		console.log(`Backfill progress: ${processed + failed}/${users.length} users processed`);

		// Delay between batches
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	return { processed, failed, results };
}

/**
 * Get backfill progress for a user
 */
export async function getBackfillProgress(userId: string): Promise<BackfillProgress | null> {
	const doc = await db.collection('backfill-progress').doc(userId).get();
	return doc.exists ? doc.data() as BackfillProgress : null;
}

/**
 * Validate backfill data quality
 */
export async function validateBackfillData(
	userId: string,
	options: { startDate?: string; endDate?: string; days?: number } = {}
): Promise<{
	isValid: boolean;
	missingDates: string[];
	invalidStats: string[];
	coverage: number;
}> {
	const endDate = options.endDate || new Date().toISOString().split('T')[0];
	const startDate = options.startDate ||
		new Date(Date.now() - (options.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

	const missingDates: string[] = [];
	const invalidStats: string[] = [];
	let validCount = 0;

	// Generate date range
	const start = new Date(startDate);
	const end = new Date(endDate);
	const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

	let currentDate = new Date(startDate);
	while (currentDate <= end) {
		const dateStr = currentDate.toISOString().split('T')[0];
		const stats = await getUserDailyStats(userId, dateStr);

		if (!stats) {
			// Check if user had any activity on this date
			const activities = await getActivitiesForDate(userId, dateStr);
			const entries = await getTrackerEntriesForDate(userId, dateStr);

			if (activities.length > 0 || entries.length > 0) {
				missingDates.push(dateStr);
			}
		} else {
			// Validate stats structure
			if (!stats.id || !stats.date || stats.version === undefined) {
				invalidStats.push(dateStr);
			} else {
				validCount++;
			}
		}

		currentDate.setDate(currentDate.getDate() + 1);
	}

	const coverage = totalDays > 0 ? (validCount / totalDays) * 100 : 0;

	return {
		isValid: missingDates.length === 0 && invalidStats.length === 0,
		missingDates,
		invalidStats,
		coverage
	};
}

/**
 * Repair missing stats for dates with activity
 */
export async function repairMissingStats(userId: string): Promise<{
	repaired: number;
	failed: number;
	dates: string[];
}> {
	const validation = await validateBackfillData(userId, { days: 90 });
	const repairedDates: string[] = [];
	let repaired = 0;
	let failed = 0;

	for (const date of validation.missingDates) {
		try {
			await calculateUserDailyStats(userId, date);
			repairedDates.push(date);
			repaired++;
		} catch (error) {
			console.error(`Failed to repair stats for ${userId} on ${date}:`, error);
			failed++;
		}
	}

	return { repaired, failed, dates: repairedDates };
}
