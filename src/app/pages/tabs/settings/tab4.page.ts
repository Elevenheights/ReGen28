import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonContent,
	IonToggle,
	IonSegment,
	IonSegmentButton,
	IonLabel,
	IonSpinner,
	IonAccordion,
	IonAccordionGroup,
	IonItem
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Components
import { EditProfileModalComponent } from '../../../components/settings/edit-profile-modal/edit-profile-modal.component';

// Services
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';
import { DatabaseService } from '../../../services/database.service';
import { StatisticsService } from '../../../services/statistics.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Models
import { User } from '../../../models/user.interface';
import { UserAchievement, Achievement, AchievementStats } from '../../../models/achievements.interface';
import { AchievementService } from '../../../services/achievement.service';
import { NotificationService } from '../../../services/notification.service';

import { CountUpDirective } from '../../../directives/count-up.directive';

@Component({
	selector: 'app-tab4',
	templateUrl: './tab4.page.html',
	styleUrls: ['./tab4.page.scss'],
	standalone: true,
	imports: [
		IonContent,
		IonToggle,
		IonSegment,
		IonSegmentButton,
		CommonModule,
		FormsModule,
		CountUpDirective,
		CountUpDirective,
		IonLabel,
		IonSpinner,
		IonAccordion,
		IonAccordionGroup,
		IonItem
	]
})
export class Tab4Page implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// User data
	user: User | null = null;
	schedule = {
		wakeTime: '06:00',
		midDayTime: '12:00',
		bedTime: '22:00'
	};
	achievements: Array<UserAchievement & { achievement: Achievement }> = [];
	achievementStats: AchievementStats | null = null;
	achievementLevel: { level: number; title: string; pointsToNext: number } | null = null;
	isCalculatingStats = false;

	// Profile image
	profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
	userDisplayName = 'User';

	constructor(
		private userService: UserService,
		private authService: AuthService,
		private logging: LoggingService,
		private toastService: ToastService,
		private db: DatabaseService,
		private router: Router,
		private modalCtrl: ModalController,
		private achievementService: AchievementService,
		private statsService: StatisticsService,
		private notificationService: NotificationService
	) { }

	ngOnInit() {
		this.loadUserProfile();
		this.loadAchievements();
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
				if (user?.preferences?.schedule) {
					this.schedule = { ...user.preferences.schedule };
				}
				this.updateProfileImageUrl();
			},
			error: (error) => {
				this.logging.error('Failed to load user profile', { error });
			}
		});
	}

	private loadAchievements() {
		this.achievementService.getUserAchievementsWithDetails().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: async (achievements) => {
				this.achievements = achievements;
				this.achievementStats = await this.achievementService.getAchievementStats();
				this.achievementLevel = await this.achievementService.getUserAchievementLevel();
			},
			error: (error) => {
				this.logging.error('Failed to load achievements', { error });
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

	async onSignOut() {
		try {
			this.logging.info('User signing out from settings');
			await this.authService.logout();
			this.router.navigate(['/login'], { replaceUrl: true });
			this.toastService.showSuccess('Signed out successfully');
		} catch (error) {
			this.logging.error('Error signing out', error);
			this.toastService.showError('Failed to sign out. Please try again.');
		}
	}

	async onEditProfile() {
		this.logging.info('Opening profile edit modal');
		const modal = await this.modalCtrl.create({
			component: EditProfileModalComponent,
			componentProps: { user: this.user },
			cssClass: 'edit-profile-modal',
			breakpoints: [0, 0.5, 0.9],
			initialBreakpoint: 0.9
		});

		await modal.present();

		const { data } = await modal.onDidDismiss();
		if (data?.saved) {
			this.loadUserProfile();
		}
	}

	async updateSchedule(type: 'wakeTime' | 'midDayTime' | 'bedTime', event: any) {
		const time = event.target.value;
		this.schedule[type] = time;

		if (this.user) {
			const currentSchedule = this.user.preferences?.schedule || {
				wakeTime: '06:00',
				midDayTime: '12:00',
				bedTime: '22:00'
			};

			const updatedSchedule = { ...currentSchedule, [type]: time };

			this.logging.info(`Updating schedule: ${type} = ${time}`);

			await this.userService.updatePreferences({
				schedule: updatedSchedule
			});
			this.toastService.showSuccess('Schedule updated');
		}
	}

	onToggleSetting(setting: string, event: any) {
		const value = event.target.checked;
		this.logging.debug(`Setting toggled: ${setting} = ${value}`);

		let preferenceUpdate: any = {};
		switch (setting) {
			case 'Reminders':
				preferenceUpdate.dailyReminders = value;
				break;
			case 'Feed Posts':
				preferenceUpdate.newFeedPostNotifications = value;
				if (value) {
					// Request permissions if enabling
					this.notificationService.init();
				}
				break;
			case 'Dark Mode':
				preferenceUpdate.darkMode = value;
				break;
			case 'Developer Mode':
				preferenceUpdate.developerMode = value;
				break;
		}

		this.userService.updatePreferences(preferenceUpdate).then(() => {
			this.toastService.showSuccess(`${setting} updated`);
		}).catch(error => {
			this.logging.error(`Failed to update ${setting}`, error);
			this.toastService.showError(`Could not update ${setting}`);
		});
	}

	// Manual trigger for action posts generation
	async triggerActionPostsGeneration() {
		try {
			this.logging.info('Manually triggering action posts generation');
			await this.toastService.showInfo('🚀 Generating action posts...');

			const result = await firstValueFrom(this.db.triggerActionPosts(true));
			if (result.debugLogs) {
				console.log('Action Generation Logs:', result.debugLogs);
			}

			if (result.postsCreated > 0) {
				await this.toastService.showSuccess(`✅ Created ${result.postsCreated} action post(s)!`);
			} else {
				this.logging.warn('No action posts created', result);
				await this.toastService.showInfo(`Generatred 0 posts. See console for details.`);
			}

		} catch (error) {
			this.logging.error('Failed to trigger action posts', error);
			await this.toastService.showError('Failed to generate action posts. Please try again.');
		}
	}

	// Manual trigger for insight posts generation
	async triggerInsightPostsGeneration() {
		try {
			this.logging.info('Manually triggering insight posts generation');
			await this.toastService.showInfo('🚀 Generating insight posts...');

			const result = await firstValueFrom(this.db.triggerInsightPosts(true));
			if (result.debugLogs) {
				console.log('Insight Generation Logs:', result.debugLogs);
			}

			if (result.postsCreated > 0) {
				await this.toastService.showSuccess(`✅ Created ${result.postsCreated} insight post(s)!`);
			} else {
				this.logging.warn('No insight posts created', result);
				await this.toastService.showInfo(`Generatred 0 posts. See console for details.`);
			}

		} catch (error) {
			this.logging.error('Failed to trigger insight posts', error);
			await this.toastService.showError('Failed to generate insight posts. Please try again.');
		}
	}

	// Personalization: Update Reference Image
	async updateReferenceImage(type: 'face' | 'body') {
		try {
			const image = await Camera.getPhoto({
				quality: 90,
				allowEditing: false,
				resultType: CameraResultType.Base64,
				source: CameraSource.Prompt,
				width: 1024
			});

			if (image.base64String && this.user) {
				const base64 = `data:image/${image.format};base64,${image.base64String}`;
				const fileName = type === 'face' ? 'reference_face.jpg' : 'reference_body.jpg';

				await this.toastService.showInfo(`Uploading ${type} reference...`);

				const url = await this.userService.uploadUserImage(this.user.id, base64, fileName);

				const updates: any = {};
				if (type === 'face') updates.referenceImageFace = url;
				else updates.referenceImageBody = url;

				await this.userService.updateUserProfile(updates);
				await this.toastService.showSuccess(`${type} reference updated!`);
				this.loadUserProfile();
			}
		} catch (error: any) {
			this.logging.error('Error updating reference image', error);
			// Only show error toast if it's not a user cancellation
			if (error?.message !== 'User cancelled photos app') {
				await this.toastService.showError('Failed to update reference image. Please check camera permissions.');
			}
		}
	}

	// Personalization: Update Style
	async updateStylePreference(event: any) {
		const style = event.detail.value;
		if (this.user) {
			await this.userService.updateUserProfile({ postStyle: style });
			this.logging.info(`Style preference updated to ${style}`);
		}
	}

	// Developer: Toggle Nano Model Type (Standard/Pro)
	async toggleNanoModelType(event: any) {
		const modelType = event.detail.value;
		if (this.user) {
			const currentDevSettings = this.user.preferences?.devSettings || { nanoModelType: 'standard' };
			await this.userService.updatePreferences({
				devSettings: { ...currentDevSettings, nanoModelType: modelType }
			});
			await this.toastService.showSuccess(`Model switched to ${modelType.toUpperCase()}`);
		}
	}

	// Developer: Toggle Image Generation Model (Nano/DALL-E)
	async toggleImageModel(event: any) {
		const model = event.detail.value;
		if (this.user) {
			const currentDevSettings = this.user.preferences?.devSettings || { nanoModelType: 'standard' };
			await this.userService.updatePreferences({
				devSettings: { ...currentDevSettings, imageModel: model }
			});
			await this.toastService.showSuccess(`Image generator switched to ${model === 'dall-e' ? 'GPT Image 1.5' : 'Nano Banana'}`);
		}
	}

	// Developer: Trigger Motivational Posts
	async triggerMotivationalPosts() {
		try {
			this.logging.info('Manually triggering motivational posts');
			await this.toastService.showInfo('🚀 Generating motivational posts...');
			// Increase timeout to 9 minutes (540000ms) to match backend
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'motivational', force: true }, { timeout: 540000 }));
			await this.toastService.showSuccess('Motivational posts generated!');
		} catch (error) {
			this.logging.error('Failed to trigger motivational posts', error);
			await this.toastService.showError('Failed to generate motivational posts.');
		}
	}

	// Developer: Trigger Contextual Posts
	async triggerContextualPosts() {
		try {
			this.logging.info('Manually triggering contextual posts');
			await this.toastService.showInfo('🚀 Generating contextual posts...');
			// Increase timeout to 9 minutes (540000ms) to match backend
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'contextual', force: true }, { timeout: 540000 }));
			await this.toastService.showSuccess('Contextual posts generated!');
		} catch (error) {
			this.logging.error('Failed to trigger contextual posts', error);
			await this.toastService.showError('Failed to generate contextual posts.');
		}
	}

	// Developer: Trigger Stats Calculation
	async triggerStatsCalculation() {
		this.isCalculatingStats = true;
		try {
			this.logging.info('Triggering manual statistics calculation');
			await this.statsService.triggerStatsCalculation();
			await this.toastService.showSuccess('Statistics calculated successfully!');
			this.statsService.clearCacheForType('all');
		} catch (error) {
			this.logging.error('Failed to trigger statistics calculation', error);
			await this.toastService.showError('Failed to calculate statistics.');
		} finally {
			this.isCalculatingStats = false;
		}
	}
	// Developer: Trigger Daily Inspiration
	async triggerDailyInspiration() {
		try {
			this.logging.info('Manually triggering daily inspiration');
			await this.toastService.showInfo('🚀 Generating daily inspiration...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'inspiration', force: true }, { timeout: 120000 }));
			await this.toastService.showSuccess('Daily inspiration generated!');
		} catch (error) {
			this.logging.error('Failed to trigger daily inspiration', error);
			await this.toastService.showError('Failed to generate daily inspiration.');
		}
	}

	// Developer: Trigger Daily Summary
	async triggerDailySummary() {
		try {
			this.logging.info('Manually triggering daily summary');
			await this.toastService.showInfo('🚀 Generating daily summary...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'summary', force: true }, { timeout: 120000 }));
			await this.toastService.showSuccess('Daily summary generated!');
		} catch (error) {
			this.logging.error('Failed to trigger daily summary', error);
			await this.toastService.showError('Failed to generate daily summary.');
		}
	}

	// Developer: Trigger Mid-Week Post
	async triggerMidWeekPost() {
		try {
			this.logging.info('Manually triggering mid-week post');
			await this.toastService.showInfo('🚀 Generating mid-week post...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'midweek', force: true }, { timeout: 120000 }));
			await this.toastService.showSuccess('Mid-week post generated!');
		} catch (error) {
			this.logging.error('Failed to trigger mid-week post', error);
			await this.toastService.showError('Failed to generate mid-week post.');
		}
	}

	// Developer: Trigger Weekly Wrap-Up
	async triggerWeeklyWrapUp() {
		try {
			this.logging.info('Manually triggering weekly wrap-up');
			await this.toastService.showInfo('🚀 Generating weekly wrap-up...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'weekly', force: true }, { timeout: 120000 }));
			await this.toastService.showSuccess('Weekly wrap-up generated!');
		} catch (error) {
			this.logging.error('Failed to trigger weekly wrap-up', error);
			await this.toastService.showError('Failed to generate weekly wrap-up.');
		}
	}

	// Developer: Trigger Progress Photo Check
	async triggerProgressPhotoPost() {
		try {
			this.logging.info('Manually triggering progress photo check');
			await this.toastService.showInfo('🚀 Checking for progress photos...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'progress', force: true }, { timeout: 300000 }));
			await this.toastService.showSuccess('Progress photo check completed!');
		} catch (error) {
			this.logging.error('Failed to trigger progress photo check', error);
			await this.toastService.showError('Failed to check progress photos.');
		}
	}

	// Developer: Trigger Cycle Review
	async triggerCycleReview() {
		try {
			this.logging.info('Manually triggering cycle review');
			await this.toastService.showInfo('🚀 Checking for cycle reviews...');
			await firstValueFrom(this.db.callFunction('triggerFeedPost', { type: 'cycle', force: true }, { timeout: 300000 }));
			await this.toastService.showSuccess('Cycle review check completed!');
		} catch (error) {
			await this.toastService.showError('Failed to check cycle review.');
		}
	}

	// Developer: Trigger Test Notification
	async triggerTestNotification() {
		try {
			this.logging.info('Triggering test notification');
			await this.toastService.showInfo('Sending test notification...');

			// Schedule a local notification for 5 seconds from now
			const now = new Date();
			now.setSeconds(now.getSeconds() + 5);

			// We can use a direct call if we expose it, using scheduleTrackerReminder logic but manual
			// Or just use the capacitor plugin directly here for testing, but better to use service
			// Since service methods are specific to trackers, we might need a generic one.
			// For now, let's just log. 
			// Actually, let's add a generic schedule method to NotificationService later.
			// For this specific requirement, the user asked for "Test Notification" button.
			// I'll add a temporary test method in NotificationService or just rely on console for now if I can't easily schedule.
			// Wait, I can just use LocalNotifications directly here for a quick test if I import it, 
			// OR I can add a `testNotification()` method to NotificationService. 
			// Let's call a method on NotificationService that I will add.
			await this.notificationService.scheduleTestNotification();

			await this.toastService.showSuccess('Test notification scheduled for 5s!');
		} catch (error) {
			this.logging.error('Failed to trigger test notification', error);
			await this.toastService.showError('Failed to schedule test notification.');
		}
	}
}
