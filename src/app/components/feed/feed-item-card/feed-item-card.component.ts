import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TrackerService } from '../../../services/tracker.service';
import { LoggingModalService } from '../../../services/logging-modal.service';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  heartOutline,
  heart,
  chatbubbleOutline,
  shareOutline,
} from 'ionicons/icons';
import { FeedService } from '../../../services/feed.service';
import { ToastService } from '../../../services/toast.service';
import { CommentsModalComponent } from '../comments-modal/comments-modal.component';
import { FeedTrackerCardComponent } from '../cards/feed-tracker-card/feed-tracker-card.component';
import { FeedStatCardComponent } from '../cards/feed-stat-card/feed-stat-card.component';
import { FeedMilestoneCardComponent } from '../cards/feed-milestone-card/feed-milestone-card.component';
import { FeedJournalCardComponent } from '../cards/feed-journal-card/feed-journal-card.component';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { FeedGuidanceCardComponent } from '../cards/feed-guidance-card/feed-guidance-card.component';
import { FeedInspirationCardComponent } from '../cards/feed-inspiration-card/feed-inspiration-card.component';
import { FeedActionCardComponent } from '../cards/feed-action-card/feed-action-card.component';
import { FeedInsightCardComponent } from '../cards/feed-insight-card/feed-insight-card.component';

@Component({
  selector: 'app-feed-item-card',
  templateUrl: './feed-item-card.component.html',
  styleUrls: ['./feed-item-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FeedTrackerCardComponent,
    FeedStatCardComponent,
    FeedMilestoneCardComponent,
    FeedJournalCardComponent,
    FeedGuidanceCardComponent,
    FeedInspirationCardComponent,
    FeedActionCardComponent,
    FeedInsightCardComponent,
  ],
})
export class FeedItemCardComponent {
  @Input() item!: FeedItem;
  liking = false;

  constructor(
    private feedService: FeedService,
    private modal: ModalController,
    private toast: ToastService,
    private trackers: TrackerService,
    private loggingModal: LoggingModalService,
    private alert: AlertController,
  ) {
    addIcons({ heartOutline, heart, chatbubbleOutline, shareOutline });
  }

  async keepGoing(): Promise<void> {
    if (!this.item.source.trackerId) return;
    try {
      const tracker = await firstValueFrom(
        this.trackers.getTracker(this.item.source.trackerId),
      );
      if (tracker) this.loggingModal.openLogModal(tracker);
      else this.toast.showError('This tracker is no longer available.');
    } catch {
      this.toast.showError('Could not open this tracker. Please try again.');
    }
  }

  async makeItLighter(): Promise<void> {
    if (!this.item.source.trackerId) return;
    let tracker;
    try {
      tracker = await firstValueFrom(
        this.trackers.getTracker(this.item.source.trackerId),
      );
    } catch {
      this.toast.showError('Could not load your target. Please try again.');
      return;
    }
    if (!tracker) {
      this.toast.showError('This tracker is no longer available.');
      return;
    }
    const dialog = await this.alert.create({
      header: 'Adjust your target',
      message: 'Choose a target that feels manageable for this tracker.',
      inputs: [
        {
          name: 'target',
          type: 'number',
          value: tracker.target,
          attributes: { min: 1 },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save target',
          handler: async (value) => {
            const target = Number(value.target);
            if (!Number.isFinite(target) || target <= 0) {
              this.toast.showError('Enter a target greater than zero.');
              return false;
            }
            try {
              await this.trackers.updateTracker(tracker.id, { target });
              return true;
            } catch {
              this.toast.showError('Could not update your target.');
              return false;
            }
          },
        },
      ],
    });
    await dialog.present();
  }

  toggleLike(): void {
    if (!this.item.id || this.liking) return;
    const oldLiked = !!this.item.hasLiked;
    const oldCount = this.item.likesCount || 0;
    this.liking = true;
    this.item.hasLiked = !oldLiked;
    this.item.likesCount = Math.max(0, oldCount + (oldLiked ? -1 : 1));
    this.feedService
      .toggleLike(this.item.id)
      .pipe(finalize(() => (this.liking = false)))
      .subscribe({
        next: (result) => {
          this.item.hasLiked = result.hasLiked;
          this.item.likesCount = result.likesCount;
        },
        error: () => {
          this.item.hasLiked = oldLiked;
          this.item.likesCount = oldCount;
          this.toast.showError('Could not update your like. Please try again.');
        },
      });
  }

  async openComments(): Promise<void> {
    if (!this.item.id) return;
    const dialog = await this.modal.create({
      component: CommentsModalComponent,
      cssClass: 'muse-comments-modal',
      componentProps: { feedItemId: this.item.id },
    });
    await dialog.present();
  }

  async sharePost(): Promise<void> {
    const title = this.item.title || 'My Regen 28 progress';
    const text = this.item.body || title;
    try {
      if (navigator.share) await navigator.share({ title, text });
      else {
        await navigator.clipboard.writeText(title + '\n' + text);
        this.toast.showInfo('Post copied for sharing');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        this.toast.showError('Could not share this post.');
    }
  }

  get imageUrl(): string | null {
    return this.item.media?.images?.[0]?.url || this.item.media?.url || null;
  }

  get hasSpecializedVisual(): boolean {
    return (
      !this.imageUrl &&
      ['trackerEntry', 'statCard', 'milestone', 'journal'].includes(
        this.item.type,
      )
    );
  }

  get displayMetrics() {
    return this.hasSpecializedVisual &&
      ['trackerEntry', 'statCard'].includes(this.item.type)
      ? this.item.metrics?.slice(1)
      : this.item.metrics;
  }

  get timeAgo(): string {
    if (!this.item.createdAt) return '';
    const value = this.item.createdAt;
    const date: Date =
      typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    return Math.floor(seconds / 86400) + 'd';
  }
}
