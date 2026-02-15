import * as admin from 'firebase-admin';

export class NotificationService {
	private db = admin.firestore();
	private messaging = admin.messaging();

	/**
	 * Send a push notification to a user's registered devices
	 */
	async sendPushNotification(userId: string, title: string, body: string, data: any = {}): Promise<void> {
		try {
			// Get user tokens
			const userDoc = await this.db.collection('users').doc(userId).get();
			if (!userDoc.exists) return;

			const userData = userDoc.data();
			const tokens = userData?.fcmTokens as string[];

			if (!tokens || tokens.length === 0) {
				console.log(`No FCM tokens found for user ${userId}`);
				return;
			}

			// Check user preferences
			if (userData?.preferences?.newFeedPostNotifications === false) {
				console.log(`User ${userId} has disabled feed post notifications`);
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
