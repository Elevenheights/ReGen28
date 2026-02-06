import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { Activity, ActivityType, RecentActivitySummary, ActivityHelper } from '../models/activity.interface';
import { TrackerEntry } from '../models/tracker.interface';
import { JournalEntry } from '../models/journal.interface';
import { Observable, switchMap, of, take, firstValueFrom, shareReplay, map, catchError } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class ActivityService {
	private readonly COLLECTION_NAME = 'activities';

	// Fallback cache data (only used when real-time fails)
	private cachedActivities: Activity[] | null = null;

	constructor(
		private databaseService: DatabaseService,
		private authService: AuthService,
		private errorHandlingService: ErrorHandlingService,
		private loggingService: LoggingService
	) {
		// Clear cache when user changes
		this.authService.user$.subscribe(user => {
			if (!user) {
				this.clearActivityCache();
			}
		});
	}

	// Clear the activities cache
	private clearActivityCache() {
		this.cachedActivities = null;
	}

	// Create a new activity entry
	async createActivity(activityData: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
		try {
			this.loggingService.debug('Creating new activity', { type: activityData.type });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activity: Omit<Activity, 'id'> = {
				...activityData,
				userId: authUser.uid,
				createdAt: new Date()
			};

			const activityId = await firstValueFrom(this.databaseService.createDocument(this.COLLECTION_NAME, activity));

			if (!activityId) {
				throw new Error('Failed to create activity');
			}

			// Clear cache to reflect new activity
			this.clearActivityCache();

			this.loggingService.info('Activity created successfully', { activityId, type: activityData.type });
			return activityId;
		} catch (error) {
			this.loggingService.error('Failed to create activity', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create activity');
		}
	}

	// Create activity from tracker entry
	async createActivityFromTrackerEntry(trackerEntry: TrackerEntry, trackerName: string, trackerColor: string, trackerIcon: string, trackerUnit: string = '', trackerCategory?: string): Promise<string> {
		try {
			this.loggingService.debug('Creating activity from tracker entry', { trackerId: trackerEntry.trackerId });

			const activity = ActivityHelper.createTrackerEntryActivity(
				trackerEntry.userId,
				trackerEntry.trackerId,
				trackerName,
				trackerIcon,
				trackerColor,
				trackerEntry.value,
				trackerUnit,
				trackerEntry.mood,
				trackerCategory
			);

			return await this.createActivity(activity);
		} catch (error) {
			this.loggingService.error('Failed to create activity from tracker entry', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create tracker activity');
		}
	}

	// Create activity from journal entry
	async createActivityFromJournalEntry(journalEntry: JournalEntry): Promise<string> {
		try {
			this.loggingService.debug('Creating activity from journal entry', { entryId: journalEntry.id });

			const activity = ActivityHelper.createJournalEntryActivity(
				journalEntry.userId,
				journalEntry.id,
				journalEntry.title,
				journalEntry.mood
			);

			return await this.createActivity(activity);
		} catch (error) {
			this.loggingService.error('Failed to create activity from journal entry', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create journal activity');
		}
	}

	// Create activity from goal completion
	async createActivityFromGoalCompletion(goalId: string, goalTitle: string, goalCategory: string): Promise<string> {
		try {
			this.loggingService.debug('Creating activity from goal completion', { goalId });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activity = ActivityHelper.createGoalCompletedActivity(
				authUser.uid,
				goalId,
				goalTitle,
				goalCategory
			);

			return await this.createActivity(activity);
		} catch (error) {
			this.loggingService.error('Failed to create activity from goal completion', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create goal activity');
		}
	}

	// Create activity from goal creation
	async createActivityFromGoalCreated(goalId: string, goalTitle: string, goalCategory: string): Promise<string> {
		try {
			this.loggingService.debug('Creating activity from goal creation', { goalId });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activity = ActivityHelper.createGoalCreatedActivity(
				authUser.uid,
				goalId,
				goalTitle,
				goalCategory
			);

			return await this.createActivity(activity);
		} catch (error) {
			this.loggingService.error('Failed to create activity from goal creation', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create goal creation activity');
		}
	}

	// Create activity from achievement
	async createActivityFromAchievement(achievementId: string, achievementTitle: string, achievementIcon: string, achievementColor: string, points: number, rarity: string): Promise<string> {
		try {
			this.loggingService.debug('Creating activity from achievement', { achievementId });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activity = ActivityHelper.createAchievementEarnedActivity(
				authUser.uid,
				achievementId,
				achievementTitle,
				achievementIcon,
				achievementColor,
				points,
				rarity
			);

			return await this.createActivity(activity);
		} catch (error) {
			this.loggingService.error('Failed to create activity from achievement', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create achievement activity');
		}
	}

	// Get recent activities with database ordering for performance
	getRecentActivities(limitCount: number = 20): Observable<Activity[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getUserDocuments<Activity>(
					this.COLLECTION_NAME,
					authUser.uid,
					{
						orderBy: [{ field: 'createdAt', direction: 'desc' }], // Database ordering for performance
						limit: limitCount
					}
				).pipe(
					map(activities => {
						// Update cache when real data succeeds
						this.cachedActivities = activities;
						return this.cachedActivities;
					}),
					catchError(error => {
						this.loggingService.error('Failed to fetch recent activities, using cache fallback', { error });
						// Only use cache as fallback when real-time fails
						if (this.cachedActivities) {
							return of(this.cachedActivities);
						}
						// If no cache available, return empty array
						return of([]);
					})
				);
			}),
			shareReplay(1)
		);
	}

	// Get activities by type with database ordering
	getActivitiesByType(type: ActivityType, limitCount: number = 10): Observable<Activity[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getUserDocuments<Activity>(
					this.COLLECTION_NAME,
					authUser.uid,
					{
						where: [{ field: 'type', operator: '==', value: type }],
						orderBy: [{ field: 'createdAt', direction: 'desc' }], // Database ordering for performance
						limit: limitCount
					}
				);
			}),
			catchError(error => {
				this.loggingService.error('Failed to fetch activities by type', error);
				return of([]);
			})
		);
	}

	// Get activities by date range with database ordering
	getActivitiesByDateRange(startDate: Date, endDate: Date): Observable<Activity[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getUserDocuments<Activity>(
					this.COLLECTION_NAME,
					authUser.uid,
					{
						where: [
							{ field: 'createdAt', operator: '>=', value: startDate },
							{ field: 'createdAt', operator: '<=', value: endDate }
						],
						orderBy: [{ field: 'createdAt', direction: 'desc' }] // Database ordering for performance
					}
				);
			})
		);
	}

	// Get today's activities with database ordering
	getTodaysActivities(): Observable<Activity[]> {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date();
		endOfDay.setHours(23, 59, 59, 999);

		return this.getActivitiesByDateRange(startOfDay, endOfDay);
	}

	// Get activity summary
	async getActivitySummary(): Promise<RecentActivitySummary> {
		try {
			this.loggingService.debug('Calculating activity summary');

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activities = await firstValueFrom(this.getRecentActivities(50));

			const summary: RecentActivitySummary = {
				userId: authUser.uid,
				activities: activities.slice(0, 10), // Show recent 10
				totalCount: activities.length,
				lastUpdated: new Date()
			};

			this.loggingService.info('Activity summary calculated', { totalCount: summary.totalCount });
			return summary;
		} catch (error) {
			this.loggingService.error('Failed to calculate activity summary', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to calculate activity summary');
		}
	}

	// Get activity feed for dashboard
	getActivityFeedForDashboard(): Observable<Array<Activity & { timeAgo: string }>> {
		return this.getRecentActivities(20).pipe(
			map(activities => activities.map(activity => ({
				...activity,
				timeAgo: this.getTimeAgo(activity.createdAt)
			}))),
			catchError(error => {
				this.loggingService.error('Failed to get activity feed for dashboard', error);
				return of([]);
			})
		);
	}

	// Cleanup old activities
	async cleanupOldActivities(monthsOld: number = 6): Promise<number> {
		try {
			this.loggingService.debug('Cleaning up old activities', { monthsOld });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const cutoffDate = new Date();
			cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

			const oldActivities = await firstValueFrom(this.databaseService.getUserDocuments<Activity>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					where: [
						{ field: 'createdAt', operator: '<', value: cutoffDate }
					]
				}
			));

			if (oldActivities.length === 0) {
				return 0;
			}

			// Delete old activities in batches
			const batchOperations = oldActivities.map(activity => ({
				type: 'delete' as const,
				collection: this.COLLECTION_NAME,
				id: activity.id
			}));

			await firstValueFrom(this.databaseService.batchWrite(batchOperations));

			this.loggingService.info('Old activities cleaned up', { deletedCount: oldActivities.length });
			return oldActivities.length;
		} catch (error) {
			this.loggingService.error('Failed to cleanup old activities', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to cleanup old activities');
		}
	}

	// Get activity statistics
	async getActivityStats(): Promise<{
		totalActivities: number;
		todayCount: number;
		weekCount: number;
		monthCount: number;
		typeBreakdown: { [key in ActivityType]: number };
	}> {
		try {
			this.loggingService.debug('Calculating activity statistics');

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const allActivities = await firstValueFrom(this.databaseService.getUserDocuments<Activity>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					orderBy: [{ field: 'createdAt', direction: 'desc' }]
				}
			));

			const now = new Date();
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			const todayActivities = allActivities.filter(activity =>
				new Date(activity.createdAt) >= today
			);

			const weekActivities = allActivities.filter(activity =>
				new Date(activity.createdAt) >= weekAgo
			);

			const monthActivities = allActivities.filter(activity =>
				new Date(activity.createdAt) >= monthAgo
			);

			// Calculate type breakdown
			const typeBreakdown: { [key in ActivityType]: number } = {
				[ActivityType.TRACKER_ENTRY]: 0,
				[ActivityType.JOURNAL_ENTRY]: 0,
				[ActivityType.GOAL_CREATED]: 0,
				[ActivityType.GOAL_UPDATED]: 0,
				[ActivityType.GOAL_COMPLETED]: 0,
				[ActivityType.MILESTONE_COMPLETED]: 0,
				[ActivityType.STREAK_ACHIEVED]: 0,
				[ActivityType.TRACKER_CREATED]: 0,
				[ActivityType.ACHIEVEMENT_EARNED]: 0,
				[ActivityType.STREAK_MILESTONE]: 0
			};

			allActivities.forEach(activity => {
				typeBreakdown[activity.type] = (typeBreakdown[activity.type] || 0) + 1;
			});

			const stats = {
				totalActivities: allActivities.length,
				todayCount: todayActivities.length,
				weekCount: weekActivities.length,
				monthCount: monthActivities.length,
				typeBreakdown
			};

			this.loggingService.info('Activity statistics calculated', { totalActivities: stats.totalActivities });
			return stats;
		} catch (error) {
			this.loggingService.error('Failed to calculate activity statistics', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to calculate activity statistics');
		}
	}

	// Delete activity
	async deleteActivity(activityId: string): Promise<void> {
		try {
			this.loggingService.debug('Deleting activity', { activityId });

			await firstValueFrom(this.databaseService.deleteDocument(this.COLLECTION_NAME, activityId));

			// Clear cache
			this.clearActivityCache();

			this.loggingService.info('Activity deleted successfully', { activityId });
		} catch (error) {
			this.loggingService.error('Failed to delete activity', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to delete activity');
		}
	}

	// Batch create activities
	async batchCreateActivities(activities: Omit<Activity, 'id' | 'createdAt'>[]): Promise<string[]> {
		try {
			this.loggingService.debug('Batch creating activities', { count: activities.length });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const batchOperations = activities.map(activityData => ({
				type: 'create' as const,
				collection: this.COLLECTION_NAME,
				data: {
					...activityData,
					userId: authUser.uid,
					createdAt: new Date()
				}
			}));

			await firstValueFrom(this.databaseService.batchWrite(batchOperations));

			// Clear cache
			this.clearActivityCache();

			this.loggingService.info('Activities batch created successfully', { count: activities.length });
			return batchOperations.map((_, index) => `batch_${index}`); // Return placeholder IDs
		} catch (error) {
			this.loggingService.error('Failed to batch create activities', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to batch create activities');
		}
	}

	// Get user activity streak
	async getUserActivityStreak(): Promise<number> {
		try {
			this.loggingService.debug('Calculating user activity streak');

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activities = await firstValueFrom(this.databaseService.getUserDocuments<Activity>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					orderBy: [{ field: 'createdAt', direction: 'desc' }]
				}
			));

			if (activities.length === 0) {
				return 0;
			}

			// Group activities by date
			const activitiesByDate = new Map<string, Activity[]>();
			activities.forEach(activity => {
				const dateStr = new Date(activity.createdAt).toDateString();
				if (!activitiesByDate.has(dateStr)) {
					activitiesByDate.set(dateStr, []);
				}
				activitiesByDate.get(dateStr)!.push(activity);
			});

			// Calculate streak
			let streak = 0;
			let currentDate = new Date();
			currentDate.setHours(0, 0, 0, 0);

			while (true) {
				const dateStr = currentDate.toDateString();
				if (activitiesByDate.has(dateStr)) {
					streak++;
					currentDate.setDate(currentDate.getDate() - 1);
				} else {
					break;
				}
			}

			this.loggingService.info('User activity streak calculated', { streak });
			return streak;
		} catch (error) {
			this.loggingService.error('Failed to calculate user activity streak', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to calculate activity streak');
		}
	}

	// Get mood-activity correlation
	async getMoodActivityCorrelation(): Promise<{
		averageMoodWithActivities: number;
		moodByActivityType: { [key in ActivityType]: number };
	}> {
		try {
			this.loggingService.debug('Calculating mood-activity correlation');

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const activities = await firstValueFrom(this.databaseService.getUserDocuments<Activity>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					orderBy: [{ field: 'createdAt', direction: 'desc' }]
				}
			));

			const activitiesWithMood = activities.filter(activity => activity.mood !== undefined);

			if (activitiesWithMood.length === 0) {
				return {
					averageMoodWithActivities: 0,
					moodByActivityType: {
						[ActivityType.TRACKER_ENTRY]: 0,
						[ActivityType.JOURNAL_ENTRY]: 0,
						[ActivityType.GOAL_CREATED]: 0,
						[ActivityType.GOAL_UPDATED]: 0,
						[ActivityType.GOAL_COMPLETED]: 0,
						[ActivityType.MILESTONE_COMPLETED]: 0,
						[ActivityType.STREAK_ACHIEVED]: 0,
						[ActivityType.TRACKER_CREATED]: 0,
						[ActivityType.ACHIEVEMENT_EARNED]: 0,
						[ActivityType.STREAK_MILESTONE]: 0
					}
				};
			}

			// Calculate average mood
			const totalMood = activitiesWithMood.reduce((sum, activity) => sum + (activity.mood || 0), 0);
			const averageMoodWithActivities = totalMood / activitiesWithMood.length;

			// Calculate mood by activity type
			const moodByActivityType: { [key in ActivityType]: number } = {
				[ActivityType.TRACKER_ENTRY]: 0,
				[ActivityType.JOURNAL_ENTRY]: 0,
				[ActivityType.GOAL_CREATED]: 0,
				[ActivityType.GOAL_UPDATED]: 0,
				[ActivityType.GOAL_COMPLETED]: 0,
				[ActivityType.MILESTONE_COMPLETED]: 0,
				[ActivityType.STREAK_ACHIEVED]: 0,
				[ActivityType.TRACKER_CREATED]: 0,
				[ActivityType.ACHIEVEMENT_EARNED]: 0,
				[ActivityType.STREAK_MILESTONE]: 0
			};

			const countByType: { [key in ActivityType]: number } = {
				[ActivityType.TRACKER_ENTRY]: 0,
				[ActivityType.JOURNAL_ENTRY]: 0,
				[ActivityType.GOAL_CREATED]: 0,
				[ActivityType.GOAL_UPDATED]: 0,
				[ActivityType.GOAL_COMPLETED]: 0,
				[ActivityType.MILESTONE_COMPLETED]: 0,
				[ActivityType.STREAK_ACHIEVED]: 0,
				[ActivityType.TRACKER_CREATED]: 0,
				[ActivityType.ACHIEVEMENT_EARNED]: 0,
				[ActivityType.STREAK_MILESTONE]: 0
			};

			activitiesWithMood.forEach(activity => {
				moodByActivityType[activity.type] += activity.mood || 0;
				countByType[activity.type]++;
			});

			// Calculate averages
			Object.keys(moodByActivityType).forEach(type => {
				const activityType = type as ActivityType;
				if (countByType[activityType] > 0) {
					moodByActivityType[activityType] = moodByActivityType[activityType] / countByType[activityType];
				}
			});

			const result = {
				averageMoodWithActivities,
				moodByActivityType
			};

			this.loggingService.info('Mood-activity correlation calculated', { averageMood: result.averageMoodWithActivities });
			return result;
		} catch (error) {
			this.loggingService.error('Failed to calculate mood-activity correlation', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to calculate mood-activity correlation');
		}
	}

	// Helper method to format time ago
	private getTimeAgo(date: Date): string {
		const now = new Date();
		const diffInMs = now.getTime() - new Date(date).getTime();
		const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
		const diffInDays = Math.floor(diffInHours / 24);

		if (diffInHours < 1) {
			return 'Just now';
		} else if (diffInHours < 24) {
			return `${diffInHours}h ago`;
		} else if (diffInDays === 1) {
			return 'Yesterday';
		} else if (diffInDays < 7) {
			return `${diffInDays}d ago`;
		} else {
			return new Date(date).toLocaleDateString();
		}
	}
} 