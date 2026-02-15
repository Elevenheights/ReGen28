
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

import { OpenAIService as OpenAITextService } from '../openai.service';
import { GeminiImageService } from '../services/gemini-image.service';
import { notificationService } from '../services/notification.service';

const db = getFirestore();
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Lazy load Services
let _openaiText: OpenAITextService | null = null;
let _geminiImage: GeminiImageService | null = null;

function getOpenAIText() {
	if (!_openaiText) {
		const apiKey = process.env.OPENAI_API_KEY || (openaiApiKey.value ? openaiApiKey.value() : '');
		_openaiText = new OpenAITextService(apiKey);
	}
	return _openaiText;
}

function getGeminiImage() {
	if (!_geminiImage) {
		_geminiImage = new GeminiImageService();
	}
	return _geminiImage;
}

// ==========================================
// UNIFIED TASKS & TRIGGERS
// ==========================================

interface FeedPostRequest {
	userId: string;
	type: 'motivational' | 'action' | 'insight' | 'inspiration' | 'summary' | 'midweek' | 'weekly' | 'progress' | 'cycle' | 'contextual' | 'morning' | 'evening' | 'midday';
	force?: boolean;
	subType?: string; // For contextual posts
}

/**
 * Unified Task Dispatcher for all feed post generation
 */
export const generateFeedPostTask = onTaskDispatched({
	secrets: [openaiApiKey],
	retryConfig: { maxAttempts: 3, minBackoffSeconds: 60 },
	rateLimits: { maxConcurrentDispatches: 20 },
	memory: '1GiB',
	timeoutSeconds: 540,
}, async (req) => {
	const { userId, type, force, subType } = req.data as FeedPostRequest;
	if (!userId || !type) {
		logger.error(`[UNIFIED] Missing userId or type in task dispatch`);
		return;
	}

	logger.info(`[UNIFIED] Starting generation task: ${type} for user ${userId}`);
	await dispatchPostGeneration(userId, type, force, subType);
});

/**
 * Unified Manual Trigger for Developers/Frontend
 */
export const triggerFeedPost = onCall({
	secrets: [openaiApiKey],
	invoker: 'public',
	memory: '1GiB',
	timeoutSeconds: 540,
}, async (request) => {
	const { auth, data } = request;
	const { type, force, subType } = data as FeedPostRequest;

	if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

	logger.info(`[UNIFIED] Manual trigger: ${type} for user ${auth.uid}`);
	await dispatchPostGeneration(auth.uid, type, force === true, subType);

	return { success: true, message: `Triggered ${type} post generation` };
});


// ==========================================
// CORE DISPATCHER
// ==========================================

async function dispatchPostGeneration(userId: string, type: string, force: boolean = false, subType?: string) {
	// Fetch user once
	const userDoc = await db.collection("users").doc(userId).get();
	if (!userDoc.exists) {
		logger.error(`User ${userId} not found`);
		return;
	}
	const userData = userDoc.data();

	try {
		switch (type) {
			case 'motivational':
			case 'morning':
				await generateMotivationalPost(userId, userData, force, subType || 'morning');
				break;
			case 'action':
				await generateActionPostsForUser(userId, userData, force);
				break;
			case 'insight':
				await generateInsightPostsForUser(userId, userData, force);
				break;
			case 'inspiration':
				await generateInspirationPost(userId, userData, force);
				break;
			case 'summary':
				await generateSummaryPost(userId, userData, force);
				break;
			case 'midweek':
				await generateMidWeekPost(userId, userData, force);
				break;
			case 'weekly':
				await generateWeeklyWrapUpPost(userId, userData, force);
				break;
			case 'progress':
				await generateProgressPhotoPost(userId, force);
				break;
			case 'cycle':
				await generateCycleReviewPost(userId, force);
				break;
			case 'contextual':
			case 'midday':
			case 'evening':
				const contextType = (type === 'contextual' ? subType : type) || 'general';
				await generateContextualPost(userId, userData, force, contextType);
				break;
			default:
				logger.warn(`Unknown post type: ${type}`);
		}
	} catch (error) {
		logger.error(`[UNIFIED] Error generating post ${type} for ${userId}`, error);
		throw error;
	}
}


// ==========================================
// HELPERS
// ==========================================

async function checkPostExists(userId: string, sourceId: string, dateKey: string): Promise<boolean> {
	const q = await db.collection('feed-items')
		.where('userId', '==', userId)
		.where('source.id', '==', sourceId)
		.where('dateKey', '==', dateKey)
		.limit(1)
		.get();
	return !q.empty;
}

// ==========================================
// GENERATORS
// ==========================================

// 1. MOTIVATIONAL
async function generateMotivationalPost(userId: string, user: any, force: boolean, contextType: string) {
	const todayKey = new Date().toISOString().split('T')[0];
	const sourceId = `motivational-${contextType}-${todayKey}`;

	if (!force && await checkPostExists(userId, sourceId, todayKey)) {
		logger.info(`Motivational post already exists for ${userId} today`);
		return;
	}

	logger.info(`Generating ${contextType} motivational post for ${userId}`);

	// 1. Generate text
	let prompt = `Give me a ${contextType} motivational quote for someone focused on wellness.`;
	if (user.firstName) prompt += ` Address them as ${user.firstName}.`;

	let content = "";
	try {
		const response = await getOpenAIText().callOpenAI(prompt);
		content = response.replace(/^"|"$/g, '').trim(); // Remove quotes
	} catch (e) {
		logger.error("Error generating text", e);
		content = "Keep pushing forward. Every step counts.";
	}

	// 2. Generate Image
	let imageUrl = null;
	try {
		const imagePrompt = `A beautiful, motivating, abstract background image suitable for a wellness app. Style: minimal, calming, premium. Theme: ${contextType} motivation.`;
		imageUrl = await getGeminiImage().generateImage(imagePrompt, 'standard');
	} catch (e) {
		logger.error("Error generating image", e);
	}

	// 3. Save Feed Item
	await db.collection('feed-items').add({
		userId,
		type: 'motivational',
		title: contextType === 'morning' ? 'Good Morning' : 'Motivation',
		subtitle: 'Daily Inspiration',
		body: content,
		dateKey: todayKey,
		source: { kind: 'generated', id: sourceId },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		media: imageUrl ? {
			status: 'ready',
			url: imageUrl,
			type: 'image'
		} : { status: 'none' },
		metrics: []
	});

	await notificationService.sendPushNotification(
		userId,
		contextType === 'morning' ? 'Good Morning ☀️' : 'New Motivation 🌟',
		content || "Your daily inspiration is ready",
		{ type: 'motivational', subType: contextType }
	);
}

// 2. ACTION
async function generateActionPostsForUser(userId: string, user: any, force: boolean) {
	const trackersSnapshot = await db.collection('trackers').where('userId', '==', userId).where('isActive', '==', true).get();

	for (const doc of trackersSnapshot.docs) {
		const tracker = doc.data();
		// Simple logic: if entries are low, nudge user.
		// (In a real app, we'd query tracker-entries here to check progress)

		// 10% chance to generate an action post per tracker to avoid spam, unless forced
		if (!force && Math.random() > 0.1) continue;

		const todayKey = new Date().toISOString().split('T')[0];
		const sourceId = `action-${doc.id}-${todayKey}`;

		if (!force && await checkPostExists(userId, sourceId, todayKey)) continue;

		const prompt = `Give a short, actionable tip for maintaining a '${tracker.name}' habit.`;
		let tip = "";
		try {
			const res = await getOpenAIText().callOpenAI(prompt);
			tip = res;
		} catch (e) {
			tip = `Don't forget to log your ${tracker.name} today!`;
		}

		await db.collection('feed-items').add({
			userId,
			type: 'action',
			title: 'Action Item',
			subtitle: tracker.name,
			body: tip,
			dateKey: todayKey,
			source: { kind: 'tracker-check', id: sourceId },
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
			visibility: 'private',
			metrics: [],
			media: { status: 'none' },
			actionLink: `/tracker/${doc.id}`
		});

		await notificationService.sendPushNotification(
			userId,
			'New Action Plan ⚡',
			tip || `Time to check in on ${tracker.name}`,
			{ type: 'action', trackerId: doc.id }
		);
	}
}

// 3. INSIGHT
async function generateInsightPostsForUser(userId: string, user: any, force: boolean) {
	// Consolidate "Weekly Analysis" or similar
	const todayKey = new Date().toISOString().split('T')[0];
	const sourceId = `insight-weekly-${todayKey}`;

	if (!force && await checkPostExists(userId, sourceId, todayKey)) return;

	// Fetch some stats (mocked for now, in reality you'd import getStatistics or calculate)
	const prompt = `Analyze a hypothetical user's week. They have been inconsistent with sleep but good with hydration. Give a 2-sentence insight.`;
	let insight = "";
	try {
		const res = await getOpenAIText().callOpenAI(prompt);
		insight = res;
	} catch (e) {
		insight = "Consistency is key. Try to align your sleep schedule with your hydration habits.";
	}

	await db.collection('feed-items').add({
		userId,
		type: 'insight',
		title: 'Weekly Insight',
		subtitle: 'Performance Analysis',
		body: insight,
		dateKey: todayKey,
		source: { kind: 'analysis', id: sourceId },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		metrics: [],
		media: { status: 'none' }
	});

	await notificationService.sendPushNotification(
		userId,
		'Weekly Insight 💡',
		insight || "Check out your weekly analysis",
		{ type: 'insight' }
	);
}

// 4. INSPIRATION (Redirects to motivational for now, or distinct logic)
async function generateInspirationPost(userId: string, user: any, force: boolean) {
	return generateMotivationalPost(userId, user, force, 'inspiration');
}

// 5. SUMMARY
async function generateSummaryPost(userId: string, user: any, force: boolean) {
	const todayKey = new Date().toISOString().split('T')[0];
	await db.collection('feed-items').add({
		userId,
		type: 'summary',
		title: 'Daily Summary',
		subtitle: new Date().toLocaleDateString(),
		body: "You've logged 3 activities today. Keep it up!",
		dateKey: todayKey,
		source: { kind: 'summary', id: `summary-${todayKey}` },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		media: { status: 'none' }
	});

	await notificationService.sendPushNotification(
		userId,
		'Daily Summary 📊',
		"Your daily summary is ready",
		{ type: 'summary' }
	);
}

// 6. MIDWEEK
async function generateMidWeekPost(userId: string, user: any, force: boolean) {
	const todayKey = new Date().toISOString().split('T')[0];
	await db.collection('feed-items').add({
		userId,
		type: 'midweek',
		title: 'Midweek Check-in',
		subtitle: 'Wednesday Wellness',
		body: "Halfway through the week! How are your goals coming along?",
		dateKey: todayKey,
		source: { kind: 'periodical', id: `midweek-${todayKey}` },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		media: { status: 'none' }
	});

	await notificationService.sendPushNotification(
		userId,
		'Midweek Check-in 🐫',
		"How's your week going?",
		{ type: 'midweek' }
	);
}

// 7. WEEKLY
async function generateWeeklyWrapUpPost(userId: string, user: any, force: boolean) {
	const todayKey = new Date().toISOString().split('T')[0];
	await db.collection('feed-items').add({
		userId,
		type: 'weekly',
		title: 'Weekly Wrap-Up',
		subtitle: 'Week in Review',
		body: "Great work this week. Take a moment to reflect on your progress.",
		dateKey: todayKey,
		source: { kind: 'periodical', id: `weekly-${todayKey}` },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		media: { status: 'none' }
	});

	await notificationService.sendPushNotification(
		userId,
		'Weekly Wrap-Up 🎁',
		"Your week in review is ready",
		{ type: 'weekly' }
	);
}

// 8. PROGRESS (Skeleton)
async function generateProgressPhotoPost(userId: string, force: boolean) {
	logger.info("Progress photo post generation not implemented yet");
}

// 9. CYCLE (Skeleton)
async function generateCycleReviewPost(userId: string, force: boolean) {
	logger.info("Cycle review post generation not implemented yet");
}

// 10. CONTEXTUAL
async function generateContextualPost(userId: string, user: any, force: boolean, type: string) {
	return generateMotivationalPost(userId, user, force, type);
}
