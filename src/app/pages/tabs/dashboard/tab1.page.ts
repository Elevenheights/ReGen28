import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TrackerService } from '../../../services/tracker.service';
import { LoggingModalService } from '../../../services/logging-modal.service';
import { Tracker } from '../../../models/tracker.interface';
import { IonicModule } from '@ionic/angular';
import { FeedListComponent } from '../../../components/feed/feed-list/feed-list.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { UserService } from '../../../services/user.service';
import { FeedService } from '../../../services/feed.service';
import { FeedItem } from '../../../models/feed-item.interface';
import { FeedItemCardComponent } from '../../../components/feed/feed-item-card/feed-item-card.component';
import { Observable, combineLatest, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { sparkles } from 'ionicons/icons';

@Component({
	selector: 'app-tab1',
	templateUrl: 'tab1.page.html',
	styleUrls: ['tab1.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		RouterLink,
		IonicModule,
		FeedListComponent,
		PageHeaderComponent,
		FeedItemCardComponent
	],
})
export class Tab1Page implements OnInit {
	private readonly noticeKey = 'regen28.feed.sanctuary-notice-dismissed.v1';
	showFeedNotice = true;
	readonly journeyTicks = Array.from({length:28}, (_, i) => 28 - i);
	journeyDay$: Observable<number>;
	focus$: Observable<{items: {tracker:Tracker; completed:boolean|null}[]; error:string|null}>;
	userDisplayName$: Observable<string>;
	profileImageUrl$: Observable<string>;
	todaysGuidance$: Observable<{ actions: FeedItem[]; insights: FeedItem[]; ids: string[] }>;

	constructor(
		private userService: UserService,
		private feedService: FeedService,
		private trackerService: TrackerService,
		private loggingModalService: LoggingModalService
	) {
		this.journeyDay$ = this.userService.getCurrentUserProfile().pipe(
			map(user => Math.min(28, Math.max(0, user?.currentDay || 0)))
		);
		this.focus$ = combineLatest([
			this.trackerService.getUserTrackers(),
			this.trackerService.getTodaysEntries().pipe(
				map(entries => ({entries, error: null as string|null})),
				catchError(() => of({entries: [], error: 'Today’s completion status is temporarily unavailable.'}))
			)
		]).pipe(
			map(([trackers, state]) => ({
				items: trackers.filter(t => t.isActive && !t.isCompleted).map(tracker => ({
					tracker, completed: state.error ? null : this.trackerService.isGoalCompletedForCurrentPeriod(tracker, state.entries)
				})), error: state.error
			})),
			catchError(() => of({items: [], error: 'Your trackers could not be loaded. Open Trackers to retry.'})),
			shareReplay({bufferSize:1,refCount:true})
		);
		this.userDisplayName$ = this.userService.getCurrentUserProfile().pipe(
			map(user => user?.displayName || 'Friend')
		);

		this.profileImageUrl$ = this.userService.getCurrentUserProfile().pipe(
			map(user => user?.photoURL || `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${user?.displayName || 'user'}`)
		);

		this.todaysGuidance$ = this.feedService.getTodaysActionsAndInsights().pipe(
			map(guidance => ({ ...guidance, ids: [...guidance.actions, ...guidance.insights].map(item => item.id).filter((id): id is string => !!id) })),
			shareReplay({ bufferSize: 1, refCount: true })
		);
		try { this.showFeedNotice = localStorage.getItem(this.noticeKey) !== 'true'; } catch { /* Storage may be unavailable. */ }

		addIcons({ sparkles });
	}

	ngOnInit() { }

	logTracker(tracker: Tracker): void {
		this.loggingModalService.openLogModal(tracker);
	}

	dismissFeedNotice(): void {
		this.showFeedNotice = false;
		try { localStorage.setItem(this.noticeKey, 'true'); } catch { /* Dismiss for this session even without storage. */ }
	}
}
