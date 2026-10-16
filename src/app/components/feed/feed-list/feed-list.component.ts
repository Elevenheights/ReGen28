import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedService } from 'src/app/services/feed.service';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { Observable, BehaviorSubject, combineLatest, map, shareReplay } from 'rxjs';
import { FeedItemCardComponent } from '../feed-item-card/feed-item-card.component';

@Component({
	selector: 'app-feed-list',
	templateUrl: './feed-list.component.html',
	styleUrls: ['./feed-list.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule, FeedItemCardComponent]
})
export class FeedListComponent implements OnInit {
	feedItems$!: Observable<FeedItem[]>;
	private excludedIds$ = new BehaviorSubject<string[]>([]);
	@Input() set excludedItemIds(ids: string[]) { this.excludedIds$.next(ids || []); }
	get hasPinnedGuidance(): boolean { return this.excludedIds$.value.length > 0; }


	constructor(private feedService: FeedService) { }

	ngOnInit() {
		this.loadFeed();
	}

	private loadFeed(): void {
		this.feedItems$ = combineLatest([this.feedService.getFeed(), this.excludedIds$]).pipe(
			map(([items, excluded]) => {
				const ids = new Set(excluded);
				return items.filter(item => !item.id || !ids.has(item.id));
			}),
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	doRefresh(event: any) {
		this.loadFeed();
		// In a real app, we'd wait for the observable to emit
		setTimeout(() => {
			event.target.complete();
		}, 1000);
	}

	trackByFn(index: number, item: FeedItem): string {
		return item.id || index.toString();
	}
}
