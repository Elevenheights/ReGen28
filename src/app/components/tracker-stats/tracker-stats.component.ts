import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export interface TrackerDashboardStats {
	totalSessions: number;
	weeklyCount: number;
	currentStreak: number;
	longestStreak: number;
}

@Component({
	selector: 'app-tracker-stats',
	templateUrl: './tracker-stats.component.html',
	styleUrls: ['./tracker-stats.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class TrackerStatsComponent {
	@Input() stats: TrackerDashboardStats | null = null;
	@Input() isLoading: boolean = false;

	constructor() { }
}
