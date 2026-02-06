import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subject, takeUntil, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// Services
import { TrackerService } from '../../services/tracker.service';
import { LoggingService } from '../../services/logging.service';

// Models
import { Tracker, TrackerCategory } from '../../models/tracker.interface';

interface CompletedChallenge {
	tracker: Tracker;
	completedDate: Date;
	totalEntries: number;
	streak: number;
	successRate: number;
	durationDays: number;
}

@Component({
	selector: 'app-completed-challenges',
	templateUrl: './completed-challenges.component.html',
	styleUrls: ['./completed-challenges.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class CompletedChallengesComponent implements OnInit, OnDestroy {
	private readonly trackerService = inject(TrackerService);
	private readonly logging = inject(LoggingService);

	private destroy$ = new Subject<void>();

	@Input() displayMode: 'compact' | 'full' = 'full';
	@Input() maxItems: number = 10;
	@Output() restartChallenge = new EventEmitter<Tracker>();
	@Output() viewDetails = new EventEmitter<Tracker>();

	// Data
	completedChallenges: CompletedChallenge[] = [];
	isLoading = true;
	hasError = false;

	// Stats summary
	totalCompleted = 0;
	totalDaysTracked = 0;
	averageSuccessRate = 0;
	longestStreak = 0;

	ngOnInit() {
		this.loadCompletedChallenges();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private loadCompletedChallenges() {
		this.isLoading = true;
		this.hasError = false;

		this.trackerService.getUserTrackers()
			.pipe(
				takeUntil(this.destroy$),
				map(trackers => trackers.filter(t => t.isCompleted && !t.isOngoing)),
				catchError(error => {
					this.logging.error('Failed to load completed challenges', { error });
					this.hasError = true;
					return of([]);
				})
			)
			.subscribe(async completedTrackers => {
				try {
					this.completedChallenges = await Promise.all(
						completedTrackers.slice(0, this.maxItems).map(async tracker => {
							return this.buildCompletedChallenge(tracker);
						})
					);

					this.calculateSummaryStats();
					this.sortByCompletedDate();

					this.logging.info('Loaded completed challenges', {
						count: this.completedChallenges.length
					});
				} catch (error) {
					this.logging.error('Failed to process completed challenges', { error });
					this.hasError = true;
				} finally {
					this.isLoading = false;
				}
			});
	}

	private async buildCompletedChallenge(tracker: Tracker): Promise<CompletedChallenge> {
		// Get the tracker's entry count
		const totalEntries = tracker.entryCount || 0;

		// Calculate expected entries based on duration and frequency
		const expectedEntries = this.calculateExpectedEntries(tracker);
		const successRate = expectedEntries > 0
			? Math.min(Math.round((totalEntries / expectedEntries) * 100), 100)
			: 0;

		return {
			tracker,
			completedDate: tracker.endDate,
			totalEntries,
			streak: tracker.stats?.longestStreak || 0,
			successRate,
			durationDays: tracker.durationDays
		};
	}

	private calculateExpectedEntries(tracker: Tracker): number {
		const days = tracker.durationDays;

		switch (tracker.frequency) {
			case 'daily':
				return days;
			case 'weekly':
				return Math.floor(days / 7);
			case 'monthly':
				return Math.floor(days / 30);
			default:
				return days;
		}
	}

	private calculateSummaryStats() {
		if (this.completedChallenges.length === 0) return;

		this.totalCompleted = this.completedChallenges.length;

		this.totalDaysTracked = this.completedChallenges.reduce(
			(sum, c) => sum + c.durationDays, 0
		);

		this.averageSuccessRate = Math.round(
			this.completedChallenges.reduce((sum, c) => sum + c.successRate, 0) /
			this.completedChallenges.length
		);

		this.longestStreak = Math.max(
			...this.completedChallenges.map(c => c.streak)
		);
	}

	private sortByCompletedDate() {
		this.completedChallenges.sort((a, b) =>
			new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
		);
	}

	// UI Helpers
	getCategoryColor(category: TrackerCategory | string): string {
		const colors: { [key: string]: string } = {
			'mind': '#3b82f6',
			'body': '#10b981',
			'soul': '#8b5cf6',
			'beauty': '#ec4899',
			'mood': '#f59e0b',
			'custom': '#6b7280'
		};
		return colors[category?.toLowerCase()] || '#6b7280';
	}

	getCategoryIcon(category: TrackerCategory | string): string {
		const icons: { [key: string]: string } = {
			'mind': 'fa-brain',
			'body': 'fa-heart-pulse',
			'soul': 'fa-spa',
			'beauty': 'fa-wand-magic-sparkles',
			'mood': 'fa-face-smile',
			'custom': 'fa-circle'
		};
		return icons[category?.toLowerCase()] || 'fa-circle';
	}

	getSuccessRateClass(rate: number): string {
		if (rate >= 80) return 'text-emerald-600 bg-emerald-50';
		if (rate >= 60) return 'text-amber-600 bg-amber-50';
		return 'text-red-600 bg-red-50';
	}

	getSuccessRateLabel(rate: number): string {
		if (rate >= 90) return 'Excellent!';
		if (rate >= 80) return 'Great Job';
		if (rate >= 60) return 'Good Effort';
		if (rate >= 40) return 'Keep Trying';
		return 'Challenge Completed';
	}

	formatDate(date: Date): string {
		if (!date) return '--';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
		});
	}

	formatDuration(days: number): string {
		if (days <= 7) return `${days} days`;
		if (days <= 28) return `${Math.round(days / 7)} weeks`;
		return `${Math.round(days / 30)} months`;
	}

	onRestartChallenge(tracker: Tracker, event: Event) {
		event.stopPropagation();
		this.restartChallenge.emit(tracker);
	}

	onViewDetails(tracker: Tracker) {
		this.viewDetails.emit(tracker);
	}

	refresh() {
		this.loadCompletedChallenges();
	}
}
