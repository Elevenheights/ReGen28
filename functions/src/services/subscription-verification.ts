import axios from 'axios';
import { defineString } from 'firebase-functions/params';

// Customer info GET accepts a project public SDK key; no secret is sent to clients.
const revenueCatApiKey = defineString('REVENUECAT_API_KEY', {
	default: 'appl_IeOlLFjbuMRZDpfFWGbgiKfDfFy'
});
const entitlementId = 'Regen28 Pro';

export interface Subscriber {
	entitlements: Record<string, {
		expires_date: string | null;
		grace_period_expires_date?: string | null;
		product_identifier: string;
	}>;
	subscriptions?: Record<string, { period_type?: string; refunded_at?: string | null }>;
}

export interface VerifiedSubscription {
	status: 'active' | 'inactive';
	subscriptionType: 'trial' | 'premium' | 'expired';
	subscriptionExpiration: Date | null;
	trialEndsAt: Date | null;
}

export function subscriptionFromSubscriber(subscriber: Subscriber, now = new Date()): VerifiedSubscription {
	const inactive: VerifiedSubscription = {
		status: 'inactive', subscriptionType: 'expired', subscriptionExpiration: null, trialEndsAt: null
	};
	const entitlement = subscriber.entitlements[entitlementId];
	if (!entitlement) return inactive;
	const subscription = subscriber.subscriptions?.[entitlement.product_identifier];
	if (subscription?.refunded_at) return inactive;
	const dates = [entitlement.expires_date, entitlement.grace_period_expires_date]
		.filter((value): value is string => typeof value === 'string')
		.map(value => new Date(value));
	if (dates.some(date => !Number.isFinite(date.getTime()))) throw new Error('Invalid subscription expiration');
	const expiration = dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))) : null;
	if (entitlement.expires_date === undefined || (expiration && expiration <= now)) return inactive;
	const trial = subscription?.period_type?.toLowerCase() === 'trial';
	return {
		status: 'active', subscriptionType: trial ? 'trial' : 'premium',
		subscriptionExpiration: expiration, trialEndsAt: trial ? expiration : null
	};
}

export async function verifySubscription(uid: string): Promise<VerifiedSubscription> {
	const response = await axios.get<{ subscriber: Subscriber }>(
		`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
		{ headers: { Authorization: `Bearer ${revenueCatApiKey.value()}` }, timeout: 15000 }
	);
	if (!response.data?.subscriber?.entitlements) throw new Error('Invalid RevenueCat response');
	return subscriptionFromSubscriber(response.data.subscriber);
}

export function hasBillingOverride(profile: { billingAccessOverride?: unknown; status?: unknown }): boolean {
	return profile.billingAccessOverride === true && profile.status === 'active';
}
