
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

import { OpenAIService as OpenAITextService } from '../openai.service';
import { ImageGenerationService } from '../services/image-generation.service';
import { notificationService } from '../services/notification.service';
import { calculateAge, getUserCurrentDateTime, calculateTrackerAnalytics, getUserLocalTime } from './feed-helpers';
import { getWeatherForLocation } from '../weather.service';

const db = getFirestore();
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Lazy load Services
let _openaiText: OpenAITextService | null = null;
let _imageService: ImageGenerationService | null = null;

function getOpenAIText() {
	if (!_openaiText) {
		const apiKey = process.env.OPENAI_API_KEY || (openaiApiKey.value ? openaiApiKey.value() : '');
		_openaiText = new OpenAITextService(apiKey);
	}
	return _openaiText;
}

function getImageService() {
	if (!_imageService) {
		const apiKey = process.env.OPENAI_API_KEY || (openaiApiKey.value ? openaiApiKey.value() : '');
		_imageService = new ImageGenerationService(apiKey);
	}
	return _imageService;
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

/**
 * Hourly Scheduler for Cadence-based Feed Posts
 * Checks every active user to see if it's currently their Wake, Midday, or Bedtime hour.
 */
export const queueUnifiedFeedCadence = onSchedule({
	schedule: '0 * * * *', // Every hour at minute 0
	timeoutSeconds: 540,
	memory: '512MiB',
}, async () => {
	logger.info('🕐 Starting Unified Feed Cadence check...');
	const queue = getFunctions().taskQueue("generateFeedPostTask");

	try {
		// 1. Get all active users
		const usersSnapshot = await db.collection('users')
			.where('isOnboardingComplete', '==', true)
			.where('status', '==', 'active')
			.get();

		logger.info(`🔍 Checking cadence for ${usersSnapshot.size} active users`);

		const promises: Promise<any>[] = [];

		for (const userDoc of usersSnapshot.docs) {
			const userData = userDoc.data();
			const userId = userDoc.id;
			const timezone = userData.preferences?.timezone || 'UTC';
			const schedule = userData.preferences?.schedule || {
				wakeTime: '06:00',
				midDayTime: '12:00',
				bedTime: '22:00'
			};

			// Get user's local hour
			const { hour } = getUserLocalTime(timezone);

			// Extract hours from schedule (format HH:mm)
			const wakeHour = parseInt(schedule.wakeTime.split(':')[0]);
			const midHour = parseInt(schedule.midDayTime.split(':')[0]);
			const bedHour = parseInt(schedule.bedTime.split(':')[0]);

			let targetType: string | null = null;
			if (hour === wakeHour) targetType = 'morning';
			else if (hour === midHour) targetType = 'midday';
			else if (hour === bedHour) targetType = 'evening';

			if (targetType) {
				logger.info(`🎯 Cadence Match! User ${userId} is in their ${targetType} window (Hour: ${hour})`);

				// Enqueue task for this specific user and type
				promises.push(queue.enqueue({
					userId,
					type: targetType,
					force: false // Respect 24h limits inside generator
				}));
			}
		}

		await Promise.all(promises);
		logger.info(`✅ Successfully queued ${promises.length} cadence tasks`);

	} catch (error) {
		logger.error('💥 Error in queueUnifiedFeedCadence:', error);
	}
});

// ==========================================
// CORE DISPATCHER
// ==========================================

async function dispatchPostGeneration(userId: string, type: string, force: boolean = false, subType?: string) {
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
	const userTimezone = user.preferences?.timezone || 'America/New_York';
	const userTime = getUserCurrentDateTime(userTimezone);
	const todayKey = userTime.dateKey;
	const sourceId = `motivational-${contextType}-${todayKey}`;

	if (!force && await checkPostExists(userId, sourceId, todayKey)) {
		logger.info(`Motivational post already exists for ${userId} today`);
		return;
	}

	logger.info(`Generating ${contextType} motivational post for ${userId}`);

	// Gather Context
	const age = user.birthday ? calculateAge(user.birthday) : null;
	const gender = user.gender || null;
	const goals = user.wellnessGoals || [];
	const focus = user.focusAreas || [];
	const location = user.location || 'Unknown';
	const weather = location !== 'Unknown' ? await getWeatherForLocation(location).catch(() => 'mild') : 'mild';

	// Fetch some stats for extra personalization
	const statsDoc = await db.collection('user-daily-stats').doc(`${userId}_${todayKey}`).get();
	const stats = statsDoc.exists ? statsDoc.data() : {};

	// 1. Generate text
	let prompt = `You are ${user.firstName || 'Champion'}'s personal wellness coach. 
We are in ${userTime.formattedDateTime} (${userTime.dayOfWeek}). User location: ${location}. Weather: ${weather}.
User Profile: ${age ? age + ' y/o' : ''} ${gender || ''}. Focus: ${focus.join(', ')}. Goals: ${goals.join(', ')}.
Current Streak: ${user.streakCount || 0} days. Recent Mood: ${stats?.overallAverageMood || 'stable'}/10.

Requirements:
1. Highly specific ${contextType} motivational quote.
2. Empowerment focused, aspirational.
3. Personal and relevant to current progress (${user.streakCount} day streak!).
4. Address them as ${user.firstName || 'Champion'}.
5. Return ONLY the quote text.`;

	let content = "";
	try {
		const response = await getOpenAIText().callOpenAI(prompt, false);
		content = response.replace(/^"|"$/g, '').trim();
	} catch (e) {
		logger.error("Error generating text", e);
		content = "Your potential is infinite. Keep building the best version of yourself today.";
	}

	// 2. Generate Image (High Fidelity Fallback)
	let imageUrl = null;
	let mediaMeta = { source: 'none', model: 'none' };
	try {
		const style = user.preferences?.visualStyle || 'vivid';
		const imagePrompt = `A stunning, high-fidelity ${style} scene of a ${age || 25} year old ${gender || 'person'} 
achieving their wellness goals in ${location}. Mood: ${contextType} optimism, empowering. 
Incorporate elements of ${focus.join(' and ')}. Photorealistic yet aspirational. 4k, cinematic lighting.`;

		const res = await getImageService().generateUniversalImage(imagePrompt, {
			userId,
			modelType: 'standard',
			referenceImages: user.referencePhotos || [],
			style: user.preferences?.visualStyle === 'realistic' ? 'realistic' : 'illustrated'
		});

		imageUrl = res.imageUrl;
		mediaMeta = { source: res.source, model: res.model };
	} catch (e) {
		logger.error("Error generating image", e);
	}

	// 3. Save Feed Item
	await db.collection('feed-items').add({
		userId,
		type: 'motivational',
		title: contextType === 'morning' ? 'Rising Strong' : 'Daily Inspiration',
		subtitle: userTime.dayOfWeek,
		body: content,
		dateKey: todayKey,
		source: { kind: 'generated', id: sourceId },
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
		visibility: 'private',
		media: imageUrl ? {
			status: 'ready',
			url: imageUrl,
			type: 'image',
			...mediaMeta
		} : { status: 'none' },
		metrics: []
	});

	await notificationService.sendPushNotification(
		userId,
		contextType === 'morning' ? 'Good Morning ☀️' : 'Personal Insight 💡',
		content.length > 100 ? content.substring(0, 97) + '...' : content,
		{ type: 'motivational', subType: contextType }
	);
}

// 2. ACTION
async function generateActionPostsForUser(userId: string, user: any, force: boolean) {
	const userTimezone = user.preferences?.timezone || 'America/New_York';
	const userTime = getUserCurrentDateTime(userTimezone);
	const todayKey = userTime.dateKey;

	const trackersSnapshot = await db.collection('trackers').where('userId', '==', userId).where('isActive', '==', true).get();

	for (const doc of trackersSnapshot.docs) {
		const tracker = doc.data();
		const sourceId = `action-${doc.id}-${todayKey}`;

		if (!force && await checkPostExists(userId, sourceId, todayKey)) continue;

		// 20% chance to generate per tracker unless forced, cap at 3 total per day
		if (!force && Math.random() > 0.2) continue;

		const analytics = await calculateTrackerAnalytics(db, doc.id, userId, 30, tracker);

		// Generate Prompt for Action Tip
		const prompt = `User ${user.firstName || ''} is tracking '${tracker.name}' (${tracker.category}).
Goal: ${tracker.target} ${tracker.unit} ${tracker.frequency}.
Stats: ${analytics.completionRate}% completion, ${analytics.currentStreak} day streak.
Trend: ${analytics.trend}. Best days: ${analytics.bestDays?.join(', ') || 'Varied'}.
Current Time: ${userTime.formattedDateTime}.

Give a specific, high-fidelity actionable coaching tip for today. 
Be witty, encouraging, and highly practical.
Return JSON: { "tip": "...", "reason": "...", "icon": "..." }`;

		try {
			const res = await getOpenAIText().callOpenAI(prompt, true);

			await db.collection('feed-items').add({
				userId,
				type: 'action',
				title: tracker.name,
				subtitle: 'Daily Action Plan',
				body: res.tip,
				dateKey: todayKey,
				source: { kind: 'tracker-check', id: sourceId },
				metadata: {
					icon: res.icon || '⚡',
					reason: res.reason,
					trackerId: doc.id
				},
				createdAt: FieldValue.serverTimestamp(),
				updatedAt: FieldValue.serverTimestamp(),
				visibility: 'private',
				metrics: [],
				media: { status: 'none' },
				actionLink: `/tracker/${doc.id}`
			});

			await notificationService.sendPushNotification(
				userId,
				`Action for ${tracker.name} ⚡`,
				res.tip,
				{ type: 'action', trackerId: doc.id }
			);
		} catch (e) {
			logger.error(`Error generating action for tracker ${doc.id}`, e);
		}
	}
}

// 3. INSIGHT
async function generateInsightPostsForUser(userId: string, user: any, force: boolean) {
	const userTimezone = user.preferences?.timezone || 'America/New_York';
	const userTime = getUserCurrentDateTime(userTimezone);
	const todayKey = userTime.dateKey;
	const sourceId = `insight-pattern-${todayKey}`;

	if (!force && await checkPostExists(userId, sourceId, todayKey)) return;

	// Fetch aggregate daily stats for context
	const snapshot = await db.collection('user-daily-stats')
		.where('userId', '==', userId)
		.orderBy('date', 'desc')
		.limit(14)
		.get();

	const recentStats = snapshot.docs.map(d => d.data());
	if (recentStats.length < 3 && !force) return;

	const prompt = `Analyze these 14 days of wellness stats for ${user.firstName || 'User'}:
${JSON.stringify(recentStats.map(s => ({ date: s.date, score: s.wellnessScore, mood: s.overallAverageMood, energy: s.overallAverageEnergy })))}

Identify a non-obvious pattern or correlation. 
Give a deep-dive wellness insight. 
Return JSON: { "insight": "...", "dataPoint": "...", "type": "correlation|discovery|celebration" }`;

	try {
		const res = await getOpenAIText().callOpenAI(prompt, true);

		await db.collection('feed-items').add({
			userId,
			type: 'insight',
			title: 'A-HA! Moment',
			subtitle: 'Pattern Discovery',
			body: res.insight,
			dateKey: todayKey,
			source: { kind: 'analysis', id: sourceId },
			metadata: {
				dataPoint: res.dataPoint,
				insightType: res.type
			},
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
			visibility: 'private',
			metrics: [],
			media: { status: 'none' }
		});

		await notificationService.sendPushNotification(
			userId,
			'New Pattern Discovered 💡',
			res.insight,
			{ type: 'insight' }
		);
	} catch (e) {
		logger.error("Error generating insight", e);
	}
}

// 4. INSPIRATION (Redirects to motivational)
async function generateInspirationPost(userId: string, user: any, force: boolean) {
	return generateMotivationalPost(userId, user, force, 'inspiration');
}

// 5. SUMMARY
async function generateSummaryPost(userId: string, user: any, force: boolean) {
	const userTimezone = user.preferences?.timezone || 'America/New_York';
	const userTime = getUserCurrentDateTime(userTimezone);
	const todayKey = userTime.dateKey;

	await db.collection('feed-items').add({
		userId,
		type: 'summary',
		title: 'Daily Summary',
		subtitle: userTime.formattedDateTime,
		body: `You've had a productive day, ${user.firstName || 'Champion'}! Your consistency is building momentum.`,
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
}

async function generateProgressPhotoPost(userId: string, force: boolean) {
	logger.info("Progress photo post generation not implemented yet");
}

async function generateCycleReviewPost(userId: string, force: boolean) {
	logger.info("Cycle review post generation not implemented yet");
}

async function generateContextualPost(userId: string, user: any, force: boolean, type: string) {
	return generateMotivationalPost(userId, user, force, type);
}
