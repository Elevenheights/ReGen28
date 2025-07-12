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