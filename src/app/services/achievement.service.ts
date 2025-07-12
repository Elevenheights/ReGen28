import { Injectable } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, collection, addDoc, query, where, getDocs, orderBy } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { ActivityService } from './activity.service';
import { Achievement, AchievementType, AchievementStatus, UserAchievement, StreakData, AchievementStats, DEFAULT_ACHIEVEMENTS, AchievementHelper } from '../models/achievements.interface';
import { Observable, map, switchMap, of, combineLatest, take, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AchievementService {

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private userService: UserService,
    private activityService: ActivityService
  ) {}

  // Initialize default achievements for a new user
  async initializeUserAchievements(): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser?.uid) throw new Error('No authenticated user');

    // Seed default achievements to the achievements collection if they don't exist
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      if (!achievement.id) continue;
      
      const achievementDoc = doc(this.firestore, `achievements/${achievement.id}`);
      const existingAchievement = await firstValueFrom(docData(achievementDoc as any).pipe(take(1)));
      
      if (!existingAchievement) {
        await setDoc(achievementDoc, achievement);
      }

      // Create user achievement tracking record
      await this.createUserAchievement(achievement.id);
    }
  }

  // Create a user achievement tracking record
  async createUserAchievement(achievementId: string): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const userAchievementId = `${authUser.uid}_${achievementId}`;
    const userAchievementDoc = doc(this.firestore, `user-achievements/${userAchievementId}`);
    
    // Check if already exists
    const existing = await docData(userAchievementDoc as any).pipe(take(1)).toPromise();
    if (existing) return;

    const userAchievement: UserAchievement = {
      id: userAchievementId,
      userId: authUser.uid,
      achievementId,
      status: AchievementStatus.LOCKED,
      progress: 0,
      currentValue: 0,
      earnedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(userAchievementDoc, userAchievement);
  }

  // Get all achievements
  getAllAchievements(): Observable<Achievement[]> {
    const achievementsQuery = query(
      collection(this.firestore, 'achievements'),
      where('isActive', '==', true),
      orderBy('type', 'asc')
    );
    
    return new Observable(observer => {
      getDocs(achievementsQuery).then(snapshot => {
        const achievements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Achievement));
        observer.next(achievements);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  // Get user's achievement progress
  getUserAchievements(): Observable<UserAchievement[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const userAchievementsQuery = query(
          collection(this.firestore, 'user-achievements'),
          where('userId', '==', authUser.uid),
          orderBy('earnedAt', 'desc')
        );
        
        return new Observable<UserAchievement[]>(observer => {
          getDocs(userAchievementsQuery).then(snapshot => {
            const userAchievements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAchievement));
            observer.next(userAchievements);
            observer.complete();
          }).catch(error => observer.error(error));
        });
      })
    );
  }

  // Get user achievements with achievement details
  getUserAchievementsWithDetails(): Observable<Array<UserAchievement & { achievement: Achievement }>> {
    return combineLatest([
      this.getUserAchievements(),
      this.getAllAchievements()
    ]).pipe(
      map(([userAchievements, achievements]) => {
        return userAchievements.map(userAchievement => {
          const achievement = achievements.find(a => a.id === userAchievement.achievementId);
          return {
            ...userAchievement,
            achievement: achievement!
          };
        }).filter(item => item.achievement); // Filter out any missing achievements
      })
    );
  }

  // Helper method to check if achievement is eligible
  private checkAchievementEligibility(achievement: Achievement, currentValue: number, additionalData?: any): boolean {
    const requirement = achievement.requirement;
    
    if (requirement.streakDays && currentValue >= requirement.streakDays) return true;
    if (requirement.totalCount && currentValue >= requirement.totalCount) return true;
    if (requirement.totalValue && currentValue >= requirement.totalValue) return true;
    if (requirement.averageValue && currentValue >= requirement.averageValue) return true;
    
    return false;
  }

  // Helper method to calculate achievement progress
  private calculateAchievementProgress(achievement: Achievement, currentValue: number): number {
    const requirement = achievement.requirement;
    let targetValue = 0;
    
    if (requirement.streakDays) targetValue = requirement.streakDays;
    else if (requirement.totalCount) targetValue = requirement.totalCount;
    else if (requirement.totalValue) targetValue = requirement.totalValue;
    else if (requirement.averageValue) targetValue = requirement.averageValue;
    
    if (targetValue === 0) return 0;
    
    const progress = (currentValue / targetValue) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  // Update user achievement progress
  async updateUserAchievementProgress(achievementId: string, currentValue: number, additionalData?: any): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const userAchievementId = `${authUser.uid}_${achievementId}`;
    const userAchievementDoc = doc(this.firestore, `user-achievements/${userAchievementId}`);

    // Get achievement details to check requirements
    const achievementDoc = doc(this.firestore, `achievements/${achievementId}`);
    const achievement = await firstValueFrom(docData(achievementDoc as any, { idField: 'id' }) as Observable<Achievement>);
    
    if (!achievement) return;

    // Check if achievement should be unlocked
    const isEligible = this.checkAchievementEligibility(achievement, currentValue, additionalData);
    const progress = this.calculateAchievementProgress(achievement, currentValue);

    let status: AchievementStatus = AchievementStatus.LOCKED;
    let earnedAt: Date | undefined = undefined;

    if (isEligible) {
      status = AchievementStatus.EARNED;
      earnedAt = new Date();
      
      // Create activity for achievement unlock
      await this.activityService.createActivityFromAchievement(
        achievementId,
        achievement.title,
        achievement.icon,
        achievement.color,
        achievement.points,
        achievement.rarity
      );

      // Update user stats
      await this.userService.incrementStat('totalMeditationMinutes', achievement.points); // Using meditation minutes as achievement points proxy
    } else if (progress > 0) {
      status = AchievementStatus.IN_PROGRESS;
    }

    const updateData: Partial<UserAchievement> = {
      progress,
      currentValue,
      status,
      ...(earnedAt && { earnedAt })
    };

    await updateDoc(userAchievementDoc, updateData);
  }

  // Check all achievements for a user (called after tracker/journal actions)
  async checkUserAchievements(triggerType: 'tracker' | 'journal' | 'streak' | 'goal', data: any): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    // Get all achievements and user's current progress
    const [achievements, userAchievements] = await Promise.all([
      firstValueFrom(this.getAllAchievements()),
      firstValueFrom(this.getUserAchievements())
    ]);

    // Filter achievements relevant to the trigger type
    const relevantAchievements = achievements.filter(achievement => {
      switch (triggerType) {
        case 'tracker':
          return [AchievementType.STREAK, AchievementType.CONSISTENCY, AchievementType.MILESTONE].includes(achievement.type);
        case 'journal':
          return [AchievementType.STREAK, AchievementType.CONSISTENCY, AchievementType.WELLNESS].includes(achievement.type);
        case 'streak':
          return achievement.type === AchievementType.STREAK;
        case 'goal':
          return [AchievementType.MILESTONE, AchievementType.WELLNESS].includes(achievement.type);
        default:
          return false;
      }
    });

    // Check each relevant achievement
    for (const achievement of relevantAchievements) {
      const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id);
      
      // Skip if already unlocked
      if (userAchievement?.status === AchievementStatus.EARNED) continue;

      // Calculate current value based on achievement type and trigger data
      const currentValue = await this.calculateCurrentValueForAchievement(achievement, data);
      
      await this.updateUserAchievementProgress(achievement.id, currentValue, data);
    }
  }

  // Calculate current value for achievement based on type
  private async calculateCurrentValueForAchievement(achievement: Achievement, triggerData: any): Promise<number> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) return 0;

    const userProfile = await firstValueFrom(this.userService.getCurrentUserProfile());
    if (!userProfile) return 0;

    switch (achievement.type) {
      case AchievementType.STREAK:
        // For streak achievements, return the current streak value
        if (achievement.id.includes('tracker')) {
          return userProfile.stats.currentStreaks || 0;
        }
        return triggerData.streakDays || 0;

      case AchievementType.MILESTONE:
        // For milestone achievements, return total count
        if (achievement.id.includes('tracker')) {
          return userProfile.stats.totalTrackerEntries || 0;
        } else if (achievement.id.includes('journal')) {
          return userProfile.stats.totalJournalEntries || 0;
        }
        return 0;

      case AchievementType.CONSISTENCY:
        // For consistency achievements, return weekly activity score
        return userProfile.stats.weeklyActivityScore || 0;

      case AchievementType.WELLNESS:
        // For wellness achievements, return overall wellness metrics
        return userProfile.stats.weeklyActivityScore || 0;

      default:
        return 0;
    }
  }

  // Get streak data for a specific tracker
  async getTrackerStreakData(trackerId: string): Promise<StreakData | null> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) return null;

    const streakQuery = query(
      collection(this.firestore, 'tracker-streaks'),
      where('trackerId', '==', trackerId),
      where('userId', '==', authUser.uid)
    );

    const snapshot = await getDocs(streakQuery);
    if (snapshot.empty) return null;

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as unknown as StreakData;
  }

  // Update streak data for a tracker
  async updateTrackerStreakData(trackerId: string, currentStreak: number): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const streakId = `${authUser.uid}_${trackerId}`;
    const streakDoc = doc(this.firestore, `tracker-streaks/${streakId}`);

    const existingStreak = await this.getTrackerStreakData(trackerId);
    const longestStreak = Math.max(currentStreak, existingStreak?.longestStreak || 0);

    // Check for streak milestones
    const milestones = [3, 7, 14, 21, 30, 50, 75, 100];
    const newMilestones = milestones.filter(milestone => 
      currentStreak >= milestone && 
      (!existingStreak?.milestonesReached || !existingStreak.milestonesReached.includes(milestone))
    );

    const streakData: any = {
      trackerId,
      userId: authUser.uid,
      currentStreak,
      currentStartDate: new Date(),
      longestStreak,
      lastActivityDate: new Date(),
      milestonesReached: [...(existingStreak?.milestonesReached || []), ...newMilestones],
      updatedAt: new Date()
    };

    await setDoc(streakDoc, streakData);

    // Check for streak achievements
    if (newMilestones.length > 0) {
      await this.checkUserAchievements('streak', { trackerId, streakDays: currentStreak });
    }
  }

  // Get achievement statistics for user
  async getAchievementStats(): Promise<AchievementStats> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const userAchievements = await firstValueFrom(this.getUserAchievements());
    
    const totalEarned = userAchievements.filter(ua => ua.status === AchievementStatus.EARNED).length;
    const inProgress = userAchievements.filter(ua => ua.status === AchievementStatus.IN_PROGRESS).length;
    const available = userAchievements.filter(ua => ua.status === AchievementStatus.AVAILABLE).length;

    // Calculate total points earned
    const totalPoints = await firstValueFrom(
      this.getUserAchievementsWithDetails().pipe(
        map(achievementsWithDetails => 
          achievementsWithDetails
            .filter(item => item.status === AchievementStatus.EARNED)
            .reduce((total, item) => total + item.achievement.points, 0)
        )
      )
    );

    // Get rarity breakdown
    const rarityBreakdown = await firstValueFrom(
      this.getUserAchievementsWithDetails().pipe(
        map(achievementsWithDetails => {
          const earned = achievementsWithDetails.filter(item => item.status === AchievementStatus.EARNED);
          return {
            commonEarned: earned.filter(item => item.achievement.rarity === 'common').length,
            rareEarned: earned.filter(item => item.achievement.rarity === 'rare').length,
            epicEarned: earned.filter(item => item.achievement.rarity === 'epic').length,
            legendaryEarned: earned.filter(item => item.achievement.rarity === 'legendary').length
          };
        })
      )
    );

    return {
      userId: authUser.uid,
      totalEarned,
      totalPoints,
      streakAchievements: 0,
      milestoneAchievements: 0,
      wellnessAchievements: 0,
      ...rarityBreakdown,
      inProgress,
      available,
      lastUpdated: new Date()
    };
  }

  // Get recent achievements for dashboard
  getRecentAchievements(limit: number = 5): Observable<Array<UserAchievement & { achievement: Achievement }>> {
    return this.getUserAchievementsWithDetails().pipe(
      map(achievements => 
        achievements
          .filter(item => item.status === AchievementStatus.EARNED)
          .sort((a, b) => {
            const dateA = a.earnedAt ? new Date(a.earnedAt).getTime() : 0;
            const dateB = b.earnedAt ? new Date(b.earnedAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, limit)
      )
    );
  }

  // Get achievements by type
  getAchievementsByType(type: AchievementType): Observable<Array<UserAchievement & { achievement: Achievement }>> {
    return this.getUserAchievementsWithDetails().pipe(
      map(achievements => achievements.filter(item => item.achievement.type === type))
    );
  }

  // Calculate user's achievement level/rank
  async getUserAchievementLevel(): Promise<{ level: number; title: string; pointsToNext: number }> {
    const stats = await this.getAchievementStats();
    const points = stats.totalPoints;

    // Define level thresholds
    const levels = [
      { level: 1, title: 'Beginner', points: 0 },
      { level: 2, title: 'Explorer', points: 100 },
      { level: 3, title: 'Achiever', points: 300 },
      { level: 4, title: 'Dedicated', points: 600 },
      { level: 5, title: 'Master', points: 1000 },
      { level: 6, title: 'Legend', points: 1500 },
      { level: 7, title: 'Champion', points: 2500 }
    ];

    let currentLevel = levels[0];
    let nextLevel = levels[1];

    for (let i = 0; i < levels.length - 1; i++) {
      if (points >= levels[i].points && points < levels[i + 1].points) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1];
        break;
      } else if (points >= levels[levels.length - 1].points) {
        currentLevel = levels[levels.length - 1];
        nextLevel = levels[levels.length - 1]; // Max level
        break;
      }
    }

    const pointsToNext = nextLevel.level === currentLevel.level ? 0 : nextLevel.points - points;

    return {
      level: currentLevel.level,
      title: currentLevel.title,
      pointsToNext
    };
  }

  // Batch check achievements (for performance optimization)
  async batchCheckAchievements(updates: Array<{ type: string; data: any }>): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    // Group updates by type to avoid redundant checks
    const groupedUpdates = updates.reduce((acc, update) => {
      if (!acc[update.type]) acc[update.type] = [];
      acc[update.type].push(update.data);
      return acc;
    }, {} as { [key: string]: any[] });

    // Process each type of update
    for (const [type, dataArray] of Object.entries(groupedUpdates)) {
      // Use the most recent data for checking (or aggregate if needed)
      const latestData = dataArray[dataArray.length - 1];
      await this.checkUserAchievements(type as any, latestData);
    }
  }
} 