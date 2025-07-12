export interface UserPreferences {
  // Notifications
  dailyReminders: boolean;
  reminderTime: string; // Format: "09:00"
  weeklyReports: boolean;
  milestoneNotifications: boolean;
  achievementNotifications: boolean;

  // App settings
  darkMode: boolean;
  language: string; // e.g., 'en', 'es'
  
  // Tracker settings
  defaultTrackerView: 'list' | 'grid';
  showCompletedTrackers: boolean;

  // Journal settings
  defaultJournalFont: string;
  autoSaveJournal: boolean;
}

export interface NotificationSettings {
  // Push notifications
  pushEnabled: boolean;
  reminders: boolean;
  achievements: boolean;
  goals: boolean;
  social: boolean;

  // Email notifications
  emailEnabled: boolean;
  weeklySummary: boolean;
  monthlyReport: boolean;
  productUpdates: boolean;
}

export interface PrivacySettings {
  // Data sharing
  profileVisibility: 'private' | 'friends' | 'public';
  shareActivity: boolean;

  // Analytics
  analyticsEnabled: boolean;
  personalizedContent: boolean;
  
  // Data management
  backupEnabled: boolean;
  lastBackupDate?: Date;
}

export interface AccountSettings {
  email: string;
  username?: string;
  passwordLastChanged?: Date;
  isPremium: boolean;
  subscriptionTier?: 'monthly' | 'yearly';
  subscriptionEndDate?: Date;
}

export interface AppSettings {
  id: string; // Should match userId
  preferences: UserPreferences;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  account: AccountSettings;
  lastUpdated: Date;
} 