import { getFirestore } from "firebase-admin/firestore";

async function seedData() {
	const db = getFirestore();
	const userId = "0DuDb3xt2LNFGmJFtfw4Ftl22oL2";

	console.log(`🌱 Starting seeding for user: ${userId}`);

	const trackersSnapshot = await db.collection("trackers").where("userId", "==", userId).get();
	const trackers = trackersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

	console.log(`📊 Found ${trackers.length} trackers`);

	const today = new Date("2026-02-06");
	let entryCount = 0;
	let journalCount = 0;

	for (let i = 0; i < 20; i++) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		for (const tracker of trackers) {
			// 80% completion rate for a dense-looking dashboard
			if (Math.random() > 0.2) {
				await db.collection("tracker-entries").add({
					trackerId: tracker.id,
					userId: userId,
					date: dateStr,
					value: (tracker as any).target || 1,
					mood: Math.floor(Math.random() * 4) + 6, // 6-10
					energy: Math.floor(Math.random() * 3) + 3, // 3-5
					notes: i === 0 ? "Feeling strong today!" : undefined,
					createdAt: date,
					updatedAt: date
				});
				entryCount++;
			}
		}

		// Add a journal entry every 2-3 days
		if (Math.random() > 0.6) {
			await db.collection("journal-entries").add({
				userId: userId,
				date: dateStr,
				title: `Reflection: ${dateStr}`,
				content: `<p>Consistency is the key to transformation. Today was a ${Math.random() > 0.5 ? 'great' : 'productive'} day on my 28-day journey. Focusing on my ${(trackers[0] as any)?.category || 'wellness'} goals feels more natural every day.</p>`,
				mood: Math.floor(Math.random() * 4) + 6,
				createdAt: date,
				updatedAt: date
			});
			journalCount++;
		}
	}

	console.log(`✅ Seeding complete!`);
	console.log(`📝 Created ${entryCount} tracker entries and ${journalCount} journal entries.`);
}

// Support both direct execution and import
if (require.main === module) {
	seedData().catch(console.error);
} else {
	// Manual trigger if needed
	(global as any).seedData = seedData;
}
