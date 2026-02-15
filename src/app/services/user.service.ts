import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { User, UserStats, UserPreferences } from '../models/user.interface';
import { Observable, map, switchMap, of, take, firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	constructor(
		private storage: Storage,
		private authService: AuthService,
		private db: DatabaseService,
		private errorHandler: ErrorHandlingService,
		private logging: LoggingService
	) {
		// Establish the connection to resolve circular dependency
		// This allows AuthService to call UserService methods when needed
		this.authService.setUserService(this);
	}

	// Get current user profile with real-time updates (no caching)
	getCurrentUserProfile(): Observable<User | null> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) {
					return of(null);
				}

				// Use DatabaseService for real-time updates - no caching
				return this.db.getDocument<User>('users', authUser.uid).pipe(
					map(userData => {
						if (userData) {
							// FORCE ONBOARDING COMPLETE FOR DEV DEBUGGING
							// This fixes the redirect loop for existing users with outdated flags
							userData.isOnboardingComplete = true;
							return userData as User;
						} else {
							// If no Firestore doc exists, return user data from auth
							return {
								id: authUser.uid,
								email: authUser.email || '',
								displayName: authUser.displayName || '',
								photoURL: authUser.photoURL || '',
								joinDate: new Date(),
								currentDay: 1,
								streakCount: 0,
								// Initialize wellness goals and focus areas for fallback
								wellnessGoals: [],
								focusAreas: [],
								commitmentLevel: 'moderate',
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
								isOnboardingComplete: true, // Auto-complete onboarding for fallback/new users during dev
								status: 'active', // New users start with trial
								subscriptionType: 'trial', // Everyone gets a trial period
								trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day trial
								lastActiveAt: new Date(),
								createdAt: new Date(),
								updatedAt: new Date()
							} as User;
						}
					})
				);
			})
		);
	}

	// Create new user profile during registration/onboarding
	async createUserProfile(userData: Partial<User>): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const defaultPreferences: UserPreferences = {
			dailyReminders: true,
			reminderTime: '09:00',
			weeklyReports: true,
			milestoneNotifications: true,
			darkMode: false,
			language: 'en',
			timezone: 'UTC', // Default fallback, should be overridden during onboarding
			dataSharing: false,
			analytics: true,
			backupEnabled: true,
			schedule: {
				wakeTime: "06:00",
				midDayTime: "12:00",
				bedTime: "22:00"
			}
		};

		const defaultStats: UserStats = {
			totalTrackerEntries: 0,
			totalJournalEntries: 0,
			completedTrackers: 0,
			currentStreaks: 0,
			longestStreak: 0,
			weeklyActivityScore: 0,
			monthlyGoalsCompleted: 0
		};

		const userProfile: Omit<User, 'id'> = {
			email: authUser.email || '',
			displayName: authUser.displayName || userData.displayName || '',
			photoURL: authUser.photoURL || userData.photoURL || '',
			joinDate: new Date(),
			currentDay: 1,
			streakCount: 0,
			// Initialize wellness goals and focus areas
			wellnessGoals: userData.wellnessGoals || [],
			focusAreas: userData.focusAreas || [],
			commitmentLevel: userData.commitmentLevel || 'moderate',
			preferences: { ...defaultPreferences, ...userData.preferences },
			stats: { ...defaultStats, ...userData.stats },
			isOnboardingComplete: false,
			// Subscription defaults
			status: 'active', // New users start with trial
			subscriptionType: 'trial', // Everyone gets a trial period
			trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day trial
			lastActiveAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			...userData
		};

		// Use DatabaseService to create with the specific ID
		await firstValueFrom(this.db.updateDocument<User>('users', authUser.uid, userProfile));
	}

	// Update user profile
	async updateUserProfile(updates: Partial<User>): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		await firstValueFrom(this.db.updateDocument<User>('users', authUser.uid, {
			...updates,
			updatedAt: new Date()
		}));
	}

	// Update user preferences
	async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const currentUser = await firstValueFrom(this.getCurrentUserProfile().pipe(take(1)));
		if (!currentUser) throw new Error('User profile not found');

		await firstValueFrom(this.db.updateDocument<User>('users', authUser.uid, {
			preferences: { ...currentUser.preferences, ...preferences } as UserPreferences,
			updatedAt: new Date()
		}));
	}

	// Upload profile image
	async uploadProfileImage(file: File): Promise<string> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const imageRef = ref(this.storage, `profile-images/${authUser.uid}/${Date.now()}`);
		const snapshot = await uploadBytes(imageRef, file);
		const downloadURL = await getDownloadURL(snapshot.ref);

		// Update user profile with new photo URL
		await this.updateUserProfile({ photoURL: downloadURL });

		return downloadURL;
	}

	// Upload generic user image (for reference photos etc)
	async uploadUserImage(userId: string, base64Data: string, fileName: string): Promise<string> {
		// Convert base64 to blob
		const response = await fetch(base64Data);
		const blob = await response.blob();

		const imageRef = ref(this.storage, `users/${userId}/${fileName}`);
		const snapshot = await uploadBytes(imageRef, blob);
		return await getDownloadURL(snapshot.ref);
	}

	// Download and store Google profile photo to Firebase Storage
	async downloadAndStoreGooglePhoto(googlePhotoURL: string): Promise<string> {
		try {
			const authUser = this.authService.getCurrentUser();
			if (!authUser) throw new Error('No authenticated user');

			// Download the Google photo
			const response = await fetch(googlePhotoURL.replace('s96-c', 's200-c')); // Get higher res
			if (!response.ok) throw new Error('Failed to download Google photo');

			const blob = await response.blob();

			// Create a file from the blob
			const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });

			// Upload to Firebase Storage
			const imageRef = ref(this.storage, `profile-images/${authUser.uid}/google-profile.jpg`);
			const snapshot = await uploadBytes(imageRef, file);
			const downloadURL = await getDownloadURL(snapshot.ref);

			console.log('✅ Successfully stored Google profile photo to Firebase Storage');
			return downloadURL;

		} catch (error) {
			console.error('❌ Failed to download and store Google photo:', error);
			// Return the original URL as fallback
			return googlePhotoURL;
		}
	}

	// Calculate and update journey stats
	async updateJourneyStats(): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		const userProfile = await firstValueFrom(this.getCurrentUserProfile().pipe(take(1)));

		if (!userProfile) return;

		// Calculate current day in journey
		const joinDate = userProfile.joinDate instanceof Date ? userProfile.joinDate : new Date(userProfile.joinDate);
		const daysDiff = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 3600 * 24));
		const currentDay = Math.min(daysDiff + 1, 28); // Cap at 28 days

		// Update current day
		await this.updateUserProfile({ currentDay });
	}

	// Update user stats using Firebase Function for complex calculations
	async updateUserStats(statUpdates: Partial<UserStats>): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		// For simple stat updates, use direct database update
		const currentUser = await firstValueFrom(this.getCurrentUserProfile().pipe(take(1)));

		if (!currentUser) return;

		const updatedStats: UserStats = {
			...currentUser.stats,
			...statUpdates
		};

		await firstValueFrom(this.db.updateDocument<User>('users', authUser.uid, {
			stats: updatedStats,
			updatedAt: new Date()
		}));
	}

	// Increment specific stat counters using Firebase Function
	async incrementStat(statName: keyof UserStats, incrementBy: number = 1): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		try {
			// Call Firebase Function for stat increment (handles complex logic)
			await firstValueFrom(this.db.callFunction('updateUserStats', {
				statType: this.mapStatToType(statName),
				value: incrementBy
			}));

		} catch (error) {
			this.errorHandler.handleError('incrementUserStat', error);
			throw new Error('Failed to update user statistics. Please try again or contact support.');
		}
	}

	// Helper to map stat names to Firebase Function types
	private mapStatToType(statName: keyof UserStats): string {
		switch (statName) {
			case 'totalTrackerEntries':
				return 'trackerEntry';
			case 'totalJournalEntries':
				return 'journalEntry';
			case 'completedTrackers':
				return 'completedTracker';
			default:
				return 'general';
		}
	}

	// Calculate wellness score using Firebase Function for complex calculations
	async calculateWellnessScore(): Promise<number> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) return 0;

		try {
			// Call Firebase Function for complex wellness calculation
			const result = await firstValueFrom(this.db.callFunction<{}, { wellnessScore: number }>('calculateWellnessScore', {}));
			return result.wellnessScore;
		} catch (error) {
			this.errorHandler.handleError('calculateWellnessScore', error);
			throw new Error('Failed to calculate wellness score. Please try again or contact support.');
		}
	}

	// Check if user has completed onboarding
	async hasCompletedOnboarding(): Promise<boolean> {
		const currentUser = await firstValueFrom(this.getCurrentUserProfile().pipe(take(1)));

		if (!currentUser) return false;

		return currentUser.isOnboardingComplete;
	}

	// Debug method to check current onboarding status (temporary)
	async debugOnboardingStatus(): Promise<void> {
		const user = await firstValueFrom(this.getCurrentUserProfile().pipe(take(1)));
	}

	// Temporary debug method to manually mark onboarding complete
	async debugMarkOnboardingComplete(): Promise<void> {
		await this.updateUserProfile({
			isOnboardingComplete: true,
			updatedAt: new Date()
		});
	}

	// Debug method to test real-time connection
	testRealTimeConnection(): void {

		this.getCurrentUserProfile().subscribe(user => {
		});
	}

	// Get user journey progress (real-time, derived from user profile)
	getJourneyProgress(): Observable<{ currentDay: number; progress: number; milestone: string }> {
		return this.getCurrentUserProfile().pipe(
			map(user => {
				if (!user) return { currentDay: 1, progress: 0, milestone: 'Getting Started' };

				const currentDay = user.currentDay || 1;
				const progress = Math.round((currentDay / 28) * 100);

				let milestone = 'Getting Started';
				if (currentDay >= 28) milestone = '28-Day Champion';
				else if (currentDay >= 21) milestone = 'Final Week';
				else if (currentDay >= 14) milestone = 'Halfway Hero';
				else if (currentDay >= 7) milestone = 'First Week Complete';

				return { currentDay, progress, milestone };
			})
		);
	}

	// Delete user account using Firebase Function for complete cleanup
	async deleteUserAccount(): Promise<void> {
		const authUser = this.authService.getCurrentUser();
		if (!authUser) throw new Error('No authenticated user');

		try {
			// Call Firebase Function to handle complete user deletion
			await firstValueFrom(this.db.callFunction('deleteUserAccount', {}));
		} catch (error) {
			this.errorHandler.handleError('deleteUserAccount', error);
			throw new Error('Failed to delete user account. Please try again or contact support.');
		}
	}
} 