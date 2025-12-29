/**
 * Comprehensive Statistics System Interfaces
 * Pre-calculated daily statistics for instant analytics
 */

// ===============================
// USER DAILY STATISTICS
// ===============================

export interface UserDailyStats {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  
  // === AGGREGATED ACTIVITY METRICS ===
  totalActivities: number;
  totalTrackerEntries: number;
  totalJournalEntries: number;
  
  // === OVERALL MOOD & WELLNESS (ALL SOURCES) ===
  overallAverageMood: number;        // Combined from journals + trackers + mood entries
  overallAverageEnergy: number;      // Combined from all sources
  moodSources: {
    journal: number;                 // Count of journal mood entries
    trackers: number;                // Count of tracker mood entries  
    moodEntries: number;             // Count of dedicated mood entries
  };
  
  // === STREAKS AS OF THIS DAY ===
  overallStreak: number;             // Combined activity streak
  journalStreak: number;             // Journal-specific streak
  trackerStreak: number;             // Tracker-specific streak
  
  // === CATEGORY BREAKDOWN ===
  mindMinutes: number;               // Mind category total time
  bodyActivities: number;            // Body category entry count
  soulActivities: number;            // Soul category entry count
  beautyRoutines: number;            // Beauty category entry count
  
  // === ACHIEVEMENTS & PROGRESS ===
  achievementsEarned: string[];      // Achievement IDs earned this day
  pointsEarned: number;              // Total achievement points earned
  
  // === UNIVERSAL ENGAGEMENT METRICS ===
  engagementRate: number;            // Active days / period (0-1)
  consistencyIndex: number;          // Rolling 7-day consistency (0-100)
  categoryDiversity: number;         // Categories used / total categories (0-1)
  energyProductivity: number;        // Energy × log(entries) normalized (0-100)
  dataQualityScore: number;          // Field completeness percentage (0-100)
  
  // === PERFORMANCE INSIGHTS ===
  bestHour: number;                  // Peak performance hour (0-23 UTC)
  hourlyActivity: number[];          // 24-element array of activity by hour
  moodCorrelationByCategory: {       // Pearson correlation mood vs activity
    mind: number;
    body: number;
    soul: number;
    beauty: number;
    custom: number;
  };
  
  // === METADATA ===
  calculatedAt: Date;
  version: number;
}

// ===============================
// TRACKER DAILY STATISTICS
// ===============================

export interface TrackerDailyStats {
  id: string;
  trackerId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  
  // === ENTRY METRICS FOR THIS DAY ===
  entriesCount: number;
  totalValue: number;
  averageValue: number;
  
  // === MOOD DATA FOR THIS DAY ===
  averageMood?: number;
  averageEnergy?: number;
  averageQuality?: number;
  
  // === STREAKS AS OF THIS DAY ===
  currentStreak: number;             // Frequency-aware streak
  longestStreakToDate: number;       // Historical maximum
  
  // === COMPLETION & ADHERENCE ===
  wasCompleted: boolean;             // Met target for this day
  adherence: number;                 // 0-1 based on tracker frequency
  completionRate: number;            // Running completion percentage
  
  // === TRENDS ===
  weeklyTrend: 'improving' | 'declining' | 'stable';
  monthlyTrend: 'improving' | 'declining' | 'stable';
  
  // === MILESTONE PROGRESS ===
  nextMilestone: number;             // Next streak threshold (7,14,30,100...)
  milestoneProgress: number;         // Progress to next milestone (0-1)
  
  // === PERFORMANCE CORRELATION ===
  moodCorrelation: number;           // Value vs mood correlation (-1 to 1)
  
  // === METADATA ===
  calculatedAt: Date;
  version: number;
}

// ===============================
// JOURNAL DAILY STATISTICS
// ===============================

export interface JournalDailyStats {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  
  // === ENTRY METRICS FOR THIS DAY ===
  entriesCount: number;
  totalWords: number;
  averageWordsPerEntry: number;
  
  // === MOOD DATA FOR THIS DAY ===
  averageMood?: number;
  averageEnergy?: number;
  moodRange: { min: number; max: number };
  
  // === CONTENT ANALYSIS ===
  categoriesUsed: string[];          // Journal categories used
  tagsUsed: string[];                // Tags used this day
  sentimentScore?: number;           // AI sentiment analysis (-1 to 1)
  
  // === STREAKS AS OF THIS DAY ===
  currentStreak: number;
  longestStreakToDate: number;
  
  // === METADATA ===
  calculatedAt: Date;
  version: number;
}

// ===============================
// ENHANCED USER STATS INTERFACE
// ===============================

export interface EnhancedUserStats {
  // === CURRENT BASIC STATS (EXISTING) ===
  totalTrackerEntries: number;
  totalJournalEntries: number;
  completedTrackers: number;
  currentStreaks: number;
  longestStreak: number;
  weeklyActivityScore: number;
  monthlyGoalsCompleted: number;
  
  // === NEW MOOD & WELLNESS ANALYTICS ===
  overallAverageMood: number;        // All-time average from all sources
  overallMoodTrend: 'improving' | 'declining' | 'stable';
  weeklyMoodAverage: number;         // Last 7 days average
  monthlyMoodAverage: number;        // Last 30 days average
  averageEnergyLevel: number;        // All-time average energy
  energyTrend: 'improving' | 'declining' | 'stable';
  
  // === NEW ACTIVITY BREAKDOWNS ===
  weeklyTrackerEntries: number;      // Last 7 days
  monthlyTrackerEntries: number;     // Last 30 days
  weeklyJournalEntries: number;      // Last 7 days
  monthlyJournalEntries: number;     // Last 30 days
  totalActivities: number;           // All activity records
  todayActivityCount: number;        // Today's activities
  weeklyActivityCount: number;       // Last 7 days activities
  monthlyActivityCount: number;      // Last 30 days activities
  
  // === NEW ACHIEVEMENT STATS ===
  totalAchievementsEarned: number;
  totalAchievementPoints: number;
  recentAchievements: number;        // This week
  activeTrackersCount: number;
  completedTrackersCount: number;
  
  // === NEW ENHANCED STREAKS ===
  journalStreak: number;             // Journal-only streak
  trackerStreak: number;             // Tracker-only streak
  overallActivityStreak: number;     // Any activity streak
  longestJournalStreak: number;      // Historical journal max
  longestTrackerStreak: number;      // Historical tracker max
  longestActivityStreak: number;     // Historical activity max
  
  // === NEW CONSISTENCY METRICS ===
  weeklyConsistencyScore: number;    // % of weekly goals met (0-100)
  monthlyConsistencyScore: number;   // % of monthly goals met (0-100)
  averageSessionsPerWeek: number;    // Rolling average
  averageSessionDuration: number;    // Average minutes per session
  preferredActivityTime: string;     // Peak usage hour ("14:00")
  
  // === NEW CATEGORY STATS ===
  totalMindMinutes: number;          // All Mind category time
  totalBodySessions: number;         // All Body category sessions
  totalSoulActivities: number;       // All Soul category activities
  totalBeautyRoutines: number;       // All Beauty category routines
  
  // === NEW SYSTEM METADATA ===
  lastStatsCalculated: Date;         // Last calculation timestamp
  statsCalculationVersion: number;   // For migration tracking
  dataQualityScore: number;          // Overall data completeness (0-100)
}

// ===============================
// ANALYTICS HELPER INTERFACES
// ===============================

export interface MoodAnalytics {
  averageMood: number;
  trend: 'improving' | 'declining' | 'stable';
  weeklyData: { week: string; averageMood: number; entryCount: number }[];
  sourceBreakdown: {
    journal: number;
    trackers: number;
    moodEntries: number;
  };
  correlationWithActivity: number;
}

export interface PerformanceMetrics {
  bestPerformanceHour: number;
  peakProductivityDays: string[];
  energyProductivityIndex: number;
  consistencyScore: number;
  categoryEngagement: {
    mind: number;
    body: number;
    soul: number;
    beauty: number;
  };
}

export interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable';
  confidence: number; // 0-1
  changePercentage: number;
  timeframe: 'weekly' | 'monthly';
}

export interface MilestoneProgress {
  current: number;
  next: number;
  progress: number; // 0-1
  estimatedDaysToNext: number;
  milestoneHistory: { milestone: number; achievedDate: Date }[];
}

export interface WritingAnalytics {
  averageWordsPerEntry: number;
  writingStreak: number;
  preferredWritingTime: string;
  topCategories: string[];
  sentimentTrend: 'improving' | 'declining' | 'stable';
}

export interface MoodCorrelation {
  trackerCorrelations: { [trackerId: string]: number };
  categoryCorrelations: {
    mind: number;
    body: number;
    soul: number;
    beauty: number;
  };
  timeOfDayCorrelation: number[];
}

// ===============================
// DATA ACCESS INTERFACES
// ===============================

export interface StatsQuery {
  userId: string;
  startDate?: string;
  endDate?: string;
  trackerId?: string;
  limit?: number;
}

export interface WeeklyMoodTrend {
  week: string;
  averageMood: number;
  entryCount: number;
}

export interface CategoryBreakdown {
  [category: string]: number;
}

export interface HourlyActivityPattern {
  hour: number;
  activityCount: number;
  averageMood?: number;
  averageEnergy?: number;
} 