import { timingSafeEqual } from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { verifySubscription, hasBillingOverride } from './services/subscription-verification';

const revenueCatWebhookSecret = defineSecret('REVENUECAT_WEBHOOK_SECRET');

interface RevenueCatEvent {
	id: string;
	type: string;
	app_user_id?: string;
	aliases?: string[];
	transferred_from?: string[];
	transferred_to?: string[];
}

export const revenueCatWebhook = onRequest(
	{ secrets: [revenueCatWebhookSecret], invoker: 'public' },
	async (req, res) => {
		if (req.method !== 'POST') {
			res.set('Allow', 'POST').status(405).send('Method not allowed');
			return;
		}
		const token = (req.headers.authorization || '').replace(/^Bearer /, '');
		const secret = revenueCatWebhookSecret.value().trim();
		const received = Buffer.from(token);
		const expected = Buffer.from(secret);
		if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
			res.status(401).send('Unauthorized');
			return;
		}

		const event = req.body?.event as RevenueCatEvent | undefined;
		if (!event || typeof event.id !== 'string' || !event.id || event.id.includes('/')
			|| typeof event.type !== 'string') {
			res.status(400).send('Invalid event');
			return;
		}
		if (event.type === 'TEST') {
			res.status(200).json({ success: true });
			return;
		}
		const candidates = event.type === 'TRANSFER'
			? [...(event.transferred_from || []), ...(event.transferred_to || [])]
			: [event.app_user_id, ...(event.aliases || [])];
		const userIds = [...new Set(candidates.filter((id): id is string =>
			typeof id === 'string' && !!id && !id.includes('/') && !id.startsWith('$RCAnonymousID:')
		))];
		if (!userIds.length) {
			res.status(200).json({ success: true, ignored: true });
			return;
		}

		try {
			const db = getFirestore();
			const eventRef = db.collection('processed_webhooks').doc(event.id);
			if ((await eventRef.get()).exists) {
				res.status(200).json({ success: true, duplicate: true });
				return;
			}
			const verifiedAt = new Date();
			// Refresh canonical state instead of replaying potentially stale billing events.
			// TRANSFER events do not contain entitlement_ids or app_user_id.
			const updates = await Promise.all(userIds.map(async uid => {
				const ref = db.collection('users').doc(uid);
				const profile = await ref.get();
				if (!profile.exists || hasBillingOverride(profile.data() || {})
					|| profile.data()?.status === 'suspended') return null;
				return { ref, verified: await verifySubscription(uid) };
			}));
			const validUpdates = updates.filter((update): update is NonNullable<typeof update> => update !== null);
			await db.runTransaction(async transaction => {
				const eventDoc = await transaction.get(eventRef);
				if (eventDoc.exists) return;
				const profiles = await Promise.all(validUpdates.map(update => transaction.get(update.ref)));
				validUpdates.forEach((update, index) => {
					const profile = profiles[index];
					const data = profile.data();
					if (!data || hasBillingOverride(data) || data.status === 'suspended'
						|| data.subscriptionVerifiedAt?.toDate() > verifiedAt) return;
					transaction.update(update.ref, {
						...update.verified, subscriptionVerifiedAt: verifiedAt,
						updatedAt: FieldValue.serverTimestamp()
					});
				});
				// Mark success atomically with profile writes so failed attempts remain retryable.
				transaction.set(eventRef, { type: event.type, processedAt: FieldValue.serverTimestamp() });
			});
			res.status(200).json({ success: true });
		} catch (error) {
			logger.error('RevenueCat webhook processing failed', error);
			res.status(500).json({ error: 'Subscription update failed; retry delivery' });
		}
	}
);
