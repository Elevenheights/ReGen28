import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonContent,
	IonHeader,
	IonTitle,
	IonToolbar,
	IonButtons,
	IonBackButton,
	IonRefresher,
	IonRefresherContent,
	IonSpinner,
	IonList,
	IonItem,
	IonLabel,
	IonIcon,
	IonInfiniteScroll,
	IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { ActivityService } from '../../services/activity.service';
import { Activity, ActivityType } from '../../models/activity.interface';
import { Subject, takeUntil } from 'rxjs';
import { LoggingService } from '../../services/logging.service';

@Component({
	selector: 'app-activities',
	templateUrl: './activities.page.html',
	styleUrls: ['./activities.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IonContent,
		IonHeader,
		IonTitle,
		IonToolbar,
		IonButtons,
		IonBackButton,
		IonRefresher,
		IonRefresherContent,
		IonSpinner,
		IonList,
		IonItem,
		IonLabel,
		IonIcon,
		IonInfiniteScroll,
		IonInfiniteScrollContent
	]
})
export class ActivitiesPage implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	activities: Activity[] = [];
	isLoading = true;
	limit = 20;

	constructor(
		private activityService: ActivityService,
		private logging: LoggingService
	) { }

	ngOnInit() {
		this.loadActivities();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	loadActivities(event?: any) {
		if (!event) this.isLoading = true;

		this.activityService.getRecentActivities(this.limit).pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (activities) => {
				this.activities = activities;
				this.isLoading = false;
				if (event) event.target.complete();
			},
			error: (error) => {
				this.logging.error('Failed to load activities', error);
				this.isLoading = false;
				if (event) event.target.complete();
			}
		});
	}

	handleRefresh(event: any) {
		this.loadActivities(event);
	}

	// Activity Helper Methods
	getActivityIcon(type: ActivityType): string {
		switch (type) {
			case ActivityType.TRACKER_ENTRY: return 'fa-solid fa-check-circle';
			case ActivityType.JOURNAL_ENTRY: return 'fa-solid fa-pen-fancy';
			case ActivityType.GOAL_CREATED: return 'fa-solid fa-bullseye';
			case ActivityType.GOAL_COMPLETED: return 'fa-solid fa-trophy';
			case ActivityType.ACHIEVEMENT_EARNED: return 'fa-solid fa-medal';
			case ActivityType.STREAK_ACHIEVED: return 'fa-solid fa-fire';
			default: return 'fa-solid fa-star';
		}
	}

	getActivityGradientClass(type: ActivityType): string {
		switch (type) {
			case ActivityType.TRACKER_ENTRY: return 'bg-gradient-to-br from-blue-500 to-indigo-600';
			case ActivityType.JOURNAL_ENTRY: return 'bg-gradient-to-br from-orange-400 to-pink-600';
			case ActivityType.GOAL_CREATED: return 'bg-gradient-to-br from-emerald-400 to-teal-600';
			case ActivityType.GOAL_COMPLETED: return 'bg-gradient-to-br from-yellow-400 to-orange-500';
			case ActivityType.ACHIEVEMENT_EARNED: return 'bg-gradient-to-br from-purple-500 to-indigo-700';
			case ActivityType.STREAK_ACHIEVED: return 'bg-gradient-to-br from-red-500 to-orange-600';
			default: return 'bg-gradient-to-br from-neutral-400 to-neutral-600';
		}
	}

	getActivityTypeLabel(type: ActivityType): string {
		switch (type) {
			case ActivityType.TRACKER_ENTRY: return 'Ritual';
			case ActivityType.JOURNAL_ENTRY: return 'Journal';
			case ActivityType.GOAL_CREATED: return 'New Goal';
			case ActivityType.GOAL_COMPLETED: return 'Goal Met';
			case ActivityType.ACHIEVEMENT_EARNED: return 'Badge Earned';
			case ActivityType.STREAK_ACHIEVED: return 'Streak';
			default: return 'Activity';
		}
	}

	formatActivityTime(date: any): string {
		if (!date) return '';
		const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	trackActivity(index: number, activity: Activity) {
		return activity.id;
	}
}
