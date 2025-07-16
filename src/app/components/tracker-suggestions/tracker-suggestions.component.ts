import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { IonButton, IonIcon, IonSpinner, IonCard, IonCardContent } from '@ionic/angular/standalone';
import { TrackerSuggestionsService } from '../../services/tracker-suggestions.service';
import { TrackerSpecificSuggestionsResponse } from '../../services/database.service';

export type DisplayMode = 'compact' | 'full';

@Component({
  selector: 'app-tracker-suggestions',
  templateUrl: './tracker-suggestions.component.html',
  styleUrls: ['./tracker-suggestions.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonIcon,
    IonSpinner,
    IonCard,
    IonCardContent
  ]
})
export class TrackerSuggestionsComponent implements OnInit, OnDestroy {
  @Input() trackerId!: string;
  @Input() trackerName?: string;
  @Input() trackerColor?: string;
  @Input() trackerIcon?: string;
  @Input() mode: DisplayMode = 'compact'; // 'compact' for dashboard, 'full' for tracker detail
  @Input() showManualGenerate = false; // true for tracker detail page
  @Output() expandToggle = new EventEmitter<boolean>();

  private destroy$ = new Subject<void>();
  
  suggestions: TrackerSpecificSuggestionsResponse | null = null;
  isLoading = false;
  error: string | null = null;
  expanded = false;

  constructor(
    private trackerSuggestionsService: TrackerSuggestionsService
  ) {}

  ngOnInit() {
    // Subscribe to suggestions state for this tracker
    this.trackerSuggestionsService.getSuggestionsState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const trackerState = state[this.trackerId];
        if (trackerState) {
          this.suggestions = trackerState.suggestions;
          this.isLoading = trackerState.isLoading;
          this.error = trackerState.error;
        }
      });

    // Load suggestions if not already available
    this.loadSuggestions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadSuggestions() {
    if (!this.suggestions && !this.isLoading) {
      await this.trackerSuggestionsService.loadSuggestionsForTracker(this.trackerId);
    }
  }

  async generateSuggestions() {
    await this.trackerSuggestionsService.generateSuggestionsForTracker(this.trackerId);
  }

  toggleExpanded() {
    this.expanded = !this.expanded;
    this.expandToggle.emit(this.expanded);
  }

  hasSuggestionsForToday(): boolean {
    return this.trackerSuggestionsService.hasSuggestionsForToday(this.trackerId);
  }
} 