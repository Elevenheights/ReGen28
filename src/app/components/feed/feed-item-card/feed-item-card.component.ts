import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { FeedService } from 'src/app/services/feed.service';
import { CommentsModalComponent } from '../comments-modal/comments-modal.component';
import { FeedActivityCardComponent } from '../cards/feed-activity-card/feed-activity-card.component';
import { FeedStatCardComponent } from '../cards/feed-stat-card/feed-stat-card.component';
import { FeedMilestoneCardComponent } from '../cards/feed-milestone-card/feed-milestone-card.component';
import { FeedJournalCardComponent } from '../cards/feed-journal-card/feed-journal-card.component';
import { FeedTrackerCardComponent } from '../cards/feed-tracker-card/feed-tracker-card.component';
import { FeedGuidanceCardComponent } from '../cards/feed-guidance-card/feed-guidance-card.component';
import { FeedInspirationCardComponent } from '../cards/feed-inspiration-card/feed-inspiration-card.component';
import { FeedActionCardComponent } from '../cards/feed-action-card/feed-action-card.component';
import { FeedInsightCardComponent } from '../cards/feed-insight-card/feed-insight-card.component';

import { addIcons } from 'ionicons';
import { heart, heartOutline, chatbubbleOutline, paperPlaneOutline, bookmarkOutline } from 'ionicons/icons';

@Component({
	selector: 'app-feed-item-card',
	templateUrl: './feed-item-card.component.html',
	styleUrls: ['./feed-item-card.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonicModule,
		FeedActivityCardComponent,
		FeedStatCardComponent,
		FeedMilestoneCardComponent,
		FeedJournalCardComponent,
		FeedGuidanceCardComponent,
		FeedTrackerCardComponent,
		FeedInspirationCardComponent,
		FeedActionCardComponent,
		FeedInsightCardComponent
	]
})
export class FeedItemCardComponent implements OnInit {
	@Input() item!: FeedItem;

	/** Fallback avatar for when images fail to load */
	private readonly FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=user';

	constructor(
		private feedService: FeedService,
		private modalController: ModalController
	) {
		addIcons({ heart, heartOutline, chatbubbleOutline, paperPlaneOutline, bookmarkOutline });
	}

	ngOnInit() {
		// Ensure defaults
		if (!this.item.likesCount) this.item.likesCount = 0;
		if (!this.item.commentsCount) this.item.commentsCount = 0;
	}

	/** Resolved avatar URL with fallback chain */
	get authorAvatar(): string {
		return this.item.author?.avatarUrl || this.FALLBACK_AVATAR;
	}

	/** Handle avatar image load failure */
	onAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src !== this.FALLBACK_AVATAR) {
			img.src = this.FALLBACK_AVATAR;
		}
	}

	toggleLike() {
		// Optimistic UI update
		const wasLiked = this.item.hasLiked;
		this.item.hasLiked = !wasLiked;
		this.item.likesCount = (this.item.likesCount || 0) + (this.item.hasLiked ? 1 : -1);

		// Call backend
		if (this.item.id) {
			this.feedService.toggleLike(this.item.id).subscribe({
				next: (result) => {
					// Sync with backend result just in case
					this.item.likesCount = result.likesCount;
					this.item.hasLiked = result.hasLiked;
				},
				error: (err) => {
					console.error('Error toggling like:', err);
					// Revert on error
					this.item.hasLiked = wasLiked;
					this.item.likesCount = (this.item.likesCount || 0) + (wasLiked ? 1 : -1);
				}
			});
		}
	}

	async openComments() {
		if (!this.item.id) return;

		const modal = await this.modalController.create({
			component: CommentsModalComponent,
			componentProps: {
				feedItemId: this.item.id
			}
		});

		await modal.present();
	}

	get timeAgo(): string {
		if (!this.item.createdAt) return '';
		const date = this.item.createdAt.toDate ? this.item.createdAt.toDate() : new Date(this.item.createdAt);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'Just now';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
		return `${Math.floor(diffInSeconds / 86400)}d`;
	}
}
