import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, PushNotificationSchema, ActionPerformed, Token } from '@capacitor/push-notifications';
import { BehaviorSubject, from } from 'rxjs';
import { LoggingService } from './logging.service';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { Tracker, TrackerConfig } from '../models/tracker.interface';

@Injectable({
	providedIn: 'root'
})
export class NotificationService {
	private _fcmToken = new BehaviorSubject<string | null>(null);

	constructor(
		private platform: Platform,
		private logger: LoggingService,
		private db: DatabaseService,
		private auth: AuthService
	) {
		this.init();
	}

	async init() {
		// Only run on real devices (Capacitor)
		if (!this.platform.is('capacitor')) {
			this.logger.info('NotificationService: Not on native platform, skipping initialization');
			return;
		}

		// Request permissions
		await this.requestPermissions();

		// Register push listeners
		this.registerPushListeners();
	}

	private async requestPermissions() {
		try {
			// Local Notifications
			const localPerms = await LocalNotifications.requestPermissions();
			if (localPerms.display !== 'granted') {
				this.logger.warn('NotificationService: Local notification permissions denied');
			}

			// Push Notifications
			const pushPerms = await PushNotifications.requestPermissions();
			if (pushPerms.receive === 'granted') {
				await PushNotifications.register();
			} else {
				this.logger.warn('NotificationService: Push notification permissions denied');
			}

		} catch (error) {
			this.logger.error('NotificationService: Error requesting permissions', error);
		}
	}

	private registerPushListeners() {
		// On success, we should save the token to firestore
		PushNotifications.addListener('registration', (token: Token) => {
			this.logger.info('NotificationService: Push registration success', { token: token.value });
			this._fcmToken.next(token.value);
			this.saveTokenToProfile(token.value);
		});

		// Some issue with registration
		PushNotifications.addListener('registrationError', (error: any) => {
			this.logger.error('NotificationService: Push registration error', error);
		});

		// Show us the notification payload if the app is open on our device
		PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
			this.logger.info('NotificationService: Push received', notification);
			// Determine if we should show a local notification or toast based on payload
			// For now, Capacitor handles foreground notifications if configured in capacitor.config.json or we can manually show
		});

		// Method called when tapping on a notification
		PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
			this.logger.info('NotificationService: Push action performed', notification);
			// TODO: Navigate to specific page based on data
		});
	}

	private async saveTokenToProfile(token: string) {
		const user = this.auth.getCurrentUser();
		if (user) {
			this.db.updateUserFCMToken(user.uid, token);
		}
	}

	// --- Local Notifications (Trackers) ---

	async scheduleTestNotification() {
		if (!this.platform.is('capacitor')) {
			this.logger.info('NotificationService: Not on native, skipping test notification');
			return;
		}

		try {
			await LocalNotifications.schedule({
				notifications: [
					{
						title: 'Test Notification',
						body: 'This is a test notification from ReGen28!',
						id: 99999,
						schedule: { at: new Date(Date.now() + 5000) },
						sound: undefined,
						attachments: undefined,
						actionTypeId: '',
						extra: null
					}
				]
			});
			this.logger.info('NotificationService: Scheduled test notification');
		} catch (e) {
			this.logger.error('NotificationService: Error scheduling test notification', e);
		}
	}

	async scheduleTrackerReminder(tracker: Tracker) {
		if (!this.platform.is('capacitor')) return;
		if (!tracker.config?.reminderEnabled || !tracker.config?.reminderTime) return;

		// Logic to parse time string "HH:mm"
		const [hours, minutes] = tracker.config.reminderTime.split(':').map(Number);

		// Create notification object
		// Simple implementation: Schedule for tomorrow at this time (repeating daily)
		// We need a unique ID for the notification. Since Tracker ID is string and plugin wants Integer, 
		// we need a consistent hash or mapping. 
		const notificationId = this.hashCode(tracker.id);

		try {
			await LocalNotifications.schedule({
				notifications: [
					{
						title: `Time to track: ${tracker.name}`,
						body: `Don't forget to log your ${tracker.name} for today!`,
						id: notificationId,
						schedule: {
							on: { hour: hours, minute: minutes },
							allowWhileIdle: true
						},
						extra: {
							trackerId: tracker.id
						}
					}
				]
			});
			this.logger.info(`NotificationService: Scheduled reminder for ${tracker.name} at ${hours}:${minutes}`);
		} catch (e) {
			this.logger.error('NotificationService: Error scheduling tracker reminder', e);
		}
	}

	async cancelTrackerReminder(trackerId: string) {
		if (!this.platform.is('capacitor')) return;
		const notificationId = this.hashCode(trackerId);
		try {
			await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
		} catch (e) {
			// Ignore error if not found
		}
	}

	// Helper to generate integer ID from string
	private hashCode(str: string): number {
		let hash = 0;
		if (str.length === 0) return hash;
		for (let i = 0; i < str.length; i++) {
			const chr = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + chr;
			hash |= 0; // Convert to 32bit integer
		}
		return Math.abs(hash); // Ensure positive for notification ID
	}
}
