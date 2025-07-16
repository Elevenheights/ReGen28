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
  totalTrackerEntries: number;
  totalJournalEntries: number;
  totalMeditationMinutes: number;
  completedTrackers: number;
  currentStreaks: number;
  longestStreak: number;
  weeklyActivityScore: number;
  monthlyGoalsCompleted: number;
} 