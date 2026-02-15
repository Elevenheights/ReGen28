
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();

/**
 * Creates the initial welcome feed for a new user.
 * 1. Static "Welcome" posts explaining the app.
 * 2. Triggers the first Daily Action, Insight, and Morning Motivation posts.
 */
export async function createWelcomeFeed(userId: string, userName: string) {
	try {
		const batch = db.batch();
		const now = new Date();
		const todayKey = now.toISOString().split('T')[0];

		// 1. Static Welcome Post - Philosophy
		const welcomePostRef = db.collection('feed-items').doc();
		batch.set(welcomePostRef, {
			userId,
			type: 'system',
			title: `Welcome to ReGen28, ${userName}!`,
			subtitle: 'Your Journey Begins',
			body: "We're so glad you're here. ReGen28 is designed to help you balance your Mind, Body, Soul, and Beauty through consistent, small actions. This feed is your personal dashboard for growth.",
			imageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80', // Placeholder or branded image
			dateKey: todayKey,
			visibility: 'private',
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
			author: {
				name: 'Regen28 Team',
				avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=regen28',
				isAiGenerated: false,
				location: 'HQ'
			},
			likesCount: 0,
			commentsCount: 0,
			tags: ['welcome', 'guide']
		});

		// 2. Static Welcome Post - Actions & Insights
		const guidePostRef = db.collection('feed-items').doc();
		batch.set(guidePostRef, {
			userId,
			type: 'system',
			title: 'How It Works: Actions & Insights',
			subtitle: 'AI-Powered Coaching',
			body: "Every day, you'll receive personalized 'Actions' to help you build habits, and 'Insights' that analyze your progress. The more you track, the smarter your coach becomes!",
			imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
			dateKey: todayKey,
			visibility: 'private',
			createdAt: new Date(now.getTime() - 1000), // Slightly older
			updatedAt: FieldValue.serverTimestamp(),
			author: {
				name: 'Regen28 Team',
				avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=regen28',
				isAiGenerated: false,
				location: 'HQ'
			},
			likesCount: 0,
			commentsCount: 0,
			tags: ['guide', 'tips']
		});

		// 3. Static Welcome Post - The Living Feed
		const feedGuideRef = db.collection('feed-items').doc();
		batch.set(feedGuideRef, {
			userId,
			type: 'system',
			title: 'Your Living Feed: More Than Just Posts',
			subtitle: 'A Dynamic Journal of You',
			body: "This feed isn't just a timeline—it's a living reflection of your journey. It adapts to your mood, celebrates your wins, and evolves as you grow. Think of it as an interactive journal that writes itself based on your actions.",
			imageUrl: 'https://images.unsplash.com/photo-1506784365371-e633d0711696?auto=format&fit=crop&w=800&q=80', // Nature/Growth metaphor
			dateKey: todayKey,
			visibility: 'private',
			createdAt: new Date(now.getTime() - 2000), // Even older to appear last (or first depending on sort)
			updatedAt: FieldValue.serverTimestamp(),
			author: {
				name: 'Regen28 Team',
				avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=regen28',
				isAiGenerated: false,
				location: 'HQ'
			},
			likesCount: 0,
			commentsCount: 0,
			tags: ['guide', 'philosophy']
		});

		await batch.commit();
		logger.info(`Created static welcome posts for user ${userId}`);

		// 3. Trigger AI Posts via Task Queue
		// We use tasks to ensure the onboarding function returns quickly
		const queueFunctions = getFunctions();

		// Morning Motivation (Immediate)
		await queueFunctions.taskQueue("generateMotivationalPostTask").enqueue({
			userId,
			force: true,
			type: 'morning' // Treat first login like a morning wake-up
		});

		// Daily Action (Force generation for today)
		await queueFunctions.taskQueue("generateActionPostTask").enqueue({
			userId,
			force: true
		});

		// Daily Insight (Force generation, though might be skipped if 0 data, but worth trying for "New Journey" insight)
		await queueFunctions.taskQueue("generateInsightPostTask").enqueue({
			userId,
			force: true
		});

		logger.info(`Queued initial AI posts for user ${userId}`);

	} catch (error) {
		logger.error(`Failed to create welcome feed for user ${userId}:`, error);
		// Don't throw, we don't want to fail the entire onboarding just for feed items
	}
}
