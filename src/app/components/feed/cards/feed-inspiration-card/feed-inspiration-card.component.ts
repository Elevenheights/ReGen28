import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { TrackerSuggestionsService } from 'src/app/services/tracker-suggestions.service';
import { Subscription } from 'rxjs';

export interface InspirationQuote {
  text: string;
  author: string;
  context?: string;
}

@Component({
  selector: 'app-feed-inspiration-card',
  templateUrl: './feed-inspiration-card.component.html',
  styleUrls: ['./feed-inspiration-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedInspirationCardComponent implements OnInit, OnDestroy {
  @Input() item!: FeedItem;
  
  quotes: InspirationQuote[] = [];
  currentIndex = 0;
  isTransitioning = false;
  private sub: Subscription | null = null;

  // Touch/swipe handling
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly SWIPE_THRESHOLD = 50; // Minimum distance for swipe

  constructor(private trackerSuggestionsService: TrackerSuggestionsService) {}

  ngOnInit() {
    this.sub = this.trackerSuggestionsService.getSuggestionsState().subscribe(state => {
      const collected: InspirationQuote[] = [];

      Object.values(state).forEach((trackerState: any) => {
        if (trackerState?.suggestions?.motivationalQuote) {
          collected.push(trackerState.suggestions.motivationalQuote);
        }
      });

      this.quotes = collected;

      // Reset index if out of bounds
      if (this.currentIndex >= this.quotes.length) {
        this.currentIndex = 0;
      }
    });
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  get currentQuote(): InspirationQuote | null {
    return this.quotes[this.currentIndex] || null;
  }

  prevQuote(event: Event) {
    event.stopPropagation();
    if (this.currentIndex > 0) {
      this.isTransitioning = true;
      setTimeout(() => {
        this.currentIndex--;
        this.isTransitioning = false;
      }, 200);
    }
  }

  nextQuote(event: Event) {
    event.stopPropagation();
    if (this.currentIndex < this.quotes.length - 1) {
      this.isTransitioning = true;
      setTimeout(() => {
        this.currentIndex++;
        this.isTransitioning = false;
      }, 200);
    }
  }

  goToQuote(index: number) {
    if (index !== this.currentIndex && index >= 0 && index < this.quotes.length) {
      this.isTransitioning = true;
      setTimeout(() => {
        this.currentIndex = index;
        this.isTransitioning = false;
      }, 200);
    }
  }

  // Touch event handlers for swipe
  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeDistance = this.touchStartX - this.touchEndX;
    
    if (Math.abs(swipeDistance) > this.SWIPE_THRESHOLD) {
      if (swipeDistance > 0) {
        // Swiped left - go to next
        if (this.currentIndex < this.quotes.length - 1) {
          this.isTransitioning = true;
          setTimeout(() => {
            this.currentIndex++;
            this.isTransitioning = false;
          }, 200);
        }
      } else {
        // Swiped right - go to previous
        if (this.currentIndex > 0) {
          this.isTransitioning = true;
          setTimeout(() => {
            this.currentIndex--;
            this.isTransitioning = false;
          }, 200);
        }
      }
    }
  }
}
