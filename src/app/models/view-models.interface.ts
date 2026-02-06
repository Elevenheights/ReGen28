import { Tracker } from './tracker.interface';

/**
 * View model for displaying tracker cards with calculated progress status
 */
export interface TrackerData extends Tracker {
	// Core progress metrics
	progress: number;           // 0-100 completion percentage
	streak: number;             // Current consecutive streak
	lastEntry?: Date;           // Most recent entry timestamp
	todayCompleted: boolean;    // Whether target met today
	totalEntries: number;       // Total logged entries

	// Duration tracking
	daysRemaining?: number;     // -1 for ongoing, positive for challenges
	daysElapsed?: number;       // Days since tracker started
	durationProgress?: number;  // 0-100 progress through duration

	// Milestone tracking
	nextMilestone?: number;     // Next streak milestone (7, 14, 30, etc.)
	milestoneProgress?: number; // 0-1 progress to next milestone

	// Trend indicators
	trend?: 'improving' | 'declining' | 'stable';
	weeklyChange?: number;      // Percentage change from last week

	// Adherence metrics
	adherence?: number;         // 0-1 frequency-based adherence score
	completionRate?: number;    // Historical completion percentage

	// UI state
	isExpanded?: boolean;       // For expandable card views
	showActions?: boolean;      // Whether to show action buttons
}

/**
 * Extended tracker data with statistics for detailed views
 */
export interface TrackerDataWithStats extends TrackerData {
	weeklyEntries: number;
	monthlyEntries: number;
	averageMood?: number;
	averageEnergy?: number;
	bestStreak: number;
	moodCorrelation?: number;
}
