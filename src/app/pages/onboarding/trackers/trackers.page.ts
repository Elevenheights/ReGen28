import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
	IonContent, IonCard, IonCardContent,
	IonButton, IonIcon, IonProgressBar, IonText,
	IonGrid, IonRow, IonCol, IonChip
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
	checkmark, arrowForward, arrowBack, add, remove,
	infiniteOutline, trendingUpOutline, refreshOutline
} from 'ionicons/icons';

import { OnboardingService } from '../../../services/onboarding.service';
import { TrackerService } from '../../../services/tracker.service';
import { TrackerFrequency } from '../../../models/tracker.interface';

@Component({
	selector: 'app-trackers',
	templateUrl: './trackers.page.html',
	styleUrls: ['./trackers.page.scss'],
	standalone: true,
	imports: [
		CommonModule, FormsModule,
		IonContent, IonCard, IonCardContent,
		IonButton, IonIcon, IonProgressBar, IonText,
		IonGrid, IonRow, IonCol, IonChip
	]
})
export class TrackersPage implements OnInit {
	selectedTrackers: any[] = [];
	recommendedTrackers: string[] = [];

	availableTrackers = [
		// MIND - Mental wellness and cognitive development
		{ id: 'meditation', name: 'Meditation', category: 'MIND', icon: '🧘', target: 10, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'reading', name: 'Reading', category: 'MIND', icon: '📚', target: 20, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'journaling', name: 'Journaling', category: 'MIND', icon: '📝', target: 1, unit: 'entry', frequency: TrackerFrequency.DAILY },
		{ id: 'learning', name: 'Learning/Study', category: 'MIND', icon: '🎓', target: 2, unit: 'hours', frequency: TrackerFrequency.WEEKLY },
		{ id: 'creative-time', name: 'Creative Activity', category: 'MIND', icon: '🎨', target: 20, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'mindfulness', name: 'Mindful Breathing', category: 'MIND', icon: '🌬️', target: 5, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'focus-session', name: 'Deep Focus Work', category: 'MIND', icon: '🎯', target: 25, unit: 'minutes', frequency: TrackerFrequency.DAILY },

		// BODY - Physical health and fitness
		{ id: 'exercise', name: 'Exercise', category: 'BODY', icon: '💪', target: 4, unit: 'sessions', frequency: TrackerFrequency.WEEKLY },
		{ id: 'water-intake', name: 'Water Intake', category: 'BODY', icon: '💧', target: 8, unit: 'glasses', frequency: TrackerFrequency.DAILY },
		{ id: 'sleep', name: 'Sleep Quality', category: 'BODY', icon: '😴', target: 8, unit: 'hours', frequency: TrackerFrequency.DAILY },
		{ id: 'stretching', name: 'Stretching', category: 'BODY', icon: '🤸', target: 15, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'steps', name: 'Daily Steps', category: 'BODY', icon: '👟', target: 10000, unit: 'steps', frequency: TrackerFrequency.DAILY },
		{ id: 'yoga', name: 'Yoga Practice', category: 'BODY', icon: '🧘‍♀️', target: 3, unit: 'sessions', frequency: TrackerFrequency.WEEKLY },
		{ id: 'healthy-meals', name: 'Healthy Meals', category: 'BODY', icon: '🥗', target: 5, unit: 'meals', frequency: TrackerFrequency.WEEKLY },
		{ id: 'posture-check', name: 'Posture Check', category: 'BODY', icon: '🏃‍♂️', target: 5, unit: 'checks', frequency: TrackerFrequency.DAILY },
		{ id: 'outdoor-time', name: 'Time Outdoors', category: 'BODY', icon: '🌳', target: 30, unit: 'minutes', frequency: TrackerFrequency.DAILY },

		// SOUL - Emotional and spiritual wellness
		{ id: 'gratitude', name: 'Gratitude Practice', category: 'SOUL', icon: '🙏', target: 1, unit: 'entry', frequency: TrackerFrequency.DAILY },
		{ id: 'mood', name: 'Daily Mood', category: 'SOUL', icon: '😊', target: 1, unit: 'check-in', frequency: TrackerFrequency.DAILY },
		{ id: 'social-connection', name: 'Social Connection', category: 'SOUL', icon: '👥', target: 3, unit: 'interactions', frequency: TrackerFrequency.WEEKLY },
		{ id: 'acts-of-kindness', name: 'Acts of Kindness', category: 'SOUL', icon: '💝', target: 2, unit: 'acts', frequency: TrackerFrequency.WEEKLY },
		{ id: 'prayer-reflection', name: 'Prayer/Reflection', category: 'SOUL', icon: '🕊️', target: 10, unit: 'minutes', frequency: TrackerFrequency.DAILY },
		{ id: 'nature-connection', name: 'Nature Connection', category: 'SOUL', icon: '🌿', target: 1, unit: 'hour', frequency: TrackerFrequency.WEEKLY },
		{ id: 'digital-detox', name: 'Digital Detox', category: 'SOUL', icon: '📵', target: 1, unit: 'hour', frequency: TrackerFrequency.DAILY },
		{ id: 'affirmations', name: 'Positive Affirmations', category: 'SOUL', icon: '💭', target: 5, unit: 'affirmations', frequency: TrackerFrequency.DAILY },

		// BEAUTY - Self-care and personal grooming
		{ id: 'skincare', name: 'Skincare Routine', category: 'BEAUTY', icon: '✨', target: 1, unit: 'routine', frequency: TrackerFrequency.DAILY },
		{ id: 'self-care', name: 'Self-Care Time', category: 'BEAUTY', icon: '🛁', target: 2, unit: 'hours', frequency: TrackerFrequency.WEEKLY },
		{ id: 'hair-care', name: 'Hair Care', category: 'BEAUTY', icon: '💇‍♀️', target: 1, unit: 'routine', frequency: TrackerFrequency.WEEKLY },
		{ id: 'nail-care', name: 'Nail Care', category: 'BEAUTY', icon: '💅', target: 1, unit: 'session', frequency: TrackerFrequency.WEEKLY },
		{ id: 'outfit-planning', name: 'Outfit Planning', category: 'BEAUTY', icon: '👗', target: 7, unit: 'outfits', frequency: TrackerFrequency.WEEKLY },
		{ id: 'mirror-work', name: 'Mirror Affirmations', category: 'BEAUTY', icon: '🪞', target: 5, unit: 'minutes', frequency: TrackerFrequency.DAILY },

		// LIFESTYLE - Habits and life management
		{ id: 'budget-tracking', name: 'Budget Tracking', category: 'LIFESTYLE', icon: '💰', target: 7, unit: 'days on budget', frequency: TrackerFrequency.WEEKLY },
		{ id: 'spending-check', name: 'Spending Check-in', category: 'LIFESTYLE', icon: '🧾', target: 1, unit: 'review', frequency: TrackerFrequency.DAILY }
	];

	constructor(
		private router: Router,
		private onboardingService: OnboardingService,
		private trackerService: TrackerService
	) {
		addIcons({
			checkmark, arrowForward, arrowBack, add, remove,
			infiniteOutline, trendingUpOutline, refreshOutline
		});
	}

	async ngOnInit() {
		// Get current onboarding data to check selected focus areas
		const onboardingData = this.onboardingService.getCurrentData();
		const selectedFocusAreas = onboardingData.wellnessGoals.focusAreas;

		console.log('🔍 Onboarding data:', {
			focusAreas: selectedFocusAreas,
			goals: onboardingData.wellnessGoals.primaryGoals,
			commitmentLevel: onboardingData.wellnessGoals.commitmentLevel
		});

		// Get AI-powered recommended trackers (should be cached from goals page)
		try {
			console.log('📋 Getting cached AI recommendations...');
			this.recommendedTrackers = await this.onboardingService.getRecommendedTrackers();
			console.log('✅ Recommendations loaded (from cache):', this.recommendedTrackers);
		} catch (error) {
			console.error('❌ Error loading recommendations:', error);
			// Fallback to basic recommendations
			this.recommendedTrackers = ['meditation', 'exercise', 'mood', 'gratitude', 'water-intake', 'sleep'];
		}

		// Filter available trackers to only show ones matching selected focus areas
		if (selectedFocusAreas.length > 0) {
			this.availableTrackers = this.availableTrackers.filter(tracker => {
				// Always include mood tracking and non-categorized trackers
				if (tracker.category === 'MOOD' || !tracker.category) return true;
				// Include trackers that match selected focus areas
				return selectedFocusAreas.some(area =>
					area.toUpperCase() === tracker.category.toUpperCase()
				);
			});
		} else {
			// If no focus areas are selected, show all trackers but prioritize essential ones
			console.log('⚠️ No focus areas selected, showing all trackers');
		}

		console.log('📋 Available trackers after filtering:', this.availableTrackers.map(t => t.id));
		console.log('⭐ Recommended trackers:', this.recommendedTrackers);

		// Pre-populate with existing data
		this.selectedTrackers = [...onboardingData.selectedTrackers];

		// If no trackers selected, auto-select recommended ones
		if (this.selectedTrackers.length === 0) {
			console.log('🎯 Auto-selecting recommended trackers...');
			this.recommendedTrackers.forEach(trackerId => {
				const tracker = this.availableTrackers.find(t => t.id === trackerId || t.id.includes(trackerId) || trackerId.includes(t.id));
				if (tracker) {
					console.log(`✅ Auto-selecting tracker: ${tracker.name}`);
					this.selectedTrackers.push({
						trackerId: tracker.id,
						enabled: true,
						customTarget: tracker.target,
						frequency: tracker.frequency,
						durationDays: 28 // Default to 28-day challenge
					});
				} else {
					console.log(`❌ Recommended tracker not found: ${trackerId}`);
				}
			});
			console.log('📝 Final auto-selected trackers:', this.selectedTrackers.map(t => t.trackerId));
		}
	}

	get progressPercentage() {
		return this.onboardingService.getProgressPercentage();
	}

	get canContinue() {
		return this.selectedTrackers.filter(t => t.enabled).length >= 3;
	}

	get enabledTrackersCount() {
		return this.selectedTrackers.filter(t => t.enabled).length;
	}

	isTrackerSelected(trackerId: string): boolean {
		const tracker = this.selectedTrackers.find(t => t.trackerId === trackerId);
		return tracker?.enabled || false;
	}

	toggleTracker(tracker: any) {
		const existingIndex = this.selectedTrackers.findIndex(t => t.trackerId === tracker.id);

		if (existingIndex > -1) {
			this.selectedTrackers[existingIndex].enabled = !this.selectedTrackers[existingIndex].enabled;
		} else {
			this.selectedTrackers.push({
				trackerId: tracker.id,
				enabled: true,
				customTarget: tracker.target,
				frequency: tracker.frequency,
				durationDays: 28 // Default to 28-day challenge
			});
		}
	}

	getTrackerTarget(trackerId: string): number {
		const tracker = this.selectedTrackers.find(t => t.trackerId === trackerId);
		const defaultTracker = this.availableTrackers.find(t => t.id === trackerId);
		return tracker?.customTarget || defaultTracker?.target || 1;
	}

	getTrackerDuration(trackerId: string): number {
		const tracker = this.selectedTrackers.find(t => t.trackerId === trackerId);
		return tracker?.durationDays || 28;
	}

	isTrackerOngoing(trackerId: string): boolean {
		const tracker = this.selectedTrackers.find(t => t.trackerId === trackerId);
		return tracker?.durationDays === 0; // 0 days means ongoing
	}

	updateTrackerDuration(trackerId: string, change: number) {
		const trackerIndex = this.selectedTrackers.findIndex(t => t.trackerId === trackerId);
		if (trackerIndex > -1) {
			const currentDuration = this.selectedTrackers[trackerIndex].durationDays || 28;

			// Minimum 7 days, maximum 365 days, or 0 for ongoing
			let newDuration = currentDuration + change;

			// Handle transitions between ongoing (0) and challenge modes
			if (currentDuration === 0 && change > 0) {
				newDuration = 7; // Switch from ongoing to 7-day challenge
			} else if (newDuration <= 0) {
				newDuration = 0; // Switch to ongoing mode
			} else {
				newDuration = Math.min(365, Math.max(7, newDuration));
			}

			this.selectedTrackers[trackerIndex].durationDays = newDuration;
		}
	}

	toggleTrackerMode(trackerId: string) {
		const trackerIndex = this.selectedTrackers.findIndex(t => t.trackerId === trackerId);
		if (trackerIndex > -1) {
			const currentDuration = this.selectedTrackers[trackerIndex].durationDays || 28;
			// Toggle between ongoing (0) and default challenge (28 days)
			this.selectedTrackers[trackerIndex].durationDays = currentDuration === 0 ? 28 : 0;
		}
	}

	getTrackerModeText(trackerId: string): string {
		return this.isTrackerOngoing(trackerId) ? 'Ongoing' : 'Challenge';
	}

	setTrackerMode(trackerId: string, isOngoing: boolean) {
		const trackerIndex = this.selectedTrackers.findIndex(t => t.trackerId === trackerId);
		if (trackerIndex > -1) {
			// Set duration based on mode
			this.selectedTrackers[trackerIndex].durationDays = isOngoing ? 0 : 28;
		}
	}

	setTrackerDuration(trackerId: string, days: number) {
		const trackerIndex = this.selectedTrackers.findIndex(t => t.trackerId === trackerId);
		if (trackerIndex > -1) {
			this.selectedTrackers[trackerIndex].durationDays = days;
		}
	}

	getDurationDescription(days: number): string {
		if (days <= 7) {
			return "Quick habit kickstart";
		} else if (days <= 21) {
			return "Foundation building period";
		} else if (days <= 30) {
			return "Full habit formation cycle";
		} else if (days <= 60) {
			return "Deep habit reinforcement";
		} else if (days <= 90) {
			return "Lifestyle transformation";
		} else {
			return "Long-term commitment";
		}
	}

	updateTrackerTarget(trackerId: string, change: number) {
		const trackerIndex = this.selectedTrackers.findIndex(t => t.trackerId === trackerId);
		if (trackerIndex > -1) {
			const tracker = this.availableTrackers.find(t => t.id === trackerId);
			const increment = this.getTargetIncrement(tracker?.frequency || TrackerFrequency.DAILY);
			const newTarget = Math.max(increment, this.selectedTrackers[trackerIndex].customTarget + (change * increment));
			this.selectedTrackers[trackerIndex].customTarget = newTarget;
		}
	}

	getFrequencyLabel(frequency: TrackerFrequency): string {
		switch (frequency) {
			case TrackerFrequency.DAILY: return 'Daily';
			case TrackerFrequency.WEEKLY: return 'Weekly';
			case TrackerFrequency.MONTHLY: return 'Monthly';
			default: return 'Daily';
		}
	}

	getFrequencyText(frequency: TrackerFrequency): string {
		switch (frequency) {
			case TrackerFrequency.DAILY: return 'per day';
			case TrackerFrequency.WEEKLY: return 'per week';
			case TrackerFrequency.MONTHLY: return 'per month';
			default: return 'per day';
		}
	}

	getTargetIncrement(frequency: TrackerFrequency): number {
		switch (frequency) {
			case TrackerFrequency.DAILY: return 1;
			case TrackerFrequency.WEEKLY: return 1;
			case TrackerFrequency.MONTHLY: return 1;
			default: return 1;
		}
	}

	isRecommended(trackerId: string): boolean {
		return this.recommendedTrackers.some(rec =>
			rec.includes(trackerId) || trackerId.includes(rec)
		);
	}

	onPrevious() {
		this.onboardingService.previousStep();
	}

	onContinue() {
		if (this.canContinue) {
			// Update onboarding data
			this.onboardingService.updateSelectedTrackers(this.selectedTrackers);

			// Move to next step
			this.onboardingService.nextStep();
		}
	}
}
