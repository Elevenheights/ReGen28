import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonIcon,
	IonModal,
	IonItem,
	IonInput,
	IonSelect,
	IonSelectOption,
	IonRange,
	IonLabel,
	IonTextarea,
	IonDatetime,
	IonCheckbox,
	IonAlert,
	IonRefresher,
	IonRefresherContent,
	IonSpinner
} from '@ionic/angular/standalone';
import { Subject, takeUntil, combineLatest, map, firstValueFrom } from 'rxjs';

// Services
import { TrackerService } from '../../../services/tracker.service';
import { UserService } from '../../../services/user.service';
import { ActivityService } from '../../../services/activity.service';
import { AIRecommendationsService } from '../../../services/ai-recommendations.service';
import { StatisticsService } from '../../../services/statistics.service'; // Added
import { ErrorHandlingService, UIErrorState } from '../../../services/error-handling.service';
import { LoggingService } from '../../../services/logging.service';
import { LoggingModalService } from '../../../services/logging-modal.service';
import { ToastService } from '../../../services/toast.service';
import { DatabaseService } from '../../../services/database.service';
import { AuthService } from '../../../services/auth.service';

// Models
import { Tracker, TrackerEntry, MoodEntry, TrackerType } from '../../../models/tracker.interface';
// Models
import { TrackerData } from '../../../models/view-models.interface';
import { User } from '../../../models/user.interface';

// Components
import { TrackerCardComponent } from '../../../components/tracker-card/tracker-card.component';
import { TrackerStatsComponent, TrackerDashboardStats } from '../../../components/tracker-stats/tracker-stats.component';

@Component({
	selector: 'app-tab3',
	templateUrl: 'tab3.page.html',
	styleUrls: ['tab3.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonContent,
		IonButton,
		IonIcon,
		IonModal,
		IonItem,
		IonInput,
		IonSelect,
		IonSelectOption,
		IonRange,
		IonLabel,
		IonTextarea,
		IonDatetime,
		IonCheckbox,
		IonAlert,
		IonRefresher,
		IonRefresherContent,
		IonSpinner,
		TrackerCardComponent,
		TrackerStatsComponent
	],
})
export class Tab3Page implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// Data
	activeTrackers: TrackerData[] = [];
	completedTrackers: TrackerData[] = [];
	trackerStats: TrackerDashboardStats = {
		totalSessions: 0,
		weeklyCount: 0,
		currentStreak: 0,
		longestStreak: 0
	};
	// User state
	user: User | null = null;
	userDisplayName = '';
	isLoading = true;
	activeSegment: 'active' | 'completed' = 'active';

	// Data

	constructor(
		private trackerService: TrackerService,
		private userService: UserService,
		private activityService: ActivityService,
		private aiRecommendationsService: AIRecommendationsService,
		private statisticsService: StatisticsService, // Injected
		private errorHandling: ErrorHandlingService,
		private logging: LoggingService,
		private cdr: ChangeDetectorRef,
		public router: Router,
		private route: ActivatedRoute,
		private loggingModalService: LoggingModalService,
		private databaseService: DatabaseService,
		private authService: AuthService,
		private toastService: ToastService
	) { }

	ngOnInit() {
		this.loadTrackerData();

		// Check for success messages from add tracker page
		this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
			if (params['message']) {
				this.toastService.showSuccess(params['message']);
			}
		});
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private loadTrackerData() {
		this.isLoading = true;

		// Load user profile and trackers
		const userProfile$ = this.userService.getCurrentUserProfile();
		const trackers$ = this.trackerService.getUserTrackers();
		const stats$ = this.statisticsService.getRecentStats(7);

		// Combine user profile, trackers, and stats
		combineLatest([userProfile$, trackers$, stats$]).pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: async ([user, trackers, stats]: [User | null, Tracker[], any[]]) => {
				// Update user state
				this.user = user;
				this.userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';

				this.logging.debug('Loaded trackers from service', { count: trackers?.length || 0 });

				// Calculate tracker stats from real data
				this.calculateTrackerStatsFromRealData(stats || [], trackers || []);

				if (!trackers || trackers.length === 0) {
					this.activeTrackers = [];
					this.completedTrackers = [];
					this.isLoading = false;
					this.cdr.detectChanges();
					return;
				}

				try {
					await this.processTrackers(trackers); // Now properly awaited
				} catch (error) {
					this.logging.error('Error in tracker processing', error);
				}

				this.isLoading = false;
				this.cdr.detectChanges();
			},
			error: (error) => {
				this.logging.error('Error loading trackers', error);
				this.isLoading = false;
				this.cdr.detectChanges();
			}
		});
	}

	private async processTrackers(trackers: Tracker[]) {
		try {
			// Check if we're filtering out any trackers for debugging
			const validTrackers = trackers.filter(tracker => tracker != null);

			if (validTrackers.length < trackers.length) {
				this.logging.warn('Some trackers were null/undefined', {
					total: trackers.length,
					valid: validTrackers.length
				});
			}

			// Get today's entries
			const todaysEntries = await firstValueFrom(this.trackerService.getTodaysEntries());

			if (todaysEntries.length > 0) {
				await this.processTrackersWithData(validTrackers, todaysEntries); // Now properly awaited
			} else {
				await this.processTrackersWithoutEntries(validTrackers); // Now properly awaited
			}

		} catch (error) {
			this.logging.error('Error processing trackers', error);
			this.activeTrackers = [];
			this.completedTrackers = [];
		}
	}

	private async processTrackersWithData(trackers: Tracker[], todaysEntries: TrackerEntry[]) {
		const processed = await Promise.all(
			trackers.filter(tracker => tracker != null).map(async tracker => {
				// Ensure we have valid tracker data
				if (!tracker || !tracker.id) {
					this.logging.warn('Invalid tracker data', { tracker });
					return null;
				}

				const progress = this.trackerService.getTrackerProgress(tracker);
				const streak = await this.calculateRealTrackerStreak(tracker); // Now properly awaited
				const todayCompleted = this.checkTodayCompletedWithEntries(tracker, todaysEntries);
				const daysRemaining = this.trackerService.getDaysRemaining(tracker);

				// Get total entries for this tracker across all time
				const totalEntries = await this.getTotalEntriesForTracker(tracker);

				return {
					...tracker,
					progress,
					streak,
					todayCompleted,
					totalEntries,
					daysRemaining: daysRemaining > 0 ? daysRemaining : undefined
				} as TrackerData;
			})
		);

		const validProcessed = processed.filter(tracker => tracker !== null) as TrackerData[];

		// Separate active and completed trackers
		this.activeTrackers = validProcessed.filter(t => t.isActive && !t.isCompleted);
		this.completedTrackers = validProcessed.filter(t => t.isCompleted);

		this.logging.debug('Processed trackers with total entries', {
			total: validProcessed.length,
			active: this.activeTrackers.length,
			completed: this.completedTrackers.length
		});
	}

	private async processTrackersWithoutEntries(trackers: Tracker[]) {
		const processed = await Promise.all(
			trackers.filter(tracker => tracker != null).map(async tracker => {
				// Ensure we have valid tracker data
				if (!tracker || !tracker.id) {
					this.logging.warn('Invalid tracker data', { tracker });
					return null;
				}

				const progress = this.trackerService.getTrackerProgress(tracker);
				const streak = await this.calculateRealTrackerStreak(tracker); // Now properly awaited
				const daysRemaining = this.trackerService.getDaysRemaining(tracker);

				return {
					...tracker,
					progress,
					streak,
					todayCompleted: false, // Cannot determine without entries
					totalEntries: 0, // Cannot determine without entries
					daysRemaining: daysRemaining > 0 ? daysRemaining : undefined
				} as TrackerData;
			})
		);

		const validProcessed = processed.filter(tracker => tracker !== null) as TrackerData[];

		// Separate active and completed trackers
		this.activeTrackers = validProcessed.filter(t => t.isActive && !t.isCompleted);
		this.completedTrackers = validProcessed.filter(t => t.isCompleted);

		this.logging.debug('Processed trackers without entries data', {
			total: validProcessed.length,
			active: this.activeTrackers.length,
			completed: this.completedTrackers.length
		});
	}

	private async calculateRealTrackerStreak(tracker: Tracker): Promise<number> {
		// 1. Check if tracker has up-to-date stats from backend
		if (tracker.stats && typeof tracker.stats.currentStreak === 'number') {
			return tracker.stats.currentStreak;
		}

		// 2. Fetch from Statistics Service (last known stat)
		try {
			// Get stats for last 7 days to be safe
			const stats = await firstValueFrom(this.statisticsService.getTrackerDailyStats(tracker.id, { days: 7 }));
			if (stats && stats.length > 0) {
				// Sort by date desc to get latest
				const sorted = stats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				return sorted[0].currentStreak;
			}
		} catch (error) {
			this.logging.error('Error fetching tracker stats', error);
		}

		return 0;
	}

	private checkTodayCompleted(tracker: Tracker): boolean {
		// Basic fallback
		return false;
	}

	private checkTodayCompletedWithEntries(tracker: Tracker, todaysEntries: TrackerEntry[]): boolean {
		// Use frequency-aware completion checking
		const allEntries = todaysEntries.filter(entry => entry.trackerId === tracker.id);
		return this.trackerService.isGoalCompletedForCurrentPeriod(tracker, allEntries);
	}

	private async getTotalEntriesForTracker(tracker: Tracker): Promise<number> {
		// 1. Use cached count if available
		if (typeof tracker.entryCount === 'number') {
			return tracker.entryCount;
		}

		try {
			// Use the simpler count method that doesn't require composite indexes
			const totalEntries = await firstValueFrom(
				this.trackerService.getTrackerEntryCount(tracker.id)
			);

			return totalEntries;
		} catch (error) {
			this.logging.error('Error getting total entries for tracker', { trackerId: tracker.id, error });
			return 0;
		}
	}

	private calculateTrackerStatsFromRealData(dailyStats: any[], trackers: Tracker[]) {
		// defaults
		let totalSessions = 0;
		let weeklyCount = 0;
		let currentStreak = 0;
		let longestStreak = 0;

		if (dailyStats && dailyStats.length > 0) {
			// Most recent stat (today or yesterday)
			const latestStat = dailyStats[dailyStats.length - 1]; // Assuming sorted by date ascending?
			// Actually getRecentStats from service might need sorting check, usually API returns latest?
			// Let's assume dailyStats are returned from API.

			// For total sessions, we might need a cumulative counter on the user object,
			// but for now let's sum up the recent days or use what we have.
			// Actually, UserStats interface has aggregated stats.
			// But here we rely on UserDailyStats.

			// Let's iterate to calculate weekly count
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
			const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

			dailyStats.forEach(stat => {
				if (stat.date >= sevenDaysAgoStr) {
					weeklyCount += (stat.totalTrackerEntries || 0);
				}
			});

			// Use the latest stat for streak
			// We need to find the latest stat object
			const latest = dailyStats.reduce((prev, current) => (prev.date > current.date) ? prev : current);
			currentStreak = latest.overallStreak || 0;

			// Total sessions - this is tricky without a permanent counter.
			// Maybe we just use weekly count for now or try to get it from User profile if available.
			// If user is loaded, check user.stats
			if (this.user && this.user.stats) {
				// currentStreak = this.user.stats.currentStreaks || currentStreak;
				// Logic above from daily stats is arguably more "real-time" if user doc isn't updated yet.
				// But user doc is updated by backend.
			}
		}

		// Fallback/Augment with active trackers info
		if (trackers) {
			// Longest streak calculation is missing from DailyStats,
			// would need query over long period or field in User profile.
			// For now, duplicate current streak or 0.
			longestStreak = currentStreak; // Placeholder
		}

		this.trackerStats = {
			totalSessions: weeklyCount, // Using weekly activity as total sessions proxy for this view
			weeklyCount: weeklyCount,
			currentStreak: currentStreak,
			longestStreak: longestStreak
		};
	}


	// Navigation method for Add Tracker
	navigateToAddTracker() {
		this.logging.info('Navigating to add tracker page');
		this.router.navigate(['/tabs/add-tracker']);
	}



	// Enhanced Logging Modal Methods
	openLogModal(tracker: TrackerData) {
		this.logging.info('Opening global logging modal', { trackerId: tracker.id, trackerName: tracker.name });

		this.loggingModalService.openLogModal(tracker, (entry: TrackerEntry) => {
			this.onEntryLogged(entry);
		});
	}

	closeLogModal() {
		this.loggingModalService.closeLogModal();
	}





	// Quick action methods
	async quickLog(tracker: TrackerData, value?: number) {
		// For boolean trackers, directly log with the global service
		if (tracker.type === TrackerType.BOOLEAN) {
			this.loggingModalService.openLogModal(tracker, (entry: TrackerEntry) => {
				this.onEntryLogged(entry);
			});
			return;
		}

		// For other types, open modal for more details
		this.openLogModal(tracker);
	}



	// Utility methods
	trackByTrackerId(index: number, tracker: TrackerData): string {
		return tracker?.id || index.toString();
	}

	getTrackerIcon(tracker: TrackerData): string {
		return tracker?.icon || 'fa-circle';
	}

	getTrackerColor(tracker: TrackerData): string {
		return tracker?.color || '#6b7280';
	}

	getProgressColor(progress: number): string {
		if (progress >= 80) return '#10b981'; // green
		if (progress >= 60) return '#f59e0b'; // amber
		return '#ef4444'; // red
	}

	getCategoryLabel(category: string | null | undefined): string {
		if (!category) return 'General';

		const labels: { [key: string]: string } = {
			'mind': 'Mental Wellness',
			'body': 'Physical Health',
			'soul': 'Emotional Wellness',
			'beauty': 'Self Care',
			'mood': 'Mental Health',
			'lifestyle': 'Life Management'
		};

		const normalizedCategory = category.toLowerCase();
		return labels[normalizedCategory] || category;
	}

	navigateToTrackerDetail(tracker: TrackerData) {
		// Navigate to tracker detail page (to be implemented)
		this.router.navigate(['/tracker-detail', tracker.id]);
	}

	private showToastMessage(message: string) {
		this.toastService.showInfo(message);
	}

	onToastDismiss() {
		this.toastService.dismissAll();
	}



	private getMoodEmoji(mood: number): string {
		if (mood >= 9) return '😄';
		if (mood >= 7) return '😊';
		if (mood >= 5) return '😐';
		if (mood >= 3) return '😔';
		return '😞';
	}

	// Helper method for template to get today's date in ISO string format
	getTodayISOString(): string {
		return new Date().toISOString().split('T')[0];
	}

	// Method for TrackerLogModal component
	async onEntryLogged(entry: TrackerEntry) {
		this.logging.info('Entry logged from tracker page', { entry });

		// Find the tracker name from the entry
		const tracker = this.activeTrackers.find(t => t.id === entry.trackerId);

		// Show success feedback
		this.showToastMessage(`✅ ${tracker?.name || 'Tracker'} updated successfully!`);

		// Refresh tracker data
		await this.loadTrackerData();
	}

	// Profile image methods
	private updateProfileImageUrl() {
		if (this.user) {
			this.userDisplayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';

			// Use Dicebear avatar with user's name as seed for consistency
			// this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;

			// Use actual photo if available
			if (this.user.photoURL) {
				const photoURL = this.user.photoURL;
				// this.profileImageUrl = photoURL;
			}
		}
	}

	onImageError(event: any) {
		// Fallback to Dicebear avatar if image fails to load
		this.logging.debug('Profile image failed to load, using fallback');
		// this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
	}

	onImageLoad(event: any) {
		this.logging.debug('Profile image loaded successfully');
	}

	getProfileImageUrl(): string {
		return ''; // No longer needed
	}

	// Helper methods for new dashboard-style design
	getActiveCount(): number {
		return this.activeTrackers.length;
	}

	getTodayEntryCount(tracker: TrackerData): number {
		if (!tracker) return 0;

		// For boolean trackers, return 1 if completed today, 0 otherwise
		if (tracker.type === 'boolean') {
			return tracker.todayCompleted ? 1 : 0;
		}

		// For other trackers, return the total entries count (this might need adjustment based on your data structure)
		return tracker.totalEntries || 0;
	}

	getTodayProgress(tracker: TrackerData): number {
		if (!tracker) return 0;

		const todayCount = this.getTodayEntryCount(tracker);
		const target = tracker.target || 1;

		return Math.min(Math.round((todayCount / target) * 100), 100);
	}

	getTodayCompletedCount(): number {
		return this.activeTrackers.filter(t => t.todayCompleted).length;
	}

	getOverallProgress(): number {
		if (this.activeTrackers.length === 0) return 0;
		const completedCount = this.getTodayCompletedCount();
		return Math.round((completedCount / this.activeTrackers.length) * 100);
	}

	async handleRefresh(event: any) {
		try {
			await this.loadTrackerData();
		} catch (error) {
			this.logging.error('Error refreshing activities', error);
		} finally {
			event.target.complete();
		}
	}

	openQuickLogModal() {
		// For now, open the existing logging modal service
		// This could be enhanced to show a quick activity picker
		if (this.activeTrackers.length > 0) {
			// Open logging modal for the first tracker as an example
			// In a real implementation, you might want to show a picker
			this.loggingModalService.openLogModal(this.activeTrackers[0], (entry: TrackerEntry) => {
				this.loadTrackerData();
			});
		} else {
			this.toastService.showInfo('No activities available to log. Create an activity tracker first!');
		}
	}
}
