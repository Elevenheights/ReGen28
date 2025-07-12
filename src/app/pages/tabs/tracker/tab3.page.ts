import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonButton,
  IonIcon,
  IonToast,
  IonModal,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonRange,
  IonLabel,
  IonTextarea,
  IonDatetime,
  IonCheckbox,
  IonAlert
} from '@ionic/angular/standalone';
import { Subject, takeUntil, combineLatest, map, firstValueFrom } from 'rxjs';

// Services
import { TrackerService } from '../../../services/tracker.service';
import { UserService } from '../../../services/user.service';
import { ActivityService } from '../../../services/activity.service';
import { AIRecommendationsService } from '../../../services/ai-recommendations.service';
import { ErrorHandlingService, UIErrorState } from '../../../services/error-handling.service';
import { LoggingService } from '../../../services/logging.service';

// Models
import { Tracker, TrackerEntry, MoodEntry, TrackerType } from '../../../models/tracker.interface';
import { User } from '../../../models/user.interface';

interface TrackerData extends Tracker {
  progress: number;
  streak: number;
  lastEntry?: Date;
  todayCompleted: boolean;
  todayLogCount: number;
  daysRemaining?: number;
}

interface TrackerStats {
  totalSessions: number;
  weeklyCount: number;
  currentStreak: number;
  longestStreak: number;
}

interface LoggingFormData {
  // Core fields
  value: number;
  date: string;
  
  // Optional fields
  mood?: number;
  energy?: number;
  notes?: string;
  duration?: number;
  intensity?: number;
  quality?: number;
  tags?: string[];
  socialContext?: 'alone' | 'with-others' | 'group';
  
  // UI state
  customDateEnabled: boolean;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent,
    IonButton,
    IonIcon,
    IonToast,
    IonModal,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonRange,
    IonLabel,
    IonTextarea,
    IonDatetime,
    IonCheckbox,
    IonAlert
  ],
})
export class Tab3Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  activeTrackers: TrackerData[] = [];
  completedTrackers: TrackerData[] = [];
  suggestedTrackers: any[] = [];
  trackerStats: TrackerStats = {
    totalSessions: 0,
    weeklyCount: 0,
    currentStreak: 0,
    longestStreak: 0
  };
  user: User | null = null;

  // UI State
  isLoading = true;
  showToast = false;
  toastMessage = '';
  
  // Enhanced logging modal state
  selectedTracker: TrackerData | null = null;
  isLogModalOpen = false;
  isSubmittingEntry = false;
  
  // Form data with comprehensive fields
  loggingForm: LoggingFormData = {
    value: 0,
    date: new Date().toISOString().split('T')[0],
    mood: 5,
    energy: 3,
    notes: '',
    duration: 0,
    intensity: 5,
    quality: 5,
    tags: [],
    socialContext: 'alone',
    customDateEnabled: false
  };
  
  // Error handling
  loggingErrorState: UIErrorState = {
    hasError: false,
    errorMessage: '',
    isRetryable: false,
    suggestions: [],
    showEmptyState: false,
    emptyStateMessage: ''
  };

  // Form validation
  formValidation = {
    isValid: true,
    errors: {} as { [key: string]: string }
  };

  constructor(
    private trackerService: TrackerService,
    private userService: UserService,
    private activityService: ActivityService,
    private aiRecommendationsService: AIRecommendationsService,
    private errorHandling: ErrorHandlingService,
    private logging: LoggingService,
    private cdr: ChangeDetectorRef,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadTrackerData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTrackerData() {
    combineLatest([
      this.trackerService.getUserTrackers(),
      this.userService.getCurrentUserProfile()
    ]).pipe(
      takeUntil(this.destroy$),
      map(([trackers, user]) => {
        return {
          trackers: trackers || [],
          user
        };
      })
    ).subscribe({
      next: (data) => {
        this.user = data.user;
        this.processTrackers(data.trackers);
        this.loadSuggestedTrackers();
        this.isLoading = false;
      },
      error: (error) => {
        this.logging.error('Error loading tracker data', { error });
        this.showToastMessage('Error loading trackers');
        this.isLoading = false;
      }
    });
  }

  private processTrackers(trackers: Tracker[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's entries to check completion status
    this.trackerService.getTodaysEntries().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (todaysEntries) => {
        const processed = trackers.filter(tracker => tracker != null).map(tracker => {
          // Ensure we have valid tracker data
          if (!tracker || !tracker.id) {
            this.logging.warn('Invalid tracker data', { tracker });
            return null;
          }

          const progress = this.trackerService.getTrackerProgress(tracker);
          const streak = this.calculateRealTrackerStreak(tracker);
          const todayCompleted = this.checkTodayCompletedWithEntries(tracker, todaysEntries);
          const daysRemaining = this.trackerService.getDaysRemaining(tracker);

          const todayLogCount = this.getTodayLogCount(tracker, todaysEntries);

          return {
            ...tracker,
            progress,
            streak,
            todayCompleted,
            todayLogCount,
            daysRemaining: daysRemaining > 0 ? daysRemaining : undefined
          } as TrackerData;
        }).filter(tracker => tracker !== null) as TrackerData[];

        // Separate active and completed trackers
        this.activeTrackers = processed.filter(t => t.isActive && !t.isCompleted);
        this.completedTrackers = processed.filter(t => t.isCompleted);
        
        // Calculate real stats from actual data
        this.calculateTrackerStats(todaysEntries);
        
        this.logging.debug('Processed trackers', { 
          total: processed.length, 
          active: this.activeTrackers.length, 
          completed: this.completedTrackers.length 
        });
      },
      error: (error) => {
        this.logging.error('Error loading today\'s entries for completion check', { error });
        // Fallback to processing without completion status
        this.processTrackersWithoutEntries(trackers);
      }
    });
  }

  private processTrackersWithoutEntries(trackers: Tracker[]) {
    const processed = trackers.filter(tracker => tracker != null).map(tracker => {
      if (!tracker || !tracker.id) {
        this.logging.warn('Invalid tracker data', { tracker });
        return null;
      }

      const progress = this.trackerService.getTrackerProgress(tracker);
      const streak = this.calculateRealTrackerStreak(tracker);
      const daysRemaining = this.trackerService.getDaysRemaining(tracker);

      return {
        ...tracker,
        progress,
        streak,
        todayCompleted: false, // Cannot determine without entries
        todayLogCount: 0, // Cannot determine without entries
        daysRemaining: daysRemaining > 0 ? daysRemaining : undefined
      } as TrackerData;
    }).filter(tracker => tracker !== null) as TrackerData[];

    this.activeTrackers = processed.filter(t => t.isActive && !t.isCompleted);
    this.completedTrackers = processed.filter(t => t.isCompleted);
  }

  private calculateRealTrackerStreak(tracker: Tracker): number {
    // For now, return 0 - streak calculation should be done via Firebase Functions
    // This avoids fake data and will be implemented properly in the future
    this.logging.debug('Streak calculation not yet implemented - returning 0', { trackerId: tracker.id });
    return 0;
  }

  private checkTodayCompleted(tracker: Tracker): boolean {
    // This would need to check today's entries from TrackerService.getTodaysEntries()
    // For now, return false to avoid fake data - real implementation needs async handling
    this.logging.debug('Today completion check not yet implemented - returning false', { trackerId: tracker.id });
    return false;
  }

  private checkTodayCompletedWithEntries(tracker: Tracker, todaysEntries: TrackerEntry[]): boolean {
    if (!tracker.id) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find entries for this tracker today
    const trackerEntriesToday = todaysEntries.filter(entry => 
      entry.trackerId === tracker.id && entry.date === today
    );

    if (trackerEntriesToday.length === 0) {
      return false; // No entries today
    }

    // Check completion based on tracker type
    switch (tracker.type) {
      case TrackerType.BOOLEAN:
        // For boolean trackers, any entry with value > 0 means completed
        return trackerEntriesToday.some(entry => entry.value > 0);
      
      case TrackerType.COUNT:
      case TrackerType.DURATION:
        // For count/duration trackers, check if target is met
        const totalValue = trackerEntriesToday.reduce((sum, entry) => sum + entry.value, 0);
        return totalValue >= tracker.target;
      
      case TrackerType.RATING:
      case TrackerType.SCALE:
        // For rating/scale trackers, any entry means completed (since it's subjective)
        return trackerEntriesToday.length > 0;
      
      default:
        // Default: check if target is met
        const defaultTotal = trackerEntriesToday.reduce((sum, entry) => sum + entry.value, 0);
        return defaultTotal >= tracker.target;
    }
  }

  private getTodayLogCount(tracker: Tracker, todaysEntries: TrackerEntry[]): number {
    if (!tracker.id) return 0;

    const today = new Date().toISOString().split('T')[0];
    
    // Find entries for this tracker today
    const trackerEntriesToday = todaysEntries.filter(entry => 
      entry.trackerId === tracker.id && entry.date === today
    );

    if (trackerEntriesToday.length === 0) {
      return 0;
    }

    // For boolean trackers, return 1 if completed, 0 if not
    if (tracker.type === TrackerType.BOOLEAN) {
      return trackerEntriesToday.some(entry => entry.value > 0) ? 1 : 0;
    }

    // For other tracker types, sum up all the values
    return trackerEntriesToday.reduce((sum, entry) => sum + entry.value, 0);
  }

  private calculateTrackerStats(todaysEntries: TrackerEntry[]) {
    // Calculate real stats based on actual entries and trackers
    const activeTrackerIds = this.activeTrackers.map(t => t.id);
    
    // Count today's completed trackers
    const todayCompleted = this.activeTrackers.filter(tracker => 
      this.checkTodayCompletedWithEntries(tracker, todaysEntries)
    ).length;

    // Get this week's entries for weekly count
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    // For now, use today's completed count as weekly proxy
    // In the future, this should query entries from the past week
    const weeklyCount = todayCompleted;

    // Current streak is simplified - would need complex calculation across multiple days
    // For now, use 0 until proper streak calculation is implemented
    const currentStreak = 0;

    this.trackerStats = {
      totalSessions: todaysEntries.length,
      weeklyCount: weeklyCount,
      currentStreak: currentStreak,
      longestStreak: 0 // Would need historical analysis
    };

    this.logging.debug('Calculated tracker stats', this.trackerStats);
  }

  private async loadSuggestedTrackers() {
    if (!this.user) return;

    try {
      // Get AI recommendations for new trackers
      const response = await this.aiRecommendationsService.getTrackerRecommendations(
        this.user.focusAreas || [],
        this.user.wellnessGoals || [],
        this.user.commitmentLevel || 'moderate'
      ).toPromise();

      // Filter out already active trackers
      const activeTrackerNames = this.activeTrackers.map(t => t.name.toLowerCase());
      
      if (response && 'recommendations' in response) {
        this.suggestedTrackers = response.recommendations.filter((rec: any) => 
          !activeTrackerNames.includes(rec.name?.toLowerCase())
        ).slice(0, 3); // Show top 3 suggestions
      } else {
        this.suggestedTrackers = [];
      }

    } catch (error) {
      this.logging.error('Error loading suggested trackers', { error });
      // Use fallback suggestions
      this.suggestedTrackers = [
        {
          name: 'Sleep Quality',
          category: 'body',
          icon: 'fa-bed',
          description: 'Track your rest and recovery'
        },
        {
          name: 'Water Intake', 
          category: 'body',
          icon: 'fa-glass-water',
          description: 'Stay hydrated throughout the day'
        }
      ];
    }
  }

  // Enhanced Logging Modal Methods
  openLogModal(tracker: TrackerData) {
    this.logging.info('Opening logging modal', { trackerId: tracker.id, trackerName: tracker.name });
    
    // Set the selected tracker first
    this.selectedTracker = tracker;
    
    // Reset form and error states
    this.resetLoggingForm(tracker);
    this.loggingErrorState = this.errorHandling.createSuccessState();
    
    // Trigger change detection to ensure template updates
    this.cdr.detectChanges();
    
    // Open the modal
    this.isLogModalOpen = true;
    
    // Trigger change detection again after opening
    this.cdr.detectChanges();
    
    this.logging.info('Modal opened', { 
      trackerId: tracker.id, 
      trackerName: tracker.name,
      selectedTracker: this.selectedTracker?.name,
      modalOpen: this.isLogModalOpen 
    });
  }

  closeLogModal() {
    this.isLogModalOpen = false;
    this.selectedTracker = null;
    this.resetLoggingForm();
    this.loggingErrorState = this.errorHandling.createSuccessState();
  }

  private resetLoggingForm(tracker?: TrackerData) {
    const today = new Date().toISOString().split('T')[0];
    
    this.loggingForm = {
      value: tracker?.target || 1,
      date: today,
      mood: 5,
      energy: 3,
      notes: '',
      duration: tracker?.target || 30,
      intensity: 5,
      quality: 5,
      tags: [],
      socialContext: 'alone',
      customDateEnabled: false
    };

    // Reset validation
    this.formValidation = {
      isValid: true,
      errors: {}
    };
  }

  // Form validation
  private validateForm(): boolean {
    const errors: { [key: string]: string } = {};
    let isValid = true;

    if (!this.selectedTracker) {
      errors['general'] = 'No tracker selected';
      isValid = false;
    }

    if (this.loggingForm.value < 0) {
      errors['value'] = 'Value cannot be negative';
      isValid = false;
    }

    if (this.selectedTracker?.type === TrackerType.DURATION && this.loggingForm.value > 1440) {
      errors['value'] = 'Duration cannot exceed 24 hours (1440 minutes)';
      isValid = false;
    }

    if (this.loggingForm.notes && this.loggingForm.notes.length > 500) {
      errors['notes'] = 'Notes cannot exceed 500 characters';
      isValid = false;
    }

    // Date validation
    const selectedDate = new Date(this.loggingForm.date);
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    if (selectedDate > today) {
      errors['date'] = 'Cannot log entries for future dates';
      isValid = false;
    }
    
    if (selectedDate < thirtyDaysAgo) {
      errors['date'] = 'Cannot log entries more than 30 days in the past';
      isValid = false;
    }

    this.formValidation = { isValid, errors };
    return isValid;
  }

  // Enhanced logging with comprehensive error handling
  async logTrackerEntry() {
    if (!this.selectedTracker || this.isSubmittingEntry) return;

    // Validate form
    if (!this.validateForm()) {
      this.loggingErrorState = this.errorHandling.createUIErrorState(
        this.errorHandling.createAppError(
          new Error('Form validation failed'),
          'validateTrackerForm'
        ),
        'Please fix the form errors and try again'
      );
      return;
    }

    this.isSubmittingEntry = true;
    this.loggingErrorState = this.errorHandling.createSuccessState();

    try {
      if (this.selectedTracker.category === 'mood') {
        // Log mood entry
        const moodEntry: Omit<MoodEntry, 'id' | 'createdAt'> = {
          userId: this.selectedTracker.userId,
          date: this.loggingForm.date,
          moodLevel: this.loggingForm.mood || 5,
          energy: this.loggingForm.energy || 3,
          notes: this.loggingForm.notes || ''
        };
        
        await this.trackerService.logMoodEntry(moodEntry);
        this.logging.info('Mood entry logged successfully', { date: moodEntry.date, mood: moodEntry.moodLevel });
      } else {
        // Log regular tracker entry with comprehensive data
        const entry: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: this.selectedTracker.userId,
          trackerId: this.selectedTracker.id!,
          value: this.loggingForm.value,
          date: this.loggingForm.date,
          notes: this.loggingForm.notes || '',
          mood: this.shouldShowField('mood') ? this.loggingForm.mood : undefined,
          energy: this.shouldShowField('energy') ? this.loggingForm.energy : undefined,
          duration: this.shouldShowField('duration') ? this.loggingForm.duration : undefined,
          intensity: this.shouldShowField('intensity') ? this.loggingForm.intensity : undefined,
          quality: this.shouldShowField('quality') ? this.loggingForm.quality : undefined,
          socialContext: this.shouldShowField('socialContext') ? this.loggingForm.socialContext : undefined,
          deviceInfo: 'web'
        };
        
        await this.trackerService.logTrackerEntry(entry);
        this.logging.info('Tracker entry logged successfully', { 
          trackerId: entry.trackerId, 
          value: entry.value, 
          date: entry.date 
        });
      }

      // Enhanced success feedback
      await this.showSuccessFeedback(this.selectedTracker, this.loggingForm);
      this.closeLogModal();
      this.loadTrackerData(); // Refresh data

    } catch (error) {
      this.logging.error('Error logging tracker entry', { error, trackerId: this.selectedTracker.id });
      
      const appError = this.errorHandling.createAppError(error, 'logTrackerEntry');
      this.loggingErrorState = this.errorHandling.createUIErrorState(
        appError,
        'Failed to log entry'
      );
    } finally {
      this.isSubmittingEntry = false;
    }
  }

  // Retry logging after error
  async retryLogging() {
    await this.logTrackerEntry();
  }

  // Dynamic field visibility based on tracker type and configuration
  shouldShowField(fieldName: string): boolean {
    if (!this.selectedTracker) {
      return false;
    }

    // Default field visibility based on tracker type
    const fieldConfig = {
      mood: ['mood', 'mind', 'soul'].includes(this.selectedTracker.category),
      energy: ['body', 'mind'].includes(this.selectedTracker.category),
      duration: this.selectedTracker.type === TrackerType.DURATION,
      intensity: ['body', 'mind'].includes(this.selectedTracker.category),
      quality: true, // Always show quality rating
      socialContext: ['mind', 'soul'].includes(this.selectedTracker.category),
      notes: true // Always allow notes
    };

    // Check if tracker has custom logging configuration
    if (this.selectedTracker.config?.loggingFields) {
      const customConfig = this.selectedTracker.config.loggingFields;
      const customFieldConfig = customConfig[fieldName as keyof typeof customConfig];
      // Handle both boolean and object configurations
      return typeof customFieldConfig === 'boolean' ? customFieldConfig : !!customFieldConfig;
    }

    return fieldConfig[fieldName as keyof typeof fieldConfig] || false;
  }

  // Input helpers for different tracker types
  getValueInputConfig() {
    if (!this.selectedTracker) return { min: 0, max: 100, step: 1 };

    switch (this.selectedTracker.type) {
      case TrackerType.DURATION:
        return { min: 0, max: 1440, step: 5 }; // Minutes, up to 24 hours
      case TrackerType.COUNT:
        return { min: 0, max: this.selectedTracker.target * 3, step: 1 };
      case TrackerType.RATING:
        return { min: 1, max: 5, step: 1 };
      case TrackerType.SCALE:
        return { min: 1, max: 10, step: 1 };
      case TrackerType.BOOLEAN:
        return { min: 0, max: 1, step: 1 };
      default:
        return { min: 0, max: this.selectedTracker.target * 2, step: 1 };
    }
  }

  getValueLabel(): string {
    if (!this.selectedTracker) return 'Value';
    
    switch (this.selectedTracker.type) {
      case TrackerType.DURATION:
        return `Duration (${this.selectedTracker.unit})`;
      case TrackerType.COUNT:
        return `Count (${this.selectedTracker.unit})`;
      case TrackerType.RATING:
        return 'Rating (1-5)';
      case TrackerType.SCALE:
        return 'Scale (1-10)';
      case TrackerType.BOOLEAN:
        return 'Completed';
      default:
        return `${this.selectedTracker.name} (${this.selectedTracker.unit})`;
    }
  }

  // Format value for display
  formatValue(value: number): string {
    if (!this.selectedTracker) return value.toString();
    
    switch (this.selectedTracker.type) {
      case TrackerType.DURATION:
        if (this.selectedTracker.unit === 'minutes') {
          const hours = Math.floor(value / 60);
          const minutes = value % 60;
          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return `${value} ${this.selectedTracker.unit}`;
      case TrackerType.BOOLEAN:
        return value > 0 ? 'Yes' : 'No';
      default:
        return `${value} ${this.selectedTracker.unit}`;
    }
  }

  // Quick action methods
  async quickLog(tracker: TrackerData, value?: number) {
    this.selectedTracker = tracker;
    this.resetLoggingForm(tracker);
    
    if (value !== undefined) {
      this.loggingForm.value = value;
    }
    
    // For boolean trackers, directly log completion
    if (tracker.type === TrackerType.BOOLEAN) {
      this.loggingForm.value = 1;
      await this.logTrackerEntry();
      return;
    }
    
    // For other types, open modal for more details
    this.openLogModal(tracker);
  }

  async addSuggestedTracker(suggestion: any) {
    if (!this.user) return;

    try {
      const newTracker: Omit<Tracker, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: this.user.id,
        name: suggestion.name,
        category: suggestion.category,
        type: suggestion.type || 'count',
        target: suggestion.target || 1,
        unit: suggestion.unit || 'times',
        frequency: suggestion.frequency || 'daily',
        color: suggestion.color || '#6b7280',
        icon: suggestion.icon || 'fa-circle',
        durationDays: 28,
        startDate: new Date(),
        endDate: new Date(Date.now() + (28 * 24 * 60 * 60 * 1000)),
        isCompleted: false,
        timesExtended: 0,
        isOngoing: false,
        isActive: true,
        isDefault: false
      };

      await this.trackerService.createTracker(newTracker);
      this.showToastMessage(`${suggestion.name} added to your trackers! 🎯`);
      this.loadTrackerData(); // Refresh data
    } catch (error) {
      this.logging.error('Error adding tracker', { error });
      this.showToastMessage('Failed to add tracker. Please try again.');
    }
  }

  // Utility methods
  trackByTrackerId(index: number, tracker: TrackerData): string {
    return tracker?.id || index.toString();
  }

  getTrackerIcon(tracker: TrackerData): string {
    return tracker?.icon || 'fa-circle';
  }

  getTrackerColor(tracker: TrackerData): string {
    return tracker?.color || '#6b7280';
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return '#10b981'; // green
    if (progress >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  getCategoryLabel(category: string | null | undefined): string {
    if (!category) return 'General';
    
    const labels: { [key: string]: string } = {
      'mind': 'Mental Wellness',
      'body': 'Physical Health', 
      'soul': 'Emotional Wellness',
      'beauty': 'Self Care',
      'mood': 'Mental Health',
      'lifestyle': 'Life Management'
    };
    
    const normalizedCategory = category.toLowerCase();
    return labels[normalizedCategory] || category;
  }

  navigateToTrackerDetail(tracker: TrackerData) {
    // Navigate to tracker detail page (to be implemented)
    this.router.navigate(['/tracker-detail', tracker.id]);
  }

  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
  }

  onToastDismiss() {
    this.showToast = false;
  }

  // Enhanced success feedback with progress updates and achievements
  private async showSuccessFeedback(tracker: TrackerData, formData: LoggingFormData) {
    const baseMessage = `${tracker.name} logged successfully! 🎉`;
    let enhancedMessage = baseMessage;
    
    // Add value information
    const formattedValue = this.formatValue(formData.value);
    enhancedMessage += `\n📊 Value: ${formattedValue}`;
    
    // Add completion status
    if (tracker.type === TrackerType.BOOLEAN && formData.value > 0) {
      enhancedMessage += `\n✅ Task completed!`;
    } else if (formData.value >= tracker.target) {
      enhancedMessage += `\n🎯 Target reached!`;
    } else {
      const percentage = Math.round((formData.value / tracker.target) * 100);
      enhancedMessage += `\n📈 ${percentage}% of target`;
    }
    
    // Add streak information (when implemented)
    if (tracker.streak > 0) {
      enhancedMessage += `\n🔥 ${tracker.streak} day streak`;
    }
    
    // Add mood context if provided
    if (formData.mood && formData.mood !== 5) {
      const moodEmoji = this.getMoodEmoji(formData.mood);
      enhancedMessage += `\n${moodEmoji} Mood: ${formData.mood}/10`;
    }
    
    // Add energy context if provided
    if (formData.energy && formData.energy !== 3) {
      const energyEmoji = formData.energy >= 4 ? '⚡' : '🔋';
      enhancedMessage += `\n${energyEmoji} Energy: ${formData.energy}/5`;
    }
    
    // Show progress milestone messages
    if (tracker.progress >= 100) {
      enhancedMessage += `\n🏆 Challenge completed! Amazing work!`;
    } else if (tracker.progress >= 75) {
      enhancedMessage += `\n🚀 Almost there! You're doing great!`;
    } else if (tracker.progress >= 50) {
      enhancedMessage += `\n💪 Halfway through! Keep it up!`;
    } else if (tracker.progress >= 25) {
      enhancedMessage += `\n🌱 Building momentum! You've got this!`;
    }
    
    this.showToastMessage(enhancedMessage);
    
    // Log the success for analytics
    this.logging.info('Tracker entry logged with success feedback', {
      trackerId: tracker.id,
      trackerName: tracker.name,
      value: formData.value,
      target: tracker.target,
      progress: tracker.progress,
      streak: tracker.streak,
      mood: formData.mood,
      energy: formData.energy
    });
  }
  
  private getMoodEmoji(mood: number): string {
    if (mood >= 9) return '😄';
    if (mood >= 7) return '😊';
    if (mood >= 5) return '😐';
    if (mood >= 3) return '😔';
    return '😞';
  }

  // Helper method for template to get today's date in ISO string format
  getTodayISOString(): string {
    return new Date().toISOString();
  }
}
