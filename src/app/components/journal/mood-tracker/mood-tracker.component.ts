import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { WeeklyMoodTrend } from '../../../models/statistics.interface'; // Updated path

@Component({
	selector: 'app-mood-tracker',
	templateUrl: './mood-tracker.component.html',
	styleUrls: ['./mood-tracker.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class MoodTrackerComponent implements OnInit {
	@Input() weeklyTrends: WeeklyMoodTrend[] = [];
	@Input() isLoading: boolean = false;

	constructor() { }

	ngOnInit() { }

	getMoodHeight(mood: number): string {
		// scale 1-10 to percentage height (min 10% for visibility)
		return Math.max(10, mood * 10) + '%';
	}

	getMoodColor(mood: number): string {
		if (mood >= 8) return 'bg-emerald-400';
		if (mood >= 6) return 'bg-blue-400';
		if (mood >= 4) return 'bg-yellow-400';
		return 'bg-rose-400';
	}
}
