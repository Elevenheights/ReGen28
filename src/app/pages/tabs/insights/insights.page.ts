import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
	IonContent,
	IonRefresher,
	IonRefresherContent,
	IonSpinner,
	ModalController
} from '@ionic/angular/standalone';

// Services
import { AuthService } from '../../../services/auth.service';
import { TrackerService } from '../../../services/tracker.service';
import { UserService } from '../../../services/user.service';
import { JournalService } from '../../../services/journal.service';
import { ActivityService } from '../../../services/activity.service';
import { ErrorHandlingService, UIErrorState } from '../../../services/error-handling.service';
import { GoalService } from '../../../services/goal.service';
import { Goal } from '../../../models/goal.interface';
import { LoggingService } from '../../../services/logging.service';
import { LoggingModalService } from '../../../services/logging-modal.service';
import { TrackerSuggestionsService, TrackerSuggestionsState } from '../../../services/tracker-suggestions.service';
import { AIRecommendationsService } from '../../../services/ai-recommendations.service';
import { ToastService } from '../../../services/toast.service';
import { StatisticsService } from '../../../services/statistics.service';
import { FeedService } from '../../../services/feed.service';
import { FeedItem } from '../../../models/feed-item.interface';

// Models
import { User } from '../../../models/user.interface';
import { Activity } from '../../../models/activity.interface';
import { Tracker, TrackerEntry } from '../../../models/tracker.interface';

// Components
import { ProfileImageComponent } from '../../../components/profile-image';
import { BreatheModalComponent } from '../../../components/breathe-modal/breathe-modal.component';
import { WriteEntryModalComponent } from '../../../components/journal/write-entry-modal/write-entry-modal.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SectionSeparatorComponent } from '../../../components/section-separator/section-separator.component';
import { CountUpDirective } from '../../../directives/count-up.directive';

// RxJS
import { Subject, combineLatest, of, firstValueFrom } from 'rxjs';
import { takeUntil, map, catchError, take, switchMap } from 'rxjs/operators';

interface DashboardData {
	user: User | null;
	journeyProgress: { currentDay: number; progress: number; milestone: string };
	wellnessScore: number;
	trackerStats: { totalSessions: number; weeklyCount: number; streak: number };
	journalStats: { totalEntries: number; weeklyCount: number; streak: number };
	weeklyMoodData: {
		dailyMoods: (number | null)[];
		averageMood: number;
		trend: 'improving' | 'declining' | 'stable';
		entryCount: number;
	};
	recentActivities: Activity[];
	activeTrackers: any[];
	todaysEntries: any[];
	activeGoals: Goal[];
	weeklyActivityStats: any[]; // UserDailyStats[]
	expandedSuggestions: { [trackerId: string]: boolean };
	analytics: {
		wellnessScore: number;
		moodData: {
			average: number;
		};
		consistencyRate: number;
		currentStreak: number;
		categoryPerformance: {
			mind: number;
			body: number;
			soul: number;
			beauty: number;
		};
		// Insights data
		peakPerformanceHour: number;
		peakPerformanceBoost: number;
		moodBoostAmount: number;
		topCategoryConsistency: number;
		wellnessScoreChange: number;
	};
	// New feed-based actions and insights
	todaysActions: FeedItem[];
	todaysInsights: FeedItem[];
}

@Component({
	selector: 'app-insights',
	templateUrl: 'insights.page.html',
	styleUrls: ['insights.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonContent,
		IonRefresher,
		IonRefresherContent,
		IonSpinner,
		PageHeaderComponent,
		SectionSeparatorComponent,
		CountUpDirective
	],
})
export class InsightsPage implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// Dashboard data
	dashboardData: DashboardData = {
		user: null,
		journeyProgress: { currentDay: 1, progress: 0, milestone: 'Getting Started' },
		wellnessScore: 0,
		trackerStats: { totalSessions: 0, weeklyCount: 0, streak: 0 },
		journalStats: { totalEntries: 0, weeklyCount: 0, streak: 0 },
		weeklyMoodData: {
			dailyMoods: [],
			averageMood: 0,
			trend: 'stable',
			entryCount: 0
		},
		recentActivities: [],
		activeTrackers: [],
		todaysEntries: [],
		activeGoals: [],
		weeklyActivityStats: [],
		expandedSuggestions: {},
		analytics: {
			wellnessScore: 0,
			moodData: {
				average: 0
			},
			consistencyRate: 0,
			currentStreak: 0,
			categoryPerformance: {
				mind: 0,
				body: 0,
				soul: 0,
				beauty: 0
			},
			// Insights data
			peakPerformanceHour: 9,
			peakPerformanceBoost: 25,
			moodBoostAmount: 1.2,
			topCategoryConsistency: 85,
			wellnessScoreChange: 5
		},
		todaysActions: [],
		todaysInsights: []
	};

	// Separate state for suggestions
	suggestionsState: TrackerSuggestionsState = {};

	// Loading and error states
	isLoading = true;
	hasGeneralError = false;
	generalErrorMessage = '';

	// Coaching state
	isExpanded = false;

	// Global reading mode for Today's Actions
	isReadingMode = false;

	// Mood Chart Timeframe
	moodChartTimeframe: 'week' | 'month' = 'week';

	// Collapsed state for wellness journey section
	isWellnessJourneyCollapsed = true;

	// Cached profile image URL
	profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';

	// Cached user display name
	userDisplayName = 'User';

	// Quote slideshow state
	currentQuoteIndex = 0;
	isQuoteTransitioning = false;
	private quoteIntervalId: any = null;
	private readonly QUOTE_INTERVAL_MS = 8000; // 8 seconds per quote

	// Computed properties for suggestions
	get isLoadingSuggestions(): boolean {
		return Object.values(this.suggestionsState).some(state => state.isLoading);
	}

	get hasAnySuggestions(): boolean {
		return this.dashboardData.todaysActions.length > 0 || this.dashboardData.todaysInsights.length > 0;
	}

	get showEmptyState(): boolean {
		const hasTrackers = this.dashboardData.activeTrackers.length > 0;
		const allLoaded = Object.values(this.suggestionsState).every(state => !state.isLoading);
		const noSuggestions = !this.hasAnySuggestions;
		const noErrors = !this.hasGeneralError;

		// If no trackers, show empty state
		if (!hasTrackers) {
			return true;
		}

		// If we have trackers but all loaded and no suggestions and no errors
		return hasTrackers && allLoaded && noSuggestions && noErrors;
	}

	get emptyStateMessage(): string {
		const hasTrackers = this.dashboardData.activeTrackers.length > 0;
		if (!hasTrackers) {
			return 'Create your first tracker to see personalized suggestions!';
		}
		return 'No suggestions available today. Check back later!';
	}

	/**
	 * Get all trackers that have suggestions or are loading
	 */
	getTrackersWithSuggestions(): any[] {
		// Get unique tracker IDs from today's actions
		const trackerIds = new Set(this.dashboardData.todaysActions.map(action => action.source.trackerId).filter(Boolean));
		return this.dashboardData.activeTrackers.filter(tracker => trackerIds.has(tracker.id));
	}

	/**
	 * Get action for a specific tracker
	 */
	getTrackerAction(trackerId: string): FeedItem | null {
		return this.dashboardData.todaysActions.find(action => action.source.trackerId === trackerId) || null;
	}

	/**
	 * Get insight for a specific tracker
	 */
	getTrackerInsight(trackerId: string): FeedItem | null {
		return this.dashboardData.todaysInsights.find(insight => insight.source.trackerId === trackerId) || null;
	}

	/**
	 * Check if a tracker is currently loading
	 */
	isTrackerLoading(trackerId: string): boolean {
		const trackerState = this.suggestionsState[trackerId];
		return trackerState?.isLoading || false;
	}

	/**
	 * Get error message for a specific tracker
	 */
	getTrackerError(trackerId: string): string | null {
		const trackerState = this.suggestionsState[trackerId];
		return trackerState?.error || null;
	}

	/**
	 * Check if a tracker's suggestions are expanded
	 */
	isTrackerExpanded(trackerId: string): boolean {
		// Default to true for debugging - change back to false later
		return this.dashboardData.expandedSuggestions[trackerId] !== false;
	}

	toggleTrackerExpansion(trackerId: string): void {
		this.dashboardData.expandedSuggestions[trackerId] = !this.dashboardData.expandedSuggestions[trackerId];
	}

	toggleActionExpansion(trackerId: string, event?: Event): void {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}

		// Toggle global reading mode instead of individual cards
		this.isReadingMode = !this.isReadingMode;
		console.log(`Toggling reading mode to: ${this.isReadingMode}`);
	}

	isActionExpanded(trackerId: string): boolean {
		// All cards are expanded when in reading mode
		return this.isReadingMode;
	}

	/**
	 * Retry loading suggestions for a specific tracker
	 */
	async retryTrackerSuggestions(trackerId: string): Promise<void> {
		try {
			await this.trackerSuggestions.loadSuggestionsForTracker(trackerId, true); // force refresh
		} catch (error) {
			this.logging.error('Failed to retry suggestions for tracker', { trackerId, error });
		}
	}

	/**
	 * Load suggestions for active trackers using the new TrackerSuggestionsService
	 */
	private async loadSuggestionsForActiveTrackers(): Promise<void> {
		// Subscribe to suggestions state changes
		this.trackerSuggestions.suggestionsState$
			.pipe(takeUntil(this.destroy$))
			.subscribe(state => {
				this.suggestionsState = state;
			});

		// Get active tracker IDs
		const activeTrackerIds = this.dashboardData.activeTrackers.map(tracker => tracker.id);

		if (activeTrackerIds.length === 0) {
			this.logging.debug('No active trackers found for suggestions');
			return;
		}

		// Load suggestions for all active trackers
		try {
			await this.trackerSuggestions.loadSuggestionsForTrackers(activeTrackerIds);
			this.logging.debug('Successfully loaded suggestions for active trackers', { trackerIds: activeTrackerIds });
		} catch (error) {
			this.logging.error('Failed to load suggestions for active trackers', { error, trackerIds: activeTrackerIds });
		}
	}

	constructor(
		private authService: AuthService,
		private userService: UserService,
		private trackerService: TrackerService,
		private goalService: GoalService,
		private journalService: JournalService,
		private activityService: ActivityService,
		private errorHandling: ErrorHandlingService,
		private logging: LoggingService,
		private trackerSuggestions: TrackerSuggestionsService,
		private statisticsService: StatisticsService,
		private feedService: FeedService,
		private loggingModalService: LoggingModalService,
		public router: Router,
		private toastService: ToastService,
		private modalCtrl: ModalController
	) { }

	ngOnInit() {
		this.loadEnhancedDashboardData();
		this.loadTodaysActionsAndInsights();
		this.startQuoteSlideshow();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
		this.stopQuoteSlideshow();
	}

	// Retry dashboard loading (clear error state and try again)
	retryDashboardLoad() {
		this.hasGeneralError = false;
		this.generalErrorMessage = '';
		this.isLoading = true;
		this.statisticsService.clearCacheForType('all');
		this.loadEnhancedDashboardData();
	}

	// Load today's actions and insights from feed
	private loadTodaysActionsAndInsights() {
		this.feedService.getTodaysActionsAndInsights()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: ({ actions, insights }) => {
					this.dashboardData.todaysActions = actions;
					this.dashboardData.todaysInsights = insights;
					this.logging.debug('Loaded today\'s actions and insights', {
						actionsCount: actions.length,
						insightsCount: insights.length
					});
				},
				error: (error) => {
					this.logging.error('Failed to load today\'s actions and insights', error);
				}
			});
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

		const weeklyMoodData$ = this.journalService.getMoodAnalytics(7).pipe(
			switchMap((analytics: { averageMood: number; moodTrend: 'improving' | 'declining' | 'stable'; moodDistribution: { [key: number]: number } }) => {
				// Get journal entries for the past 7 days to calculate daily moods
				const endDate = new Date();
				const startDate = new Date();
				startDate.setDate(endDate.getDate() - 6); // 7 days including today

				return this.journalService.getJournalEntriesByDateRange(startDate, endDate).pipe(
					map(entries => {
						// Create array for 7 days (Monday to Sunday)
						const dailyMoods = new Array(7).fill(null);

						// Group entries by date and calculate average mood for each day
						entries.forEach(entry => {
							const entryDate = new Date(entry.date);
							const dayIndex = (entryDate.getDay() + 6) % 7; // Convert to Monday=0, Sunday=6

							if (entry.mood && entry.mood > 0) {
								if (dailyMoods[dayIndex] === null) {
									dailyMoods[dayIndex] = entry.mood;
								} else {
									// Average if multiple entries per day
									dailyMoods[dayIndex] = (dailyMoods[dayIndex] + entry.mood) / 2;
								}
							}
						});

						return {
							dailyMoods,
							averageMood: analytics.averageMood,
							trend: analytics.moodTrend,
							entryCount: entries.length
						};
					})
				);
			}),
			catchError((error) => {
				this.logging.error('Could not load weekly mood data', { error });
				return of({
					dailyMoods: [],
					averageMood: 0,
					trend: 'stable' as const,
					entryCount: 0
				});
			})
		);

		// Combine the observable data streams with proper error handling
		const dashboardData$ = combineLatest(
			userProfile$,
			journeyProgress$,
			trackerData$,
			recentActivities$,
			weeklyMoodData$
		).pipe(
			map(([user, journeyProgress, trackerData, activities, weeklyMoodData]) => {
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
						weeklyCount: 0, // Placeholder in legacy loader
						streak: user?.stats?.journalStreak || 0
					},
					weeklyMoodData,
					recentActivities: activities || [],
					activeTrackers: trackerData?.activeTrackers || [],
					todaysEntries: trackerData?.todaysEntries || [],
					activeGoals: [], // Legacy loader
					weeklyActivityStats: [],
					expandedSuggestions: {},
					analytics: {
						wellnessScore: user?.stats?.weeklyActivityScore || 0,
						moodData: {
							average: weeklyMoodData.averageMood || 0
						},
						consistencyRate: 0,
						currentStreak: user?.stats?.currentStreaks || 0,
						categoryPerformance: this.calculateCategoryPerformance([], trackerData?.activeTrackers || []),
						// Insights data
						peakPerformanceHour: 9,
						peakPerformanceBoost: 25,
						moodBoostAmount: 1.2,
						topCategoryConsistency: 85,
						wellnessScoreChange: 5
					},
					todaysActions: [],
					todaysInsights: []
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
					weeklyMoodData: {
						dailyMoods: [],
						averageMood: 0,
						trend: 'stable' as const,
						entryCount: 0
					},
					recentActivities: [],
					activeTrackers: [],
					todaysEntries: [],
					activeGoals: [],
					weeklyActivityStats: [],
					expandedSuggestions: {},
					analytics: {
						wellnessScore: 0,
						moodData: {
							average: 0
						},
						consistencyRate: 0,
						currentStreak: 0,
						categoryPerformance: {
							mind: 0,
							body: 0,
							soul: 0,
							beauty: 0
						},
						// Insights data
						peakPerformanceHour: 9,
						peakPerformanceBoost: 0,
						moodBoostAmount: 0,
						topCategoryConsistency: 0,
						wellnessScoreChange: 0
					},
					todaysActions: [],
					todaysInsights: []
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

					// Load tracker-specific suggestions using the new service
					this.loadSuggestionsForActiveTrackers();
				},
				error: (error) => {
					this.logging.error('Error loading dashboard data', { error });
					this.isLoading = false;
					this.toastService.showError('Unable to load dashboard. Please check your connection and try again.');
				}
			});
	}

	/**
	 * Enhanced dashboard data loading using pre-calculated statistics
	 * This provides instant loading by leveraging the statistics service
	 */
	private loadEnhancedDashboardData() {
		this.logging.info('Loading enhanced dashboard with pre-calculated statistics');

		// Get user profile first
		const userProfile$ = this.userService.getCurrentUserProfile().pipe(
			catchError((error) => {
				this.logging.error('Could not load user profile', { error });
				return this.errorHandling.handleErrorGracefully('loadUserProfile', error);
			})
		);
		// Get today's pre-calculated statistics
		const todaysStats$ = this.statisticsService.getTodaysStats().pipe(
			catchError((error) => {
				this.logging.warn('Could not load today\'s statistics, falling back to basic data', { error });
				return of(null);
			})
		);

		// Get weekly journal stats for count
		const weeklyJournalStats$ = this.statisticsService.getJournalDailyStats({ days: 7 }).pipe(
			catchError((error) => {
				this.logging.warn('Could not load weekly journal stats', { error });
				return of([]);
			})
		);

		// Get weekly mood trend from statistics service
		const weeklyMoodTrend$ = this.statisticsService.getWeeklyMoodTrend(1).pipe(
			map(trends => {
				if (trends.length === 0) return {
					dailyMoods: [],
					averageMood: 0,
					trend: 'stable' as const,
					entryCount: 0
				};

				const latestWeek = trends[0];
				// Convert week data to daily array (simplified)
				return {
					dailyMoods: new Array(7).fill(latestWeek.averageMood > 0 ? latestWeek.averageMood : null),
					averageMood: latestWeek.averageMood,
					trend: 'stable' as const, // TODO: Calculate trend from statistics
					entryCount: latestWeek.entryCount
				};
			}),
			catchError((error) => {
				this.logging.warn('Could not load weekly mood trend', { error });
				return of({
					dailyMoods: [],
					averageMood: 0,
					trend: 'stable' as const,
					entryCount: 0
				});
			})
		);

		// Get performance insights
		const performanceInsights$ = this.statisticsService.getPerformanceInsights(7).pipe(
			catchError((error) => {
				this.logging.warn('Could not load performance insights', { error });
				return of({
					bestPerformanceHour: 9,
					peakProductivityDays: [],
					energyProductivityIndex: 0,
					consistencyScore: 0,
					categoryEngagement: { mind: 0, body: 0, soul: 0, beauty: 0 }
				});
			})
		);

		// Still need recent activities and tracker data from existing services
		const recentActivities$ = this.activityService.getRecentActivities(5).pipe(
			catchError((error) => {
				this.logging.error('Could not load recent activities', { error });
				return of([]);
			})
		);

		const trackerData$ = this.trackerService.getTrackerDashboardData().pipe(
			catchError((error) => {
				this.logging.error('Could not load tracker data', { error });
				// MEMORY FALLBACK: If the service call fails, try to use whatever is in memory
				// This prevents "No activities" when only stats/goals are broken
				const cachedTrackers = this.trackerService['cachedTrackers'] || [];
				return of({
					activeTrackers: cachedTrackers,
					todaysEntries: [],
					weeklyStats: { totalEntries: 0, completedTrackers: 0, averageMood: 0 }
				} as any);
			})
		);

		const activeGoals$ = this.goalService.getActiveGoals().pipe(
			catchError((error) => {
				this.logging.warn('Could not load active goals', { error });
				return of([]);
			})
		);

		// Get weekly activity stats for engagement chart
		const weeklyActivityStats$ = this.statisticsService.getRecentStats(7).pipe(
			catchError((error) => {
				this.logging.warn('Could not load weekly activity stats', { error });
				return of([]);
			})
		);

		// Combine all data streams
		const enhancedDashboardData$ = combineLatest(
			userProfile$,
			todaysStats$,
			weeklyMoodTrend$,
			performanceInsights$,
			recentActivities$,
			trackerData$,
			weeklyJournalStats$,
			activeGoals$,
			weeklyActivityStats$
		).pipe(
			map(([user, todaysStats, weeklyMoodData, performanceInsights, activities, trackerData, weeklyJournalStats, activeGoals, weeklyStats]) => {
				// Use statistics data when available, fallback to user profile stats
				const wellnessScore = todaysStats?.engagementRate
					? Math.round(todaysStats.engagementRate * 100)
					: (user?.stats?.weeklyActivityScore || 0);

				const trackerStats = {
					// Use cumulative user stats for total, or daily if we want daily
					// For "Total Sessions" usually means All Time
					totalSessions: user?.stats?.totalTrackerEntries || 0,
					weeklyCount: trackerData?.weeklyStats?.totalEntries || 0,
					streak: todaysStats?.trackerStreak || user?.stats?.currentStreaks || 0
				};

				const journalStats = {
					totalEntries: todaysStats?.totalJournalEntries || user?.stats?.totalJournalEntries || 0,
					weeklyCount: weeklyJournalStats.reduce((sum, s) => sum + (s.entriesCount || 0), 0),
					streak: todaysStats?.journalStreak || 0
				};

				// Enhanced analytics using pre-calculated data
				const analytics = {
					wellnessScore,
					moodData: {
						average: todaysStats?.overallAverageMood || weeklyMoodData.averageMood || 0
					},
					consistencyRate: performanceInsights.consistencyScore > 0
						? Math.round(performanceInsights.consistencyScore)
						: this.getTodayCompletionPercentage(),
					currentStreak: todaysStats?.overallStreak || user?.stats?.currentStreaks || 0,
					categoryPerformance: this.calculateCategoryPerformance(activeGoals, trackerData?.activeTrackers || []),
					// Enhanced insights from statistics
					peakPerformanceHour: performanceInsights.bestPerformanceHour,
					peakPerformanceBoost: Math.round(performanceInsights.energyProductivityIndex / 4), // Scale down
					moodBoostAmount: weeklyMoodData.averageMood > 0 ? Math.round(weeklyMoodData.averageMood * 10) / 10 : 0,
					topCategoryConsistency: Math.round(performanceInsights.consistencyScore),
					wellnessScoreChange: performanceInsights.consistencyScore > 75 ? 12 : -3
				};

				return {
					user,
					journeyProgress: { currentDay: user?.currentDay || 1, progress: Math.round(((user?.currentDay || 1) / 28) * 100), milestone: this.calculateMilestone(user?.currentDay || 1) },
					wellnessScore,
					trackerStats,
					journalStats,
					weeklyMoodData,
					recentActivities: activities || [],
					activeTrackers: trackerData?.activeTrackers || [],
					todaysEntries: trackerData?.todaysEntries || [],
					activeGoals: activeGoals || [],
					weeklyActivityStats: weeklyStats || [],
					expandedSuggestions: {},
					todaysActions: [],
					todaysInsights: [],
					analytics
				};
			}),
			catchError((error) => {
				this.logging.error('Error loading enhanced dashboard data', { error });
				// Return fallback with error state
				return of({
					user: null,
					journeyProgress: { currentDay: 1, progress: 0, milestone: 'Getting Started' },
					wellnessScore: 0,
					trackerStats: { totalSessions: 0, weeklyCount: 0, streak: 0 },
					journalStats: { totalEntries: 0, weeklyCount: 0, streak: 0 },
					weeklyMoodData: { dailyMoods: [], averageMood: 0, trend: 'stable', entryCount: 0 },
					recentActivities: [],
					activeTrackers: [],
					todaysEntries: [],
					activeGoals: [],
					weeklyActivityStats: [],
					expandedSuggestions: {},
					todaysActions: [],
					todaysInsights: [],
					analytics: {
						wellnessScore: 0,
						moodData: { average: 0 },
						consistencyRate: 0,
						currentStreak: 0,
						categoryPerformance: { mind: 0, body: 0, soul: 0, beauty: 0 },
						peakPerformanceHour: 9,
						peakPerformanceBoost: 0,
						moodBoostAmount: 0,
						topCategoryConsistency: 0,
						wellnessScoreChange: 0
					},
					suggestionsState: this.errorHandling.createUIErrorState(
						this.errorHandling.createAppError(error, 'loadEnhancedDashboardData'),
						'Unable to load dashboard data'
					)
				} as DashboardData);
			})
		);

		// Subscribe to enhanced dashboard data
		enhancedDashboardData$
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (data) => {
					// Preserve todaysActions and todaysInsights if they were already loaded
					// by loadTodaysActionsAndInsights (which runs in parallel)
					const existingActions = this.dashboardData.todaysActions;
					const existingInsights = this.dashboardData.todaysInsights;
					this.dashboardData = data;
					if (existingActions.length > 0) {
						this.dashboardData.todaysActions = existingActions;
					}
					if (existingInsights.length > 0) {
						this.dashboardData.todaysInsights = existingInsights;
					}
					this.updateProfileImageUrl();
					this.isLoading = false; // Stop loading spinner

					// Load tracker-specific suggestions
					this.loadSuggestionsForActiveTrackers();

					this.logging.info('Enhanced dashboard data loaded successfully', {
						wellnessScore: data.wellnessScore,
						hasTodaysStats: !!data.analytics,
						activeTrackers: data.activeTrackers.length
					});
				},
				error: (error) => {
					this.logging.error('Statistics system unavailable - dashboard cannot load', { error });
					this.isLoading = false;
					this.hasGeneralError = true;
					this.generalErrorMessage = 'Statistics system is currently unavailable. Please try again later or contact support if this persists.';
				}
			});
	}

	private calculateMilestone(currentDay: number): string {
		if (currentDay >= 28) return '28-Day Champion';
		if (currentDay >= 21) return 'Final Week';
		if (currentDay >= 14) return 'Halfway Hero';
		if (currentDay >= 7) return 'First Week Complete';
		return 'Getting Started';
	}

	// Update profile image URL when user data changes
	private updateProfileImageUrl() {
		// Update cached display name
		this.userDisplayName = this.getUserDisplayName();

		// Use stored photo URL (which is now our Firebase Storage URL)
		const storedPhotoURL = this.dashboardData.user?.photoURL;

		console.log('🖼️ Profile photo debug:', {
			storedPhotoURL,
			userDisplayName: this.userDisplayName,
			dashboardUser: this.dashboardData.user
		});

		if (!storedPhotoURL) {
			this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
			console.log('🔄 Using fallback avatar:', this.profileImageUrl);
			return;
		}

		// Use our stored photo URL directly
		this.profileImageUrl = storedPhotoURL;
		console.log('✅ Using stored photo:', this.profileImageUrl);
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

	// DEPRECATED: Old suggestion system - now using feed-based actions/insights
	// Keeping for reference during migration, can be removed later
	private async loadTrackerSpecificSuggestions(): Promise<void> {
		// No longer used - actions and insights now come from feed-items collection
		this.logging.debug('loadTrackerSpecificSuggestions called but deprecated - using feed system instead');
	}

	// Get user's most active tracker
	private async getMostActiveTracker(): Promise<Tracker | null> {
		try {
			const trackers = await firstValueFrom(this.trackerService.getUserTrackers().pipe(
				map(trackerList => trackerList.filter(t => t.isActive))
			));
			if (!trackers || trackers.length === 0) {
				return null;
			}

			// Sort by entryCount or recent activity, return the most active
			return trackers.sort((a: Tracker, b: Tracker) => (b.entryCount || 0) - (a.entryCount || 0))[0];
		} catch (error) {
			this.logging.error('Error getting most active tracker', { error });
			return null;
		}
	}



	// Quick Actions
	async logMood() {
		try {
			// Open mood logging modal via WriteEntryModal
			const modal = await this.modalCtrl.create({
				component: WriteEntryModalComponent,
				// Optional: Pass specific props if needed
			});

			await modal.present();

			const { data } = await modal.onDidDismiss();
			if (data?.saved) {
				this.toastService.showSuccess('Mood logged successfully!');
				this.loadEnhancedDashboardData(); // Refresh stats
			}
		} catch (error) {
			this.logging.error('Error opening mood logging', { error });
			this.toastService.showError('Error opening mood logger');
		}
	}

	async openBreathe() {
		try {
			const modal = await this.modalCtrl.create({
				component: BreatheModalComponent
			});
			await modal.present();
		} catch (error) {
			this.logging.error('Error opening breathing exercise', { error });
			this.toastService.showError('Unable to open breathing exercise');
		}
	}

	async openQuickLogModal() {
		try {
			if (this.dashboardData.activeTrackers.length > 0) {
				const tracker = this.dashboardData.activeTrackers[0];
				this.loggingModalService.openLogModal(tracker, (entry) => {
					this.loadEnhancedDashboardData();
				});
			} else {
				this.toastService.showInfo('No active trackers found. Create one first!');
				this.router.navigate(['/tabs/add-tracker']);
			}
		} catch (error) {
			this.logging.error('Error opening quick log modal', { error });
			this.toastService.showError('Error opening activity logger');
		}
	}

	async addNewTracker() {
		try {
			// Navigate to add tracker page
			this.router.navigate(['/tabs/add-tracker']);
		} catch (error) {
			this.logging.error('Error navigating to add tracker', { error });
			this.toastService.showError('Error opening tracker creation');
		}
	}

	async openJournalEntry() {
		try {
			// Navigate to journal entry page
			this.router.navigate(['/journal-entry', 'new']);
		} catch (error) {
			this.logging.error('Error navigating to journal entry', { error });
			this.toastService.showError('Error opening journal entry');
		}
	}

	// View all activities
	viewAllActivities() {
		// Navigate to the full activity history page
		this.router.navigate(['/activities']);
	}

	// Image error handling - simplified
	onImageError(event: any) {
		console.log('❌ Image failed to load, switching to fallback');
		// Fallback to a default avatar when any image fails to load
		const img = event.target as HTMLImageElement;
		const fallbackUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName || 'user'}`;
		img.src = fallbackUrl;
		console.log('🔄 Fallback avatar URL:', fallbackUrl);
	}

	onImageLoad(event: any) {
		console.log('✅ Profile image loaded successfully');
	}

	// Get a safe profile image URL
	getProfileImageUrl(): string {
		return this.profileImageUrl;
	}

	// Enhanced UI Methods for Wellness Journey
	getFocusAreaIcon(area: string): string {
		switch (area) {
			case 'MIND': return 'fa-solid fa-brain';
			case 'BODY': return 'fa-solid fa-dumbbell';
			case 'SOUL': return 'fa-solid fa-heart';
			case 'BEAUTY': return 'fa-solid fa-wand-magic-sparkles';
			default: return 'fa-solid fa-circle';
		}
	}

	getFocusAreaColor(area: string): string {
		switch (area) {
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

		switch (commitmentLevel.toLowerCase()) {
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

		switch (commitmentLevel.toLowerCase()) {
			case 'light': return '#10b981'; // Green for light
			case 'moderate': return '#f59e0b'; // Orange for moderate  
			case 'intensive': return '#dc2626'; // Red for intensive
			default: return '#6b7280'; // Gray default
		}
	}

	// Get mood emojis for the week
	getMoodEmojisForWeek(): (string | null)[] {
		const { dailyMoods } = this.dashboardData.weeklyMoodData;

		if (!dailyMoods || dailyMoods.length === 0) {
			// Return 7 null values for empty week
			return new Array(7).fill(null);
		}

		return dailyMoods.map(mood => {
			if (mood === null || mood === undefined) return null;

			// Convert mood value (1-10) to emoji
			if (mood >= 9) return '😄'; // Very happy
			if (mood >= 8) return '😊'; // Happy
			if (mood >= 7) return '🙂'; // Content
			if (mood >= 6) return '😌'; // Peaceful
			if (mood >= 5) return '😐'; // Neutral
			if (mood >= 4) return '😕'; // Slightly sad
			if (mood >= 3) return '☹️';  // Sad
			if (mood >= 2) return '😞'; // Very sad
			return '😢'; // Extremely sad
		});
	}

	// Toggle wellness journey section
	toggleWellnessJourney() {
		this.isWellnessJourneyCollapsed = !this.isWellnessJourneyCollapsed;
	}



	hasActiveTrackers(): boolean {
		return this.dashboardData.activeTrackers.length > 0;
	}

	// Today's completion tracking methods
	getTotalActiveTrackers(): number {
		return this.dashboardData.activeTrackers.length;
	}

	getCompletedTrackersToday(): number {
		// Count how many active trackers have entries today
		const today = new Date().toISOString().split('T')[0];
		return this.dashboardData.activeTrackers.filter(tracker => {
			// Check if this tracker has any entry today
			// This is a simplified check - in real implementation you'd check actual entries
			return tracker.lastEntryDate && tracker.lastEntryDate.toISOString().split('T')[0] === today;
		}).length;
	}

	getTodayCompletionPercentage(): number {
		const total = this.getTotalActiveTrackers();
		if (total === 0) return 0;
		const completed = this.getCompletedTrackersToday();
		return Math.round((completed / total) * 100);
	}

	getTodayProgressText(): string {
		const completed = this.getCompletedTrackersToday();
		const total = this.getTotalActiveTrackers();

		if (total === 0) return "No active trackers";
		if (completed === 0) return "Ready to start your day";
		if (completed === total) return "All targets completed! 🎉";
		return `${completed}/${total} targets completed`;
	}

	getTodayRenewalText(): string {
		const completed = this.getCompletedTrackersToday();
		const total = this.getTotalActiveTrackers();

		if (total === 0) return "Create your first ritual to begin";
		if (completed === 0) return "Ready for today's renewal?";
		if (completed === total) return "Your energy is beautifully aligned ✨";
		return `${completed} of ${total} intentions honored`;
	}

	hasSuggestionsToShow(): boolean {
		// Check if any tracker has suggestions
		return Object.keys(this.suggestionsState).some(trackerId => {
			const suggestions = this.suggestionsState[trackerId];
			return suggestions && !suggestions.isLoading && !suggestions.error && suggestions.suggestions;
		});
	}

	trackActivity(index: number, activity: Activity): string {
		return activity.id;
	}

	getActivityIcon(activityType: string): string {
		const iconMap: { [key: string]: string } = {
			'tracker': 'fa-solid fa-chart-line',
			'tracker_entry': 'fa-solid fa-chart-simple',
			'journal': 'fa-solid fa-book',
			'meditation': 'fa-solid fa-brain',
			'exercise': 'fa-solid fa-dumbbell',
			'mood': 'fa-solid fa-face-smile',
			'water': 'fa-solid fa-glass-water',
			'sleep': 'fa-solid fa-moon',
			'nutrition': 'fa-solid fa-apple-whole',
			'mindfulness': 'fa-solid fa-leaf',
			'goal': 'fa-solid fa-target',
			'achievement': 'fa-solid fa-trophy',
			// Additional activity types
			'habit': 'fa-solid fa-repeat',
			'task': 'fa-solid fa-list-check',
			'reminder': 'fa-solid fa-bell',
			'milestone': 'fa-solid fa-flag-checkered',
			'reflection': 'fa-solid fa-lightbulb',
			'wellness': 'fa-solid fa-heart',
			'fitness': 'fa-solid fa-running',
			'health': 'fa-solid fa-plus',
			'learning': 'fa-solid fa-graduation-cap',
			'work': 'fa-solid fa-briefcase',
			'social': 'fa-solid fa-users',
			'creativity': 'fa-solid fa-palette',
			'default': 'fa-solid fa-bars-progress'
		};

		// Debug unknown activity types
		if (!iconMap[activityType]) {
			console.log('🔍 Unknown activity type:', activityType, 'using default icon');
		}

		return iconMap[activityType] || iconMap['default'];
	}

	formatActivityTime(timestamp: any): string {
		try {
			const now = new Date();
			let activityTime: Date;

			// Handle different timestamp formats
			if (timestamp && typeof timestamp.toDate === 'function') {
				// Firestore Timestamp
				activityTime = timestamp.toDate();
			} else if (timestamp instanceof Date) {
				// Already a Date object
				activityTime = timestamp;
			} else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
				// String or number timestamp
				activityTime = new Date(timestamp);
			} else {
				// Fallback to current time
				activityTime = now;
			}

			// Check if the date is valid
			if (isNaN(activityTime.getTime())) {
				return 'Recently';
			}

			const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));

			if (diffInMinutes < 1) {
				return 'Just now';
			} else if (diffInMinutes < 60) {
				return `${diffInMinutes}m ago`;
			} else if (diffInMinutes < 1440) { // 24 hours
				const hours = Math.floor(diffInMinutes / 60);
				return `${hours}h ago`;
			} else {
				const days = Math.floor(diffInMinutes / 1440);
				if (days === 1) {
					return 'Yesterday';
				} else if (days < 7) {
					return `${days}d ago`;
				} else {
					return activityTime.toLocaleDateString();
				}
			}
		} catch (error) {
			console.warn('Error formatting activity time:', error);
			return 'Recently';
		}
	}

	async refreshCoaching(): Promise<void> {
		try {
			// Clear existing suggestions
			this.suggestionsState = {};

			// Reload suggestions for all active trackers
			if (this.dashboardData.activeTrackers.length > 0) {
				await this.loadSuggestionsForActiveTrackers();
			}

			this.logging.info('AI coaching refreshed successfully');
		} catch (error) {
			this.logging.error('Failed to refresh AI coaching', { error });
		}
	}

	getActivityGradientClass(activityType: string): string {
		const gradientMap: { [key: string]: string } = {
			'tracker': 'bg-gradient-to-br from-blue-500 to-blue-600',
			'journal': 'bg-gradient-to-br from-purple-500 to-purple-600',
			'meditation': 'bg-gradient-to-br from-indigo-500 to-indigo-600',
			'exercise': 'bg-gradient-to-br from-emerald-500 to-emerald-600',
			'mood': 'bg-gradient-to-br from-yellow-500 to-yellow-600',
			'water': 'bg-gradient-to-br from-cyan-500 to-cyan-600',
			'sleep': 'bg-gradient-to-br from-violet-500 to-violet-600',
			'nutrition': 'bg-gradient-to-br from-green-500 to-green-600',
			'mindfulness': 'bg-gradient-to-br from-teal-500 to-teal-600',
			'goal': 'bg-gradient-to-br from-red-500 to-red-600',
			'achievement': 'bg-gradient-to-br from-amber-500 to-amber-600',
			// Additional activity types
			'habit': 'bg-gradient-to-br from-orange-500 to-orange-600',
			'task': 'bg-gradient-to-br from-slate-500 to-slate-600',
			'reminder': 'bg-gradient-to-br from-pink-500 to-pink-600',
			'milestone': 'bg-gradient-to-br from-rose-500 to-rose-600',
			'reflection': 'bg-gradient-to-br from-lime-500 to-lime-600',
			'wellness': 'bg-gradient-to-br from-red-400 to-red-500',
			'fitness': 'bg-gradient-to-br from-green-400 to-green-500',
			'health': 'bg-gradient-to-br from-blue-400 to-blue-500',
			'learning': 'bg-gradient-to-br from-purple-400 to-purple-500',
			'work': 'bg-gradient-to-br from-gray-500 to-gray-600',
			'social': 'bg-gradient-to-br from-sky-500 to-sky-600',
			'creativity': 'bg-gradient-to-br from-fuchsia-500 to-fuchsia-600',
			'default': 'bg-gradient-to-br from-neutral-500 to-neutral-600'
		};

		return gradientMap[activityType] || gradientMap['default'];
	}

	getActivityTypeLabel(activityType: string): string {
		const labelMap: { [key: string]: string } = {
			'tracker': 'Tracker',
			'tracker_entry': 'Tracked',
			'journal': 'Journal',
			'meditation': 'Meditation',
			'exercise': 'Exercise',
			'mood': 'Mood',
			'water': 'Hydration',
			'sleep': 'Sleep',
			'nutrition': 'Nutrition',
			'mindfulness': 'Mindfulness',
			'goal': 'Goal',
			'achievement': 'Achievement',
			// Additional activity types
			'habit': 'Habit',
			'task': 'Task',
			'reminder': 'Reminder',
			'milestone': 'Milestone',
			'reflection': 'Reflection',
			'wellness': 'Wellness',
			'fitness': 'Fitness',
			'health': 'Health',
			'learning': 'Learning',
			'work': 'Work',
			'social': 'Social',
			'creativity': 'Creative',
			'default': 'Activity'
		};

		return labelMap[activityType] || labelMap['default'];
	}

	async handleRefresh(event: any) {
		try {
			// Clear error state and cache for fresh data
			this.hasGeneralError = false;
			this.generalErrorMessage = '';
			this.statisticsService.clearCacheForType('all');

			// Reload enhanced dashboard data
			this.loadEnhancedDashboardData();

			// Small delay to allow loading to start
			await new Promise(resolve => setTimeout(resolve, 500));
		} catch (error) {
			console.error('Error refreshing dashboard:', error);
		} finally {
			event.target.complete();
		}
	}

	/**
	 * Get the tracker that most consistently improves mood
	 */
	getMoodBoostingTracker(): string {
		// For now, return a default tracker name
		// In the future, this will be calculated from mood correlation data
		return this.dashboardData.activeTrackers.find(t => t.category === 'mind')?.name || 'Meditation';
	}

	/**
	 * Get the category with highest consistency
	 */
	getMostConsistentCategory(): string {
		const categories = ['Mind', 'Body', 'Soul', 'Beauty'];
		// For now, return the category with highest score
		// In the future, this will be calculated from actual consistency data
		const categoryPerformance = this.dashboardData.analytics.categoryPerformance;

		let bestCategory = 'Mind';
		let bestScore = 0;

		Object.entries(categoryPerformance).forEach(([category, data]: [string, any]) => {
			if (data.score > bestScore) {
				bestScore = data.score;
				bestCategory = category.charAt(0).toUpperCase() + category.slice(1);
			}
		});

		return bestCategory;
	}

	/**
	 * Access Math functions in template
	 */
	Math = Math;

	// Global insights reading mode (like Today's Action)
	isInsightsReadingMode = false;

	/**
	 * Toggle global insights reading mode
	 */
	toggleInsightExpansion(trackerId: string, event?: Event): void {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		// Toggle global reading mode instead of individual cards
		this.isInsightsReadingMode = !this.isInsightsReadingMode;
	}

	/**
	 * Check if insights are in reading mode (global expansion)
	 */
	isInsightExpanded(trackerId: string): boolean {
		return this.isInsightsReadingMode;
	}

	/**
	 * Get the first insight text for preview (truncated)
	 */
	getFirstInsightText(trackerId: string): string {
		const insight = this.getTrackerInsight(trackerId);
		if (insight && insight.body) {
			// Truncate to first sentence or 100 characters, whichever is shorter
			const firstSentence = insight.body.split('.')[0];
			if (firstSentence.length < 100) {
				return firstSentence + '.';
			} else {
				return insight.body.substring(0, 100) + '...';
			}
		}
		return '';
	}

	/**
	 * Get the first available motivational quote from active trackers
	 * DEPRECATED: Now using inspiration feed posts, kept for compatibility
	 */
	getFirstMotivationalQuote(): any {
		// Still using old tracker suggestions for quotes
		const trackersWithSuggestions = this.getTrackersWithSuggestions();
		for (const tracker of trackersWithSuggestions) {
			const state = this.suggestionsState[tracker.id];
			if (state?.suggestions?.motivationalQuote) {
				return state.suggestions.motivationalQuote;
			}
		}
		return null;
	}

	/**
	 * Get all available motivational quotes from active trackers
	 * DEPRECATED: Now using inspiration feed posts, kept for compatibility
	 */
	getAllMotivationalQuotes(): any[] {
		const quotes: any[] = [];
		const trackersWithSuggestions = this.getTrackersWithSuggestions();

		for (const tracker of trackersWithSuggestions) {
			const state = this.suggestionsState[tracker.id];
			if (state?.suggestions?.motivationalQuote) {
				quotes.push(state.suggestions.motivationalQuote);
			}
		}

		return quotes;
	}

	// ==================== Quote Slideshow Methods ====================

	/**
	 * Get the current quote based on slideshow index
	 */
	getCurrentQuote(): any {
		const quotes = this.getAllMotivationalQuotes();
		if (quotes.length === 0) return null;

		// Ensure index is within bounds
		if (this.currentQuoteIndex >= quotes.length) {
			this.currentQuoteIndex = 0;
		}
		return quotes[this.currentQuoteIndex];
	}

	/**
	 * Start the quote auto-rotation slideshow
	 */
	startQuoteSlideshow(): void {
		this.stopQuoteSlideshow(); // Clear any existing interval
		this.quoteIntervalId = setInterval(() => {
			this.nextQuote();
		}, this.QUOTE_INTERVAL_MS);
	}

	/**
	 * Stop the quote auto-rotation slideshow
	 */
	stopQuoteSlideshow(): void {
		if (this.quoteIntervalId) {
			clearInterval(this.quoteIntervalId);
			this.quoteIntervalId = null;
		}
	}

	/**
	 * Go to the next quote with fade transition
	 */
	nextQuote(): void {
		const quotes = this.getAllMotivationalQuotes();
		if (quotes.length <= 1) return;

		// Trigger fade out
		this.isQuoteTransitioning = true;

		setTimeout(() => {
			this.currentQuoteIndex = (this.currentQuoteIndex + 1) % quotes.length;
			// Trigger fade in
			this.isQuoteTransitioning = false;
		}, 250); // Half of the CSS transition duration
	}

	/**
	 * Go to the previous quote with fade transition
	 */
	previousQuote(): void {
		const quotes = this.getAllMotivationalQuotes();
		if (quotes.length <= 1) return;

		// Reset the interval when manually navigating
		this.startQuoteSlideshow();

		// Trigger fade out
		this.isQuoteTransitioning = true;

		setTimeout(() => {
			this.currentQuoteIndex = (this.currentQuoteIndex - 1 + quotes.length) % quotes.length;
			// Trigger fade in
			this.isQuoteTransitioning = false;
		}, 250);
	}

	/**
	 * Go to a specific quote by index
	 */
	goToQuote(index: number): void {
		const quotes = this.getAllMotivationalQuotes();
		if (index < 0 || index >= quotes.length) return;
		if (index === this.currentQuoteIndex) return;

		// Reset the interval when manually navigating
		this.startQuoteSlideshow();

		// Trigger fade out
		this.isQuoteTransitioning = true;

		setTimeout(() => {
			this.currentQuoteIndex = index;
			// Trigger fade in
			this.isQuoteTransitioning = false;
		}, 250);
	}

	// Mood Chart Methods
	setMoodChartTimeframe(timeframe: 'week' | 'month') {
		this.moodChartTimeframe = timeframe;
		// In a real implementation, you would fetch different data here
		// For now we'll just stick with the weekly data but update the view state
	}

	getMoodTrendLabel(): string {
		const trend = this.dashboardData.weeklyMoodData.trend;
		switch (trend) {
			case 'improving': return 'Uplifting ↗';
			case 'declining': return 'Declining ↘';
			default: return 'Stable →';
		}
	}

	getMoodInsightText(): string {
		const trend = this.dashboardData.weeklyMoodData.trend;
		const avg = this.dashboardData.weeklyMoodData.averageMood;

		// Check for specific insights based on data
		// This mirrors the hardcoded "peaks mid-week" logic but dynamic
		if (avg >= 4) return "Your mood is radiating positivity! Keep honoring your rhythms.";
		if (trend === 'improving') return "Your energy is shifting upward. Great consistency.";
		if (trend === 'declining') return "You're facing some resistance. Consider a gentle check-in.";
		return "Your mood is stable. You're finding your balance.";
	}

	// Top Trackers
	getTopTrackers(): any[] {
		if (!this.dashboardData.activeTrackers) return [];
		// Sort by streak descending
		return [...this.dashboardData.activeTrackers]
			.sort((a, b) => (b.streak || 0) - (a.streak || 0))
			.slice(0, 3);
	}

	getTrackerConsistency(tracker: any): number {
		if (!tracker) return 0;
		// Use real consistency score if available, otherwise calculate from streak/history
		// Avoid defaulting to 85% which creates false data
		return tracker.consistencyScore || 0;
	}

	hasMoodData(): boolean {
		return this.dashboardData.weeklyMoodData.dailyMoods.some(m => m !== null);
	}

	private calculateCategoryPerformance(goals: Goal[], trackers: any[]) {
		const categories = ['mind', 'body', 'soul', 'beauty'];
		const performance: any = {};

		categories.forEach(cat => {
			const catGoals = (goals || []).filter(g => (g.category || '').toLowerCase() === cat);
			const catTrackers = (trackers || []).filter(t => (t.category || '').toLowerCase() === cat);

			let score = 0;
			let count = 0;

			if (catGoals.length > 0) {
				score += catGoals.reduce((sum, g) => sum + (g.progress || 0), 0);
				count += catGoals.length;
			}

			if (catTrackers.length > 0) {
				score += catTrackers.reduce((sum, t) => {
					const trackerScore = t.progress || t.stats?.completionRate || (t.streak > 0 ? Math.min(100, t.streak * 10) : 0);
					return sum + trackerScore;
				}, 0);
				count += catTrackers.length;
			}

			performance[cat] = count > 0 ? Math.round(score / count) : 0;
		});
		return performance;
	}

	getCategoryGoalCount(category: string): number {
		if (!this.dashboardData?.activeGoals) return 0;
		return this.dashboardData.activeGoals.filter(g => (g.category || '').toLowerCase() === category.toLowerCase()).length;
	}

	// Engagement Chart Methods
	getWeeklyEngagementCount(): number {
		return this.dashboardData.weeklyActivityStats.filter(s => s.totalActivities > 0).length;
	}

	getWeeklyEngagementRate(): string {
		const count = this.dashboardData.weeklyActivityStats.filter(s => s.totalActivities > 0).length;
		const rate = Math.round((count / 7) * 100);
		return `${rate}% rate`;
	}

	getDailyEngagementHeight(dayIndex: number): string {
		// Map 0 (Mon) - 6 (Sun) to available stats
		// Need to align stats with days. Assuming weeklyActivityStats is sorted date desc or asc?
		// Ensure we map correctly to Mon-Sun visual
		// For simplicity, let's just map index to index if we have 7 days
		const stat = this.dashboardData.weeklyActivityStats[dayIndex];
		if (!stat || !stat.totalActivities) return '4px'; // Minimal height for 0

		// Scale 0-10 activities to 10-100%
		const height = Math.min(100, Math.max(10, stat.totalActivities * 10));
		return `${height}%`;
	}

	// Button Handlers
	openNotifications() {
		this.toastService.showInfo('Notifications coming soon!');
	}

	viewCategories() {
		// Navigate to the Tracker tab for a detailed view of ritual progress in each category
		this.router.navigate(['/tabs/tracker']);
	}

	viewAllGoals() {
		this.router.navigate(['/goals']);
	}

	/**
	 * Get SVG path for mood line chart
	 */
	getMoodPath(): string {
		const moods = this.dashboardData.weeklyMoodData.dailyMoods;
		if (moods.length === 0) return '';

		let path = '';
		moods.forEach((mood, i) => {
			if (mood !== null) {
				const x = 20 + i * 40;
				const y = 100 - (mood - 1) * 20;
				if (path === '') {
					path = `M${x},${y}`;
				} else {
					path += ` L${x},${y}`;
				}
			}
		});
		return path;
	}

	/**
	 * Get SVG path for mood area chart
	 */
	getMoodAreaPath(): string {
		const path = this.getMoodPath();
		if (!path) return '';

		// Get last point
		const moods = this.dashboardData.weeklyMoodData.dailyMoods;
		const lastIndex = moods.map((m, i) => m !== null ? i : -1).filter(i => i !== -1).pop();
		const firstIndex = moods.map((m, i) => m !== null ? i : -1).filter(i => i !== -1).shift();

		if (lastIndex === undefined || firstIndex === undefined) return '';

		const firstX = 20 + firstIndex * 40;
		const lastX = 20 + lastIndex * 40;

		return `${path} L${lastX},120 L${firstX},120 Z`;
	}

	/**
	 * Get points for mood dots
	 */
	getMoodPoints(): { cx: number; cy: number }[] {
		return this.dashboardData.weeklyMoodData.dailyMoods
			.map((mood, i) => {
				if (mood === null) return null;
				return {
					cx: 20 + i * 40,
					cy: 100 - (mood - 1) * 20
				};
			})
			.filter((p): p is { cx: number; cy: number } => p !== null);
	}
}
