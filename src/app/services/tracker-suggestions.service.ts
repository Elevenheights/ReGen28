import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { DatabaseService, TrackerSpecificSuggestionsResponse } from './database.service';
import { ErrorHandlingService, UIErrorState } from './error-handling.service';
import { LoggingService } from './logging.service';
import { Auth } from '@angular/fire/auth';

export interface TrackerSuggestionsState {
  [trackerId: string]: {
    suggestions: TrackerSpecificSuggestionsResponse | null;
    isLoading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TrackerSuggestionsService {
  public suggestionsState$ = new BehaviorSubject<TrackerSuggestionsState>({});
  
  constructor(
    private db: DatabaseService,
    private errorHandling: ErrorHandlingService,
    private logging: LoggingService,
    private auth: Auth
  ) {
    this.loadAllCachedSuggestions();
  }

  /**
   * Get suggestions state for all trackers
   */
  getSuggestionsState(): Observable<TrackerSuggestionsState> {
    return this.suggestionsState$.asObservable();
  }

  /**
   * Get suggestions for a specific tracker
   */
  getTrackerSuggestions(trackerId: string): TrackerSpecificSuggestionsResponse | null {
    const state = this.suggestionsState$.value;
    return state[trackerId]?.suggestions || null;
  }

  /**
   * Check if suggestions are loading for a tracker
   */
  isSuggestionsLoading(trackerId: string): boolean {
    const state = this.suggestionsState$.value;
    return state[trackerId]?.isLoading || false;
  }

  /**
   * Get suggestions for multiple trackers (used by dashboard)
   */
  async loadSuggestionsForTrackers(trackerIds: string[]): Promise<void> {
    this.logging.debug('Loading suggestions for trackers', { trackerIds });
    
    const promises = trackerIds.map(async (trackerId) => {
      try {
        await this.loadSuggestionsForTracker(trackerId, false);
      } catch (error) {
        this.logging.error('Failed to load suggestions for tracker', { trackerId, error });
        // Continue with other trackers even if one fails
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Load suggestions for a single tracker with optional force refresh
   */
  async loadSuggestionsForTracker(trackerId: string, forceRefresh = false): Promise<TrackerSpecificSuggestionsResponse | null> {
    const state = this.suggestionsState$.value;
    
    // Set loading state
    this.updateTrackerState(trackerId, {
      isLoading: true,
      error: null
    });

    try {
      // Check cache first unless forcing refresh
      if (!forceRefresh) {
        const cachedSuggestions = this.getCachedSuggestions(trackerId);
        if (cachedSuggestions) {
          // Check if we need to refresh based on database updates
          const shouldRefresh = await this.shouldRefreshCache(trackerId, cachedSuggestions);
          if (!shouldRefresh) {
            this.logging.debug('Using cached suggestions for tracker', { trackerId });
            this.updateTrackerState(trackerId, {
              suggestions: cachedSuggestions,
              isLoading: false,
              lastUpdated: new Date()
            });
            return cachedSuggestions;
          } else {
            this.logging.debug('Cache outdated, refreshing from server', { trackerId });
          }
        }
      }

      // Load from server
      this.logging.debug('Loading suggestions from server for tracker', { trackerId, forceRefresh });
      const result = await firstValueFrom(this.db.getTrackerSpecificSuggestions(trackerId, forceRefresh));
      
      if (result && result.todayAction && result.suggestions && result.motivationalQuote) {
        // Cache the result
        this.cacheSuggestions(trackerId, result);
        
        // Update state
        this.updateTrackerState(trackerId, {
          suggestions: result,
          isLoading: false,
          lastUpdated: new Date(),
          error: null
        });

        this.logging.debug('Successfully loaded suggestions for tracker', { trackerId });
        return result;
      } else {
        throw new Error('Invalid suggestions response from server');
      }

    } catch (error) {
      this.logging.error('Failed to load suggestions for tracker', { trackerId, error });
      
      this.updateTrackerState(trackerId, {
        isLoading: false,
        error: (error as Error).message
      });

      return null;
    }
  }

  /**
   * Manually generate suggestions for a tracker
   */
  async generateSuggestionsForTracker(trackerId: string): Promise<TrackerSpecificSuggestionsResponse | null> {
    this.logging.debug('Manually generating suggestions for tracker', { trackerId });
    return this.loadSuggestionsForTracker(trackerId, true);
  }

  /**
   * Check if suggestions exist for today
   */
  hasSuggestionsForToday(trackerId: string): boolean {
    const suggestions = this.getTrackerSuggestions(trackerId);
    if (!suggestions) return false;

    const today = this.getTodayKey();
    return suggestions.dateKey === today;
  }

  /**
   * Clear suggestions for a tracker
   */
  clearTrackerSuggestions(trackerId: string): void {
    this.updateTrackerState(trackerId, {
      suggestions: null,
      isLoading: false,
      error: null,
      lastUpdated: null
    });

    // Clear cache
    this.clearCachedSuggestions(trackerId);
  }

  /**
   * Clear all suggestions
   */
  clearAllSuggestions(): void {
    this.suggestionsState$.next({});
    this.clearAllCachedSuggestions();
  }

  // Private helper methods

  private updateTrackerState(trackerId: string, updates: Partial<TrackerSuggestionsState[string]>): void {
    const currentState = this.suggestionsState$.value;
    const trackerState = currentState[trackerId] || {
      suggestions: null,
      isLoading: false,
      error: null,
      lastUpdated: null
    };

    this.suggestionsState$.next({
      ...currentState,
      [trackerId]: {
        ...trackerState,
        ...updates
      }
    });
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getCacheKey(trackerId: string): string {
    const today = this.getTodayKey();
    return `tracker_suggestions_${trackerId}_${today}`;
  }

  private getCachedSuggestions(trackerId: string): TrackerSpecificSuggestionsResponse | null {
    try {
      const cacheKey = this.getCacheKey(trackerId);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const today = this.getTodayKey();
        
        // Validate cache structure and date
        if (parsedCache.dateKey === today && 
            parsedCache.todayAction && 
            parsedCache.suggestions && 
            parsedCache.motivationalQuote) {
          return parsedCache;
        }
      }
      
      return null;
    } catch (error) {
      this.logging.error('Error reading cached suggestions', { trackerId, error });
      return null;
    }
  }

  private cacheSuggestions(trackerId: string, data: TrackerSpecificSuggestionsResponse): void {
    try {
      const cacheKey = this.getCacheKey(trackerId);
      const cacheData = {
        ...data,
        cachedAt: new Date().toISOString(),
        // Store the database generation timestamp for comparison
        dbGeneratedAt: data.generatedAt ? (data.generatedAt.toDate ? data.generatedAt.toDate().toISOString() : data.generatedAt) : null
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      this.logging.debug('Cached suggestions for tracker', { trackerId, dbGeneratedAt: cacheData.dbGeneratedAt });
    } catch (error) {
      this.logging.error('Error caching suggestions', { trackerId, error });
    }
  }

  private clearCachedSuggestions(trackerId: string): void {
    try {
      const today = this.getTodayKey();
      const cacheKey = `tracker_suggestions_${trackerId}_${today}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      this.logging.error('Error clearing cached suggestions', { trackerId, error });
    }
  }

  private clearAllCachedSuggestions(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('tracker_suggestions_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      this.logging.error('Error clearing all cached suggestions', { error });
    }
  }

  /**
   * Check if we should refresh the cache by comparing database timestamp
   */
  private async shouldRefreshCache(trackerId: string, cachedData: any): Promise<boolean> {
    try {
      // If we don't have a database timestamp in cache, we should refresh
      if (!cachedData.dbGeneratedAt) {
        this.logging.debug('No database timestamp in cache, refreshing', { trackerId });
        return true;
      }

      // Get the current document from database to check its timestamp
      const today = this.getTodayKey();
      const docId = `${await this.getCurrentUserId()}_${trackerId}_${today}`;
      
      // Use a lightweight check to see if the document exists and get its timestamp
      const result = await firstValueFrom(this.db.checkSuggestionTimestamp(trackerId));
      
      if (result && result.generatedAt) {
        const dbTimestamp = result.generatedAt.toDate ? result.generatedAt.toDate().toISOString() : result.generatedAt;
        const cachedTimestamp = cachedData.dbGeneratedAt;
        
        const shouldRefresh = dbTimestamp !== cachedTimestamp;
        this.logging.debug('Cache timestamp comparison', { 
          trackerId, 
          dbTimestamp, 
          cachedTimestamp, 
          shouldRefresh 
        });
        
        return shouldRefresh;
      }
      
      // If no document exists in database, keep cache
      return false;
      
    } catch (error) {
      this.logging.error('Error checking cache timestamp', { trackerId, error });
      // On error, don't refresh cache to avoid unnecessary API calls
      return false;
    }
  }

  private async getCurrentUserId(): Promise<string> {
    const user = this.auth.currentUser;
    return user?.uid || '';
  }

  private loadAllCachedSuggestions(): void {
    try {
      const keys = Object.keys(localStorage);
      const today = this.getTodayKey();
      
      keys.forEach(key => {
        if (key.startsWith('tracker_suggestions_') && key.endsWith(`_${today}`)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsedCache = JSON.parse(cached);
              if (parsedCache.trackerId) {
                this.updateTrackerState(parsedCache.trackerId, {
                  suggestions: parsedCache,
                  isLoading: false,
                  error: null,
                  lastUpdated: new Date(parsedCache.cachedAt || Date.now())
                });
              }
            }
          } catch (error) {
            this.logging.error('Error loading cached suggestion', { key, error });
          }
        }
      });
    } catch (error) {
      this.logging.error('Error loading all cached suggestions', { error });
    }
  }
} 