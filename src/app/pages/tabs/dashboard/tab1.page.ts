import { Component, OnInit, OnDestroy } from '@angular/core';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonToast
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, combineLatest, map, catchError, of, firstValueFrom } from 'rxjs';

// Services
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { TrackerService } from '../../../services/tracker.service';
import { JournalService } from '../../../services/journal.service';
import { ActivityService } from '../../../services/activity.service';
import { DatabaseService } from '../../../services/database.service';
import { ErrorHandlingService, UIErrorState } from '../../../services/error-handling.service';
import { LoggingService } from '../../../services/logging.service';

// Models
import { User } from '../../../models/user.interface';
import { Tracker } from '../../../models/tracker.interface';
import { Activity } from '../../../models/activity.interface';

interface DashboardData {
  user: User | null;
  journeyProgress: { currentDay: number; progress: number; milestone: string };
  wellnessScore: number;
  trackerStats: { totalSessions: number; weeklyCount: number; streak: number };
  journalStats: { totalEntries: number; weeklyCount: number; streak: number };
  recentActivities: Activity[];
  todaysSuggestions: DailySuggestion[];
  suggestionsState: UIErrorState;
}

interface DailyIntention {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface DailySuggestion {
  text: string;
  type: string;
  icon: string;
}

interface DailySuggestionsResponse {
  userId: string;
  date: string;
  suggestions: DailySuggestion[];
  generatedAt: any;
  source: string;
  model: string;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonToast
  ],
})
export class Tab1Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Dashboard data
  dashboardData: DashboardData = {
    user: null,
    journeyProgress: { currentDay: 1, progress: 0, milestone: 'Getting Started' },
    wellnessScore: 0,
    trackerStats: { totalSessions: 0, weeklyCount: 0, streak: 0 },
    journalStats: { totalEntries: 0, weeklyCount: 0, streak: 0 },
    recentActivities: [],
    todaysSuggestions: [],
    suggestionsState: {
      hasError: false,
      errorMessage: '',
      isRetryable: false,
      suggestions: [],
      showEmptyState: false,
      emptyStateMessage: ''
    }
  };

  // UI state
  isLoading = true;
  showToast = false;
  toastMessage = '';
  
  // Collapsed state for wellness journey section
  isWellnessJourneyCollapsed = true;
  
  // Cached profile image URL
  profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
  
  // Cached user display name
  userDisplayName = 'User';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private trackerService: TrackerService,
    private journalService: JournalService,
    private activityService: ActivityService,
    private db: DatabaseService,
    private errorHandling: ErrorHandlingService,
    private logging: LoggingService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData() {
    // Get user profile and journey progress first
    const userProfile$ = this.userService.getCurrentUserProfile().pipe(
      catchError((error) => {
        this.logging.error('Could not load user profile', { error });
        return this.errorHandling.handleErrorGracefully('loadUserProfile', error);
      })
    );
    
    const journeyProgress$ = this.userService.getJourneyProgress().pipe(
      catchError((error) => {
        this.logging.error('Could not load journey progress', { error });
        return this.errorHandling.handleErrorGracefully('loadJourneyProgress', error);
      })
    );
    
    const trackerData$ = this.trackerService.getTrackerDashboardData().pipe(
      catchError((error) => {
        this.logging.error('Could not load tracker data', { error });
        return this.errorHandling.handleErrorGracefully('loadTrackerData', error);
      })
    );
    
    const recentActivities$ = this.activityService.getRecentActivities(5).pipe(
      catchError((error) => {
        this.logging.error('Could not load recent activities', { error });
        return this.errorHandling.handleErrorGracefully('loadRecentActivities', error);
      })
    );

    // Combine the observable data streams with proper error handling
    const dashboardData$ = combineLatest([
      userProfile$,
      journeyProgress$,
      trackerData$,
      recentActivities$
    ]).pipe(
      map(([user, journeyProgress, trackerData, activities]) => {
        const result = {
          user,
          journeyProgress,
          wellnessScore: user?.stats?.weeklyActivityScore || 0,
          trackerStats: {
            totalSessions: user?.stats?.totalTrackerEntries || 0,
            weeklyCount: trackerData?.weeklyStats?.totalEntries || 0,
            streak: user?.stats?.currentStreaks || 0
          },
          journalStats: {
            totalEntries: user?.stats?.totalJournalEntries || 0,
            weeklyCount: 0, // Will be updated separately
            streak: 0 // Will be updated separately
          },
          recentActivities: activities || [],
          todaysSuggestions: [],
          suggestionsState: this.errorHandling.createSuccessState()
        };

        return result;
      }),
      catchError((error) => {
        this.logging.error('Error combining dashboard data', { error });
        // Return empty state with error
        return of({
          user: null,
          journeyProgress: { currentDay: 1, progress: 0, milestone: 'Getting Started' },
          wellnessScore: 0,
          trackerStats: { totalSessions: 0, weeklyCount: 0, streak: 0 },
          journalStats: { totalEntries: 0, weeklyCount: 0, streak: 0 },
          recentActivities: [],
          todaysSuggestions: [],
          suggestionsState: this.errorHandling.createUIErrorState(
            this.errorHandling.createAppError(error, 'loadDashboardData'),
            'Unable to load dashboard data'
          )
        });
      })
    );

    // Subscribe to dashboard data
    dashboardData$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dashboardData = data;
          // Update profile image URL when user data changes
          this.updateProfileImageUrl();
          this.isLoading = false;
          
          // Load daily suggestions asynchronously if no error
          if (!this.dashboardData.suggestionsState.hasError) {
            this.loadDailySuggestions();
          }
        },
        error: (error) => {
          this.logging.error('Error loading dashboard data', { error });
          this.isLoading = false;
          this.showToastMessage('Unable to load dashboard. Please check your connection and try again.');
        }
      });
  }

  // Update profile image URL when user data changes
  private updateProfileImageUrl() {
    // Update cached display name
    this.userDisplayName = this.getUserDisplayName();
    
    // Try to get photo from current auth user first (better access than stored URLs)
    const currentAuthUser = this.authService.getCurrentUser();
    const authPhotoURL = currentAuthUser?.photoURL;
    const storedPhotoURL = this.dashboardData.user?.photoURL;
    
    // Prefer the live auth photo over stored URL
    const photoURL = authPhotoURL || storedPhotoURL;
    
    if (!photoURL) {
      this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
      return;
    }

    // Use the photo URL directly - let browser handle loading/errors
    this.profileImageUrl = photoURL;
  }

  // Get user's greeting based on time of day
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Get user display name
  getUserDisplayName(): string {
    if (!this.dashboardData.user) {
      return 'User';
    }
    
    const displayName = this.dashboardData.user.displayName || 
                       this.dashboardData.user.email?.split('@')[0] || 
                       'User';
    
    return displayName;
  }

  // Get user's wellness goals
  getUserWellnessGoals(): string[] {
    return this.dashboardData.user?.wellnessGoals || [];
  }

  // Get user's focus areas
  getUserFocusAreas(): string[] {
    return this.dashboardData.user?.focusAreas || [];
  }

  // Get user's commitment level
  getUserCommitmentLevel(): string {
    const level = this.dashboardData.user?.commitmentLevel || 'moderate';
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  // Check if user has completed onboarding with goals
  hasWellnessGoals(): boolean {
    return this.getUserWellnessGoals().length > 0;
  }

  // Format time ago for activities
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Date(date).toLocaleDateString();
  }

  // Load daily suggestions with graceful error handling
  private async loadDailySuggestions(): Promise<void> {
    this.dashboardData.suggestionsState = {
      hasError: false,
      errorMessage: '',
      isRetryable: false,
      suggestions: [],
      showEmptyState: false,
      emptyStateMessage: 'Loading suggestions...'
    };

    try {
      // Check client-side cache first (localStorage)
      const cachedSuggestions = this.getCachedSuggestions();
      if (cachedSuggestions) {
        this.logging.debug('Using cached suggestions from localStorage');
        this.dashboardData.todaysSuggestions = cachedSuggestions.suggestions;
        this.dashboardData.suggestionsState = this.errorHandling.createSuccessState();
        return;
      }

      // No cache found, call Firebase Function
      this.logging.debug('No cached suggestions found, calling Firebase Function');
      const result = await firstValueFrom(this.db.callFunction<{}, DailySuggestionsResponse>('getDailySuggestions', {}));
      
      if (result && result.suggestions) {
        this.dashboardData.todaysSuggestions = result.suggestions;
        this.dashboardData.suggestionsState = this.errorHandling.createSuccessState();
        
        // Cache the result locally for faster subsequent loads
        this.cacheSuggestions(result);
      } else {
        // No suggestions returned - empty state
        this.dashboardData.suggestionsState = this.errorHandling.createEmptyState('No suggestions available today');
      }
    } catch (error) {
      this.logging.error('Error loading daily suggestions', { error });
      const appError = this.errorHandling.createAppError(error, 'loadDailySuggestions');
      this.dashboardData.suggestionsState = this.errorHandling.createUIErrorState(
        appError,
        'Daily suggestions unavailable'
      );
      
      // Clear suggestions on error
      this.dashboardData.todaysSuggestions = [];
    }
  }

  // Retry loading suggestions
  async retrySuggestions(): Promise<void> {
    await this.loadDailySuggestions();
  }

  // Client-side caching helpers
  private getCachedSuggestions(): { suggestions: DailySuggestion[]; date: string } | null {
    try {
      const today = this.getTodayKey();
      const cacheKey = `daily_suggestions_${today}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        // Validate cache structure and date
        if (parsedCache.date === today && parsedCache.suggestions && Array.isArray(parsedCache.suggestions)) {
          return parsedCache;
        }
      }
      
      // Clean up old cache entries
      this.cleanupOldSuggestionsCache();
      return null;
    } catch (error) {
      this.logging.error('Error reading suggestions cache', { error });
      return null;
    }
  }

  private cacheSuggestions(data: DailySuggestionsResponse): void {
    try {
      const today = this.getTodayKey();
      const cacheKey = `daily_suggestions_${today}`;
      
      const cacheData = {
        date: today,
        suggestions: data.suggestions,
        cachedAt: new Date().toISOString(),
        source: data.source || 'firebase'
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      this.logging.debug('Cached suggestions locally for date', { today });
    } catch (error) {
      this.logging.error('Error caching suggestions', { error });
    }
  }

  private getTodayKey(): string {
    // Use UTC date to match server-side caching
    const now = new Date();
    const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return utcToday.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private cleanupOldSuggestionsCache(): void {
    try {
      const today = this.getTodayKey();
      const keysToRemove: string[] = [];
      
      // Check localStorage for old suggestion cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('daily_suggestions_')) {
          const dateFromKey = key.replace('daily_suggestions_', '');
          
          // Remove if not today's cache
          if (dateFromKey !== today) {
            keysToRemove.push(key);
          }
        }
      }
      
      // Remove old entries
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      if (keysToRemove.length > 0) {
        this.logging.debug('Cleaned up old suggestion cache entries', { count: keysToRemove.length });
      }
    } catch (error) {
      this.logging.error('Error cleaning up old cache', { error });
    }
  }

  // Quick Actions
  async logMood() {
    try {
      // Navigate to mood tracker or open mood logging modal
      this.router.navigate(['/tabs/tracker']);
      // Could also implement a quick mood logging modal here
    } catch (error) {
      this.logging.error('Error navigating to mood tracker', { error });
      this.showToastMessage('Error opening mood tracker');
    }
  }

  async openBreathe() {
    try {
      // Navigate to breathing exercise or meditation
      // For now, just show a message
      this.showToastMessage('Breathing exercise coming soon! 🧘‍♀️');
    } catch (error) {
      this.logging.error('Error opening breathing exercise', { error });
    }
  }

  // View all activities
  viewAllActivities() {
    // Navigate to full activity history
    this.router.navigate(['/activity-history']);
  }

  // Utility methods
  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
  }

  onToastDismiss() {
    this.showToast = false;
  }

  // Image error handling - simplified
  onImageError(event: any) {
    // Fallback to a default avatar when any image fails to load
    const img = event.target as HTMLImageElement;
    const fallbackUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
    img.src = fallbackUrl;
  }

  onImageLoad(event: any) {
    // Image loaded successfully - no action needed
  }

  // Get a safe profile image URL
  getProfileImageUrl(): string {
    return this.profileImageUrl;
  }

  // Enhanced UI Methods for Wellness Journey
  getFocusAreaIcon(area: string): string {
    switch(area) {
      case 'MIND': return 'fa-solid fa-brain';
      case 'BODY': return 'fa-solid fa-dumbbell';
      case 'SOUL': return 'fa-solid fa-heart';
      case 'BEAUTY': return 'fa-solid fa-sparkles';
      default: return 'fa-solid fa-circle';
    }
  }

  getFocusAreaColor(area: string): string {
    switch(area) {
      case 'MIND': return '#3b82f6'; // Blue
      case 'BODY': return '#10b981'; // Green
      case 'SOUL': return '#8b5cf6'; // Purple
      case 'BEAUTY': return '#ec4899'; // Pink
      default: return '#6b7280'; // Gray
    }
  }

  getCommitmentLevelClass(dotNumber: number): string {
    const commitmentLevel = this.dashboardData.user?.commitmentLevel || 'moderate';
    let activeLevel = 1;
    
    switch(commitmentLevel.toLowerCase()) {
      case 'light':
        activeLevel = 1;
        break;
      case 'moderate':
        activeLevel = 2;
        break;
      case 'intensive':
        activeLevel = 3;
        break;
    }

    return dotNumber <= activeLevel ? 'bg-purple-500' : 'bg-neutral-300';
  }

  getCommitmentLevelColor(): string {
    const commitmentLevel = this.dashboardData.user?.commitmentLevel || 'moderate';
    
    switch(commitmentLevel.toLowerCase()) {
      case 'light': return '#10b981'; // Green for light
      case 'moderate': return '#f59e0b'; // Orange for moderate  
      case 'intensive': return '#dc2626'; // Red for intensive
      default: return '#6b7280'; // Gray default
    }
  }

  // Toggle wellness journey section
  toggleWellnessJourney() {
    this.isWellnessJourneyCollapsed = !this.isWellnessJourneyCollapsed;
  }
}
