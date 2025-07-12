export enum GoalCategory {
  CAREER = 'career',               // job, skills, professional development
  RELATIONSHIPS = 'relationships', // family, friends, social connections
  PERSONAL = 'personal',           // hobbies, interests, self-improvement
  FINANCIAL = 'financial',         // major purchases, investments, debt payoff
  HEALTH = 'health',               // long-term health goals, major lifestyle changes
  EDUCATION = 'education',         // courses, degrees, certifications
  LIFESTYLE = 'lifestyle'          // travel, experiences, major life changes
}

export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface Goal {
  id: string;
  userId: string;
  
  // Basic info
  title: string;
  description?: string;
  category: GoalCategory;
  
  // Timeline
  targetDate?: Date;
  startDate: Date;
  completedDate?: Date;
  
  // Status and priority
  status: GoalStatus;
  priority: Priority;
  
  // Progress tracking
  progress: number;        // 0-100 percentage
  
  // Organization
  tags?: string[];
  color?: string;
  icon?: string;
  
  // Milestones
  milestones?: GoalMilestone[];
  
  // Related trackers
  relatedTrackers?: string[]; // tracker IDs that contribute to this goal
  
  // Reminders
  reminderEnabled?: boolean;
  reminderFrequency?: 'daily' | 'weekly' | 'monthly';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  
  // Content
  title: string;
  description?: string;
  
  // Timeline
  dueDate?: Date;
  completedDate?: Date;
  
  // Status
  isCompleted: boolean;
  
  // Progress
  order: number;           // sequence in the goal
  weight?: number;         // contribution to overall goal progress (0-100)
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalProgress {
  id: string;
  goalId: string;
  userId: string;
  
  // Progress data
  progressPercent: number;
  
  // Content
  notes?: string;
  attachments?: string[];  // photos, documents
  
  // Metrics
  milestonesCompleted?: number;
  totalMilestones?: number;
  
  // Timestamps
  date: string;            // ISO date string
  createdAt: Date;
}

export interface GoalStats {
  userId: string;
  
  // Overall metrics
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  
  // Completion rates by category
  completionRateByCategory: { [key in GoalCategory]: number };
  
  // Time analysis
  averageCompletionTime: number; // days
  goalsCompletedThisMonth: number;
  goalsCompletedThisYear: number;
  
  // Success patterns
  mostSuccessfulCategory: GoalCategory;
  averageProgressPerWeek: number;
  
  // Current focus
  highPriorityGoals: number;
  overdueGoals: number;
  goalsNearDeadline: number; // within 30 days
  
  // Last updated
  lastUpdated: Date;
}

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
  
  // Default settings
  defaultDuration: number; // days
  suggestedMilestones: string[];
  relatedTrackerTypes: string[];
  
  // Usage
  popularity: number;
  timesUsed: number;
} 