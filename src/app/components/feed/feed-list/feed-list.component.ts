import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedService } from 'src/app/services/feed.service';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { Observable } from 'rxjs';
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


	constructor(private feedService: FeedService) { }

	ngOnInit() {
		this.feedItems$ = this.feedService.getFeed();
	}

	doRefresh(event: any) {
		this.feedItems$ = this.feedService.getFeed();
		// In a real app, we'd wait for the observable to emit
		setTimeout(() => {
			event.target.complete();
		}, 1000);
	}

	trackByFn(index: number, item: FeedItem): string {
		return item.id || index.toString();
	}
}
