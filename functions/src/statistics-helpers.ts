
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from "firebase-functions/logger";

const db = getFirestore();

/**
 * Increment User Daily Stats (Lightweight)
 * Updates the user-daily-stats document with a simple atomic increment.
 * This avoids the heavy read/write cost of recalculating the entire day.
 */
export async function incrementUserDailyStats(
	userId: string,
	date: string,
	updateData: {
		activityType?: 'tracker' | 'journal' | 'activity';
		category?: string;
		mood?: number;
		energy?: number;
	}
): Promise<void> {
	const statsRef = db.collection('user-daily-stats').doc(`${userId}_${date}`);

	// We use a simple update if possible, or set if not exists
	// Using merge: true is cheaper than a transaction for simple upserts if we trust the initial state
	// But atomic increments require an existing doc to work perfectly in some SDKs, though FieldValue.increment works with set({merge:true}) usually.

	const update: any = {
		totalActivities: FieldValue.increment(1),
		updatedAt: FieldValue.serverTimestamp()
	};

	if (updateData.activityType === 'tracker') {
		update.totalTrackerEntries = FieldValue.increment(1);
	} else if (updateData.activityType === 'journal') {
		update.totalJournalEntries = FieldValue.increment(1);
	}

	if (updateData.category) {
		const catInfo = updateData.category.toLowerCase();
		if (catInfo === 'mind') update.mindMinutes = FieldValue.increment(1);
		else if (catInfo === 'body') update.bodyActivities = FieldValue.increment(1);
		else if (catInfo === 'soul') update.soulActivities = FieldValue.increment(1);
		else if (catInfo === 'beauty') update.beautyRoutines = FieldValue.increment(1);
	}

	// For the very first entry of the day, we need to ensure the doc exists with base fields
	// set() with merge: true handles both creation and update efficiently
	try {
		await statsRef.set(update, { merge: true });
		logger.info(`✅ Lightweight stats increment for user ${userId}`);
	} catch (error) {
		logger.error(`❌ Failed to increment stats for user ${userId}:`, error);
	}
}
