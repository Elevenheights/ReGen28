export enum AchievementType {
  STREAK = 'streak',                    // consecutive days
  MILESTONE = 'milestone',              // total count achievements
  CONSISTENCY = 'consistency',          // frequency-based
  WELLNESS = 'wellness',               // overall wellness metrics
  EXPLORATION = 'exploration',         // trying new things
  SOCIAL = 'social',                   // community/sharing achievements
  SPECIAL = 'special'                  // seasonal/event achievements
}

export enum AchievementStatus {
  LOCKED = 'locked',                   // not yet achievable
  AVAILABLE = 'available',             // can be earned
  IN_PROGRESS = 'in_progress',         // partially completed
  EARNED = 'earned',                   // completed
  EXPIRED = 'expired'                  // time-limited achievement that expired
}

export interface Achievement {
  id: string;
  
  // Basic info
  title: string;
  description: string;
  type: AchievementType;
  
  // Visual
  icon: string;
  color: string;
  badge?: string;                      // special badge image URL
  
  // Requirements
  requirement: AchievementRequirement;
  
  // Categorization
  category?: string;                   // tracker category, general, etc.
  tags?: string[];
  
  // Rarity and points
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;                      // achievement points awarded
  
  // Availability
  isActive: boolean;
  startDate?: Date;                    // for time-limited achievements
  endDate?: Date;
  
  // Metadata
  createdAt: Date;
}

export interface AchievementRequirement {
  // Streak requirements
  streakDays?: number;                 // "Log meditation 7 days in a row"
  trackerIds?: string[];               // specific trackers required
  
  // Count requirements
  totalCount?: number;                 // "Complete 100 journal entries"
  timeframe?: 'day' | 'week' | 'month' | 'year' | 'all-time';
  
  // Value requirements
  totalValue?: number;                 // "Exercise for 1000 minutes total"
  averageValue?: number;               // "Maintain 4+ mood average for a week"
  
  // Category requirements
  categories?: string[];               // "Complete trackers in all 4 categories"
  categoryCount?: number;              // "Complete 5 different Mind trackers"
  
  // Complex requirements
  conditions?: AchievementCondition[]; // multiple conditions that must be met
}

export interface AchievementCondition {
  type: 'streak' | 'count' | 'value' | 'frequency' | 'custom';
  trackerId?: string;
  category?: string;
  operator: '>=' | '>' | '=' | '<' | '<=';
  value: number;
  timeframe?: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  
  // Status
  status: AchievementStatus;
  progress: number;                    // 0-100 percentage
  
  // Progress tracking
  currentValue?: number;               // current count/streak/value
  targetValue?: number;                // required value to complete
  
  // Dates
  unlockedAt?: Date;                   // when became available
  startedAt?: Date;                    // when progress began
  earnedAt?: Date;                     // when completed
  
  // Progress data
  progressData?: any;                  // flexible data for complex achievements
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface StreakData {
  trackerId: string;
  userId: string;
  
  // Current streak
  currentStreak: number;
  currentStartDate: Date;
  
  // Best streak
  longestStreak: number;
  longestStartDate?: Date;
  longestEndDate?: Date;
  
  // Last activity
  lastActivityDate: Date;
  
  // Milestones reached
  milestonesReached: number[];         // [7, 14, 30, 50, 100] day milestones
  
  // Timestamps
  updatedAt: Date;
}

export interface AchievementStats {
  userId: string;
  
  // Overall stats
  totalEarned: number;
  totalPoints: number;
  
  // By type
  streakAchievements: number;
  milestoneAchievements: number;
  wellnessAchievements: number;
  
  // By rarity
  commonEarned: number;
  rareEarned: number;
  epicEarned: number;
  legendaryEarned: number;
  
  // Progress
  inProgress: number;
  available: number;
  
  // Recent
  lastEarned?: UserAchievement;
  lastEarnedAt?: Date;
  
  // Leaderboard
  rank?: number;
  percentile?: number;
  
  // Last updated
  lastUpdated: Date;
}

/**
 * Default achievements that come with the app
 */
export const DEFAULT_ACHIEVEMENTS: Partial<Achievement>[] = [
  // STREAK ACHIEVEMENTS
  {
    title: "Getting Started",
    description: "Complete any tracker for 3 days in a row",
    type: AchievementType.STREAK,
    icon: "fa-seedling",
    color: "#10b981",
    rarity: "common",
    points: 50,
    requirement: { streakDays: 3 }
  },
  {
    title: "Week Warrior",
    description: "Complete any tracker for 7 days in a row",
    type: AchievementType.STREAK,
    icon: "fa-fire",
    color: "#f59e0b",
    rarity: "common",
    points: 100,
    requirement: { streakDays: 7 }
  },
  {
    title: "Meditation Master",
    description: "Meditate for 30 days in a row",
    type: AchievementType.STREAK,
    icon: "fa-brain",
    color: "#8b5cf6",
    rarity: "epic",
    points: 500,
    requirement: { streakDays: 30, categories: ["mind"] }
  },
  {
    title: "Wellness Legend",
    description: "Complete trackers in all categories for 50 days",
    type: AchievementType.STREAK,
    icon: "fa-crown",
    color: "#f59e0b",
    rarity: "legendary",
    points: 1000,
    requirement: { streakDays: 50, categories: ["mind", "body", "soul", "beauty"] }
  },

  // MILESTONE ACHIEVEMENTS
  {
    title: "First Steps",
    description: "Complete your first tracker entry",
    type: AchievementType.MILESTONE,
    icon: "fa-star",
    color: "#3b82f6",
    rarity: "common",
    points: 25,
    requirement: { totalCount: 1 }
  },
  {
    title: "Century Club",
    description: "Complete 100 tracker entries",
    type: AchievementType.MILESTONE,
    icon: "fa-trophy",
    color: "#f59e0b",
    rarity: "rare",
    points: 200,
    requirement: { totalCount: 100 }
  },
  {
    title: "Journal Explorer",
    description: "Write 25 journal entries",
    type: AchievementType.MILESTONE,
    icon: "fa-pen-to-square",
    color: "#6366f1",
    rarity: "rare",
    points: 150,
    requirement: { totalCount: 25, categories: ["journal"] }
  },

  // WELLNESS ACHIEVEMENTS
  {
    title: "Mood Booster",
    description: "Maintain a 4+ mood average for 7 days",
    type: AchievementType.WELLNESS,
    icon: "fa-face-smile",
    color: "#f59e0b",
    rarity: "rare",
    points: 200,
    requirement: { averageValue: 4, timeframe: "week", categories: ["mood"] }
  },
  {
    title: "Energy Dynamo",
    description: "Maintain 4+ energy for 14 days",
    type: AchievementType.WELLNESS,
    icon: "fa-bolt",
    color: "#eab308",
    rarity: "epic",
    points: 300,
    requirement: { averageValue: 4, timeframe: "week", categories: ["mood"] }
  },

  // EXPLORATION ACHIEVEMENTS
  {
    title: "Well-Rounded",
    description: "Complete trackers in all 4 categories",
    type: AchievementType.EXPLORATION,
    icon: "fa-compass",
    color: "#06b6d4",
    rarity: "rare",
    points: 250,
    requirement: { categories: ["mind", "body", "soul", "beauty"], categoryCount: 1 }
  }
];

/**
 * Helper class for achievement logic
 */
export class AchievementHelper {
  
  static checkStreakAchievements(streakData: StreakData, achievements: Achievement[]): string[] {
    const eligibleIds: string[] = [];
    
    achievements
      .filter(a => a.type === AchievementType.STREAK)
      .forEach(achievement => {
        if (achievement.requirement.streakDays && 
            streakData.currentStreak >= achievement.requirement.streakDays) {
          eligibleIds.push(achievement.id);
        }
      });
    
    return eligibleIds;
  }

  static calculateProgress(userAchievement: UserAchievement, currentData: any): number {
    if (!userAchievement.targetValue) return 0;
    const progress = (currentData / userAchievement.targetValue) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  static getNextMilestone(currentStreak: number): number {
    const milestones = [3, 7, 14, 21, 30, 50, 75, 100, 200, 365];
    return milestones.find(m => m > currentStreak) || currentStreak + 100;
  }

  static getRarityColor(rarity: string): string {
    const colors = {
      common: '#6b7280',    // gray-500
      rare: '#3b82f6',      // blue-500
      epic: '#8b5cf6',      // violet-500
      legendary: '#f59e0b'  // amber-500
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  }
} 