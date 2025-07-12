export enum TrackerCategory {
  MIND = 'mind',           // meditation, focus, learning, mental exercises
  BODY = 'body',          // exercise, sleep, nutrition, physical health
  SOUL = 'soul',          // gratitude, prayer, connection, spiritual practices
  BEAUTY = 'beauty',      // skincare, grooming, self-care, beauty routines
  MOOD = 'mood',          // universal daily mood tracking
  CUSTOM = 'custom'       // user-defined tracker types
}

export enum TrackerType {
  DURATION = 'duration',   // minutes, hours
  COUNT = 'count',        // steps, glasses, sessions
  RATING = 'rating',      // 1-5 quality scale
  BOOLEAN = 'boolean',    // yes/no completion
  SCALE = 'scale'         // 1-10 mood/wellness scale
}

export enum TrackerFrequency {
  DAILY = 'daily',         // track every day
  WEEKLY = 'weekly',       // track weekly goals
  MONTHLY = 'monthly'      // track monthly goals
}

export interface LoggingFieldConfig {
  // Core tracking (always required)
  value: true;             // Always required - the main metric
  
  // Emotional/Mental state
  mood?: boolean;          // 1-10 mood scale
  energy?: boolean;        // 1-5 energy scale
  
  // Quality metrics
  duration?: boolean;      // actual time spent
  intensity?: boolean;     // 1-10 how hard/intense
  quality?: boolean;       // 1-10 satisfaction/quality
  
  // Context & Notes
  notes?: boolean;         // text notes
  tags?: boolean;          // categorization tags
  socialContext?: boolean; // alone/with-others/group
  
  // Media & Location
  photos?: boolean;        // photo uploads
  location?: boolean;      // GPS/address tracking
  weather?: boolean;       // weather context
  attachments?: boolean;   // file attachments
  
  // Custom fields (for future expansion)
  customFields?: {
    [fieldName: string]: {
      type: 'text' | 'number' | 'scale' | 'boolean' | 'select';
      label: string;
      options?: string[];  // for select type
      min?: number;        // for number/scale
      max?: number;        // for number/scale
    };
  };
}

export interface Tracker {
  id: string;
  userId: string;
  name: string;
  category: TrackerCategory;
  type: TrackerType;
  
  // Display properties
  color: string;
  icon: string;
  
  // Target and measurement
  target: number;
  unit: string;
  frequency: TrackerFrequency; // how often to track this habit
  
  // Duration and lifecycle
  durationDays: number;        // default 28, how long this tracker should run
  startDate: Date;             // when the tracker challenge started
  endDate: Date;               // calculated: startDate + durationDays
  isCompleted: boolean;        // whether the challenge period is finished
  timesExtended: number;       // how many times the tracker has been extended
  isOngoing: boolean;          // if true, tracker runs indefinitely (no end date)
  
  // Status
  isActive: boolean;
  isDefault: boolean;
  
  // Configuration
  config?: TrackerConfig;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Optional stats (calculated, not required for every tracker)
  stats?: TrackerStats;
}

export interface TrackerConfig {
  // Reminders
  reminderEnabled: boolean;
  reminderTime?: string;
  reminderDays?: string[]; // ['monday', 'tuesday', ...]
  
  // Logging configuration - which fields to show/require
  loggingFields?: LoggingFieldConfig;
  
  // Photo requirements
  requirePhotos?: boolean;
  maxPhotos?: number;
  
  // Custom options for specific tracker types (deprecated in favor of loggingFields.customFields)
  customOptions?: any;
}

export interface TrackerEntry {
  id: string;
  trackerId: string;
  userId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  
  // Core data
  value: number;
  
  // Optional metadata
  mood?: number;           // 1-10 scale
  energy?: number;         // 1-5 scale
  notes?: string;
  
  // Media & context
  photos?: string[];       // URLs to stored images
  location?: GeoLocation;
  weather?: WeatherData;
  
  // Categorization
  tags?: string[];
  socialContext?: 'alone' | 'with-others' | 'group';
  
  // Quality metrics
  duration?: number;       // actual time spent (minutes)
  intensity?: number;      // 1-10 scale
  quality?: number;        // 1-10 satisfaction scale
  
  // System data
  reminderTriggered?: boolean;
  deviceInfo?: string;     // 'mobile' | 'web'
  attachments?: string[];  // URLs to files/audio
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;       // 'sunny', 'cloudy', 'rainy', etc.
  humidity?: number;
}

export interface TrackerStats {
  trackerId: string;
  
  // Streak data
  currentStreak: number;
  longestStreak: number;
  
  // Completion metrics
  completionRate: number;  // percentage
  weeklyCount: number;
  monthlyCount: number;
  
  // Averages
  weeklyAverage: number;
  monthlyAverage: number;
  
  // Trends
  lastWeekChange: number;  // percentage change
  lastMonthChange: number;
  
  // Mood correlation
  averageMoodWhenCompleted: number;
  moodCorrelation: number; // -1 to 1
  
  // Last updated
  lastUpdated: Date;
}

export interface MoodEntry {
  id: string;
  userId: string;
  date: string; // ISO date string
  
  // Mood data
  moodLevel: number;       // 1-10 scale
  energy: number;          // 1-5 scale
  
  // Context
  notes?: string;
  relatedTrackers?: string[]; // tracker IDs that might have influenced mood
  
  // Timestamps
  createdAt: Date;
} 