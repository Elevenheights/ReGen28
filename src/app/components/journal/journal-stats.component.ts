import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Models
import { JournalStats } from '../../models/journal.interface';

@Component({
	selector: 'app-journal-stats',
	templateUrl: './journal-stats.component.html',
	styleUrls: ['./journal-stats.component.scss'],
	standalone: true,
	imports: [
		CommonModule
	]
})
export class JournalStatsComponent {
	@Input() stats: JournalStats | null = null;
	@Input() isLoading = false;
	@Input() showDetailedStats = false;

	getMoodTrendIcon(): string {
		if (!this.stats) return 'fa-minus';

		if (this.stats.moodTrend > 0.2) return 'fa-trending-up';
		if (this.stats.moodTrend < -0.2) return 'fa-trending-down';
		return 'fa-minus';
	}

	getMoodTrendColor(): string {
		if (!this.stats) return 'text-neutral-400';

		if (this.stats.moodTrend > 0.2) return 'text-green-500';
		if (this.stats.moodTrend < -0.2) return 'text-red-500';
		return 'text-neutral-400';
	}

	getMoodTrendText(): string {
		if (!this.stats) return 'No data';

		if (this.stats.moodTrend > 0.2) return 'Improving';
		if (this.stats.moodTrend < -0.2) return 'Declining';
		return 'Stable';
	}

	getStreakColor(): string {
		if (!this.stats || this.stats.currentStreak === 0) return 'text-neutral-400';

		if (this.stats.currentStreak >= 7) return 'text-green-500';
		if (this.stats.currentStreak >= 3) return 'text-blue-500';
		return 'text-purple-500';
	}

	getStreakIcon(): string {
		if (!this.stats || this.stats.currentStreak === 0) return 'fa-fire-extinguisher';

		if (this.stats.currentStreak >= 7) return 'fa-fire-flame-curved';
		if (this.stats.currentStreak >= 3) return 'fa-fire';
		return 'fa-fire-flame-simple';
	}

	formatAverageMood(): string {
		if (!this.stats || this.stats.averageMood === 0) return 'N/A';
		return this.stats.averageMood.toFixed(1);
	}

	getAverageMoodEmoji(): string {
		if (!this.stats || this.stats.averageMood === 0) return '😊';

		const mood = this.stats.averageMood;
		if (mood <= 2) return '😢';
		if (mood <= 4) return '😕';
		if (mood <= 6) return '😐';
		if (mood <= 8) return '😊';
		return '😄';
	}

	getWritingFrequency(): string {
		if (!this.stats || this.stats.totalEntries === 0) return 'No entries yet';

		const daysActive = Math.max(1, this.daysSinceFirstEntry());
		const frequency = this.stats.totalEntries / daysActive;

		if (frequency >= 1) return 'Daily';
		if (frequency >= 0.5) return 'Every other day';
		if (frequency >= 0.25) return 'Weekly';
		return 'Occasional';
	}

	private daysSinceFirstEntry(): number {
		// This would ideally come from the stats, but we'll estimate
		// based on total entries and current date
		const now = new Date();
		const estimatedDays = Math.max(1, this.stats?.totalEntries || 1);
		return Math.min(estimatedDays * 2, 365); // Conservative estimate
	}

	getProductivityScore(): number {
		if (!this.stats) return 0;

		// Calculate a simple productivity score based on multiple factors
		let score = 0;

		// Base score from entry count (40%)
		score += Math.min(40, this.stats.totalEntries * 2);

		// Streak bonus (30%)
		score += Math.min(30, this.stats.currentStreak * 3);

		// Consistency bonus (20%)
		const weeklyConsistency = this.stats.weeklyCount >= 3 ? 20 : this.stats.weeklyCount * 6.67;
		score += weeklyConsistency;

		// Mood stability bonus (10%)
		if (this.stats.averageMood > 0) {
			score += Math.min(10, this.stats.averageMood);
		}

		return Math.min(100, Math.round(score));
	}

	getProductivityLabel(): string {
		const score = this.getProductivityScore();

		if (score >= 80) return 'Excellent';
		if (score >= 60) return 'Great';
		if (score >= 40) return 'Good';
		if (score >= 20) return 'Getting Started';
		return 'Just Beginning';
	}

	getProductivityColor(): string {
		const score = this.getProductivityScore();

		if (score >= 80) return 'text-green-500';
		if (score >= 60) return 'text-blue-500';
		if (score >= 40) return 'text-purple-500';
		if (score >= 20) return 'text-yellow-500';
		return 'text-neutral-400';
	}

	getSentimentIcon(): string {
		if (!this.stats) return 'fa-minus';
		if (this.stats.sentimentTrend > 0.05) return 'fa-face-smile-beam';
		if (this.stats.sentimentTrend < -0.05) return 'fa-face-frown';
		return 'fa-face-meh';
	}

	getSentimentColor(): string {
		if (!this.stats) return 'text-neutral-400';
		if (this.stats.sentimentTrend > 0.05) return 'text-emerald-500';
		if (this.stats.sentimentTrend < -0.05) return 'text-rose-500';
		return 'text-neutral-400';
	}

	getSentimentTrendText(): string {
		if (!this.stats) return 'Stable';
		if (this.stats.sentimentTrend > 0.05) return 'Positivity Incr.';
		if (this.stats.sentimentTrend < -0.05) return 'Positivity Decr.';
		return 'Stable';
	}
}