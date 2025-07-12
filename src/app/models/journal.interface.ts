export interface JournalEntry {
  id: string;
  userId: string;
  date: string; // ISO date string
  
  // Content
  title?: string;
  content: string;
  
  // Mood and energy tracking
  mood?: number;           // 1-10 scale with emojis
  energy?: number;         // 1-5 scale
  
  // Organization
  tags?: string[];         // ['gratitude', 'reflection', 'goals', 'challenges']
  category?: JournalCategory;
  
  // Media attachments
  photos?: string[];       // URLs to images
  attachments?: string[];  // URLs to files/audio
  
  // Context
  location?: GeoLocation;
  weather?: WeatherData;
  
  // Metadata
  wordCount?: number;
  readingTime?: number;    // estimated minutes
  sentiment?: SentimentAnalysis;
  
  // Prompts
  promptId?: string;       // if written from a prompt
  promptText?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export enum JournalCategory {
  GRATITUDE = 'gratitude',
  REFLECTION = 'reflection',
  GOALS = 'goals',
  CHALLENGES = 'challenges',
  DREAMS = 'dreams',
  GROWTH = 'growth',
  MINDFULNESS = 'mindfulness',
  RELATIONSHIPS = 'relationships',
  WORK = 'work',
  HEALTH = 'health',
  CUSTOM = 'custom'
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  humidity?: number;
}

export interface SentimentAnalysis {
  score: number;           // -1 (negative) to 1 (positive)
  magnitude: number;       // 0 to 1 (intensity)
  emotions?: string[];     // ['joy', 'sadness', 'anger', 'fear', 'surprise']
}

export interface JournalPrompt {
  id: string;
  text: string;
  icon: string;
  category: JournalCategory;
  
  // Targeting
  difficulty?: 'easy' | 'medium' | 'deep';
  tags?: string[];
  
  // Usage tracking
  timesUsed?: number;
  averageRating?: number;
  
  // Timestamps
  createdAt: Date;
  isActive: boolean;
}

export interface JournalStats {
  userId: string;
  
  // Entry metrics
  totalEntries: number;
  weeklyCount: number;
  monthlyCount: number;
  
  // Streak tracking
  currentStreak: number;
  longestStreak: number;
  
  // Mood analytics
  averageMood: number;
  moodTrend: number;       // -1 to 1 (declining to improving)
  
  // Content analytics
  totalWords: number;
  averageWordsPerEntry: number;
  mostUsedTags: string[];
  favoriteCategories: JournalCategory[];
  
  // Sentiment over time
  sentimentTrend: number;  // -1 to 1
  emotionalRange: number;  // 0 to 1 (consistency)
  
  // Activity patterns
  preferredWritingTime?: string; // hour of day
  weeklyPattern?: number[];      // activity by day of week
  
  // Last updated
  lastUpdated: Date;
}

export interface MoodTrend {
  date: string;
  mood: number;
  energy: number;
  entryCount: number;
} 