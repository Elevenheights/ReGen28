export interface User {
  id: string;
  email: string;
  displayName?: string;
  gender?: string;
  birthday?: string;
  photoURL?: string;
  
  // Wellness journey data
  joinDate: Date;
  currentDay: number;
  streakCount: number;
  
  // Wellness goals and focus areas from onboarding
  wellnessGoals?: string[];
  focusAreas?: string[];
  commitmentLevel?: 'light' | 'moderate' | 'intensive';
  
  // User preferences
  preferences: UserPreferences;
  
  // Stats and analytics
  stats: UserStats;
  
  // Onboarding status
  isOnboardingComplete: boolean;
  
  // Subscription status
  status: 'active' | 'inactive' | 'suspended'; // active = paid/trial users, inactive = expired trial users without AI suggestions
  subscriptionType?: 'trial' | 'premium' | 'expired'; // Track subscription type
  trialEndsAt?: Date; // When free trial expires
  lastActiveAt?: Date; // Track when user was last active
  
  // Suggestion tracking (new fields)
  lastSuggestionsGeneratedDate?: string; // YYYY-MM-DD format in user's timezone
  lastSuggestionsGeneratedAt?: Date;      // Timestamp when suggestions were last generated
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  // Notifications
  dailyReminders: boolean;
  reminderTime: string; // Format: "09:00"
  weeklyReports: boolean;
  milestoneNotifications: boolean;
  
  // App settings
  darkMode: boolean;
  language: string;
  timezone: string; // IANA timezone (e.g., "America/New_York", "Europe/London")
  
  // Privacy
  dataSharing: boolean;
  analytics: boolean;
  backupEnabled: boolean;
}

export interface UserStats {
  // === CURRENT BASIC STATS (EXISTING) ===
  totalTrackerEntries: number;
  totalJournalEntries: number;
  completedTrackers: number;
  currentStreaks: number;
  longestStreak: number;
  weeklyActivityScore: number;
  monthlyGoalsCompleted: number;
  
  // === NEW MOOD & WELLNESS ANALYTICS ===
  overallAverageMood?: number;        // All-time average from all sources
  overallMoodTrend?: 'improving' | 'declining' | 'stable';
  weeklyMoodAverage?: number;         // Last 7 days average
  monthlyMoodAverage?: number;        // Last 30 days average
  averageEnergyLevel?: number;        // All-time average energy
  energyTrend?: 'improving' | 'declining' | 'stable';
  
  // === NEW ACTIVITY BREAKDOWNS ===
  weeklyTrackerEntries?: number;      // Last 7 days
  monthlyTrackerEntries?: number;     // Last 30 days
  weeklyJournalEntries?: number;      // Last 7 days
  monthlyJournalEntries?: number;     // Last 30 days
  totalActivities?: number;           // All activity records
  todayActivityCount?: number;        // Today's activities
  weeklyActivityCount?: number;       // Last 7 days activities
  monthlyActivityCount?: number;      // Last 30 days activities
  
  // === NEW ACHIEVEMENT STATS ===
  totalAchievementsEarned?: number;
  totalAchievementPoints?: number;
  recentAchievements?: number;        // This week
  activeTrackersCount?: number;
  completedTrackersCount?: number;
  
  // === NEW ENHANCED STREAKS ===
  journalStreak?: number;             // Journal-only streak
  trackerStreak?: number;             // Tracker-only streak
  overallActivityStreak?: number;     // Any activity streak
  longestJournalStreak?: number;      // Historical journal max
  longestTrackerStreak?: number;      // Historical tracker max
  longestActivityStreak?: number;     // Historical activity max
  
  // === NEW CONSISTENCY METRICS ===
  weeklyConsistencyScore?: number;    // % of weekly goals met (0-100)
  monthlyConsistencyScore?: number;   // % of monthly goals met (0-100)
  averageSessionsPerWeek?: number;    // Rolling average
  averageSessionDuration?: number;    // Average minutes per session
  preferredActivityTime?: string;     // Peak usage hour ("14:00")
  
  // === NEW CATEGORY STATS ===
  totalMindMinutes?: number;          // All Mind category time
  totalBodySessions?: number;         // All Body category sessions
  totalSoulActivities?: number;       // All Soul category activities
  totalBeautyRoutines?: number;       // All Beauty category routines
  
  // === NEW SYSTEM METADATA ===
  lastStatsCalculated?: Date;         // Last calculation timestamp
  statsCalculationVersion?: number;   // For migration tracking
  dataQualityScore?: number;          // Overall data completeness (0-100)
} 