import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { Tracker, TrackerEntry, TrackerStats, TrackerCategory, TrackerType, TrackerFrequency, MoodEntry } from '../models/tracker.interface';
import { createDefaultTrackersForUser } from '../data/default-trackers';
import { Observable, map, switchMap, of, combineLatest, shareReplay, firstValueFrom, catchError, Subject, startWith } from 'rxjs';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';

@Injectable({
	providedIn: 'root'
})
export class TrackerService {
	// Fallback cache data (only used when real-time fails)
	private cachedTrackers: Tracker[] | null = null;
	private cachedTodaysEntries: TrackerEntry[] | null = null;
	private cachedDashboardData: any | null = null;
	private trackersRefreshSubject = new Subject<void>(); // For triggering observable refresh

	constructor(
		private authService: AuthService,
		private userService: UserService,
		private db: DatabaseService,
		private activityService: ActivityService,
		private errorHandler: ErrorHandlingService,
		private logging: LoggingService,
		private notificationService: NotificationService
	) {
		// Clear cache when user logs out
		this.authService.user$.subscribe(user => {
			if (!user) {
				this.clearAllCaches();
			}
		});
	}

	// Clear all cached data
	private clearAllCaches() {
		this.cachedTrackers = null;
		this.cachedTodaysEntries = null;
		this.cachedDashboardData = null;
	}

	// Method to refresh trackers observable (triggers new data fetch)
	refreshTrackers() {
		this.logging.info('Refreshing trackers observable');
		this.clearAllCaches();
		this.trackersRefreshSubject.next();
	}

	// Debug method to manually clear caches
	debugClearCaches() {
		this.clearAllCaches();
	}

	// Utility method to convert Firestore timestamps to Date objects
	private convertFirestoreDate(firestoreDate: any): Date {
		if (!firestoreDate) return new Date();

		// If it's already a Date object, return it
		if (firestoreDate instanceof Date) {
			return firestoreDate;
		}

		// If it's a Firestore Timestamp, convert it
		if (firestoreDate && typeof firestoreDate.toDate === 'function') {
			return firestoreDate.toDate();
		}

		// If it's a string, parse it
		if (typeof firestoreDate === 'string') {
			return new Date(firestoreDate);
		}

		// If it has seconds property (Firestore timestamp format)
		if (firestoreDate && firestoreDate.seconds) {
			return new Date(firestoreDate.seconds * 1000);
		}

		// Default fallback
		return new Date();
	}

	// Convert tracker data with proper date handling
	private normalizeTracker(tracker: any): Tracker {
		return {
			...tracker,
			startDate: this.convertFirestoreDate(tracker.startDate),
			endDate: this.convertFirestoreDate(tracker.endDate),
			createdAt: this.convertFirestoreDate(tracker.createdAt),
			updatedAt: this.convertFirestoreDate(tracker.updatedAt)
		};
	}

	// Get all trackers for current user (with database ordering for performance)
	getUserTrackers(): Observable<Tracker[]> {
		return this.trackersRefreshSubject.pipe(
			startWith(null), // Start immediately
			switchMap(() => this.authService.user$),
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.db.getUserDocuments<Tracker>('trackers', authUser.uid, {
					orderBy: [{ field: 'createdAt', direction: 'asc' }] // Database ordering for performance
				}).pipe(
					map(trackers => {
						// Update cache when real data succeeds
						this.cachedTrackers = trackers.map(tracker => this.normalizeTracker(tracker));
						this.logging.debug('Trackers loaded and cached', { count: this.cachedTrackers.length });
						return this.cachedTrackers;
					}),
					catchError(error => {
						this.logging.error('Failed to fetch trackers from DB, using cache fallback', { error });
						// Only use cache as fallback when real-time fails
						if (this.cachedTrackers) {
							return of(this.cachedTrackers);
						}
						// If no cache available, return empty array
						return of([]);
					})
				);
			}),
			shareReplay(1)
		);
	}

	// Get trackers by category
	getTrackersByCategory(category: TrackerCategory): Observable<Tracker[]> {
		return this.getUserTrackers().pipe(
			map(trackers => trackers.filter(tracker => tracker.category === category))
		);
	}

	// Get single tracker by ID
	getTracker(trackerId: string): Observable<Tracker | null> {
		return this.db.getDocument<Tracker>('trackers', trackerId).pipe(
			map(tracker => tracker ? this.normalizeTracker(tracker) : null)
		);
	}

	// Update tracker using DatabaseService
	async updateTracker(trackerId: string, updates: Partial<Tracker>): Promise<void> {
		await firstValueFrom(this.db.updateDocument<Tracker>('trackers', trackerId, updates));
		this.refreshTrackers(); // Refresh trackers to reflect changes immediately

		// Handle notifications
		const updatedTracker = await firstValueFrom(this.getTracker(trackerId));
		if (updatedTracker) {
			await this.notificationService.cancelTrackerReminder(trackerId);
			if (updatedTracker.isActive && !updatedTracker.isCompleted) {
				await this.notificationService.scheduleTrackerReminder(updatedTracker);
			}
		}
	}

	// ENHANCED: Delete tracker entry with rollback on failure
	async deleteTrackerEntry(entryId: string, trackerId: string): Promise<void> {
		try {
			// First verify the entry exists and belongs to this tracker
			const entry = await firstValueFrom(
				this.db.getDocumentOnce<TrackerEntry>('tracker-entries', entryId)
			);

			if (!entry) {
				throw new Error('Entry not found');
			}

			if (entry.trackerId !== trackerId) {
				throw new Error('Entry does not belong to specified tracker');
			}

			// Delete the entry
			await this.db.deleteDocument('tracker-entries', entryId);

			// Decrement entry count atomically
			await this.decrementTrackerEntryCount(trackerId);

			this.logging.info('Successfully deleted tracker entry and updated count', {
				entryId, trackerId
			});

			// Clear caches
			this.clearAllCaches();
		} catch (error) {
			this.logging.error('Failed to delete tracker entry', { entryId, trackerId, error });
			throw this.errorHandler.createAppError(error, 'Failed to delete tracker entry');
		}
	}

	// NEW: Bulk delete entries with atomic count updates
	async bulkDeleteTrackerEntries(entryIds: string[], trackerId: string): Promise<void> {
		try {
			this.logging.info('Starting bulk delete of tracker entries', {
				entryCount: entryIds.length, trackerId
			});

			// Verify all entries exist and belong to this tracker
			const entries = await Promise.all(
				entryIds.map(id => firstValueFrom(this.db.getDocumentOnce<TrackerEntry>('tracker-entries', id)))
			);

			const validEntries = entries.filter(entry =>
				entry && entry.trackerId === trackerId
			);

			if (validEntries.length !== entryIds.length) {
				throw new Error(`Some entries are invalid or don't belong to tracker ${trackerId}`);
			}

			// Use batch operations for consistency
			const batchOperations = entryIds.map(entryId => ({
				type: 'delete' as const,
				collection: 'tracker-entries',
				id: entryId
			}));

			await firstValueFrom(this.db.batchWrite(batchOperations));

			// Update count with the actual number of deleted entries
			await this.db.updateDocument('trackers', trackerId, {
				entryCount: this.db.increment(-validEntries.length),
				updatedAt: new Date()
			});

			this.logging.info('Successfully bulk deleted entries and updated count', {
				deletedCount: validEntries.length, trackerId
			});

			this.clearAllCaches();
		} catch (error) {
			this.logging.error('Failed to bulk delete tracker entries', { entryIds, trackerId, error });
			throw this.errorHandler.createAppError(error, 'Failed to bulk delete tracker entries');
		}
	}

	// NEW: Verify and fix count discrepancies
	async verifyAndFixTrackerEntryCount(trackerId: string): Promise<{
		wasCorrect: boolean;
		oldCount: number;
		actualCount: number;
		fixed: boolean
	}> {
		try {
			const authUser = this.authService.getCurrentUser();
			if (!authUser) throw new Error('No authenticated user');

			// Get stored count from tracker
			const tracker = await firstValueFrom(this.getTracker(trackerId));
			const storedCount = tracker?.entryCount || 0;

			// Get actual count from database
			const entries = await firstValueFrom(
				this.db.queryDocuments<TrackerEntry>('tracker-entries', {
					where: [
						{ field: 'trackerId', operator: '==', value: trackerId },
						{ field: 'userId', operator: '==', value: authUser.uid }
					]
				})
			);

			const actualCount = entries.length;
			const wasCorrect = storedCount === actualCount;

			if (!wasCorrect) {
				this.logging.warn('Entry count mismatch detected', {
					trackerId, storedCount, actualCount
				});

				// Fix the count
				await this.db.updateDocument('trackers', trackerId, {
					entryCount: actualCount,
					updatedAt: new Date()
				});

				this.logging.info('Fixed entry count discrepancy', {
					trackerId, oldCount: storedCount, newCount: actualCount
				});

				this.clearAllCaches();
			}

			return {
				wasCorrect,
				oldCount: storedCount,
				actualCount,
				fixed: !wasCorrect
			};

		} catch (error) {
			this.logging.error('Failed to verify tracker entry count', { trackerId, error });
			return {
				wasCorrect: false,
				oldCount: 0,
				actualCount: 0,
				fixed: false
			};
		}
	}

	// NEW: Audit all tracker counts for a user
	async auditAllTrackerCounts(): Promise<Array<{
		trackerId: string;
		trackerName: string;
		wasCorrect: boolean;
		oldCount: number;
		actualCount: number;
		fixed: boolean;
	}>> {
		try {
			const authUser = this.authService.getCurrentUser();
			if (!authUser) throw new Error('No authenticated user');

			this.logging.info('Starting tracker count audit for user', { userId: authUser.uid });

			const trackers = await firstValueFrom(this.getUserTrackers());
			const results = [];

			for (const tracker of trackers) {
				const result = await this.verifyAndFixTrackerEntryCount(tracker.id);
				results.push({
					trackerId: tracker.id,
					trackerName: tracker.name,
					...result
				});
			}

			const fixedCount = results.filter(r => r.fixed).length;
			this.logging.info('Tracker count audit completed', {
				totalTrackers: results.length,
				issuesFixed: fixedCount
			});

			return results;

		} catch (error) {
			this.logging.error('Failed to audit tracker counts', { error });
			throw this.errorHandler.createAppError(error, 'Failed to audit tracker counts');
		}
	}

	// ENHANCED: Delete entire tracker with proper cleanup
	async deleteTracker(trackerId: string): Promise<void> {
		try {
			const authUser = this.authService.getCurrentUser();
			if (!authUser) throw new Error('No authenticated user');

			this.logging.info('Deleting tracker and all associated entries', { trackerId });

			// Get all entries for this tracker
			const entries = await firstValueFrom(
				this.db.queryDocuments<TrackerEntry>('tracker-entries', {
					where: [
						{ field: 'trackerId', operator: '==', value: trackerId },
						{ field: 'userId', operator: '==', value: authUser.uid }
					]
				})
			);

			// Delete all entries first
			if (entries.length > 0) {
				const batchOperations = entries.map(entry => ({
					type: 'delete' as const,
					collection: 'tracker-entries',
					id: entry.id
				}));

				await firstValueFrom(this.db.batchWrite(batchOperations));
				this.logging.info(`Deleted ${entries.length} tracker entries`);
			}

			// Delete the tracker document
			await this.db.deleteDocument('trackers', trackerId);

			this.logging.info('Successfully deleted tracker and all entries', {
				trackerId, deletedEntries: entries.length
			});

			this.refreshTrackers();
		} catch (error) {
			this.logging.error('Failed to delete tracker', { trackerId, error });
			throw this.errorHandler.createAppError(error, 'Failed to delete tracker');
		}

		// Cancel any notifications
		this.notificationService.cancelTrackerReminder(trackerId);
	}

	// ENHANCED: Log tracker entry with rollback on failure
	async logTrackerEntry(entryData: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		try {
			// Call Firebase Function to handle entry logging with stats updates
			const result = await firstValueFrom(this.db.callFunction<any, { entryId: string }>('logTrackerEntry', {
				...entryData,
				userId: authUser.uid
			}));

			// Increment entry count atomically (no race conditions)
			try {
				await this.incrementTrackerEntryCount(entryData.trackerId);
			} catch (countError) {
				// If count increment fails, log warning but don't fail the operation
				// The audit function can fix this later
				this.logging.warn('Entry created but count increment failed', {
					entryId: result.entryId,
					trackerId: entryData.trackerId,
					error: countError
				});
			}

			// Clear caches to reflect new entry
			this.clearAllCaches();

			// Create recent activity record
			try {
				const tracker = await firstValueFrom(this.getTracker(entryData.trackerId));
				if (tracker) {
					const fullEntry: TrackerEntry = {
						...entryData,
						id: result.entryId,
						userId: authUser.uid,
						createdAt: new Date(),
						updatedAt: new Date(),
						date: entryData.date || new Date().toISOString().split('T')[0]
					};
					await this.activityService.createActivityFromTrackerEntry(
						fullEntry,
						tracker.name,
						tracker.color,
						tracker.icon,
						tracker.unit,
						tracker.category
					);
				}
			} catch (activityError) {
				this.logging.warn('Tracker entry logged but activity record failed', { activityError });
			}

			return result.entryId;
		} catch (error) {
			this.errorHandler.logWarning('Error logging tracker entry via function', { error });
			throw new Error('Failed to log tracker entry. Please try again or contact support.');
		}
	}

	// OPTIMIZED: Get tracker entry count using stored field (0 extra reads!)
	getTrackerEntryCount(trackerId: string): Observable<number> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of(0);

				// Get count from tracker document's computed field (only 1 read!)
				return this.getTracker(trackerId).pipe(
					map(tracker => {
						// Use computed entryCount field 
						return tracker?.entryCount || 0;
					})
				);
			})
		);
	}

	// OPTIMIZED: Get tracker entries with proper database ordering and pagination
	getTrackerEntries(trackerId: string, limit: number = 50, startAfterDoc?: any): Observable<TrackerEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				const queryOptions: any = {
					where: [
						{ field: 'trackerId', operator: '==', value: trackerId },
						{ field: 'userId', operator: '==', value: authUser.uid }
					],
					orderBy: [{ field: 'date', direction: 'desc' }], // Database ordering - most recent first
					limit: limit
				};

				// Add cursor for pagination if provided
				if (startAfterDoc) {
					queryOptions.startAfter = startAfterDoc;
				}

				return this.db.queryDocuments<TrackerEntry>('tracker-entries', queryOptions);
			})
		);
	}

	// Get today's entries for all trackers (real-time first, cache as fallback)
	getTodaysEntries(): Observable<TrackerEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) {
					return of([]);
				}

				// Get today's date in YYYY-MM-DD format to match TrackerEntry.date string format
				const today = new Date().toISOString().split('T')[0];

				return this.db.queryDocuments<TrackerEntry>(
					'tracker-entries',
					{
						where: [
							{ field: 'userId', operator: '==', value: authUser.uid },
							{ field: 'date', operator: '==', value: today }
						]
						// No orderBy to avoid composite index requirement - sorting done client-side if needed
					}
				).pipe(
					map(entries => {
						// Update cache when real data succeeds
						this.cachedTodaysEntries = entries;
						return this.cachedTodaysEntries;
					}),
					catchError(error => {
						this.logging.error('Failed to fetch todays entries from DB, using cache fallback', { error });
						// Only use cache as fallback when real-time fails
						if (this.cachedTodaysEntries) {
							return of(this.cachedTodaysEntries);
						}
						// If no cache available, return empty array
						return of([]);
					})
				);
			}),
			shareReplay(1)
		);
	}

	// Calculate tracker statistics using Firebase Function
	async calculateTrackerStats(trackerId: string): Promise<TrackerStats> {
		try {
			// Call Firebase Function for complex stats calculation
			const result = await firstValueFrom(this.db.callFunction<{ trackerId: string }, TrackerStats>('calculateTrackerStats', {
				trackerId
			}));

			return result;
		} catch (error) {
			this.errorHandler.logWarning('Error calculating tracker stats via function', { error });
			throw new Error('Failed to calculate tracker statistics. Please try again or contact support.');
		}
	}

	// Update tracker statistics - uses Firebase Function
	private async updateTrackerStats(trackerId: string): Promise<void> {
		const stats = await this.calculateTrackerStats(trackerId);
		await this.updateTracker(trackerId, { stats });
	}

	// Log mood entry
	async logMoodEntry(moodData: Omit<MoodEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const moodEntry: Omit<MoodEntry, 'id'> = {
			...moodData,
			userId: authUser.uid,
			createdAt: new Date()
		};

		return await firstValueFrom(this.db.createDocument<MoodEntry>('mood-entries', moodEntry));
	}

	// OPTIMIZED: Get mood entries with database ordering
	getMoodEntries(limit: number = 30): Observable<MoodEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.db.getUserDocuments<MoodEntry>('mood-entries', authUser.uid, {
					orderBy: [{ field: 'date', direction: 'desc' }], // Database ordering for performance
					limit: limit
				});
			}),
			catchError(error => {
				this.logging.error('Failed to fetch mood entries', error);
				return of([]);
			})
		);
	}

	// OPTIMIZED: Lightweight dashboard data that fetches minimal information
	getTrackerDashboardData(): Observable<{
		activeTrackers: Tracker[];
		todaysEntries: TrackerEntry[];
		weeklyStats: { totalEntries: number; completedTrackers: number; averageMood: number };
	}> {
		return combineLatest([
			this.getUserTrackers(),
			this.getTodaysEntries(),
			this.getRecentMoodAverage(7) // Get just the average, not all entries
		]).pipe(
			map(([trackers, todaysEntries, averageMood]) => {
				const activeTrackers = trackers.filter(t => t.isActive && !t.isCompleted);

				// Calculate lightweight weekly stats
				const weeklyStats = {
					totalEntries: todaysEntries.length,
					completedTrackers: activeTrackers.filter(t =>
						todaysEntries.some(entry => entry.trackerId === t.id)
					).length,
					averageMood: averageMood
				};

				// Update cache when real data succeeds
				this.cachedDashboardData = {
					activeTrackers,
					todaysEntries,
					weeklyStats
				};
				return this.cachedDashboardData;
			}),
			catchError(error => {
				this.logging.error('Failed to fetch dashboard data from DB, using cache fallback', { error });
				// Only use cache as fallback when real-time fails
				if (this.cachedDashboardData) {
					return of(this.cachedDashboardData);
				}
				// If no cache available, return empty structure
				return of({
					activeTrackers: [],
					todaysEntries: [],
					weeklyStats: { totalEntries: 0, completedTrackers: 0, averageMood: 0 }
				});
			})
		);
	}

	// Get recent mood average with database ordering
	private getRecentMoodAverage(days: number): Observable<number> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of(0);

				const startDate = new Date();
				startDate.setDate(startDate.getDate() - days);
				const startDateStr = startDate.toISOString().split('T')[0];

				return this.db.queryDocuments<MoodEntry>('mood-entries', {
					where: [
						{ field: 'userId', operator: '==', value: authUser.uid },
						{ field: 'date', operator: '>=', value: startDateStr }
					],
					orderBy: [{ field: 'date', direction: 'desc' }], // Database ordering
					limit: 50 // Limit to recent entries for performance
				}).pipe(
					map(entries => {
						if (entries.length === 0) return 0;
						return entries.reduce((sum, entry) => sum + entry.moodLevel, 0) / entries.length;
					}),
					catchError(error => {
						this.logging.error('Failed to fetch recent mood average', error);
						return of(0);
					})
				);
			})
		);
	}

	// NEW: Increment entry count when logging entries (maintains accuracy)
	private async incrementTrackerEntryCount(trackerId: string): Promise<void> {
		try {
			// Use Firestore increment to atomically update count
			await this.db.updateDocument('trackers', trackerId, {
				entryCount: this.db.increment(1), // Atomic increment
				updatedAt: new Date()
			});
		} catch (error) {
			this.logging.error('Failed to increment tracker entry count', { trackerId, error });
		}
	}

	// NEW: Decrement entry count when deleting entries  
	private async decrementTrackerEntryCount(trackerId: string): Promise<void> {
		try {
			// Use Firestore increment with negative value to decrement
			await this.db.updateDocument('trackers', trackerId, {
				entryCount: this.db.increment(-1), // Atomic decrement
				updatedAt: new Date()
			});
		} catch (error) {
			this.logging.error('Failed to decrement tracker entry count', { trackerId, error });
		}
	}

	// Initialize default trackers for a new user - uses Firebase Function
	async initializeUserTrackers(): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		try {
			// Call Firebase Function to handle default tracker creation
			await firstValueFrom(this.db.callFunction('initializeDefaultTrackers', {
				userId: authUser.uid
			}));

			// Refresh trackers to reflect new trackers immediately
			this.refreshTrackers();
		} catch (error) {
			this.errorHandler.logWarning('Error initializing trackers via function', { error });
			throw new Error('Failed to initialize default trackers. Please try again or contact support.');
		}
	}

	// Create a new tracker
	async createTracker(trackerData: Omit<Tracker, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const now = new Date();
		const durationDays = trackerData.durationDays || 28;
		const isOngoing = trackerData.isOngoing || false;

		const tracker: Omit<Tracker, 'id'> = {
			...trackerData,
			userId: authUser.uid,
			durationDays: durationDays,
			startDate: trackerData.startDate || now,
			endDate: isOngoing ? now : (trackerData.endDate || new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000))),
			isCompleted: trackerData.isCompleted || false,
			timesExtended: trackerData.timesExtended || 0,
			isOngoing: isOngoing,
			entryCount: 0, // Initialize entry count for new trackers
			createdAt: now,
			updatedAt: now
		};

		const trackerId = await firstValueFrom(this.db.createDocument<Tracker>('trackers', tracker));

		// Refresh trackers observable to reflect new tracker immediately
		this.refreshTrackers();

		// Schedule notification if configured
		await this.notificationService.scheduleTrackerReminder({ ...tracker, id: trackerId } as Tracker);

		return trackerId;
	}

	// Get suggested trackers based on user behavior
	getSuggestedTrackers(): Tracker[] {
		return [
			{
				id: 'suggested-1',
				userId: '',
				name: 'Sleep Quality',
				category: TrackerCategory.BODY,
				type: TrackerType.DURATION,
				color: '#10b981',
				icon: 'fa-bed',
				target: 8,
				unit: 'hours',
				frequency: TrackerFrequency.DAILY,
				durationDays: 28,
				startDate: new Date(),
				endDate: new Date(Date.now() + (28 * 24 * 60 * 60 * 1000)),
				isCompleted: false,
				timesExtended: 0,
				isOngoing: false,
				isActive: true,
				isDefault: false,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				id: 'suggested-2',
				userId: '',
				name: 'Energy Levels',
				category: TrackerCategory.BODY,
				type: TrackerType.RATING,
				color: '#f59e0b',
				icon: 'fa-bolt',
				target: 7,
				unit: 'level',
				frequency: TrackerFrequency.DAILY,
				durationDays: 28,
				startDate: new Date(),
				endDate: new Date(Date.now() + (28 * 24 * 60 * 60 * 1000)),
				isCompleted: false,
				timesExtended: 0,
				isOngoing: false,
				isActive: true,
				isDefault: false,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		];
	}

	// Duration Management Methods

	// Check if a tracker has expired
	isTrackerExpired(tracker: Tracker): boolean {
		// Ongoing trackers never expire
		if (tracker.isOngoing) return false;

		const now = new Date();
		return now > tracker.endDate && !tracker.isCompleted;
	}

	// Get days remaining for a tracker
	getDaysRemaining(tracker: Tracker): number {
		// Ongoing trackers have unlimited days
		if (tracker.isOngoing) return -1; // -1 indicates unlimited

		const now = new Date();
		const timeDiff = tracker.endDate.getTime() - now.getTime();
		const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
		return Math.max(0, daysRemaining);
	}

	// Get tracker completion percentage based on duration
	getTrackerProgress(tracker: Tracker): number {
		// Ongoing trackers show progress based on streak or entries, not time
		if (tracker.isOngoing) {
			return 0; // Could be enhanced to show streak-based progress
		}

		const totalDays = tracker.durationDays;
		const daysRemaining = this.getDaysRemaining(tracker);
		const daysCompleted = totalDays - daysRemaining;
		return Math.min(100, Math.max(0, Math.round((daysCompleted / totalDays) * 100)));
	}

	// Extend a tracker by additional days
	async extendTracker(trackerId: string, additionalDays: number = 28): Promise<void> {
		const tracker = await firstValueFrom(this.getTracker(trackerId));
		if (!tracker) throw new Error('Tracker not found');

		// Ensure endDate is a proper Date object
		const currentEndDate = this.convertFirestoreDate(tracker.endDate);
		const newEndDate = new Date(currentEndDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

		await this.updateTracker(trackerId, {
			endDate: newEndDate,
			durationDays: tracker.durationDays + additionalDays,
			timesExtended: tracker.timesExtended + 1,
			isCompleted: false
		});
	}

	// Mark tracker as completed using Firebase Function
	async completeTracker(trackerId: string): Promise<void> {
		try {
			// Call Firebase Function to handle completion with stats updates
			await firstValueFrom(this.db.callFunction('completeTracker', { trackerId }));

			// Refresh trackers to reflect completion status immediately
			this.refreshTrackers();
		} catch (error) {
			this.errorHandler.logWarning('Error completing tracker via function', { error });
			throw new Error('Failed to complete tracker. Please try again or contact support.');
		}
	}

	// Restart a tracker with new duration
	async restartTracker(trackerId: string, newDurationDays: number = 28): Promise<void> {
		const now = new Date();
		const newEndDate = new Date(now.getTime() + (newDurationDays * 24 * 60 * 60 * 1000));

		await this.updateTracker(trackerId, {
			startDate: now,
			endDate: newEndDate,
			durationDays: newDurationDays,
			isCompleted: false,
			timesExtended: 0,
			isActive: true
		});
	}

	// Archive a tracker (hide it without blocking or deleting)
	async archiveTracker(trackerId: string): Promise<void> {
		await this.updateTracker(trackerId, {
			isActive: false,
			archivedAt: new Date()
		});
	}

	// Unarchive a tracker
	async unarchiveTracker(trackerId: string): Promise<void> {
		await this.updateTracker(trackerId, {
			isActive: true,
			archivedAt: undefined
		});
	}

	// Get expiring trackers with database ordering
	getExpiringTrackers(): Observable<Tracker[]> {
		return this.getUserTrackers().pipe(
			map(trackers => {
				const now = new Date();
				const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

				return trackers.filter(tracker =>
					tracker.isActive &&
					!tracker.isCompleted &&
					!tracker.isOngoing &&
					tracker.endDate <= threeDaysFromNow
				).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()); // Sort by end date
			})
		);
	}

	// Get completed trackers for achievements
	getCompletedTrackers(): Observable<Tracker[]> {
		return this.getUserTrackers().pipe(
			map(trackers => trackers.filter(tracker => tracker.isCompleted))
		);
	}

	// Convert a tracker to ongoing mode
	async convertToOngoing(trackerId: string): Promise<void> {
		await this.updateTracker(trackerId, {
			isOngoing: true,
			isCompleted: false
		});
	}

	// Convert a tracker to challenge mode with specified duration
	async convertToChallenge(trackerId: string, durationDays: number = 28): Promise<void> {
		const now = new Date();
		const newEndDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));

		await this.updateTracker(trackerId, {
			isOngoing: false,
			durationDays: durationDays,
			startDate: now,
			endDate: newEndDate,
			isCompleted: false,
			timesExtended: 0
		});
	}

	// Get ongoing trackers with proper filtering  
	getOngoingTrackers(): Observable<Tracker[]> {
		return this.getUserTrackers().pipe(
			map(trackers => trackers.filter(t => t.isOngoing && t.isActive))
		);
	}

	// Get challenge trackers with proper filtering
	getChallengeTrackers(): Observable<Tracker[]> {
		return this.getUserTrackers().pipe(
			map(trackers => trackers.filter(t => !t.isOngoing && t.isActive))
		);
	}

	// NEW: One-time migration to add entryCount to existing trackers
	async migrateExistingTrackersToIncludeEntryCount(): Promise<void> {
		try {
			const authUser = this.authService.getCurrentUser();
			if (!authUser) return;

			this.logging.info('Starting tracker entry count migration');

			// Get all trackers for the user
			const trackers = await firstValueFrom(this.getUserTrackers());

			for (const tracker of trackers) {
				// Only update trackers that don't have entryCount field
				if (tracker.entryCount === undefined || tracker.entryCount === null) {
					// Get actual count from entries
					const entries = await firstValueFrom(
						this.db.queryDocuments<TrackerEntry>('tracker-entries', {
							where: [
								{ field: 'trackerId', operator: '==', value: tracker.id },
								{ field: 'userId', operator: '==', value: authUser.uid }
							]
						})
					);

					// Update tracker with correct count
					await this.db.updateDocument('trackers', tracker.id, {
						entryCount: entries.length,
						updatedAt: new Date()
					});

					this.logging.info(`Updated tracker ${tracker.name} with entryCount: ${entries.length}`);
				}
			}

			this.logging.info('Tracker entry count migration completed');
			this.clearAllCaches(); // Clear caches after migration

		} catch (error) {
			this.logging.error('Failed to migrate tracker entry counts', { error });
		}
	}

	// NEW: Recovery method for partially failed operations
	async recoverFromPartialFailure(trackerId: string): Promise<void> {
		try {
			this.logging.info('Starting recovery for potential partial failures', { trackerId });

			// Verify and fix count discrepancies
			const result = await this.verifyAndFixTrackerEntryCount(trackerId);

			if (result.fixed) {
				this.logging.info('Recovered from partial failure', {
					trackerId,
					oldCount: result.oldCount,
					actualCount: result.actualCount
				});
			} else {
				this.logging.info('No recovery needed, counts are accurate', { trackerId });
			}

		} catch (error) {
			this.logging.error('Failed to recover from partial failure', { trackerId, error });
			throw this.errorHandler.createAppError(error, 'Failed to recover from partial failure');
		}
	}

	/**
	 * Calculate frequency-aware streak for a tracker
	 * @param tracker The tracker to calculate streak for
	 * @param entries All entries for this tracker (sorted by date desc)
	 * @returns Object with current and longest streak
	 */
	calculateFrequencyAwareStreak(tracker: Tracker, entries: TrackerEntry[]): { currentStreak: number; longestStreak: number } {
		if (!entries || entries.length === 0) {
			return { currentStreak: 0, longestStreak: 0 };
		}

		// Sort entries by date descending (most recent first)
		const sortedEntries = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

		switch (tracker.frequency) {
			case TrackerFrequency.DAILY:
				return this.calculateDailyStreak(sortedEntries);
			case TrackerFrequency.WEEKLY:
				return this.calculateWeeklyStreak(sortedEntries);
			case TrackerFrequency.MONTHLY:
				return this.calculateMonthlyStreak(sortedEntries);
			default:
				return this.calculateDailyStreak(sortedEntries);
		}
	}

	/**
	 * Calculate daily streak - must have entries every consecutive day
	 */
	private calculateDailyStreak(entries: TrackerEntry[]): { currentStreak: number; longestStreak: number } {
		let currentStreak = 0;
		let longestStreak = 0;
		let tempStreak = 0;

		// Check current streak starting from today/yesterday
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		let checkDate = new Date(today);

		// First check if there's an entry today or yesterday to start the streak
		const todayStr = today.toISOString().split('T')[0];
		const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		const hasToday = entries.some(e => e.date === todayStr);
		const hasYesterday = entries.some(e => e.date === yesterdayStr);

		if (hasToday) {
			currentStreak = 1;
			checkDate.setDate(checkDate.getDate() - 1);
		} else if (hasYesterday) {
			currentStreak = 1;
			checkDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
			checkDate.setDate(checkDate.getDate() - 1);
		} else {
			currentStreak = 0;
		}

		// Continue checking backwards for current streak
		if (currentStreak > 0) {
			for (let i = 0; i < 365; i++) { // Max 1 year lookback
				const dateStr = checkDate.toISOString().split('T')[0];
				const hasEntry = entries.some(e => e.date === dateStr);

				if (hasEntry) {
					currentStreak++;
					checkDate.setDate(checkDate.getDate() - 1);
				} else {
					break;
				}
			}
		}

		// Calculate longest streak by going through all entries
		const uniqueDates = [...new Set(entries.map(e => e.date))].sort();

		for (let i = 0; i < uniqueDates.length; i++) {
			tempStreak = 1;
			let currentDate = new Date(uniqueDates[i]);

			// Look forward for consecutive days
			for (let j = i + 1; j < uniqueDates.length; j++) {
				const nextDate = new Date(uniqueDates[j]);
				const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

				if (daysDiff === 1) {
					tempStreak++;
					currentDate = nextDate;
				} else {
					break;
				}
			}

			longestStreak = Math.max(longestStreak, tempStreak);
		}

		return { currentStreak, longestStreak };
	}

	/**
	 * Calculate weekly streak - must have at least one entry per week
	 */
	private calculateWeeklyStreak(entries: TrackerEntry[]): { currentStreak: number; longestStreak: number } {
		let currentStreak = 0;
		let longestStreak = 0;

		// Group entries by week (ISO week)
		const entriesByWeek = new Map<string, TrackerEntry[]>();

		entries.forEach(entry => {
			const entryDate = new Date(entry.date);
			const weekKey = this.getISOWeek(entryDate);

			if (!entriesByWeek.has(weekKey)) {
				entriesByWeek.set(weekKey, []);
			}
			entriesByWeek.get(weekKey)!.push(entry);
		});

		// Sort weeks
		const sortedWeeks = Array.from(entriesByWeek.keys()).sort().reverse();

		// Calculate current streak
		const currentWeek = this.getISOWeek(new Date());
		const lastWeek = this.getISOWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

		if (entriesByWeek.has(currentWeek)) {
			currentStreak = 1;
			let checkWeek = this.getPreviousWeek(currentWeek);

			while (entriesByWeek.has(checkWeek) && currentStreak < 52) { // Max 1 year
				currentStreak++;
				checkWeek = this.getPreviousWeek(checkWeek);
			}
		} else if (entriesByWeek.has(lastWeek)) {
			currentStreak = 1;
			let checkWeek = this.getPreviousWeek(lastWeek);

			while (entriesByWeek.has(checkWeek) && currentStreak < 52) {
				currentStreak++;
				checkWeek = this.getPreviousWeek(checkWeek);
			}
		}

		// Calculate longest streak
		let tempStreak = 0;
		let lastWeekKey = '';

		for (const weekKey of sortedWeeks.reverse()) { // Reverse to go chronologically
			if (!lastWeekKey || this.isConsecutiveWeek(lastWeekKey, weekKey)) {
				tempStreak++;
				longestStreak = Math.max(longestStreak, tempStreak);
			} else {
				tempStreak = 1;
			}
			lastWeekKey = weekKey;
		}

		return { currentStreak, longestStreak };
	}

	/**
	 * Calculate monthly streak - must have at least one entry per month
	 */
	private calculateMonthlyStreak(entries: TrackerEntry[]): { currentStreak: number; longestStreak: number } {
		let currentStreak = 0;
		let longestStreak = 0;

		// Group entries by month
		const entriesByMonth = new Map<string, TrackerEntry[]>();

		entries.forEach(entry => {
			const entryDate = new Date(entry.date);
			const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

			if (!entriesByMonth.has(monthKey)) {
				entriesByMonth.set(monthKey, []);
			}
			entriesByMonth.get(monthKey)!.push(entry);
		});

		// Sort months
		const sortedMonths = Array.from(entriesByMonth.keys()).sort().reverse();

		// Calculate current streak
		const now = new Date();
		const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const lastMonth = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`;

		if (entriesByMonth.has(currentMonth)) {
			currentStreak = 1;
			let checkMonth = this.getPreviousMonth(currentMonth);

			while (entriesByMonth.has(checkMonth) && currentStreak < 24) { // Max 2 years
				currentStreak++;
				checkMonth = this.getPreviousMonth(checkMonth);
			}
		} else if (entriesByMonth.has(lastMonth)) {
			currentStreak = 1;
			let checkMonth = this.getPreviousMonth(lastMonth);

			while (entriesByMonth.has(checkMonth) && currentStreak < 24) {
				currentStreak++;
				checkMonth = this.getPreviousMonth(checkMonth);
			}
		}

		// Calculate longest streak
		let tempStreak = 0;
		let lastMonthKey = '';

		for (const monthKey of sortedMonths.reverse()) { // Reverse to go chronologically
			if (!lastMonthKey || this.isConsecutiveMonth(lastMonthKey, monthKey)) {
				tempStreak++;
				longestStreak = Math.max(longestStreak, tempStreak);
			} else {
				tempStreak = 1;
			}
			lastMonthKey = monthKey;
		}

		return { currentStreak, longestStreak };
	}

	/**
	 * Helper: Get ISO week string for a date (YYYY-WW format)
	 */
	private getISOWeek(date: Date): string {
		const temp = new Date(date.getTime());
		temp.setHours(0, 0, 0, 0);
		temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
		const week1 = new Date(temp.getFullYear(), 0, 4);
		const weekNumber = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
		return `${temp.getFullYear()}-${String(weekNumber).padStart(2, '0')}`;
	}

	/**
	 * Helper: Get previous week string
	 */
	private getPreviousWeek(weekKey: string): string {
		const [year, week] = weekKey.split('-').map(Number);
		const date = this.getDateFromWeek(year, week);
		date.setDate(date.getDate() - 7);
		return this.getISOWeek(date);
	}

	/**
	 * Helper: Get previous month string
	 */
	private getPreviousMonth(monthKey: string): string {
		const [year, month] = monthKey.split('-').map(Number);
		if (month === 1) {
			return `${year - 1}-12`;
		} else {
			return `${year}-${String(month - 1).padStart(2, '0')}`;
		}
	}

	/**
	 * Helper: Check if two weeks are consecutive
	 */
	private isConsecutiveWeek(week1: string, week2: string): boolean {
		const date1 = this.getDateFromWeek(...week1.split('-').map(Number) as [number, number]);
		const date2 = this.getDateFromWeek(...week2.split('-').map(Number) as [number, number]);
		const daysDiff = Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);
		return daysDiff === 7;
	}

	/**
	 * Helper: Check if two months are consecutive
	 */
	private isConsecutiveMonth(month1: string, month2: string): boolean {
		const [year1, m1] = month1.split('-').map(Number);
		const [year2, m2] = month2.split('-').map(Number);

		if (year1 === year2) {
			return Math.abs(m2 - m1) === 1;
		} else if (year2 === year1 + 1) {
			return m1 === 12 && m2 === 1;
		} else if (year1 === year2 + 1) {
			return m2 === 12 && m1 === 1;
		}

		return false;
	}

	/**
	 * Helper: Get date from ISO week
	 */
	private getDateFromWeek(year: number, week: number): Date {
		const date = new Date(year, 0, 1);
		const daysToAdd = (week - 1) * 7;
		date.setDate(date.getDate() + daysToAdd);
		return date;
	}

	/**
	 * Check if a tracker's goal is completed for the current period based on frequency
	 * @param tracker The tracker to check
	 * @param entries Entries for the current period
	 * @returns Whether the goal is completed for the current period
	 */
	isGoalCompletedForCurrentPeriod(tracker: Tracker, entries: TrackerEntry[]): boolean {
		const currentPeriodEntries = this.getCurrentPeriodEntries(tracker, entries);
		const totalValue = currentPeriodEntries.reduce((sum, entry) => sum + entry.value, 0);

		return totalValue >= tracker.target;
	}

	/**
	 * Get entries for the current period based on tracker frequency
	 */
	private getCurrentPeriodEntries(tracker: Tracker, entries: TrackerEntry[]): TrackerEntry[] {
		const now = new Date();
		let startDate: Date;

		switch (tracker.frequency) {
			case TrackerFrequency.DAILY:
				// Today only
				startDate = new Date(now);
				startDate.setHours(0, 0, 0, 0);
				break;

			case TrackerFrequency.WEEKLY:
				// Start of current week (Monday)
				startDate = new Date(now);
				startDate.setDate(now.getDate() - (now.getDay() + 6) % 7);
				startDate.setHours(0, 0, 0, 0);
				break;

			case TrackerFrequency.MONTHLY:
				// Start of current month
				startDate = new Date(now.getFullYear(), now.getMonth(), 1);
				break;

			default:
				startDate = new Date(now);
				startDate.setHours(0, 0, 0, 0);
		}

		const startDateStr = startDate.toISOString().split('T')[0];
		return entries.filter(entry => entry.date >= startDateStr);
	}

	/**
	 * Get completion rate for current period based on frequency
	 * @param tracker The tracker
	 * @param entries All entries for this tracker
	 * @returns Completion percentage for current period
	 */
	getCurrentPeriodCompletionRate(tracker: Tracker, entries: TrackerEntry[]): number {
		const currentPeriodEntries = this.getCurrentPeriodEntries(tracker, entries);
		const totalValue = currentPeriodEntries.reduce((sum, entry) => sum + entry.value, 0);

		return Math.min(100, (totalValue / tracker.target) * 100);
	}
} 