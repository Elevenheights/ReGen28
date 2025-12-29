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
  const overallStreak = calculateOverallStreak(userId, date, previousStats);
  const journalStreak = calculateJournalStreak(userId, date);
  const trackerStreak = calculateTrackerStreak(userId, date);
  
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
    achievementsEarned: [], // TODO: Implement achievement detection
    pointsEarned: 0, // TODO: Implement points calculation
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
function calculateFrequencyAwareStreak(
  frequency: TrackerFrequency,
  entries: any[],
  currentDate: string
): number {
  // TODO: Implement sophisticated streak calculation based on frequency
  // For now, return simple count
  return entries.filter(e => e.date === currentDate).length > 0 ? 1 : 0;
}

/**
 * Calculate trend direction
 */
function calculateTrend(
  entries: any[],
  timeframe: 'weekly' | 'monthly'
): 'improving' | 'declining' | 'stable' {
  // TODO: Implement trend analysis
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
function calculateCompletionRate(entries: any[], frequency: TrackerFrequency): number {
  // TODO: Implement completion rate calculation
  return 0.8; // Placeholder
}

/**
 * Calculate consistency score
 */
function calculateConsistencyScore(activities: any[], trackerEntries: any[]): number {
  // TODO: Implement consistency scoring
  return 75; // Placeholder
}

/**
 * Calculate engagement rate
 */
async function calculateEngagementRate(userId: string, date: string): Promise<number> {
  // TODO: Implement engagement rate calculation
  return 0.8; // Placeholder
}

/**
 * Calculate category diversity
 */
function calculateCategoryDiversity(trackerEntries: any[]): number {
  const categories = new Set(trackerEntries.map(e => e.tracker?.category).filter(Boolean));
  const totalCategories = 5; // mind, body, soul, beauty, custom
  return categories.size / totalCategories;
}

/**
 * Calculate energy productivity index
 */
function calculateEnergyProductivity(activities: any[], averageMood: number): number {
  if (activities.length === 0) return 0;
  return averageMood * Math.log(1 + activities.length) * 10; // Normalized to 0-100
}

/**
 * Calculate data quality score
 */
function calculateDataQualityScore(trackerEntries: any[], journalEntries: any[]): number {
  // TODO: Implement data quality scoring based on field completeness
  return 85; // Placeholder
}

/**
 * Calculate best performance hour
 */
function calculateBestHour(activities: any[]): number {
  // TODO: Implement hour analysis
  return 10; // Placeholder (10 AM)
}

/**
 * Calculate hourly activity distribution
 */
function calculateHourlyActivity(activities: any[]): number[] {
  const hourlyCount = new Array(24).fill(0);
  
  activities.forEach(activity => {
    if (activity.createdAt) {
      const hour = new Date(activity.createdAt).getHours();
      hourlyCount[hour]++;
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
  // TODO: Implement category-specific mood correlation
  return { mind: 0.3, body: 0.5, soul: 0.4, beauty: 0.2, custom: 0.1 };
}

/**
 * Calculate various streak types
 */
function calculateOverallStreak(userId: string, date: string, previousStats: any): number {
  // TODO: Implement overall activity streak
  return 1;
}

async function calculateJournalStreak(userId: string, date: string): Promise<number> {
  // TODO: Implement journal-specific streak
  return 1;
}

function calculateTrackerStreak(userId: string, date: string): number {
  // TODO: Implement tracker-specific streak
  return 1;
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
  await db.collection('tracker-daily-stats').doc(`${trackerId}_${date}`).set(stats);
}

async function saveJournalDailyStats(userId: string, date: string, stats: JournalDailyStats): Promise<void> {
  await db.collection('journal-daily-stats').doc(`${userId}_journal_${date}`).set(stats);
}

async function updateUserOverallStats(userId: string, date: string): Promise<void> {
  // TODO: Implement aggregated stats update for user profile
  console.log(`TODO: Update overall stats for user ${userId} based on date ${date}`);
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