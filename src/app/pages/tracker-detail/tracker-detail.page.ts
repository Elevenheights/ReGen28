import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonList,
  IonListHeader,
  IonChip,
  IonBadge,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  InfiniteScrollCustomEvent,
  AlertController
} from '@ionic/angular/standalone';

// Components
import { TrackerSuggestionsComponent } from '../../components/tracker-suggestions/tracker-suggestions.component';
import { Subject, takeUntil, firstValueFrom, map } from 'rxjs';

// Services
import { TrackerService } from '../../services/tracker.service';
import { LoggingService } from '../../services/logging.service';
import { LoggingModalService } from '../../services/logging-modal.service';
import { ErrorHandlingService, UIErrorState } from '../../services/error-handling.service';
import { DatabaseService, TrackerSpecificSuggestionsResponse } from '../../services/database.service';
import { TrackerSuggestionsService } from '../../services/tracker-suggestions.service';

// Models
import { Tracker, TrackerEntry, TrackerType } from '../../models/tracker.interface';

interface GroupedEntries {
  date: string;
  entries: TrackerEntry[];
  dailyTotal: number;
  dailyAverage: number;
}

interface TodayAction {
  text: string;
  icon: string;
  reason: string;
}

interface TrackerSuggestion {
  text: string;
  type: string;
  icon: string;
  dataPoint: string;
}

interface MotivationalQuote {
  text: string;
  author: string;
  context: string;
}

@Component({
  selector: 'app-tracker-detail',
  templateUrl: './tracker-detail.page.html',
  styleUrls: ['./tracker-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonItem,
    IonList,
    IonListHeader,
    IonChip,
    IonBadge,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TrackerSuggestionsComponent
  ],
})
export class TrackerDetailPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  tracker: Tracker | null = null;
  allEntries: TrackerEntry[] = [];
  displayedEntries: TrackerEntry[] = [];
  groupedEntries: GroupedEntries[] = [];
  
  // UI State
  isLoading = true;
  viewMode: 'list' | 'grouped' = 'grouped';
  searchTerm = '';
  sortOrder: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest';
  
  // Pagination
  currentPage = 0;
  pageSize = 20;
  hasMoreData = true;

  // Stats
  totalEntries = 0;
  averageValue = 0;
  highestValue = 0;
  lowestValue = 0;
  currentStreak = 0;
  longestStreak = 0;

  // Legacy suggestion properties (will be removed)
  todayAction: TodayAction | null = null;
  legacyTrackerSuggestions: TrackerSuggestion[] = [];
  motivationalQuote: MotivationalQuote | null = null;
  suggestionsState: UIErrorState = {
    hasError: false,
    errorMessage: '',
    isRetryable: false,
    suggestions: [],
    showEmptyState: false,
    emptyStateMessage: ''
  };
  isSuggestionsLoading = false;



  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private trackerService: TrackerService,
    private logging: LoggingService,
    private loggingModalService: LoggingModalService,
    private errorHandling: ErrorHandlingService,
    private db: DatabaseService,
    private alertController: AlertController,
    private trackerSuggestions: TrackerSuggestionsService
  ) {}

  ngOnInit() {
    const trackerId = this.route.snapshot.paramMap.get('id');
    if (trackerId) {
      this.loadTrackerDetail(trackerId);
    } else {
      this.router.navigate(['/tabs/tracker']);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadTrackerDetail(trackerId: string) {
    try {
      this.isLoading = true;

      // Load tracker info
      const tracker = await firstValueFrom(
        this.trackerService.getTracker(trackerId).pipe(takeUntil(this.destroy$))
      );

      if (!tracker) {
        this.router.navigate(['/tabs/tracker']);
        return;
      }

      this.tracker = tracker;

      // Load all entries for this tracker
      await this.loadAllEntries(trackerId);
      
      // Calculate stats
      this.calculateStats();
      
      // Process entries for display
      this.processEntriesForDisplay();

      // Load tracker-specific suggestions using the shared service
      this.trackerSuggestions.loadSuggestionsForTracker(trackerId);

    } catch (error) {
      this.logging.error('Error loading tracker detail', { trackerId, error });
      this.router.navigate(['/tabs/tracker']);
    } finally {
      this.isLoading = false;
    }
  }

  private async loadAllEntries(trackerId: string) {
    try {
      // Load entries in chunks to avoid overwhelming the UI
      let allLoaded = false;
      let currentLimit = 100;
      
      while (!allLoaded) {
        const entries = await firstValueFrom(
          this.trackerService.getTrackerEntries(trackerId, currentLimit)
            .pipe(takeUntil(this.destroy$))
        );
        
        this.allEntries = entries;
        
        // Log sample entry for debugging date format issues
        if (entries.length > 0) {
          console.log('Sample tracker entry:', entries[0]);
          console.log('Entry date:', entries[0].date, 'Type:', typeof entries[0].date);
          console.log('Entry createdAt:', entries[0].createdAt, 'Type:', typeof entries[0].createdAt);
          
          // Test time formatting with the actual data
          console.log('Formatted time test:', this.formatTime(entries[0].createdAt));
          
          // If it's an object, log its properties
          if (entries[0].createdAt && typeof entries[0].createdAt === 'object') {
            console.log('CreatedAt object properties:', Object.keys(entries[0].createdAt));
            const createdAtAny = entries[0].createdAt as any;
            if (createdAtAny.seconds) {
              console.log('Firestore timestamp seconds:', createdAtAny.seconds);
            }
          }
        }
        
        // If we got fewer entries than requested, we've loaded everything
        if (entries.length < currentLimit) {
          allLoaded = true;
        } else {
          currentLimit += 100;
        }
      }
    } catch (error) {
      this.logging.error('Error loading tracker entries', { trackerId, error });
      throw error;
    }
  }

  private calculateStats() {
    if (this.allEntries.length === 0) {
      this.totalEntries = 0;
      this.averageValue = 0;
      this.highestValue = 0;
      this.lowestValue = 0;
      this.currentStreak = 0;
      this.longestStreak = 0;
      return;
    }

    this.totalEntries = this.allEntries.length;
    
    const values = this.allEntries.map(entry => entry.value);
    this.averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;
    this.highestValue = Math.max(...values);
    this.lowestValue = Math.min(...values);
    
    // Use frequency-aware streak calculation
    if (this.tracker) {
      const streakData = this.trackerService.calculateFrequencyAwareStreak(this.tracker, this.allEntries);
      this.currentStreak = streakData.currentStreak;
      this.longestStreak = streakData.longestStreak;
    } else {
      this.currentStreak = 0;
      this.longestStreak = 0;
    }
  }

  private processEntriesForDisplay() {
    // Apply search filter
    let filteredEntries = this.allEntries;
    
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredEntries = this.allEntries.filter(entry =>
        entry.notes?.toLowerCase().includes(searchLower) ||
        entry.date.includes(searchLower)
      );
    }

    // Apply sorting
    filteredEntries = this.sortEntries(filteredEntries);

    if (this.viewMode === 'grouped') {
      this.groupedEntries = this.groupEntriesByDate(filteredEntries);
    } else {
      this.displayedEntries = filteredEntries.slice(0, (this.currentPage + 1) * this.pageSize);
    }
  }

  private sortEntries(entries: TrackerEntry[]): TrackerEntry[] {
    return [...entries].sort((a, b) => {
      switch (this.sortOrder) {
        case 'newest':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'highest':
          return b.value - a.value;
        case 'lowest':
          return a.value - b.value;
        default:
          return 0;
      }
    });
  }

  private groupEntriesByDate(entries: TrackerEntry[]): GroupedEntries[] {
    const groups = new Map<string, TrackerEntry[]>();
    
    entries.forEach(entry => {
      // Normalize the date to ensure it's in YYYY-MM-DD format
      const normalizedDate = this.normalizeDateString(entry.date);
      if (!groups.has(normalizedDate)) {
        groups.set(normalizedDate, []);
      }
      groups.get(normalizedDate)!.push(entry);
    });

    return Array.from(groups.entries()).map(([date, entries]) => {
      const dailyTotal = entries.reduce((sum, entry) => sum + entry.value, 0);
      const dailyAverage = dailyTotal / entries.length;
      
      return {
        date,
        entries: entries.sort((a, b) => {
          try {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          } catch (error) {
            console.warn('Error sorting entries by createdAt:', error);
            return 0;
          }
        }),
        dailyTotal,
        dailyAverage
      };
    }).sort((a, b) => {
      try {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } catch (error) {
        console.warn('Error sorting groups by date:', error);
        return 0;
      }
    });
  }

  // Helper method to normalize date strings
  private normalizeDateString(dateInput: any): string {
    try {
      if (!dateInput) {
        return new Date().toISOString().split('T')[0]; // Default to today
      }
      
      if (typeof dateInput === 'string') {
        // If it's already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          return dateInput;
        }
        // If it's an ISO string, extract the date part
        if (dateInput.includes('T')) {
          return dateInput.split('T')[0];
        }
        // Try to parse and format
        const date = new Date(dateInput);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      
      if (dateInput instanceof Date) {
        return dateInput.toISOString().split('T')[0];
      }

      // If it has seconds property (Firestore timestamp)
      if (dateInput && typeof dateInput === 'object' && dateInput.seconds) {
        const date = new Date(dateInput.seconds * 1000);
        return date.toISOString().split('T')[0];
      }
      
      console.warn('Could not normalize date:', dateInput);
      return new Date().toISOString().split('T')[0]; // Fallback to today
      
    } catch (error) {
      console.error('Error normalizing date:', dateInput, error);
      return new Date().toISOString().split('T')[0];
    }
  }

  // Event handlers
  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.currentPage = 0;
    this.processEntriesForDisplay();
  }

  onViewModeChange(event: any) {
    this.viewMode = event.detail.value;
    this.processEntriesForDisplay();
  }

  onSortOrderChange(event: any) {
    this.sortOrder = event.detail.value;
    this.processEntriesForDisplay();
  }

  onInfiniteScroll(event: InfiniteScrollCustomEvent) {
    if (this.viewMode === 'list' && this.hasMoreData) {
      this.currentPage++;
      const newDisplayed = this.sortEntries(this.allEntries)
        .slice(0, (this.currentPage + 1) * this.pageSize);
      
      this.displayedEntries = newDisplayed;
      
      if (this.displayedEntries.length >= this.allEntries.length) {
        this.hasMoreData = false;
      }
    }
    
    event.target.complete();
  }

  // Utility methods
  formatValue(value: number): string {
    if (!this.tracker) return value.toString();
    
    switch (this.tracker.type) {
      case TrackerType.DURATION:
        if (this.tracker.unit === 'minutes') {
          const hours = Math.floor(value / 60);
          const minutes = value % 60;
          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return `${value} ${this.tracker.unit}`;
      case TrackerType.BOOLEAN:
        return value > 0 ? 'Yes' : 'No';
      default:
        return `${value} ${this.tracker.unit}`;
    }
  }

  formatDate(dateString: string): string {
    try {
      // Handle null/undefined/empty strings
      if (!dateString) {
        return 'Unknown Date';
      }

      // Parse the date string (expecting YYYY-MM-DD format)
      let date: Date;
      
      if (dateString.includes('T')) {
        // If it's an ISO string with time
        date = new Date(dateString);
      } else {
        // If it's just YYYY-MM-DD format, add time to avoid timezone issues
        date = new Date(dateString + 'T00:00:00');
      }

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Invalid Date';
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const entryDate = new Date(date);
      entryDate.setHours(0, 0, 0, 0);

      if (entryDate.getTime() === today.getTime()) {
        return 'Today';
      } else if (entryDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  }

  formatTime(date: Date | string | any): string {
    try {
      // Handle different input types
      let dateObj: Date;
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (date && typeof date === 'object') {
        // Handle Firestore timestamp objects
        if (date.seconds) {
          dateObj = new Date(date.seconds * 1000);
        } else if (date.toDate && typeof date.toDate === 'function') {
          dateObj = date.toDate();
        } else {
          console.warn('Unknown time object format:', date);
          return 'Unknown Time';
        }
      } else {
        console.warn('Unsupported time format:', date, typeof date);
        return 'Unknown Time';
      }

      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date for time formatting:', date);
        return 'Invalid Time';
      }

      return dateObj.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', date, error);
      return 'Invalid Time';
    }
  }

  getProgressColor(value: number): string {
    if (!this.tracker) return '#6b7280';
    
    const percentage = (value / this.tracker.target) * 100;
    if (percentage >= 100) return '#10b981'; // green
    if (percentage >= 80) return '#f59e0b'; // amber
    if (percentage >= 60) return '#3b82f6'; // blue
    return '#6b7280'; // gray
  }

  goBack() {
    // Use browser back for better UX, fallback to specific route
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/tracker']);
    }
  }

  // TrackBy function for ngFor optimization
  trackByEntryId(index: number, entry: TrackerEntry): string {
    return entry.id;
  }

  // Modal handlers
  openLogModal() {
    if (this.tracker) {
      this.loggingModalService.openLogModal(this.tracker, (entry: TrackerEntry) => {
        this.onEntryLogged(entry);
      });
    }
  }

  closeLogModal() {
    this.loggingModalService.closeLogModal();
  }

  async onEntryLogged(entry: TrackerEntry) {
    this.logging.info('Entry logged from detail page', { entry });
    
    // Refresh data to show new entry
    if (this.tracker) {
      await this.loadAllEntries(this.tracker.id);
      // Reload suggestions after new entry using the shared service
      this.trackerSuggestions.loadSuggestionsForTracker(this.tracker.id, true);
    }
  }

  // Load tracker-specific AI suggestions with caching
  private async loadTrackerSpecificSuggestions(trackerId: string): Promise<void> {
    this.isSuggestionsLoading = true;
    this.suggestionsState = {
      hasError: false,
      errorMessage: '',
      isRetryable: false,
      suggestions: [],
      showEmptyState: false,
      emptyStateMessage: 'Loading personalized suggestions...'
    };

    try {
      // Check client-side cache first
      const cachedSuggestions = this.getCachedTrackerSuggestions(trackerId);
      if (cachedSuggestions) {
        this.logging.debug('Using cached tracker suggestions', { trackerId });
        this.setTrackerSuggestionsData(cachedSuggestions);
        this.suggestionsState = this.errorHandling.createSuccessState();
        this.isSuggestionsLoading = false;
        return;
      }

      // No cache found, call Firebase Function
      this.logging.debug('No cached tracker suggestions found, calling Firebase Function', { trackerId });
      const result = await firstValueFrom(this.db.getTrackerSpecificSuggestions(trackerId));
      
      if (result && result.todayAction && result.suggestions && result.motivationalQuote) {
        this.setTrackerSuggestionsData(result);
        this.suggestionsState = this.errorHandling.createSuccessState();
        
        // Cache the result locally
        this.cacheTrackerSuggestions(trackerId, result);
      } else {
        // No suggestions returned - empty state
        this.suggestionsState = this.errorHandling.createEmptyState('No suggestions available for this tracker');
      }
    } catch (error) {
      this.logging.error('Error loading tracker-specific suggestions', { trackerId, error });
      const appError = this.errorHandling.createAppError(error, 'loadTrackerSpecificSuggestions');
      this.suggestionsState = this.errorHandling.createUIErrorState(
        appError,
        'Personalized suggestions unavailable'
      );
      
      // Clear suggestions on error
      this.clearTrackerSuggestionsData();
    } finally {
      this.isSuggestionsLoading = false;
    }
  }

  // Set suggestions data from response
  private setTrackerSuggestionsData(data: TrackerSpecificSuggestionsResponse): void {
    this.todayAction = data.todayAction;
    this.legacyTrackerSuggestions = data.suggestions;
    this.motivationalQuote = data.motivationalQuote;
  }

  // Clear suggestions data
  private clearTrackerSuggestionsData(): void {
    this.todayAction = null;
    this.legacyTrackerSuggestions = [];
    this.motivationalQuote = null;
  }

  // Retry loading suggestions
  async retryTrackerSuggestions(): Promise<void> {
    if (this.tracker) {
      await this.loadTrackerSpecificSuggestions(this.tracker.id);
    }
  }

  // Client-side caching helpers for tracker suggestions
  private getCachedTrackerSuggestions(trackerId: string): TrackerSpecificSuggestionsResponse | null {
    try {
      const today = this.getTodayKey();
      const cacheKey = `tracker_suggestions_${trackerId}_${today}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        // Validate cache structure and date
        if (parsedCache.date === today && parsedCache.todayAction && parsedCache.suggestions && parsedCache.motivationalQuote) {
          return parsedCache;
        }
      }
      
      // Clean up old cache entries for this tracker
      this.cleanupOldTrackerSuggestionsCache(trackerId);
      return null;
    } catch (error) {
      this.logging.error('Error reading tracker suggestions cache', { trackerId, error });
      return null;
    }
  }

  private cacheTrackerSuggestions(trackerId: string, data: TrackerSpecificSuggestionsResponse): void {
    try {
      const today = this.getTodayKey();
      const cacheKey = `tracker_suggestions_${trackerId}_${today}`;
      
      const cacheData = {
        ...data,
        cachedAt: new Date().toISOString()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      this.logging.debug('Cached tracker suggestions locally', { trackerId, today });
    } catch (error) {
      this.logging.error('Error caching tracker suggestions', { trackerId, error });
    }
  }

  private cleanupOldTrackerSuggestionsCache(trackerId: string): void {
    try {
      const today = this.getTodayKey();
      const keysToRemove: string[] = [];
      
      // Check localStorage for old tracker suggestion cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tracker_suggestions_${trackerId}_`)) {
          const dateFromKey = key.replace(`tracker_suggestions_${trackerId}_`, '');
          
          // Remove if not today's cache
          if (dateFromKey !== today) {
            keysToRemove.push(key);
          }
        }
      }
      
      // Remove old entries
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      if (keysToRemove.length > 0) {
        this.logging.debug('Cleaned up old tracker suggestion cache entries', { trackerId, count: keysToRemove.length });
      }
    } catch (error) {
      this.logging.error('Error cleaning up old tracker suggestion cache', { trackerId, error });
    }
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  getTodayName(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Confirm and delete tracker
  async confirmDeleteTracker() {
    if (!this.tracker) return;

    const alert = await this.alertController.create({
      header: 'Delete Tracker',
      message: `Are you sure you want to delete "${this.tracker.name}"? This will permanently remove the tracker and all ${this.totalEntries} entries.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            this.logging.info('User cancelled tracker deletion', { trackerId: this.tracker?.id });
          }
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.deleteTracker();
          }
        }
      ]
    });

    await alert.present();
  }

  // Delete tracker
  async deleteTracker() {
    if (!this.tracker) return;

    try {
      this.logging.info('Deleting tracker from detail page', { 
        trackerId: this.tracker.id, 
        trackerName: this.tracker.name 
      });
      
      // Delete the tracker (this will also delete all entries)
      await this.trackerService.deleteTracker(this.tracker.id);
      
      this.logging.info('Tracker deleted successfully', { trackerId: this.tracker.id });
      
      // Navigate back to tracker list with success message
      this.router.navigate(['/tabs/tracker'], {
        queryParams: { message: `${this.tracker.name} deleted successfully` }
      });
      
    } catch (error) {
      this.logging.error('Failed to delete tracker', { error, trackerId: this.tracker?.id });
      const appError = this.errorHandling.createAppError(error, 'DELETE_TRACKER');
      // Show error feedback (you could add a toast service here)
      console.error('Delete failed:', appError.userMessage);
    }
  }
} 