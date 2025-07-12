export enum ActivityType {
  TRACKER_ENTRY = 'tracker_entry',
  JOURNAL_ENTRY = 'journal_entry',
  GOAL_CREATED = 'goal_created',
  GOAL_UPDATED = 'goal_updated',
  GOAL_COMPLETED = 'goal_completed',
  MILESTONE_COMPLETED = 'milestone_completed',
  STREAK_ACHIEVED = 'streak_achieved',
  TRACKER_CREATED = 'tracker_created',
  ACHIEVEMENT_EARNED = 'achievement_earned',
  STREAK_MILESTONE = 'streak_milestone'     // specific streak milestones (7, 30, 100 days)
}

export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  
  // Display information
  title: string;
  description?: string;
  icon: string;
  color: string;
  
  // Related data
  relatedId: string;        // ID of the tracker, journal entry, goal, etc.
  relatedType: string;      // 'tracker', 'journal', 'goal', etc.
  
  // Activity metadata
  value?: number;           // for tracker entries
  unit?: string;            // for tracker entries
  mood?: number;            // if applicable
  category?: string;        // tracker category, journal category, etc.
  
  // Timestamps
  activityDate: Date;       // when the actual activity happened
  createdAt: Date;          // when this activity record was created
}

export interface RecentActivitySummary {
  userId: string;
  activities: Activity[];
  totalCount: number;
  lastUpdated: Date;
}

/**
 * Helper functions to create activities from different sources
 */
export class ActivityHelper {
  
  static createTrackerEntryActivity(
    userId: string, 
    trackerId: string, 
    trackerName: string, 
    trackerIcon: string, 
    trackerColor: string, 
    value: number, 
    unit: string,
    mood?: number,
    category?: string
  ): Activity {
    return {
      id: '', // Will be set by Firestore
      userId,
      type: ActivityType.TRACKER_ENTRY,
      title: `Logged ${trackerName}`,
      description: `${value} ${unit}`,
      icon: trackerIcon,
      color: trackerColor,
      relatedId: trackerId,
      relatedType: 'tracker',
      value,
      unit,
      mood,
      category,
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createJournalEntryActivity(
    userId: string,
    journalEntryId: string,
    title?: string,
    mood?: number,
    category?: string
  ): Activity {
    return {
      id: '',
      userId,
      type: ActivityType.JOURNAL_ENTRY,
      title: title ? `Wrote "${title}"` : 'Added journal entry',
      description: mood ? `Mood: ${this.getMoodEmoji(mood)}` : undefined,
      icon: 'fa-pen-to-square',
      color: '#6366f1', // indigo-500
      relatedId: journalEntryId,
      relatedType: 'journal',
      mood,
      category,
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createGoalCompletedActivity(
    userId: string,
    goalId: string,
    goalTitle: string,
    category: string
  ): Activity {
    return {
      id: '',
      userId,
      type: ActivityType.GOAL_COMPLETED,
      title: `Completed goal`,
      description: goalTitle,
      icon: 'fa-trophy',
      color: '#f59e0b', // amber-500
      relatedId: goalId,
      relatedType: 'goal',
      category,
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createStreakAchievedActivity(
    userId: string,
    trackerId: string,
    trackerName: string,
    streakDays: number,
    trackerColor: string
  ): Activity {
    return {
      id: '',
      userId,
      type: ActivityType.STREAK_ACHIEVED,
      title: `${streakDays} day streak!`,
      description: trackerName,
      icon: 'fa-fire',
      color: trackerColor,
      relatedId: trackerId,
      relatedType: 'tracker',
      value: streakDays,
      unit: 'days',
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createMilestoneCompletedActivity(
    userId: string,
    goalId: string,
    milestoneTitle: string,
    goalTitle: string
  ): Activity {
    return {
      id: '',
      userId,
      type: ActivityType.MILESTONE_COMPLETED,
      title: `Milestone reached`,
      description: `${milestoneTitle} - ${goalTitle}`,
      icon: 'fa-flag-checkered',
      color: '#10b981', // emerald-500
      relatedId: goalId,
      relatedType: 'goal',
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createAchievementEarnedActivity(
    userId: string,
    achievementId: string,
    achievementTitle: string,
    achievementIcon: string,
    achievementColor: string,
    points: number,
    rarity: string
  ): Activity {
    return {
      id: '',
      userId,
      type: ActivityType.ACHIEVEMENT_EARNED,
      title: `🏆 ${achievementTitle}`,
      description: `Earned ${points} points • ${rarity}`,
      icon: achievementIcon,
      color: achievementColor,
      relatedId: achievementId,
      relatedType: 'achievement',
      value: points,
      unit: 'points',
      category: rarity,
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  static createStreakMilestoneActivity(
    userId: string,
    trackerId: string,
    trackerName: string,
    streakDays: number,
    trackerColor: string,
    milestoneType: string = 'streak'
  ): Activity {
    const milestoneEmojis: { [key: number]: string } = {
      3: '🌱', 7: '🔥', 14: '⚡', 21: '💪', 30: '🏆', 
      50: '🌟', 75: '💎', 100: '👑', 200: '🚀', 365: '🏆'
    };
    
    return {
      id: '',
      userId,
      type: ActivityType.STREAK_MILESTONE,
      title: `${milestoneEmojis[streakDays] || '🔥'} ${streakDays} Day Streak!`,
      description: `${trackerName} • ${this.getStreakMessage(streakDays)}`,
      icon: 'fa-fire',
      color: trackerColor,
      relatedId: trackerId,
      relatedType: 'tracker',
      value: streakDays,
      unit: 'days',
      category: milestoneType,
      activityDate: new Date(),
      createdAt: new Date()
    };
  }

  private static getStreakMessage(days: number): string {
    if (days >= 365) return 'Incredible dedication!';
    if (days >= 200) return 'Legendary consistency!';
    if (days >= 100) return 'Amazing commitment!';
    if (days >= 75) return 'Outstanding progress!';
    if (days >= 50) return 'Fantastic streak!';
    if (days >= 30) return 'Building strong habits!';
    if (days >= 21) return 'Habit forming!';
    if (days >= 14) return 'Great momentum!';
    if (days >= 7) return 'One week strong!';
    if (days >= 3) return 'Getting started!';
    return 'Keep it up!';
  }

  private static getMoodEmoji(mood: number): string {
    const moodEmojis = ['😢', '😕', '😐', '😊', '😄'];
    return moodEmojis[mood - 1] || '😐';
  }

  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
} 