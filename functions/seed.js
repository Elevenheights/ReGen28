const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');

if (getApps().length === 0) {
	initializeApp();
}

const db = getFirestore();
const userId = "0DuDb3xt2LNFGmJFtfw4Ftl22oL2";

async function seedData() {
	console.log(`🌱 Starting seeding for user: ${userId}`);

	const trackersSnapshot = await db.collection("trackers").where("userId", "==", userId).get();
	const trackers = trackersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

	console.log(`📊 Found ${trackers.length} trackers`);
	if (trackers.length === 0) {
		console.log("No trackers found. Creating default ones first...");
		const defaultTrackers = [
			{ name: "Meditation", category: "mind", target: 10, unit: "minutes", icon: "🧘", color: "#3b82f6" },
			{ name: "Exercise", category: "body", target: 1, unit: "session", icon: "💪", color: "#10b981" },
			{ name: "Reading", category: "mind", target: 20, unit: "minutes", icon: "📚", color: "#3b82f6" },
			{ name: "Water Intake", category: "body", target: 8, unit: "glasses", icon: "💧", color: "#0ea5e9" }
		];

		for (const dt of defaultTrackers) {
			const docRef = await db.collection("trackers").add({
				...dt,
				userId: userId,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date()
			});
			trackers.push({ id: docRef.id, ...dt });
		}
	}

	const today = new Date("2026-02-06");
	let entryCount = 0;
	let journalCount = 0;

	for (let i = 0; i < 20; i++) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		for (const tracker of trackers) {
			if (Math.random() > 0.2) {
				await db.collection("tracker-entries").add({
					trackerId: tracker.id,
					userId: userId,
					date: dateStr,
					value: tracker.target || 1,
					mood: Math.floor(Math.random() * 4) + 6,
					energy: Math.floor(Math.random() * 3) + 3,
					createdAt: date,
					updatedAt: date
				});
				entryCount++;
			}
		}

		if (Math.random() > 0.6) {
			await db.collection("journal-entries").add({
				userId: userId,
				date: dateStr,
				title: `Reflection: ${dateStr}`,
				content: `<p>Consistency is key. Day ${20 - i} of my progress. Feeling ${Math.random() > 0.5 ? 'balanced' : 'focused'}.</p>`,
				mood: Math.floor(Math.random() * 4) + 6,
				createdAt: date,
				updatedAt: date
			});
			journalCount++;
		}
	}

	console.log(`✅ Seeding complete! Created ${entryCount} tracker entries and ${journalCount} journal entries.`);
}

module.exports = { seedData };
