import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedListComponent } from '../../../components/feed/feed-list/feed-list.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { UserService } from '../../../services/user.service';
import { FeedService } from '../../../services/feed.service';
import { FeedItem } from '../../../models/feed-item.interface';
import { FeedItemCardComponent } from '../../../components/feed/feed-item-card/feed-item-card.component';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { sparkles } from 'ionicons/icons';

@Component({
	selector: 'app-tab1',
	templateUrl: 'tab1.page.html',
	styleUrls: ['tab1.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonicModule,
		FeedListComponent,
		PageHeaderComponent,
		FeedItemCardComponent
	],
})
export class Tab1Page implements OnInit {
	userDisplayName$: Observable<string>;
	profileImageUrl$: Observable<string>;
	todaysGuidance$: Observable<{ actions: FeedItem[]; insights: FeedItem[] }>;

	constructor(
		private userService: UserService,
		private feedService: FeedService
	) {
		this.userDisplayName$ = this.userService.getCurrentUserProfile().pipe(
			map(user => user?.displayName || 'Friend')
		);

		this.profileImageUrl$ = this.userService.getCurrentUserProfile().pipe(
			map(user => user?.photoURL || `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${user?.displayName || 'user'}`)
		);

		this.todaysGuidance$ = this.feedService.getTodaysActionsAndInsights();

		addIcons({ sparkles });
	}

	ngOnInit() { }
}
