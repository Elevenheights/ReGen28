import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { TrackerService } from './tracker.service';
import { ActivityService } from './activity.service';
import { LoggingService } from './logging.service';
import { ErrorHandlingService } from './error-handling.service';
import { Tracker, TrackerEntry } from '../models/tracker.interface';

interface LoggingModalState {
  isOpen: boolean;
  tracker: Tracker | null;
  onEntryLogged?: (entry: TrackerEntry) => void;
}

@Injectable({
  providedIn: 'root'
})
export class LoggingModalService {
  private modalStateSubject = new BehaviorSubject<LoggingModalState>({
    isOpen: false,
    tracker: null
  });

  public modalState$ = this.modalStateSubject.asObservable();

  constructor(
    private trackerService: TrackerService,
    private activityService: ActivityService,
    private logging: LoggingService,
    private errorHandling: ErrorHandlingService
  ) {}

  /**
   * Open the logging modal for a specific tracker
   */
  openLogModal(tracker: Tracker, onEntryLogged?: (entry: TrackerEntry) => void): void {
    this.logging.info('Opening global logging modal', { trackerId: tracker.id });
    
    this.modalStateSubject.next({
      isOpen: true,
      tracker,
      onEntryLogged
    });
  }

  /**
   * Close the logging modal
   */
  closeLogModal(): void {
    this.modalStateSubject.next({
      isOpen: false,
      tracker: null
    });
  }

  /**
   * Handle entry logging with all the business logic
   */
  async logEntry(entryData: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrackerEntry> {
    try {
      const currentState = this.modalStateSubject.value;
      
      if (!currentState.tracker) {
        throw new Error('No tracker selected for logging');
      }

      this.logging.info('Logging entry via global service', { 
        trackerId: currentState.tracker.id 
      });

      // Use tracker service to log the entry
      const entryId = await this.trackerService.logTrackerEntry(entryData);
      
      // Create the complete entry object
      const loggedEntry: TrackerEntry = {
        ...entryData,
        id: entryId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create activity entry
      await this.activityService.createActivityFromTrackerEntry(
        loggedEntry,
        currentState.tracker.name,
        currentState.tracker.color,
        currentState.tracker.icon,
        currentState.tracker.unit,
        currentState.tracker.category
      );

      this.logging.info('Entry logged successfully via global service', { 
        entryId, 
        trackerId: currentState.tracker.id 
      });

      // Call the callback if provided
      if (currentState.onEntryLogged) {
        currentState.onEntryLogged(loggedEntry);
      }

      // Close the modal
      this.closeLogModal();

      return loggedEntry;

    } catch (error) {
      this.logging.error('Failed to log entry via global service', { error });
      throw this.errorHandling.createAppError(error, 'Failed to log tracker entry');
    }
  }

  /**
   * Get current modal state
   */
  getCurrentState(): LoggingModalState {
    return this.modalStateSubject.value;
  }
} 