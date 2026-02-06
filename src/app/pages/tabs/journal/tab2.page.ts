import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonCardSubtitle,
	IonTextarea,
	IonButton,
	IonIcon,
	IonSpinner,
	IonItem,
	IonLabel,
	IonInput,
	IonNote,
	IonButtons,
	ModalController
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Services
import { UserService } from '../../../services/user.service';
import { LoggingService } from '../../../services/logging.service';
import { JournalService } from '../../../services/journal.service';
import { ToastService } from '../../../services/toast.service';
import { StatisticsService } from '../../../services/statistics.service';
import { firstValueFrom, combineLatest } from 'rxjs'; // Added combineLatest

// Models
import { User } from '../../../models/user.interface';
import { UserDailyStats, WeeklyMoodTrend, JournalDailyStats } from '../../../models/statistics.interface'; // Updated
import { JournalEntry, JournalStats, JournalPrompt } from '../../../models/journal.interface';

// Components
import { JournalEntryCardComponent, JournalStatsComponent } from '../../../components/journal';
import { MoodTrackerComponent } from '../../../components/journal/mood-tracker/mood-tracker.component';
import { JournalPromptsComponent } from '../../../components/journal/journal-prompts/journal-prompts.component'; // Added
import { WriteEntryModalComponent } from '../../../components/journal/write-entry-modal/write-entry-modal.component';

@Component({
	selector: 'app-tab2',
	templateUrl: 'tab2.page.html',
	styleUrls: ['tab2.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonContent,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonCardSubtitle,
		IonTextarea,
		IonButton,
		IonIcon,
		IonSpinner,
		IonItem,
		IonLabel,
		IonInput,
		IonNote,
		IonButtons,
		JournalEntryCardComponent,
		JournalStatsComponent,
		MoodTrackerComponent,
		JournalPromptsComponent,
		WriteEntryModalComponent
	]
})
export class Tab2Page implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// User data
	user: User | null = null;

	// Profile image
	profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
	userDisplayName = 'User';

	// Journal data
	journalStats: JournalStats | null = null;
	recentEntries: JournalEntry[] = [];
	journalPrompts: JournalPrompt[] = [];
	dailyPrompt: JournalPrompt | null = null;
	weeklyMoodTrends: WeeklyMoodTrend[] = []; // Added

	// Loading states
	isLoadingStats = true;
	isLoadingEntries = true;
	isLoadingTrends = true; // Added
	isLoadingPrompts = true;
	isLoadingDailyPrompt = true;
	isRefreshingPrompts = false;

	// AI prompts status
	aiPromptsAvailable = false;
	promptsLastRefreshed: Date | null = null;



	constructor(
		private userService: UserService,
		private logging: LoggingService,
		private journalService: JournalService,
		private router: Router,
		private cdr: ChangeDetectorRef,
		private toastService: ToastService,
		private statisticsService: StatisticsService,
		private modalCtrl: ModalController
	) { }

	ngOnInit() {
		this.loadUserProfile();
		this.loadJournalData();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private loadUserProfile() {
		this.userService.getCurrentUserProfile().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (user) => {
				this.user = user;
				this.updateProfileImageUrl();
			},
			error: (error) => {
				this.logging.error('Failed to load user profile', { error });
			}
		});
	}

	private loadJournalData() {
		this.isLoadingStats = true;
		this.isLoadingEntries = true;
		this.isLoadingTrends = true;

		// Load recent entries
		const recentEntries$ = this.journalService.getRecentJournalEntries();

		// Load user stats using StatisticsService (fetch last 30 days for trend analysis)
		const stats$ = this.statisticsService.getRecentStats(30);

		// Load journal daily stats (last 30 days for content analytics)
		const journalDailyStats$ = this.statisticsService.getJournalDailyStats({ days: 30 });

		// Load weekly mood trends (last 8 weeks)
		const trends$ = this.statisticsService.getWeeklyMoodTrend(8);

		// Combine all sources
		combineLatest([recentEntries$, stats$, journalDailyStats$, trends$]).pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: ([entries, dailyStats, journalDailyStats, trends]) => {
				this.recentEntries = entries;
				this.journalStats = this.calculateJournalStatsFromRealData(dailyStats, journalDailyStats, entries);
				this.weeklyMoodTrends = trends;

				this.isLoadingStats = false;
				this.isLoadingEntries = false;
				this.isLoadingTrends = false;

				this.logging.debug('Journal dashboard data loaded', {
					totalEntries: this.journalStats.totalEntries,
					recentCount: entries.length,
					statsRecordCount: dailyStats.length,
					journalDailyStatsCount: journalDailyStats.length,
					weeksTrend: trends.length
				});
			},
			error: (error) => {
				this.logging.error('Failed to load journal dashboard data', { error });
				this.isLoadingStats = false;
				this.isLoadingEntries = false;
				this.isLoadingTrends = false;
			}
		});

		// Load AI-powered prompts
		this.loadAIPrompts();
	}

	private calculateJournalStatsFromRealData(
		dailyStats: UserDailyStats[],
		journalDailyStats: JournalDailyStats[],
		recentEntries: JournalEntry[]
	): JournalStats {
		// Use the latest daily stat for current snapshots (streaks, etc)
		const sortedStats = [...dailyStats].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		const latestStat = sortedStats.length > 0 ? sortedStats[0] : null;

		// Calculate weekly count from last 7 days of stats
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const weeklyStats = sortedStats.filter(s => new Date(s.date) >= oneWeekAgo);
		const weeklyCount = weeklyStats.reduce((sum, s) => sum + (s.moodSources?.journal || 0), 0);

		const monthlyStats = sortedStats.filter(s => new Date(s.date) >= oneMonthAgo);
		const monthlyCount = monthlyStats.reduce((sum, s) => sum + (s.moodSources?.journal || 0), 0);

		// Use User Profile stats for all-time totals if available, otherwise fallback
		const totalEntries = this.user?.stats?.totalJournalEntries || recentEntries.length;

		// Calculate trend
		let moodTrend = 0;
		if (sortedStats.length >= 2) {
			const recentMoods = sortedStats.slice(0, 7).map(s => s.overallAverageMood).filter(m => m > 0);
			const olderMoods = sortedStats.slice(7, 14).map(s => s.overallAverageMood).filter(m => m > 0);

			const recentAvg = recentMoods.length > 0 ? recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length : 0;
			const olderAvg = olderMoods.length > 0 ? olderMoods.reduce((a, b) => a + b, 0) / olderMoods.length : 0;

			if (olderAvg > 0) {
				moodTrend = (recentAvg - olderAvg) / olderAvg;
			}
		}

		// Content analytics from JournalDailyStats
		const totalWords = journalDailyStats.reduce((sum, s) => sum + (s.totalWords || 0), 0);
		const totalEntriesWithDailyStats = journalDailyStats.reduce((sum, s) => sum + (s.entriesCount || 0), 0);
		const averageWordsPerEntry = totalEntriesWithDailyStats > 0 ? Math.round(totalWords / totalEntriesWithDailyStats) : 0;

		// Aggregate categories and tags
		const categoryMap = new Map<string, number>();
		const tagMap = new Map<string, number>();

		journalDailyStats.forEach(s => {
			s.categoriesUsed?.forEach(c => categoryMap.set(c, (categoryMap.get(c) || 0) + 1));
			s.tagsUsed?.forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
		});

		const favoriteCategories = Array.from(categoryMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(e => e[0] as any);

		const mostUsedTags = Array.from(tagMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(e => e[0]);

		// Sentiment trend
		let sentimentTrend = 0;
		if (journalDailyStats.length >= 2) {
			const sortedJournalStats = [...journalDailyStats].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
			const recentSentiment = sortedJournalStats.slice(0, 7).map(s => s.sentimentScore).filter(s => s !== undefined) as number[];
			const olderSentiment = sortedJournalStats.slice(7, 14).map(s => s.sentimentScore).filter(s => s !== undefined) as number[];

			const recentAvgSent = recentSentiment.length > 0 ? recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length : 0;
			const olderAvgSent = olderSentiment.length > 0 ? olderSentiment.reduce((a, b) => a + b, 0) / olderSentiment.length : 0;

			sentimentTrend = recentAvgSent - olderAvgSent;
		}

		return {
			userId: this.user?.id || '',
			totalEntries: totalEntries,
			weeklyCount: weeklyCount,
			monthlyCount: monthlyCount,
			currentStreak: latestStat?.journalStreak || 0,
			longestStreak: this.user?.stats?.longestJournalStreak || 0,
			averageMood: latestStat?.overallAverageMood || 0,
			moodTrend: moodTrend,
			totalWords: totalWords,
			averageWordsPerEntry: averageWordsPerEntry,
			mostUsedTags: mostUsedTags,
			favoriteCategories: favoriteCategories,
			sentimentTrend: sentimentTrend,
			emotionalRange: 0, // Need more complex calculation if desired
			lastUpdated: new Date()
		};
	}

	private loadAIPrompts() {
		// Load daily prompt with AI
		this.journalService.getDailyPrompt().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (prompt) => {
				this.dailyPrompt = prompt;
				this.isLoadingDailyPrompt = false;
				this.logging.debug('Daily prompt loaded', {
					promptId: prompt.id,
					isAI: prompt.id.startsWith('ai-')
				});
			},
			error: (error) => {
				this.logging.error('Failed to load daily prompt', { error });
				this.isLoadingDailyPrompt = false;
			}
		});

		// Load reflection prompts with AI
		this.journalService.getJournalPrompts().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (prompts) => {
				this.journalPrompts = prompts;
				this.isLoadingPrompts = false;
				this.aiPromptsAvailable = this.journalService.areAIPromptsAvailable();
				this.promptsLastRefreshed = new Date();
				this.logging.debug('Reflection prompts loaded', {
					promptCount: prompts.length,
					aiAvailable: this.aiPromptsAvailable
				});
			},
			error: (error) => {
				this.logging.error('Failed to load reflection prompts', { error });
				this.isLoadingPrompts = false;
			}
		});
	}

	private updateProfileImageUrl() {
		if (this.user) {
			this.userDisplayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';

			// Use Dicebear avatar with user's name as seed for consistency
			this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;

			// Use actual photo if available
			if (this.user.photoURL) {
				const photoURL = this.user.photoURL;
				this.profileImageUrl = photoURL;
			}
		}
	}

	onImageError(event: any) {
		// Fallback to Dicebear avatar if image fails to load
		this.logging.debug('Profile image failed to load, using fallback');
		this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
	}

	onImageLoad(event: any) {
		this.logging.debug('Profile image loaded successfully');
	}

	getProfileImageUrl(): string {
		return this.profileImageUrl;
	}

	// Helper methods for template
	formatDate(date: string | Date): string {
		const entryDate = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - entryDate.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 1) {
			return 'Today';
		} else if (diffDays === 2) {
			return 'Yesterday';
		} else if (diffDays <= 7) {
			return `${diffDays - 1} days ago`;
		} else {
			return entryDate.toLocaleDateString();
		}
	}

	truncateContent(content: string, maxLength: number = 100): string {
		if (content.length <= maxLength) {
			return content;
		}
		return content.substring(0, maxLength) + '...';
	}

	getMoodEmoji(mood?: number): string {
		if (!mood || mood < 1) return '😊';

		if (mood <= 2) return '😢';
		if (mood <= 4) return '😕';
		if (mood <= 6) return '😐';
		if (mood <= 8) return '😊';
		return '😄';
	}

	getCategoryIcon(category?: string): string {
		switch (category?.toLowerCase()) {
			case 'gratitude': return 'fa-heart';
			case 'reflection': return 'fa-star';
			case 'growth': return 'fa-trending-up';
			case 'mindfulness': return 'fa-leaf';
			case 'goals': return 'fa-target';
			case 'relationships': return 'fa-people-group';
			case 'health': return 'fa-dumbbell';
			case 'challenges': return 'fa-shield';
			case 'work': return 'fa-briefcase';
			case 'dreams': return 'fa-moon';
			default: return 'fa-pen';
		}
	}

	// Event handlers
	async onWriteNewEntry() {
		const modal = await this.modalCtrl.create({
			component: WriteEntryModalComponent,
			cssClass: 'journal-modal',
			breakpoints: [0, 0.5, 0.9],
			initialBreakpoint: 0.9
		});

		await modal.present();

		const { data } = await modal.onDidDismiss();
		if (data?.saved) {
			this.loadJournalData();
		}
	}

	async onPromptSelected(prompt: JournalPrompt) {
		const modal = await this.modalCtrl.create({
			component: WriteEntryModalComponent,
			componentProps: { prompt },
			cssClass: 'journal-modal',
			breakpoints: [0, 0.5, 0.9],
			initialBreakpoint: 0.9
		});

		await modal.present();

		const { data } = await modal.onDidDismiss();
		if (data?.saved) {
			this.loadJournalData();
		}
	}

	onViewAllEntries() {
		this.logging.debug('View all entries clicked');
		// TODO: Navigate to full journal entries list
	}

	onSearchEntries() {
		this.logging.debug('Search entries clicked');
		// TODO: Open search modal or navigate to search page
	}

	onEntryClick(entry: JournalEntry) {
		this.logging.debug('Journal entry clicked', { entryId: entry.id });
		this.router.navigate(['/journal-entry', entry.id]);
	}



	async onEntryDelete(entry: JournalEntry) {
		this.logging.debug('Delete entry requested', { entryId: entry.id });

		// TODO: Add confirmation dialog
		const confirmed = confirm(`Are you sure you want to delete "${entry.title || 'this entry'}"?`);
		if (!confirmed) return;

		try {
			await this.journalService.deleteJournalEntry(entry.id);
			this.logging.info('Journal entry deleted', { entryId: entry.id });
			// Refresh the journal data to remove the deleted entry
			this.loadJournalData();
			this.toastService.showSuccess('Entry deleted successfully!');
		} catch (error) {
			this.logging.error('Failed to delete journal entry', { entryId: entry.id, error });
			// Error is already handled by the service
		}
	}

	onEntryEdit(entry: JournalEntry) {
		// Navigate to entry in edit mode
		this.router.navigate(['/journal-entry', entry.id], {
			queryParams: { edit: 'true' }
		});
	}

	// Refresh AI prompts (force refresh)
	async onRefreshPrompts() {
		// Prevent double clicks
		if (this.isRefreshingPrompts) {
			return;
		}

		this.logging.debug('Refreshing AI prompts');
		this.isRefreshingPrompts = true;

		// Force change detection immediately
		this.cdr.detectChanges();

		try {
			// Add a small delay to ensure the animation is visible
			await new Promise(resolve => setTimeout(resolve, 100));

			// Force refresh AI prompts
			await this.journalService.refreshAIPrompts();

			// Reload prompts
			this.loadAIPromptsAfterRefresh();

			this.logging.info('AI prompts refreshed successfully');
		} catch (error) {
			this.logging.error('Failed to refresh AI prompts', { error });
			this.isRefreshingPrompts = false;
			this.cdr.detectChanges();
		}
	}

	// Special version of loadAIPrompts used after refresh
	private loadAIPromptsAfterRefresh() {
		let dailyPromptLoaded = false;
		let reflectionPromptsLoaded = false;

		const checkIfBothLoaded = () => {
			if (dailyPromptLoaded && reflectionPromptsLoaded) {
				this.isRefreshingPrompts = false;
				this.cdr.detectChanges();
			}
		};

		// Load daily prompt with AI
		this.journalService.getDailyPrompt().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (prompt) => {
				this.dailyPrompt = prompt;
				dailyPromptLoaded = true;
				checkIfBothLoaded();
				this.logging.debug('Daily prompt loaded after refresh', {
					promptId: prompt.id,
					isAI: prompt.id.startsWith('ai-')
				});
			},
			error: (error) => {
				this.logging.error('Failed to load daily prompt after refresh', { error });
				dailyPromptLoaded = true;
				checkIfBothLoaded();
			}
		});

		// Load reflection prompts with AI
		this.journalService.getJournalPrompts().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (prompts) => {
				this.journalPrompts = prompts;
				this.aiPromptsAvailable = this.journalService.areAIPromptsAvailable();
				this.promptsLastRefreshed = new Date();
				reflectionPromptsLoaded = true;
				checkIfBothLoaded();
				this.logging.debug('Reflection prompts loaded after refresh', {
					promptCount: prompts.length,
					aiAvailable: this.aiPromptsAvailable
				});
			},
			error: (error) => {
				this.logging.error('Failed to load reflection prompts after refresh', { error });
				reflectionPromptsLoaded = true;
				checkIfBothLoaded();
			}
		});
	}

	// Get prompt status for debugging/display
	getPromptsStatus() {
		return this.journalService.getAIPromptStatus();
	}

	// Check if prompts are from AI
	isDailyPromptFromAI(): boolean {
		return this.dailyPrompt?.id.startsWith('ai-') || false;
	}

	areReflectionPromptsFromAI(): boolean {
		return this.journalPrompts.some(prompt => prompt.id.startsWith('ai-'));
	}
}
