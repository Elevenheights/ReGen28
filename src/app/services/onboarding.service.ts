import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { TrackerService } from './tracker.service';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { AIRecommendationsService } from './ai-recommendations.service';
import { TrackerCategory, TrackerFrequency } from '../models/tracker.interface';

export interface OnboardingData {
  step: number;
  totalSteps: number;
  profileData: {
    displayName?: string;
    gender?: string;
    birthday?: string;
    reminderTime?: string;
    photoUrl?: string;
    preferences?: {
      darkMode?: boolean;
      notifications?: boolean;
    };
  };
  wellnessGoals: {
    focusAreas: TrackerCategory[];
    primaryGoal?: string;
    primaryGoals?: string[]; // New: array of multiple goals
    commitmentLevel?: 'light' | 'moderate' | 'intensive';
  };
  selectedTrackers: {
    trackerId: string;
    enabled: boolean;
    customTarget?: number;
    frequency?: TrackerFrequency; // Updated to use proper enum type
    durationDays?: number; // Duration for tracker challenge (default 28 days)
  }[];
  isComplete: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private onboardingDataSubject = new BehaviorSubject<OnboardingData>({
    step: 1,
    totalSteps: 5,
    profileData: {},
    wellnessGoals: {
      focusAreas: []
    },
    selectedTrackers: [],
    isComplete: false
  });

  public onboardingData$ = this.onboardingDataSubject.asObservable();
  
  // Cache for AI recommendations to avoid duplicate calls
  private cachedRecommendations: string[] | null = null;
  private recommendationsPromise: Promise<string[]> | null = null;

  constructor(
    private router: Router,
    private userService: UserService,
    private trackerService: TrackerService,
    private authService: AuthService,
    private db: DatabaseService,
    private aiRecommendationsService: AIRecommendationsService
  ) {}

  // Initialize onboarding data
  initializeOnboarding(): void {
    const authUser = this.authService.getCurrentUser();
    if (authUser) {
      const initialData: OnboardingData = {
        step: 1,
        totalSteps: 5,
        profileData: {
          displayName: authUser.displayName || ''
        },
        wellnessGoals: {
          focusAreas: []
        },
        selectedTrackers: [],
        isComplete: false
      };
      this.onboardingDataSubject.next(initialData);
    }
  }

  // Get current onboarding data
  getCurrentData(): OnboardingData {
    return this.onboardingDataSubject.value;
  }

  // Update onboarding data
  updateData(updates: Partial<OnboardingData>): void {
    const currentData = this.onboardingDataSubject.value;
    const updatedData = { ...currentData, ...updates };
    this.onboardingDataSubject.next(updatedData);
  }

  // Move to next step
  nextStep(): void {
    const currentData = this.onboardingDataSubject.value;
    
    if (currentData.step < currentData.totalSteps) {
      const newStep = currentData.step + 1;
      this.updateData({ step: newStep });
      this.navigateToStep(newStep);
    }
  }

  // Move to previous step
  previousStep(): void {
    const currentData = this.onboardingDataSubject.value;
    if (currentData.step > 1) {
      this.updateData({ step: currentData.step - 1 });
      this.navigateToStep(currentData.step - 1);
    }
  }

  // Go to specific step
  goToStep(step: number): void {
    const currentData = this.onboardingDataSubject.value;
    if (step >= 1 && step <= currentData.totalSteps) {
      this.updateData({ step });
      this.navigateToStep(step);
    }
  }

  // Navigate to the appropriate onboarding page
  private navigateToStep(step: number): void {
    const routes = [
      '/onboarding/welcome',
      '/onboarding/profile',
      '/onboarding/goals',
      '/onboarding/trackers',
      '/onboarding/complete'
    ];
    
    if (step >= 1 && step <= routes.length) {
      const targetRoute = routes[step - 1];
      this.router.navigate([targetRoute]);
    }
  }

  // Update profile data
  updateProfileData(profileData: Partial<OnboardingData['profileData']>): void {
    const currentData = this.onboardingDataSubject.value;
    this.updateData({
      profileData: { ...currentData.profileData, ...profileData }
    });
  }

  // Update wellness goals
  updateWellnessGoals(goals: Partial<OnboardingData['wellnessGoals']>): void {
    const currentData = this.onboardingDataSubject.value;
    this.updateData({
      wellnessGoals: { ...currentData.wellnessGoals, ...goals }
    });
    
    // Clear cache when goals change
    this.clearRecommendationsCache();
  }

  // Update selected trackers
  updateSelectedTrackers(trackers: OnboardingData['selectedTrackers']): void {
    this.updateData({ selectedTrackers: trackers });
  }

  // Validate current step
  isStepValid(step: number): boolean {
    const data = this.onboardingDataSubject.value;
    
    switch (step) {
      case 1: // Welcome
        return true; // No validation needed
      
      case 2: // Profile
        return !!(data.profileData.displayName && 
                 data.profileData.gender && 
                 data.profileData.birthday && 
                 data.profileData.reminderTime);
      
      case 3: // Goals
        // Support both old single goal system and new multiple goals system
        const hasGoals = (data.wellnessGoals.primaryGoals && data.wellnessGoals.primaryGoals.length > 0) ||
                        !!data.wellnessGoals.primaryGoal;
        return data.wellnessGoals.focusAreas.length > 0 && hasGoals;
      
      case 4: // Trackers
        return data.selectedTrackers.filter(t => t.enabled).length >= 3;
      
      case 5: // Complete
        return this.isStepValid(2) && this.isStepValid(3) && this.isStepValid(4);
      
      default:
        return false;
    }
  }

  // Get recommended trackers based on selected focus areas and goals using AI
  async getRecommendedTrackers(): Promise<string[]> {
    // Return cached recommendations if available
    if (this.cachedRecommendations) {
      console.log('📋 Returning cached AI recommendations:', this.cachedRecommendations);
      return this.cachedRecommendations;
    }

    // Return existing promise if already in progress
    if (this.recommendationsPromise) {
      console.log('⏳ AI recommendations already in progress, waiting...');
      return this.recommendationsPromise;
    }

    // Create new promise for recommendations
    this.recommendationsPromise = this.fetchRecommendations();
    
    try {
      const recommendations = await this.recommendationsPromise;
      this.cachedRecommendations = recommendations;
      console.log('✅ AI recommendations cached:', recommendations);
      return recommendations;
    } catch (error) {
      console.error('❌ Error getting AI recommendations:', error);
      // Clear the promise so it can be retried
      this.recommendationsPromise = null;
      throw error;
    }
  }

  private async fetchRecommendations(): Promise<string[]> {
    const data = this.onboardingDataSubject.value;
    const focusAreas = data.wellnessGoals.focusAreas.map(area => area.toString());
    const goals = data.wellnessGoals.primaryGoals || (data.wellnessGoals.primaryGoal ? [data.wellnessGoals.primaryGoal] : []);
    const commitmentLevel = data.wellnessGoals.commitmentLevel || 'moderate';

    console.log('🤖 Fetching AI recommendations with:', { focusAreas, goals, commitmentLevel });

    try {
      // Call AI service to get personalized recommendations
      const aiResponse = await this.aiRecommendationsService.getTrackerRecommendations(
        focusAreas,
        goals,
        commitmentLevel as 'light' | 'moderate' | 'intensive'
      ).toPromise();

      console.log('✅ AI recommendations received:', aiResponse);

      if (aiResponse && aiResponse.recommendations) {
        // Extract tracker IDs from AI recommendations
        const recommendedTrackerIds = aiResponse.recommendations
          .sort((a, b) => b.priority - a.priority)
          .map(rec => rec.trackerId);
        
        console.log('🎯 Recommended tracker IDs:', recommendedTrackerIds);
        return recommendedTrackerIds;
      }
      
      throw new Error('No recommendations received from AI service');
    } catch (error) {
      console.error('❌ Error getting AI recommendations:', error);
      throw new Error('Failed to get tracker recommendations. Please try again or contact support.');
    }
  }

  // Clear cached recommendations (useful when goals change)
  clearRecommendationsCache(): void {
    console.log('🗑️ Clearing AI recommendations cache');
    this.cachedRecommendations = null;
    this.recommendationsPromise = null;
  }

  // Complete onboarding using Firebase Function
  async completeOnboarding(): Promise<void> {
    const data = this.onboardingDataSubject.value;
    const authUser = this.authService.getCurrentUser();
    
    if (!authUser || !this.isStepValid(5)) {
      throw new Error('Onboarding validation failed');
    }

    try {
      console.log('🎯 OnboardingService: Starting onboarding completion...');
      
      // Call Firebase Function to handle complete onboarding process
      console.log('🎯 OnboardingService: Calling Firebase Function...');
      await firstValueFrom(this.db.callFunction('completeUserOnboarding', {
        profileData: data.profileData,
        wellnessGoals: data.wellnessGoals,
        selectedTrackers: data.selectedTrackers,
        preferences: {
          ...data.profileData.preferences,
          reminderTime: data.profileData.reminderTime || '09:00',
          dailyReminders: data.profileData.preferences?.notifications !== false,
          weeklyReports: true,
          milestoneNotifications: true,
          darkMode: data.profileData.preferences?.darkMode || false,
          language: 'en',
          dataSharing: false,
          analytics: true,
          backupEnabled: true
        }
      }));
      
      console.log('🎯 OnboardingService: Firebase Function completed successfully');
      console.log('🎯 OnboardingService: Real-time database listeners will automatically receive the updated user data');

      // Mark onboarding as complete locally
      this.updateData({ isComplete: true });

      console.log('🎯 OnboardingService: Navigating to dashboard...');
      // Navigate to main app
      this.router.navigate(['/tabs/dashboard']);
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw new Error('Failed to complete onboarding. Please try again or contact support.');
    }
  }

  // Reset onboarding (for testing or re-onboarding)
  resetOnboarding(): void {
    this.initializeOnboarding();
    this.router.navigate(['/onboarding/welcome']);
  }

  // Get progress percentage
  getProgressPercentage(): number {
    const data = this.onboardingDataSubject.value;
    return Math.round((data.step / data.totalSteps) * 100);
  }

  // Check if user can proceed to next step
  canProceedToNext(): boolean {
    const data = this.onboardingDataSubject.value;
    return this.isStepValid(data.step);
  }

  // Skip onboarding (minimal setup)
  async skipOnboarding(): Promise<void> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    try {
      // Create minimal user profile with proper completion flag
      await this.userService.updateUserProfile({
        displayName: authUser.displayName || 'User',
        // Set empty arrays for skipped onboarding
        wellnessGoals: [],
        focusAreas: [],
        commitmentLevel: 'moderate',
        isOnboardingComplete: true,
        // Subscription defaults
        status: 'active', // New users start with trial
        subscriptionType: 'trial', // Everyone gets a trial period
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day trial
        lastActiveAt: new Date(),
        preferences: {
          dailyReminders: true,
          reminderTime: '09:00',
          weeklyReports: true,
          milestoneNotifications: true,
          darkMode: false,
          language: 'en',
          timezone: 'UTC', // Default fallback
          dataSharing: false,
          analytics: true,
          backupEnabled: true
        }
      });

      // Initialize default trackers for the user
      await this.trackerService.initializeUserTrackers();

      // Navigate to main app
      this.router.navigate(['/tabs/dashboard']);
      
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      throw new Error('Failed to set up minimal profile. Please try again or contact support.');
    }
  }
} 