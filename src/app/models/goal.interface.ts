export interface Goal {
	id: string;
	userId: string;
	title: string;
	description?: string;
	category: 'mind' | 'body' | 'soul' | 'beauty' | 'custom';

	// Progress tracking
	status: GoalStatus;
	priority: GoalPriority;
	progress: number; // 0 to 100

	// Timing
	startDate: Date;
	targetDate?: Date;
	completedAt?: Date;

	// Sub-tasks/Milestones (Optional)
	milestones: GoalMilestone[];

	// Linked data
	linkedTrackerIds?: string[]; // Triggers for automatic progress if applicable

	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

export type GoalStatus = 'active' | 'completed' | 'on_hold' | 'abandoned';
export type GoalPriority = 'low' | 'medium' | 'high';

export interface GoalMilestone {
	id: string;
	title: string;
	isCompleted: boolean;
	completedAt?: Date;
	order: number;
}
