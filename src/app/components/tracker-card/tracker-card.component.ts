import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Tracker, TrackerType, TrackerCategory } from '../../models/tracker.interface';
import { TrackerData } from '../../models/view-models.interface';

@Component({
	selector: 'app-tracker-card',
	templateUrl: './tracker-card.component.html',
	styleUrls: ['./tracker-card.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class TrackerCardComponent {
	@Input() tracker!: TrackerData;
	@Input() showActions: boolean = true;
	@Input() compactMode: boolean = false;

	@Output() quickLog = new EventEmitter<void>();
	@Output() openDetail = new EventEmitter<void>();
	@Output() openLogModal = new EventEmitter<void>();
	@Output() extendTracker = new EventEmitter<void>();
	@Output() completeTracker = new EventEmitter<void>();

	constructor() { }

	// Progress styling
	get progressColor(): string {
		if (this.tracker.progress >= 80) return '#10b981'; // green
		if (this.tracker.progress >= 60) return '#f59e0b'; // amber
		return '#ef4444'; // red
	}

	get progressGradient(): string {
		const color = this.tracker.color || this.progressColor;
		return `linear-gradient(90deg, ${color}, ${color}90)`;
	}

	// Category helpers
	get categoryLabel(): string {
		if (!this.tracker.category) return 'General';

		const labels: { [key: string]: string } = {
			'mind': 'Mental Wellness',
			'body': 'Physical Health',
			'soul': 'Emotional Wellness',
			'beauty': 'Self Care',
			'mood': 'Mental Health',
			'lifestyle': 'Life Management',
			'custom': 'Custom'
		};

		return labels[this.tracker.category.toLowerCase()] || this.tracker.category;
	}

	get categoryShortLabel(): string {
		if (!this.tracker.category) return 'General';
		return this.tracker.category.charAt(0).toUpperCase() + this.tracker.category.slice(1).toLowerCase();
	}

	get trackerColor(): string {
		return this.tracker.color || '#6b7280';
	}

	get trackerIcon(): string {
		return this.tracker.icon || 'fa-circle';
	}

	// Duration helpers
	get isOngoing(): boolean {
		return this.tracker.isOngoing || this.tracker.daysRemaining === -1;
	}

	get durationDisplay(): string {
		if (this.isOngoing) {
			return 'Ongoing';
		}
		if (this.tracker.daysRemaining !== undefined) {
			if (this.tracker.daysRemaining <= 0) {
				return 'Completed';
			}
			if (this.tracker.daysRemaining === 1) {
				return '1 day left';
			}
			return `${this.tracker.daysRemaining} days left`;
		}
		return '';
	}

	get durationIcon(): string {
		if (this.isOngoing) return 'fa-infinity';
		if (this.tracker.daysRemaining !== undefined && this.tracker.daysRemaining <= 3) {
			return 'fa-hourglass-half';
		}
		return 'fa-calendar';
	}

	get durationClass(): string {
		if (this.isOngoing) {
			return 'text-amber-600 bg-amber-50';
		}
		if (this.tracker.daysRemaining !== undefined) {
			if (this.tracker.daysRemaining <= 0) {
				return 'text-emerald-600 bg-emerald-50';
			}
			if (this.tracker.daysRemaining <= 3) {
				return 'text-red-600 bg-red-50';
			}
			if (this.tracker.daysRemaining <= 7) {
				return 'text-amber-600 bg-amber-50';
			}
		}
		return 'text-neutral-600 bg-neutral-50';
	}

	// Milestone helpers
	get nextMilestoneDisplay(): string {
		if (!this.tracker.nextMilestone) return '';
		return `${this.tracker.nextMilestone} day milestone`;
	}

	get milestoneProgressPercent(): number {
		return Math.round((this.tracker.milestoneProgress || 0) * 100);
	}

	// Trend helpers
	get trendIcon(): string {
		switch (this.tracker.trend) {
			case 'improving': return 'fa-arrow-trend-up';
			case 'declining': return 'fa-arrow-trend-down';
			default: return 'fa-minus';
		}
	}

	get trendClass(): string {
		switch (this.tracker.trend) {
			case 'improving': return 'text-emerald-500';
			case 'declining': return 'text-red-500';
			default: return 'text-neutral-400';
		}
	}

	get trendLabel(): string {
		switch (this.tracker.trend) {
			case 'improving': return 'Improving';
			case 'declining': return 'Needs attention';
			default: return 'Stable';
		}
	}

	// Streak helpers
	get hasStreak(): boolean {
		return (this.tracker.streak || 0) > 0;
	}

	get streakDisplay(): string {
		const streak = this.tracker.streak || 0;
		if (streak === 1) return '1 day streak';
		return `${streak} day streak`;
	}

	get isOnFire(): boolean {
		return (this.tracker.streak || 0) >= 7;
	}

	// Adherence helpers
	get adherencePercent(): number {
		return Math.round((this.tracker.adherence || 0) * 100);
	}

	get adherenceClass(): string {
		const adherence = this.adherencePercent;
		if (adherence >= 80) return 'text-emerald-600';
		if (adherence >= 60) return 'text-amber-600';
		return 'text-red-600';
	}

	// Frequency display
	get frequencyLabel(): string {
		switch (this.tracker.frequency) {
			case 'daily': return 'Day';
			case 'weekly': return 'Week';
			case 'monthly': return 'Month';
			default: return 'Day';
		}
	}

	// Actions
	onQuickLog(event: Event) {
		event.stopPropagation();
		this.quickLog.emit();
	}

	onOpenLogModal(event: Event) {
		event.stopPropagation();
		this.openLogModal.emit();
	}

	onCardClick() {
		this.openDetail.emit();
	}

	onExtend(event: Event) {
		event.stopPropagation();
		this.extendTracker.emit();
	}

	onComplete(event: Event) {
		event.stopPropagation();
		this.completeTracker.emit();
	}
}
