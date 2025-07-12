import { Injectable } from '@angular/core';
import { Firestore, doc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, limit } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Activity, ActivityType, RecentActivitySummary, ActivityHelper } from '../models/activity.interface';
import { TrackerEntry } from '../models/tracker.interface';
import { JournalEntry } from '../models/journal.interface';
import { Observable, switchMap, of, take, firstValueFrom, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  // Cache recent activities to prevent repeated queries
  private recentActivities$: Observable<Activity[]> | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {
    // Clear cache when user changes
    this.authService.user$.subscribe(() => {
      this.clearActivityCache();
    });
  }

  // Clear the activities cache
  private clearActivityCache() {
    this.recentActivities$ = null;
    this.cacheExpiry = 0;
  }

  // Create a new activity entry
  async createActivity(activityData: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const activity: Omit<Activity, 'id'> = {
      ...activityData,
      userId: authUser.uid,
      createdAt: new Date()
    };

    const activitiesCollection = collection(this.firestore, 'activities');
    const docRef = await addDoc(activitiesCollection, activity);

    // Clear cache to reflect new activity
    this.clearActivityCache();

    return docRef.id;
  }

  // Auto-create activity from tracker entry
  async createActivityFromTrackerEntry(trackerEntry: TrackerEntry, trackerName: string, trackerColor: string, trackerIcon: string, trackerUnit: string = ''): Promise<string> {
    const activity = ActivityHelper.createTrackerEntryActivity(
      trackerEntry.userId,
      trackerEntry.trackerId,
      trackerName,
      trackerIcon,
      trackerColor,
      trackerEntry.value,
      trackerUnit,
      trackerEntry.mood
    );

    return this.createActivity(activity);
  }

  // Auto-create activity from journal entry
  async createActivityFromJournalEntry(journalEntry: JournalEntry): Promise<string> {
    const activity = ActivityHelper.createJournalEntryActivity(
      journalEntry.userId,
      journalEntry.id,
      journalEntry.title || 'New Journal Entry',
      journalEntry.mood
    );

    return this.createActivity(activity);
  }

  // Auto-create activity from goal completion
  async createActivityFromGoalCompletion(goalId: string, goalTitle: string, goalCategory: string): Promise<string> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const activity = ActivityHelper.createGoalCompletedActivity(
      authUser.uid,
      goalId,
      goalTitle,
      goalCategory
    );

    return this.createActivity(activity);
  }

  // Auto-create activity from achievement earned
  async createActivityFromAchievement(achievementId: string, achievementTitle: string, achievementIcon: string, achievementColor: string, points: number, rarity: string): Promise<string> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const activity = ActivityHelper.createAchievementEarnedActivity(
      authUser.uid,
      achievementId,
      achievementTitle,
      achievementIcon,
      achievementColor,
      points,
      rarity
    );

    return this.createActivity(activity);
  }

  // Get recent activities for current user (cached with time-based expiry)
  getRecentActivities(limitCount: number = 20): Observable<Activity[]> {
    const now = Date.now();
    
    // Return cached data if it's still valid
    if (this.recentActivities$ && now < this.cacheExpiry) {
      return this.recentActivities$;
    }

    // Create new cached observable
    this.recentActivities$ = this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const activitiesQuery = query(
          collection(this.firestore, 'activities'),
          where('userId', '==', authUser.uid),
          orderBy('activityDate', 'desc'),
          limit(limitCount)
        );
        
        return getDocs(activitiesQuery).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        );
      }),
      shareReplay(1) // Cache the result
    );

    // Set cache expiry
    this.cacheExpiry = now + this.CACHE_DURATION;

    return this.recentActivities$;
  }

  // Get activities by type
  getActivitiesByType(type: ActivityType, limitCount: number = 10): Observable<Activity[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const activitiesQuery = query(
          collection(this.firestore, 'activities'),
          where('userId', '==', authUser.uid),
          where('type', '==', type),
          orderBy('activityDate', 'desc'),
          limit(limitCount)
        );
        
        return getDocs(activitiesQuery).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        );
      })
    );
  }

  // Get activities for specific date range
  getActivitiesByDateRange(startDate: Date, endDate: Date): Observable<Activity[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const activitiesQuery = query(
          collection(this.firestore, 'activities'),
          where('userId', '==', authUser.uid),
          where('activityDate', '>=', startDate),
          where('activityDate', '<=', endDate),
          orderBy('activityDate', 'desc')
        );
        
        return getDocs(activitiesQuery).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        );
      })
    );
  }

  // Get today's activities
  getTodaysActivities(): Observable<Activity[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getActivitiesByDateRange(today, tomorrow);
  }

  // Get activity summary for dashboard
  async getActivitySummary(): Promise<RecentActivitySummary> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const activities = await firstValueFrom(this.getRecentActivities(10).pipe(take(1)));

    return {
      userId: authUser.uid,
      activities: activities || [],
      totalCount: activities?.length || 0,
      lastUpdated: new Date()
    };
  }

  // Get activity feed with time formatting for dashboard
  getActivityFeedForDashboard(): Observable<Array<Activity & { timeAgo: string }>> {
    return this.getRecentActivities(10).pipe(
      switchMap(activities => {
        const activitiesWithTime = activities.map(activity => ({
          ...activity,
          timeAgo: ActivityHelper.getTimeAgo(activity.activityDate)
        }));
        return of(activitiesWithTime);
      })
    );
  }

  // Clean up old activities (delete activities older than X months)
  async cleanupOldActivities(monthsOld: number = 6): Promise<number> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

    const activitiesQuery = query(
      collection(this.firestore, 'activities'),
      where('userId', '==', authUser.uid),
      where('activityDate', '<', cutoffDate)
    );

    const snapshot = await getDocs(activitiesQuery);
    let deletedCount = 0;

    // Delete old activities in batches
    const deletePromises = snapshot.docs.map(async (docSnapshot) => {
      await deleteDoc(doc(this.firestore, `activities/${docSnapshot.id}`));
      deletedCount++;
    });

    await Promise.all(deletePromises);
    return deletedCount;
  }

  // Get activity statistics
  async getActivityStats(): Promise<{
    totalActivities: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    typeBreakdown: { [key in ActivityType]: number };
  }> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    // Get activities for different time periods
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const [todayActivities, weekActivities, monthActivities, allActivities] = await Promise.all([
      this.getTodaysActivities().pipe(switchMap(activities => of(activities))).toPromise(),
      this.getActivitiesByDateRange(oneWeekAgo, new Date()).pipe(switchMap(activities => of(activities))).toPromise(),
      this.getActivitiesByDateRange(oneMonthAgo, new Date()).pipe(switchMap(activities => of(activities))).toPromise(),
      this.getRecentActivities(1000).pipe(switchMap(activities => of(activities))).toPromise()
    ]);

    // Calculate type breakdown - initialize all activity types to 0
    const typeBreakdown: { [key in ActivityType]: number } = Object.values(ActivityType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as { [key in ActivityType]: number });

    (allActivities || []).forEach(activity => {
      typeBreakdown[activity.type]++;
    });

    return {
      totalActivities: allActivities?.length || 0,
      todayCount: todayActivities?.length || 0,
      weekCount: weekActivities?.length || 0,
      monthCount: monthActivities?.length || 0,
      typeBreakdown
    };
  }

  // Delete specific activity
  async deleteActivity(activityId: string): Promise<void> {
    const activityDoc = doc(this.firestore, `activities/${activityId}`);
    await deleteDoc(activityDoc);
  }

  // Batch create activities (for bulk operations)
  async batchCreateActivities(activities: Omit<Activity, 'id' | 'createdAt'>[]): Promise<string[]> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const createPromises = activities.map(async (activityData) => {
      const activity: Omit<Activity, 'id'> = {
        ...activityData,
        userId: authUser.uid,
        createdAt: new Date()
      };

      const activitiesCollection = collection(this.firestore, 'activities');
      const docRef = await addDoc(activitiesCollection, activity);
      return docRef.id;
    });

    return Promise.all(createPromises);
  }

  // Get user's activity streak (consecutive days with activities)
  async getUserActivityStreak(): Promise<number> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    // Get recent activities and calculate consecutive days
    const activities = await this.getRecentActivities(100).pipe(
      switchMap(activities => of(activities))
    ).toPromise();

    if (!activities || activities.length === 0) return 0;

    // Group activities by date
    const activitiesByDate = new Map<string, Activity[]>();
    
    activities.forEach(activity => {
      const date = new Date(activity.activityDate).toDateString();
      
      if (!activitiesByDate.has(date)) {
        activitiesByDate.set(date, []);
      }
      activitiesByDate.get(date)?.push(activity);
    });

    // Calculate consecutive days from today backwards
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    while (true) {
      const dateString = currentDate.toDateString();
      if (activitiesByDate.has(dateString)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // Get mood correlation from activities
  async getMoodActivityCorrelation(): Promise<{
    averageMoodWithActivities: number;
    moodByActivityType: { [key in ActivityType]: number };
  }> {
    const activities = await this.getRecentActivities(200).pipe(
      switchMap(activities => of(activities))
    ).toPromise();

    const activitiesWithMood = (activities || []).filter(activity => activity.mood !== undefined);

    if (activitiesWithMood.length === 0) {
      return {
        averageMoodWithActivities: 0,
        moodByActivityType: Object.values(ActivityType).reduce((acc, type) => {
          acc[type] = 0;
          return acc;
        }, {} as { [key in ActivityType]: number })
      };
    }

    // Calculate overall average mood
    const averageMoodWithActivities = activitiesWithMood.reduce((sum, activity) => sum + (activity.mood || 0), 0) / activitiesWithMood.length;

    // Calculate mood by activity type
    const moodByActivityType: { [key in ActivityType]: number } = Object.values(ActivityType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as { [key in ActivityType]: number });

    Object.values(ActivityType).forEach(type => {
      const activitiesOfType = activitiesWithMood.filter(activity => activity.type === type);
      if (activitiesOfType.length > 0) {
        moodByActivityType[type] = activitiesOfType.reduce((sum, activity) => sum + (activity.mood || 0), 0) / activitiesOfType.length;
      }
    });

    return {
      averageMoodWithActivities: Math.round(averageMoodWithActivities * 10) / 10,
      moodByActivityType
    };
  }
} 