import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { Tracker, TrackerEntry, TrackerStats, TrackerCategory, TrackerType, TrackerFrequency, MoodEntry } from '../models/tracker.interface';
import { createDefaultTrackersForUser } from '../data/default-trackers';
import { Observable, map, switchMap, of, combineLatest, shareReplay, firstValueFrom, catchError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TrackerService {
  // Cache observables to prevent repeated Firebase queries
  private userTrackers$: Observable<Tracker[]> | null = null;
  private todaysEntries$: Observable<TrackerEntry[]> | null = null;
  private trackerDashboardData$: Observable<any> | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private db: DatabaseService,
    private errorHandler: ErrorHandlingService,
    private logging: LoggingService
  ) {
    // Clear caches when user changes
    this.authService.user$.subscribe(() => {
      this.clearAllCaches();
    });
  }

  // Clear all cached observables
  private clearAllCaches() {
    this.userTrackers$ = null;
    this.todaysEntries$ = null;
    this.trackerDashboardData$ = null;
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

  // Get all trackers for current user (cached)
  getUserTrackers(): Observable<Tracker[]> {
    if (this.userTrackers$) {
      return this.userTrackers$;
    }

    this.userTrackers$ = this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        return this.db.getUserDocuments<Tracker>('trackers', authUser.uid, {
          where: [{ field: 'isActive', operator: '==', value: true }],
          orderBy: [{ field: 'createdAt', direction: 'asc' }]
        });
      }),
      map(trackers => trackers.map(tracker => this.normalizeTracker(tracker))),
      shareReplay(1) // Cache the result
    );

    return this.userTrackers$;
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
    this.clearAllCaches(); // Clear caches to reflect changes
  }

  // Delete tracker (soft delete)
  async deleteTracker(trackerId: string): Promise<void> {
    await this.updateTracker(trackerId, { isActive: false });
  }

  // Log a new tracker entry - uses Firebase Function for complex logic
  async logTrackerEntry(entryData: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    try {
      // Call Firebase Function to handle entry logging with stats updates
      const result = await firstValueFrom(this.db.callFunction<any, { entryId: string }>('logTrackerEntry', {
        ...entryData,
        userId: authUser.uid
      }));

      // Clear caches to reflect new entry
      this.clearAllCaches();

      return result.entryId;
    } catch (error) {
      this.errorHandler.logWarning('Error logging tracker entry via function', { error });
      throw new Error('Failed to log tracker entry. Please try again or contact support.');
    }
  }

  // Get tracker entries for a specific tracker
  getTrackerEntries(trackerId: string, limit: number = 50): Observable<TrackerEntry[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        return this.db.queryDocuments<TrackerEntry>('tracker-entries', {
          where: [
            { field: 'trackerId', operator: '==', value: trackerId },
            { field: 'userId', operator: '==', value: authUser.uid }
          ],
          orderBy: [{ field: 'date', direction: 'desc' }],
          limit: limit
        });
      })
    );
  }

  // Get today's entries for all trackers (cached)
  getTodaysEntries(): Observable<TrackerEntry[]> {
    if (this.todaysEntries$) {
      return this.todaysEntries$;
    }

    this.todaysEntries$ = this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.db.getDocumentsByDateRange<TrackerEntry>(
          'tracker-entries',
          today,
          tomorrow,
          'date',
          {
            where: [{ field: 'userId', operator: '==', value: authUser.uid }],
            orderBy: [{ field: 'date', direction: 'desc' }]
          }
        );
      }),
      shareReplay(1) // Cache the result
    );

    return this.todaysEntries$;
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

  // Get mood entries for analytics
  getMoodEntries(limit: number = 30): Observable<MoodEntry[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        return this.db.getUserDocuments<MoodEntry>('mood-entries', authUser.uid, {
          orderBy: [{ field: 'date', direction: 'desc' }],
          limit: limit
        });
      })
    );
  }

  // Get tracker progress dashboard data (cached)
  getTrackerDashboardData(): Observable<{
    activeTrackers: Tracker[];
    todaysEntries: TrackerEntry[];
    weeklyStats: { totalEntries: number; completedTrackers: number; averageMood: number };
  }> {
    if (this.trackerDashboardData$) {
      return this.trackerDashboardData$;
    }

    this.trackerDashboardData$ = combineLatest([
      this.getUserTrackers(),
      this.getTodaysEntries(),
      this.getMoodEntries(7)
    ]).pipe(
      map(([trackers, todaysEntries, recentMood]) => {
        const activeTrackers = trackers.filter(t => t.isActive);
        
        // Calculate weekly stats
        const weeklyStats = {
          totalEntries: todaysEntries.length,
          completedTrackers: activeTrackers.filter(t => 
            todaysEntries.some(e => e.trackerId === t.id)
          ).length,
          averageMood: recentMood.length > 0 
            ? Math.round(recentMood.reduce((sum, entry) => sum + entry.moodLevel, 0) / recentMood.length)
            : 0
        };

        return {
          activeTrackers,
          todaysEntries,
          weeklyStats
        };
      }),
      shareReplay(1) // Cache the result
    );

    return this.trackerDashboardData$;
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

      // Clear caches to reflect new trackers
      this.clearAllCaches();
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
      createdAt: now,
      updatedAt: now
    };

    const trackerId = await firstValueFrom(this.db.createDocument<Tracker>('trackers', tracker));

    // Clear caches to reflect new tracker
    this.clearAllCaches();

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
      
      // Clear caches
      this.clearAllCaches();
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

  // Get trackers nearing expiration (within 3 days)
  getExpiringTrackers(): Observable<Tracker[]> {
    return this.getUserTrackers().pipe(
      map(trackers => {
        const threeDaysFromNow = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
        return trackers.filter(tracker => {
          if (!tracker.isActive || tracker.isCompleted || tracker.isOngoing) {
            return false;
          }
          
          const endDate = this.convertFirestoreDate(tracker.endDate);
          return endDate <= threeDaysFromNow;
        });
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

  // Get ongoing trackers
  getOngoingTrackers(): Observable<Tracker[]> {
    return this.getUserTrackers().pipe(
      map(trackers => trackers.filter(tracker => tracker.isOngoing && tracker.isActive))
    );
  }

  // Get challenge trackers (time-limited)
  getChallengeTrackers(): Observable<Tracker[]> {
    return this.getUserTrackers().pipe(
      map(trackers => trackers.filter(tracker => !tracker.isOngoing && tracker.isActive))
    );
  }
} 