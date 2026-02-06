import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Seed dummy data for a specific user - DEV USE ONLY
 */
export const seedUserTestData = onCall({
	invoker: 'public'
}, async (request) => {
	const db = getFirestore();
	const { auth, data } = request;

	if (!auth) {
		throw new HttpsError('unauthenticated', 'User must be authenticated');
	}

	const userId = data.userId || auth.uid;

	// Only allow users to seed their own data (unless admin)
	if (userId !== auth.uid && auth.token?.admin !== true) {
		throw new HttpsError('permission-denied', 'Cannot seed data for other users');
	}

	try {
		console.log(`🌱 Starting seeding for user: ${userId}`);

		const trackersSnapshot = await db.collection("trackers").where("userId", "==", userId).get();
		let trackers = trackersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

		console.log(`📊 Found ${trackers.length} trackers`);

		if (trackers.length === 0) {
			console.log("No trackers found. Creating default ones first...");
			const defaultTrackers = [
				{ name: "Meditation", category: "mind", target: 10, unit: "minutes", icon: "fa-brain", color: "#3b82f6", type: "duration", frequency: "daily" },
				{ name: "Exercise", category: "body", target: 1, unit: "session", icon: "fa-dumbbell", color: "#10b981", type: "count", frequency: "weekly" },
				{ name: "Reading", category: "mind", target: 20, unit: "minutes", icon: "fa-book", color: "#3b82f6", type: "duration", frequency: "daily" },
				{ name: "Water Intake", category: "body", target: 8, unit: "glasses", icon: "fa-glass-water", color: "#0ea5e9", type: "count", frequency: "daily" }
			];

			const batch = db.batch();
			for (const dt of defaultTrackers) {
				const docRef = db.collection("trackers").doc();
				const trackerData = {
					...dt,
					userId: userId,
					isActive: true,
					isCompleted: false,
					durationDays: 28,
					startDate: new Date(),
					endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
					entryCount: 0,
					createdAt: FieldValue.serverTimestamp(),
					updatedAt: FieldValue.serverTimestamp()
				};
				batch.set(docRef, trackerData);
				trackers.push({ id: docRef.id, ...trackerData });
			}
			await batch.commit();
			console.log(`Created ${defaultTrackers.length} default trackers.`);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0); // Normalize to start of day

		let entryCount = 0;
		let journalCount = 0;
		const entryBatch = db.batch();

		for (let i = 0; i < 20; i++) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];

			for (const tracker of trackers) {
				// High completion rate for dummy data
				const shouldLog = Math.random() > 0.25;
				if (shouldLog) {
					const entryRef = db.collection("tracker-entries").doc();
					entryBatch.set(entryRef, {
						trackerId: tracker.id,
						userId: userId,
						date: dateStr,
						value: tracker.target || (tracker.type === 'count' ? 1 : 10),
						mood: Math.floor(Math.random() * 4) + 6,
						energy: Math.floor(Math.random() * 3) + 3,
						notes: i === 0 ? "Feeling strong today!" : undefined,
						createdAt: date,
						updatedAt: date
					});
					entryCount++;
				}
			}

			// Add journal entry occasionally
			if (Math.random() > 0.6) {
				const journalRef = db.collection("journal-entries").doc();
				entryBatch.set(journalRef, {
					userId: userId,
					date: dateStr,
					title: `Reflection: ${dateStr}`,
					content: `<p>Consistency is the key to transformation. Today was a ${Math.random() > 0.5 ? 'great' : 'productive'} day on my 28-day journey.</p>`,
					mood: Math.floor(Math.random() * 4) + 6,
					createdAt: date,
					updatedAt: date
				});
				journalCount++;
			}

			// Commit every 100 operations to stay under batch limit (500)
			if (entryCount + journalCount > 400) {
				// In a real script we'd commit here, but for 20 days it's fine
			}
		}

		await entryBatch.commit();

		// Update tracker counts (approximate)
		for (const tracker of trackers) {
			const entriesForTracker = entryCount / trackers.length; // rough estimate
			await db.collection("trackers").doc(tracker.id).update({
				entryCount: FieldValue.increment(Math.floor(entriesForTracker)),
				updatedAt: FieldValue.serverTimestamp()
			});
		}

		console.log(`✅ Seeding complete! Created ${entryCount} tracker entries and ${journalCount} journal entries.`);

		return {
			success: true,
			entriesCreated: entryCount,
			journalEntriesCreated: journalCount,
			message: `Successfully seeded data for ${userId}`
		};

	} catch (error) {
		console.error('Error in seeding operation:', error);
		throw new HttpsError('internal', `Failed to seed data: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
});
