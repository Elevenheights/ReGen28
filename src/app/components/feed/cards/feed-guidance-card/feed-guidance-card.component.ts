import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';
import { TrackerSuggestionsService } from 'src/app/services/tracker-suggestions.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-feed-guidance-card',
  templateUrl: './feed-guidance-card.component.html',
  styleUrls: ['./feed-guidance-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedGuidanceCardComponent implements OnInit, OnDestroy {
  @Input() item!: FeedItem;
  
  suggestions: any[] = [];
  isLoading = true;
  currentIndex = 0;
  expandedIndex: number | null = null;
  private sub: Subscription | null = null;

  // Touch/swipe handling
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly SWIPE_THRESHOLD = 50; // Minimum distance for swipe

  constructor(private trackerSuggestionsService: TrackerSuggestionsService) { }

  ngOnInit() {
    this.sub = this.trackerSuggestionsService.getSuggestionsState().subscribe(state => {
      this.isLoading = Object.values(state).some(s => s.isLoading);
      
      // Determine if this is an actions or insights post based on source
      const isActionsPost = this.item.source.id === 'actions';
      const isInsightsPost = this.item.source.id === 'insights';
      
      // Collect suggestions filtered by post type
      const allSuggestions: any[] = [];
      Object.entries(state).forEach(([trackerId, s]) => {
        if (s.suggestions) {
          const trackerName = s.suggestions.trackerInfo?.name || 'Your Tracker';
          const trackerIcon = this.getCategoryIcon(s.suggestions.trackerInfo?.category);
          
          // Add actions if this is the actions post
          if (isActionsPost && s.suggestions.todayAction) {
            allSuggestions.push({
              type: 'action',
              trackerId,
              trackerName,
              trackerIcon,
              content: s.suggestions.todayAction,
              color: 'emerald'
            });
          }
          
          // Add insights if this is the insights post
          if (isInsightsPost && s.suggestions.suggestions && s.suggestions.suggestions.length > 0) {
            // Include all insights
            s.suggestions.suggestions.forEach((suggestion: any) => {
              allSuggestions.push({
                type: 'insight',
                trackerId,
                trackerName,
                trackerIcon,
                content: typeof suggestion === 'string' 
                  ? { text: suggestion } 
                  : suggestion,
                color: 'blue'
              });
            });
          }
        }
      });
      this.suggestions = allSuggestions;

      // Reset index if out of bounds
      if (this.currentIndex >= this.suggestions.length) {
        this.currentIndex = 0;
      }
    });
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  prevSlide(event: Event) {
    event.stopPropagation();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.expandedIndex = null;
    }
  }

  nextSlide(event: Event) {
    event.stopPropagation();
    if (this.currentIndex < this.suggestions.length - 1) {
      this.currentIndex++;
      this.expandedIndex = null;
    }
  }

  goToSlide(index: number) {
    this.currentIndex = index;
    this.expandedIndex = null;
  }

  toggleExpand(index: number) {
    if (this.expandedIndex === index) {
      this.expandedIndex = null;
    } else {
      this.expandedIndex = index;
    }
  }

  isTextLong(text: string): boolean {
    return !!text && text.length > 120;
  }

  hasExpandableContent(card: any): boolean {
    return !!(card.content.reason || card.content.dataPoint || card.content.type || this.isTextLong(card.content.text));
  }

  private getCategoryIcon(category?: string): string {
    if (!category) return '📊';
    
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('mind')) return '🧠';
    if (categoryLower.includes('body')) return '💪';
    if (categoryLower.includes('soul')) return '✨';
    if (categoryLower.includes('beauty')) return '💅';
    return '📊';
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
        if (this.currentIndex < this.suggestions.length - 1) {
          this.currentIndex++;
          this.expandedIndex = null;
        }
      } else {
        // Swiped right - go to previous
        if (this.currentIndex > 0) {
          this.currentIndex--;
          this.expandedIndex = null;
        }
      }
    }
  }
}
