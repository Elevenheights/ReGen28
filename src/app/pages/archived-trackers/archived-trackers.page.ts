import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton } from '@ionic/angular/standalone';
import { TrackerService } from '../../services/tracker.service';
import { Tracker, TrackerCategory } from '../../models/tracker.interface';
import { Observable, map } from 'rxjs';

@Component({
	selector: 'app-archived-trackers',
	templateUrl: './archived-trackers.page.html',
	styleUrls: ['./archived-trackers.page.scss'],
	standalone: true,
	imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, CommonModule, FormsModule]
})
export class ArchivedTrackersPage implements OnInit {
	archivedTrackers$: Observable<Tracker[]>;
	completedTrackers$: Observable<Tracker[]>;
	viewMode: 'archived' | 'completed' = 'archived';

	constructor(
		private trackerService: TrackerService,
		private router: Router
	) {
		// Initialize with filtered observables
		this.archivedTrackers$ = this.trackerService.getUserTrackers().pipe(
			map(trackers => trackers.filter(t => !t.isActive && !t.isCompleted))
		);

		this.completedTrackers$ = this.trackerService.getUserTrackers().pipe(
			map(trackers => trackers.filter(t => t.isCompleted))
		);
	}

	ngOnInit() {
	}

	getTrackerIcon(tracker: Tracker): string {
		return tracker.icon || 'fa-circle';
	}

	getTrackerColor(tracker: Tracker): string {
		return tracker.color || '#6b7280';
	}

	getCategoryLabel(category: string): string {
		const labels: { [key: string]: string } = {
			'mind': 'Mental',
			'body': 'Physical',
			'soul': 'Emotional',
			'beauty': 'Self Care',
			'mood': 'Mood',
			'lifestyle': 'Lifestyle'
		};
		return labels[category?.toLowerCase()] || category || 'General';
	}

	navigateToTrackerDetail(tracker: Tracker) {
		this.router.navigate(['/tracker-detail', tracker.id]);
	}
}
