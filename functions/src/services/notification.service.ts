import * as admin from 'firebase-admin';

export class NotificationService {
	private db = admin.firestore();
	private messaging = admin.messaging();

	/**
	 * Send a push notification to a user's registered devices
	 * @param userId The user's ID
	 * @param title Notification title
	 * @param body Notification body
	 * @param data Additional data for the notification
	 * @param preferenceKey Optional: the user preference key to check before sending
	 */
	async sendPushNotification(userId: string, title: string, body: string, data: any = {}, preferenceKey?: string): Promise<void> {
		try {
			// Get user tokens and preferences
			const userDoc = await this.db.collection('users').doc(userId).get();
			if (!userDoc.exists) return;

			const userData = userDoc.data();
			const tokens = userData?.fcmTokens as string[];

			if (!tokens || tokens.length === 0) {
				console.log(`No FCM tokens found for user ${userId}`);
				return;
			}

			// Check master notification toggle
			if (userData?.preferences?.dailyReminders === false) {
				console.log(`User ${userId} has disabled all notifications`);
				return;
			}

			// Check specific granular preference if provided
			// Preserve the legacy feed opt-out as well as the newer channel toggles.
			if (userData?.preferences?.newFeedPostNotifications === false) {
				console.log(`User ${userId} has disabled feed post notifications`);
				return;
			}

			if (preferenceKey && userData?.preferences?.[preferenceKey] === false) {
				console.log(`User ${userId} has disabled notifications for ${preferenceKey}`);
				return;
			}

			// Send to all tokens
			const message: admin.messaging.MulticastMessage = {
				tokens: tokens,
				notification: {
					title: title,
					body: body,
				},
				data: {
					...data,
					// Ensure data values are strings
					click_action: 'FCM_PLUGIN_ACTIVITY',
				}
			};

			const response = await this.messaging.sendEachForMulticast(message);

			// Clean up invalid tokens
			if (response.failureCount > 0) {
				const failedTokens: string[] = [];
				response.responses.forEach((resp, idx) => {
					if (!resp.success) {
						failedTokens.push(tokens[idx]);
					}
				});

				if (failedTokens.length > 0) {
					await this.db.collection('users').doc(userId).update({
						fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
					});
					console.log(`Removed ${failedTokens.length} invalid tokens for user ${userId}`);
				}
			}

			console.log(`Sent notification to user ${userId}: ${response.successCount} success, ${response.failureCount} failure`);

		} catch (error) {
			console.error(`Error sending push notification to user ${userId}:`, error);
		}
	}
}

export const notificationService = new NotificationService();
