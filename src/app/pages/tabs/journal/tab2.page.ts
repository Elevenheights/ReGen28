import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonTextarea,
  IonButton,
  IonIcon,
  IonSpinner,
  IonItem,
  IonLabel,
  IonInput,
  IonNote,
  IonButtons
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Services
import { UserService } from '../../../services/user.service';
import { LoggingService } from '../../../services/logging.service';
import { JournalService } from '../../../services/journal.service';
import { ToastService } from '../../../services/toast.service';

// Models
import { User } from '../../../models/user.interface';
import { JournalEntry, JournalStats, JournalPrompt } from '../../../models/journal.interface';

// Components
import { JournalEntryCardComponent, JournalStatsComponent } from '../../../components/journal';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonTextarea,
    IonButton,
    IonIcon,
    IonSpinner,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonButtons,
    JournalEntryCardComponent,
    JournalStatsComponent
  ]
})
export class Tab2Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // User data
  user: User | null = null;
  
  // Profile image
  profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
  userDisplayName = 'User';

  // Journal data
  journalStats: JournalStats | null = null;
  recentEntries: JournalEntry[] = [];
  journalPrompts: JournalPrompt[] = [];
  dailyPrompt: JournalPrompt | null = null;
  
  // Loading states
  isLoadingStats = true;
  isLoadingEntries = true;
  isLoadingPrompts = true;
  isLoadingDailyPrompt = true;
  isRefreshingPrompts = false;
  
  // AI prompts status
  aiPromptsAvailable = false;
  promptsLastRefreshed: Date | null = null;



  constructor(
    private userService: UserService,
    private logging: LoggingService,
    private journalService: JournalService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadUserProfile();
    this.loadJournalData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserProfile() {
    this.userService.getCurrentUserProfile().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user) => {
        this.user = user;
        this.updateProfileImageUrl();
      },
      error: (error) => {
        this.logging.error('Failed to load user profile', { error });
      }
    });
  }

  private loadJournalData() {
    // Load journal dashboard data (stats and entries)
    this.journalService.getJournalDashboardData().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.journalStats = data.stats;
        this.recentEntries = data.recentEntries;
        this.isLoadingStats = false;
        this.isLoadingEntries = false;
        this.logging.debug('Journal dashboard data loaded', { 
          totalEntries: data.stats.totalEntries,
          recentCount: data.recentEntries.length
        });
      },
      error: (error) => {
        this.logging.error('Failed to load journal dashboard data', { error });
        this.isLoadingStats = false;
        this.isLoadingEntries = false;
      }
    });

    // Load AI-powered prompts
    this.loadAIPrompts();
  }

  private loadAIPrompts() {
    // Load daily prompt with AI
    this.journalService.getDailyPrompt().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (prompt) => {
        this.dailyPrompt = prompt;
        this.isLoadingDailyPrompt = false;
        this.logging.debug('Daily prompt loaded', { 
          promptId: prompt.id,
          isAI: prompt.id.startsWith('ai-')
        });
      },
      error: (error) => {
        this.logging.error('Failed to load daily prompt', { error });
        this.isLoadingDailyPrompt = false;
      }
    });

    // Load reflection prompts with AI
    this.journalService.getJournalPrompts().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (prompts) => {
        this.journalPrompts = prompts;
        this.isLoadingPrompts = false;
        this.aiPromptsAvailable = this.journalService.areAIPromptsAvailable();
        this.promptsLastRefreshed = new Date();
        this.logging.debug('Reflection prompts loaded', { 
          promptCount: prompts.length,
          aiAvailable: this.aiPromptsAvailable
        });
      },
      error: (error) => {
        this.logging.error('Failed to load reflection prompts', { error });
        this.isLoadingPrompts = false;
      }
    });
  }

  private updateProfileImageUrl() {
    if (this.user) {
      this.userDisplayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';
      
      // Use Dicebear avatar with user's name as seed for consistency
      this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
      
      // Use actual photo if available
      if (this.user.photoURL) {
        const photoURL = this.user.photoURL;
        this.profileImageUrl = photoURL;
      }
    }
  }

  onImageError(event: any) {
    // Fallback to Dicebear avatar if image fails to load
    this.logging.debug('Profile image failed to load, using fallback');
    this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
  }

  onImageLoad(event: any) {
    this.logging.debug('Profile image loaded successfully');
  }

  getProfileImageUrl(): string {
    return this.profileImageUrl;
  }

  // Helper methods for template
  formatDate(date: string | Date): string {
    const entryDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return entryDate.toLocaleDateString();
    }
  }

  truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  getMoodEmoji(mood?: number): string {
    if (!mood || mood < 1) return '😊';
    
    if (mood <= 2) return '😢';
    if (mood <= 4) return '😕';
    if (mood <= 6) return '😐';
    if (mood <= 8) return '😊';
    return '😄';
  }

  getCategoryIcon(category?: string): string {
    switch (category?.toLowerCase()) {
      case 'gratitude': return 'fa-heart';
      case 'reflection': return 'fa-star';
      case 'growth': return 'fa-trending-up';
      case 'mindfulness': return 'fa-leaf';
      case 'goals': return 'fa-target';
      case 'relationships': return 'fa-people-group';
      case 'health': return 'fa-dumbbell';
      case 'challenges': return 'fa-shield';
      case 'work': return 'fa-briefcase';
      case 'dreams': return 'fa-moon';
      default: return 'fa-pen';
    }
  }

  // Event handlers
  onWriteNewEntry() {
    this.logging.debug('Write new entry button clicked');
    this.router.navigate(['/journal-entry', 'new']);
  }

  onPromptSelected(prompt: JournalPrompt) {
    this.logging.debug('Journal prompt selected', { promptId: prompt.id });
    this.router.navigate(['/journal-entry', 'new'], { 
      queryParams: { promptId: prompt.id } 
    });
  }

  onViewAllEntries() {
    this.logging.debug('View all entries clicked');
    // TODO: Navigate to full journal entries list
  }

  onSearchEntries() {
    this.logging.debug('Search entries clicked');
    // TODO: Open search modal or navigate to search page
  }

  onEntryClick(entry: JournalEntry) {
    this.logging.debug('Journal entry clicked', { entryId: entry.id });
    this.router.navigate(['/journal-entry', entry.id]);
  }



  async onEntryDelete(entry: JournalEntry) {
    this.logging.debug('Delete entry requested', { entryId: entry.id });
    
    // TODO: Add confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete "${entry.title || 'this entry'}"?`);
    if (!confirmed) return;

    try {
      await this.journalService.deleteJournalEntry(entry.id);
      this.logging.info('Journal entry deleted', { entryId: entry.id });
      // Refresh the journal data to remove the deleted entry
      this.loadJournalData();
      this.toastService.showSuccess('Entry deleted successfully!');
    } catch (error) {
      this.logging.error('Failed to delete journal entry', { entryId: entry.id, error });
      // Error is already handled by the service
    }
  }

  onEntryEdit(entry: JournalEntry) {
    // Navigate to entry in edit mode
    this.router.navigate(['/journal-entry', entry.id], { 
      queryParams: { edit: 'true' } 
    });
  }

  // Refresh AI prompts (force refresh)
  async onRefreshPrompts() {
    // Prevent double clicks
    if (this.isRefreshingPrompts) {
      return;
    }

    this.logging.debug('Refreshing AI prompts');
    this.isRefreshingPrompts = true;
    
    // Force change detection immediately
    this.cdr.detectChanges();

    try {
      // Add a small delay to ensure the animation is visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force refresh AI prompts
      await this.journalService.refreshAIPrompts();
      
      // Reload prompts
      this.loadAIPromptsAfterRefresh();
      
      this.logging.info('AI prompts refreshed successfully');
    } catch (error) {
      this.logging.error('Failed to refresh AI prompts', { error });
      this.isRefreshingPrompts = false;
      this.cdr.detectChanges();
    }
  }

  // Special version of loadAIPrompts used after refresh
  private loadAIPromptsAfterRefresh() {
    let dailyPromptLoaded = false;
    let reflectionPromptsLoaded = false;

    const checkIfBothLoaded = () => {
      if (dailyPromptLoaded && reflectionPromptsLoaded) {
        this.isRefreshingPrompts = false;
        this.cdr.detectChanges();
      }
    };

    // Load daily prompt with AI
    this.journalService.getDailyPrompt().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (prompt) => {
        this.dailyPrompt = prompt;
        dailyPromptLoaded = true;
        checkIfBothLoaded();
        this.logging.debug('Daily prompt loaded after refresh', { 
          promptId: prompt.id,
          isAI: prompt.id.startsWith('ai-')
        });
      },
      error: (error) => {
        this.logging.error('Failed to load daily prompt after refresh', { error });
        dailyPromptLoaded = true;
        checkIfBothLoaded();
      }
    });

    // Load reflection prompts with AI
    this.journalService.getJournalPrompts().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (prompts) => {
        this.journalPrompts = prompts;
        this.aiPromptsAvailable = this.journalService.areAIPromptsAvailable();
        this.promptsLastRefreshed = new Date();
        reflectionPromptsLoaded = true;
        checkIfBothLoaded();
        this.logging.debug('Reflection prompts loaded after refresh', { 
          promptCount: prompts.length,
          aiAvailable: this.aiPromptsAvailable
        });
      },
      error: (error) => {
        this.logging.error('Failed to load reflection prompts after refresh', { error });
        reflectionPromptsLoaded = true;
        checkIfBothLoaded();
      }
    });
  }

  // Get prompt status for debugging/display
  getPromptsStatus() {
    return this.journalService.getAIPromptStatus();
  }

  // Check if prompts are from AI
  isDailyPromptFromAI(): boolean {
    return this.dailyPrompt?.id.startsWith('ai-') || false;
  }

  areReflectionPromptsFromAI(): boolean {
    return this.journalPrompts.some(prompt => prompt.id.startsWith('ai-'));
  }
}
