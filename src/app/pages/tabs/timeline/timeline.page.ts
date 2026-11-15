import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { map } from 'rxjs/operators';
import { FeedListComponent } from '../../../components/feed/feed-list/feed-list.component';
import { UserService } from '../../../services/user.service';

@Component({
  standalone: true,
  selector: 'app-timeline',
  imports: [CommonModule, RouterLink, IonicModule, FeedListComponent],
  templateUrl: './timeline.page.html',
  styleUrls: ['./timeline.page.scss'],
})
export class TimelinePage {
  day$ = this.user
    .getCurrentUserProfile()
    .pipe(
      map((profile) => Math.min(28, Math.max(0, profile?.currentDay || 0))),
    );
  constructor(private user: UserService) {}
  async shareJourney(day: number): Promise<void> {
    const text =
      'Day ' + day + ' of my Regen 28 journey. My pace. My progress.';
    try {
      if (navigator.share)
        await navigator.share({ title: 'My Regen 28 journey', text });
      else await navigator.clipboard.writeText(text);
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        this.shareError = 'Sharing is unavailable. Please try again.';
    }
  }
  shareError = '';
}
