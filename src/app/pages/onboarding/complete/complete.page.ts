import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonCard, IonCardContent, 
  IonButton, IonIcon, IonProgressBar, IonText, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, rocketSharp, star, trophy, warning, refresh } from 'ionicons/icons';

import { OnboardingService } from '../../../services/onboarding.service';

@Component({
  selector: 'app-complete',
  templateUrl: './complete.page.html',
  styleUrls: ['./complete.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonCardContent,
    IonButton, IonIcon, IonProgressBar, IonText, IonGrid, IonRow, IonCol
  ]
})
export class CompletePage implements OnInit {
  isCompleting = false;
  onboardingData: any;
  completionError: string | null = null;

  constructor(
    private router: Router,
    private onboardingService: OnboardingService
  ) {
    addIcons({ checkmarkCircle, rocketSharp, star, trophy, warning, refresh });
  }

  ngOnInit() {
    this.onboardingData = this.onboardingService.getCurrentData();
  }

  get progressPercentage() {
    return 100; // Final step
  }

  get selectedFocusAreasCount() {
    return this.onboardingData.wellnessGoals.focusAreas.length;
  }

  get selectedTrackersCount() {
    return this.onboardingData.selectedTrackers.filter((t: any) => t.enabled).length;
  }

  async onStartJourney() {
    this.isCompleting = true;
    this.completionError = null;
    
    try {
      console.log('🎉 Completing onboarding...');
      await this.onboardingService.completeOnboarding();
      console.log('✅ Onboarding completed successfully');
      
      // Navigation is handled by the onboarding service
    } catch (error: any) {
      console.error('❌ Error completing onboarding:', error);
      this.isCompleting = false;
      
      // Show specific error message to user
      this.completionError = error?.message || 'Failed to complete onboarding. Please try again.';
    }
  }

  onPrevious() {
    this.onboardingService.previousStep();
  }

  // Retry completion
  async onRetry() {
    await this.onStartJourney();
  }
}
