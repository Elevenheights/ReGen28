import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
	IonContent,
	IonCard,
	IonCardContent,
	IonButton,
	IonIcon
} from '@ionic/angular/standalone';
import { OnboardingService } from '../../../services/onboarding.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { addIcons } from 'ionicons';
import {
	leaf,
	bulb,
	fitness,
	heart,
	rose,
	time,
	shieldCheckmark,
	rocket
} from 'ionicons/icons';
import { take } from 'rxjs';

@Component({
	selector: 'app-welcome',
	templateUrl: './welcome.page.html',
	styleUrls: ['./welcome.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonContent,
		IonCard,
		IonCardContent,
		IonButton,
		IonIcon
	]
})
export class WelcomePage implements OnInit {
	userName: string = '';

	constructor(
		private router: Router,
		private onboardingService: OnboardingService,
		private authService: AuthService,
		private userService: UserService
	) {
		// Register icons
		addIcons({
			leaf,
			bulb,
			fitness,
			heart,
			rose,
			time,
			shieldCheckmark,
			rocket
		});
	}

	ngOnInit() {
		// Initialize onboarding
		this.onboardingService.initializeOnboarding();

		// Get user name for personalization
		const authUser = this.authService.getCurrentUser();
		this.userName = authUser?.displayName || authUser?.email?.split('@')[0] || 'there';
	}

	async onGetStarted() {
		console.log('🚀 Let\'s Get Started button clicked!');
		const currentUser = this.authService.getCurrentUser();
		console.log('Current user:', currentUser);

		if (!currentUser) {
			console.error('❌ No authenticated user found');
			this.router.navigate(['/login']);
			return;
		}

		try {
			// Check if user profile already exists (created during registration)
			const existingProfile = await this.userService.getCurrentUserProfile().pipe(take(1)).toPromise();

			if (!existingProfile) {
				console.log('📝 No user profile found, creating basic user profile for onboarding...');

				// Create basic user profile but DON'T mark onboarding complete yet
				await this.userService.createUserProfile({
					id: currentUser.uid,
					email: currentUser.email || '',
					displayName: currentUser.displayName || '',
					photoURL: currentUser.photoURL || '',
					joinDate: new Date(),
					currentDay: 1,
					streakCount: 0,
					isOnboardingComplete: false, // NOT complete yet - will complete after onboarding
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
						backupEnabled: true,
						schedule: {
							wakeTime: "06:00",
							midDayTime: "12:00",
							bedTime: "22:00"
						}
					},
					stats: {
						totalTrackerEntries: 0,
						totalJournalEntries: 0,
						completedTrackers: 0,
						currentStreaks: 0,
						longestStreak: 0,
						weeklyActivityScore: 0,
						monthlyGoalsCompleted: 0
					},
					createdAt: new Date(),
					updatedAt: new Date()
				});

				console.log('✅ Basic user profile created');
			} else {
				console.log('✅ User profile already exists, proceeding with onboarding');
			}

			// Initialize onboarding and move to next step
			console.log('🔄 Starting onboarding flow...');
			this.onboardingService.initializeOnboarding();
			this.onboardingService.nextStep(); // Go to profile page

		} catch (error) {
			console.error('❌ Error during onboarding initialization:', error);
			this.router.navigate(['/tabs/dashboard']);
		}
	}

	async onSkipOnboarding() {
		console.log('⏭️ Skip onboarding clicked...');
		const currentUser = this.authService.getCurrentUser();

		if (!currentUser) {
			console.error('❌ No authenticated user found');
			this.router.navigate(['/login']);
			return;
		}

		try {
			// Check if user profile already exists (created during registration)
			const existingProfile = await this.userService.getCurrentUserProfile().pipe(take(1)).toPromise();

			if (!existingProfile) {
				console.log('📝 No user profile found, creating minimal user profile and skipping onboarding...');

				// Create complete user profile and mark onboarding as complete
				await this.userService.createUserProfile({
					id: currentUser.uid,
					email: currentUser.email || '',
					displayName: currentUser.displayName || 'User',
					photoURL: currentUser.photoURL || '',
					joinDate: new Date(),
					currentDay: 1,
					streakCount: 0,
					isOnboardingComplete: true, // Skip - mark as complete immediately
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
						backupEnabled: true,
						schedule: {
							wakeTime: "06:00",
							midDayTime: "12:00",
							bedTime: "22:00"
						}
					},
					stats: {
						totalTrackerEntries: 0,
						totalJournalEntries: 0,
						completedTrackers: 0,
						currentStreaks: 0,
						longestStreak: 0,
						weeklyActivityScore: 0,
						monthlyGoalsCompleted: 0
					},
					createdAt: new Date(),
					updatedAt: new Date()
				});

				console.log('✅ Minimal user profile created and onboarding skipped');
			} else {
				console.log('✅ User profile already exists, updating to mark onboarding complete');

				// Update existing profile to mark onboarding as complete
				await this.userService.updateUserProfile({
					isOnboardingComplete: true
				});

				console.log('✅ Onboarding marked as complete');
			}

			console.log('🏠 Navigating to dashboard');
			this.router.navigate(['/tabs/dashboard']);

		} catch (error) {
			console.error('❌ Error skipping onboarding:', error);
			this.router.navigate(['/tabs/dashboard']);
		}
	}
} 