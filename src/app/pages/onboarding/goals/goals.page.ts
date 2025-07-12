import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonCard, IonCardContent, 
  IonItem, IonLabel, IonButton, IonIcon, IonSelect, IonSelectOption,
  IonProgressBar, IonText, IonCheckbox, IonGrid, IonInput,
  IonRow, IonCol, IonChip, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  sparkles, checkmark, arrowForward, arrowBack,
  leaf, water, moon, sunny, flower, heart, add, close
} from 'ionicons/icons';

import { OnboardingService } from '../../../services/onboarding.service';
import { TrackerCategory } from '../../../models/tracker.interface';

@Component({
  selector: 'app-goals',
  templateUrl: './goals.page.html',
  styleUrls: ['./goals.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardContent,
    IonItem, IonLabel, IonButton, IonIcon, IonSelect, IonSelectOption,
    IonProgressBar, IonText, IonCheckbox, IonInput,
    IonGrid, IonRow, IonCol, IonChip, IonSpinner
  ]
})
export class GoalsPage implements OnInit {
  goalsForm: FormGroup;
  selectedFocusAreas: TrackerCategory[] = [];
  selectedGoals: string[] = [];
  customGoalText: string = '';
  isLoadingRecommendations = false;
  loadingMessage = 'Getting your personalized recommendations...';
  
  focusAreas = [
    {
      category: TrackerCategory.MIND,
      title: 'Mind & Focus',
      subtitle: 'Mental clarity and mindfulness',
      icon: 'leaf',
      color: 'purple',
      description: 'Meditation, focus, stress reduction, mental wellness'
    },
    {
      category: TrackerCategory.BODY,
      title: 'Body & Health',
      subtitle: 'Physical wellness and vitality',
      icon: 'sunny',
      color: 'success',
      description: 'Exercise, sleep, nutrition, physical health'
    },
    {
      category: TrackerCategory.SOUL,
      title: 'Soul & Spirit',
      subtitle: 'Emotional and spiritual growth',
      icon: 'heart',
      color: 'warning',
      description: 'Gratitude, relationships, purpose, spiritual practices'
    },
    {
      category: TrackerCategory.BEAUTY,
      title: 'Beauty & Self-Care',
      subtitle: 'Personal care and confidence',
      icon: 'sparkles',
      color: 'tertiary',
      description: 'Skincare, grooming, self-expression, confidence'
    }
  ];

  primaryGoals = [
    // Goals randomized across categories for natural browsing experience
    { value: 'reduce-stress', label: 'Reduce stress and anxiety' },
    { value: 'self-confidence', label: 'Build self-confidence and self-esteem' },
    { value: 'better-sleep', label: 'Improve sleep quality and rest' },
    { value: 'meaningful-relationships', label: 'Build meaningful relationships and connections' },
    { value: 'digital-detox', label: 'Digital detox and mindful technology use' },
    { value: 'skincare-glow', label: 'Achieve healthy, glowing skin' },
    { value: 'exercise-habits', label: 'Build consistent exercise habits' },
    { value: 'find-purpose', label: 'Find purpose and meaning in life' },
    { value: 'emotional-resilience', label: 'Build emotional resilience and coping skills' },
    { value: 'control-spending', label: 'Control spending and improve financial habits' },
    { value: 'self-care-routine', label: 'Establish consistent self-care routines' },
    { value: 'boost-energy', label: 'Boost energy and reduce fatigue' },
    { value: 'socialize-more', label: 'Socialize more and be more social' },
    { value: 'mental-clarity', label: 'Improve focus and mental clarity' },
    { value: 'healthy-aging', label: 'Embrace healthy aging and wellness' },
    { value: 'mindful-eating', label: 'Develop mindful eating habits' },
    { value: 'practice-gratitude', label: 'Practice gratitude and mindfulness' },
    { value: 'body-positivity', label: 'Improve body image and self-acceptance' },
    { value: 'read-more', label: 'Read more books and expand knowledge' },
    { value: 'spiritual-growth', label: 'Foster spiritual growth and wellness' },
    { value: 'personal-style', label: 'Enhance personal style and self-expression' },
    { value: 'wellness-beauty', label: 'Focus on inner beauty and wellness radiance' }
  ];

  togglePredefinedGoal(goal: any) {
    const goalLabel = goal.label;
    const index = this.selectedGoals.indexOf(goalLabel);
    
    if (index > -1) {
      // Remove goal if already selected
      this.selectedGoals.splice(index, 1);
    } else if (this.selectedGoals.length < 5) {
      // Add goal if under limit
      this.selectedGoals.push(goalLabel);
    }
  }

  addCustomGoal() {
    const customGoal = this.customGoalText?.trim();
    
    if (customGoal && 
        !this.selectedGoals.includes(customGoal) && 
        this.selectedGoals.length < 5) {
      this.selectedGoals.push(customGoal);
      this.customGoalText = '';
    }
  }

  removeGoal(index: number) {
    this.selectedGoals.splice(index, 1);
  }

  isGoalSelected(goalValue: string): boolean {
    const goalLabel = this.primaryGoals.find(g => g.value === goalValue)?.label;
    return this.selectedGoals.includes(goalLabel || '');
  }

  commitmentLevels = [
    {
      value: 'light',
      title: 'Light Touch',
      subtitle: '10-15 minutes daily',
      description: 'Perfect for busy schedules, gentle introduction'
    },
    {
      value: 'moderate',
      title: 'Balanced Approach',
      subtitle: '20-30 minutes daily',
      description: 'Steady progress with manageable commitment'
    },
    {
      value: 'intensive',
      title: 'Deep Transformation',
      subtitle: '30+ minutes daily',
      description: 'Maximum impact, significant lifestyle change'
    }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private onboardingService: OnboardingService
  ) {
    addIcons({ 
      heart, sparkles, checkmark, arrowForward, arrowBack,
      leaf, water, moon, sunny, flower, add, close
    });
    
    this.goalsForm = this.formBuilder.group({
      commitmentLevel: ['moderate', Validators.required]
    });
  }

  ngOnInit() {
    // Pre-populate with existing data
    const onboardingData = this.onboardingService.getCurrentData();
    this.selectedFocusAreas = [...onboardingData.wellnessGoals.focusAreas];
    
    // Handle existing goals data (might be string or array)
    if (onboardingData.wellnessGoals.primaryGoals) {
      this.selectedGoals = Array.isArray(onboardingData.wellnessGoals.primaryGoals) 
        ? [...onboardingData.wellnessGoals.primaryGoals]
        : [onboardingData.wellnessGoals.primaryGoals];
    } else if (onboardingData.wellnessGoals.primaryGoal) {
      // Backward compatibility for single goal
      this.selectedGoals = [onboardingData.wellnessGoals.primaryGoal];
    }
    
    if (onboardingData.wellnessGoals.commitmentLevel) {
      this.goalsForm.patchValue({
        commitmentLevel: onboardingData.wellnessGoals.commitmentLevel
      });
    }
  }

  get progressPercentage() {
    return this.onboardingService.getProgressPercentage();
  }

  get canContinue() {
    return this.selectedFocusAreas.length > 0 && 
           this.selectedGoals.length > 0 && 
           this.goalsForm.valid;
  }

  toggleFocusArea(category: TrackerCategory) {
    const index = this.selectedFocusAreas.indexOf(category);
    if (index > -1) {
      this.selectedFocusAreas.splice(index, 1);
    } else {
      this.selectedFocusAreas.push(category);
    }
  }

  isFocusAreaSelected(category: TrackerCategory): boolean {
    return this.selectedFocusAreas.includes(category);
  }

  onPrevious() {
    this.onboardingService.previousStep();
  }

  async onContinue() {
    if (this.canContinue) {
      const formData = this.goalsForm.value;
      
      // Update onboarding data with multiple goals
      this.onboardingService.updateWellnessGoals({
        focusAreas: this.selectedFocusAreas,
        primaryGoals: this.selectedGoals,
        primaryGoal: this.selectedGoals[0], // Keep first goal for backward compatibility
        commitmentLevel: formData.commitmentLevel
      });

      // Show loading state
      this.isLoadingRecommendations = true;
      this.loadingMessage = 'Analyzing your goals and preferences...';

      try {
        // Pre-fetch AI recommendations and wait for completion
        console.log('🎯 Pre-fetching AI recommendations...');
        const recommendations = await this.onboardingService.getRecommendedTrackers();
        console.log('✅ AI recommendations ready:', recommendations.length, 'trackers');
        
        this.loadingMessage = 'Preparing your personalized tracker selection...';
        
        // Small delay for better UX (let user see the completion message)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now navigate with recommendations ready
        this.onboardingService.nextStep();
      } catch (error) {
        console.error('❌ Error pre-loading recommendations:', error);
        this.loadingMessage = 'Preparing your tracker selection...';
        
        // Continue anyway - trackers page will handle fallback
        await new Promise(resolve => setTimeout(resolve, 500));
        this.onboardingService.nextStep();
      } finally {
        this.isLoadingRecommendations = false;
      }
    }
  }

  getFocusAreaIcon(category: TrackerCategory): string {
    const area = this.focusAreas.find(a => a.category === category);
    return area?.icon || 'checkmark';
  }

  getFocusAreaColor(category: TrackerCategory): string {
    const area = this.focusAreas.find(a => a.category === category);
    return area?.color || 'primary';
  }
}
