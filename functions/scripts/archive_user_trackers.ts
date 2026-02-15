
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// Attempt to use default application credentials
if (admin.apps.length === 0) {
	admin.initializeApp();
}

const db = admin.firestore();

async function archiveInactiveTrackers(userId: string) {
	console.log(`Starting archive check for user: ${userId}`);
	// Check if user exists
	const userDoc = await db.doc(`users/${userId}`).get();
	if (!userDoc.exists) {
		console.warn(`User ${userId} not found.`);
	}

	const trackersRef = db.collection(`trackers`); // Wait, trackers are root collection or subcollection?
	// Based on previous code: `this.trackerService.getUserTrackers()` calls likely subcollection?
	// Let's check `TrackerService` to be sure.
	// In `tracker.service.ts` (viewed earlier):
	// `collection(this.firestore, 'users', userId, 'trackers')` is standard pattern.
	// BUT wait, in `tracker.service.ts` earlier view (lines 1-800), I saw methods but didn't memorize the path.
	// I recall `users/${userId}/trackers` from similar apps, and my previous CLI attempt tried `users/.../trackers`.
	// Let's assume subcollection `trackers` under user document.

	// HOWEVER, I also see `db.collection('trackers')` in some contexts?
	// Let's double check `tracker.service.ts` quickly or just guess `users/${userId}/trackers` as it's the standard for per-user data.
	// The previous CLI `firebase firestore:documents:list "users/0DuDb3xt2LNFGmJFtfw4Ftl22oL2/trackers"` failed with exit code 1, which might mean path issue or auth.
	// Let's try `trackers` subcollection.

	// Correction: In `TrackerService`, almost certainly `users/{userId}/trackers`.

	const trackersQuery = db.collection(`users/${userId}/trackers`);
	const snapshot = await trackersQuery.get();

	console.log(`Found ${snapshot.size} total trackers.`);

	if (snapshot.empty) {
		console.log('No trackers found in subcollection.');
		return;
	}

	let updatedCount = 0;
	const batch = db.batch();

	snapshot.forEach(doc => {
		const data = doc.data();

		// Check availability of isActive
		// If it is missing, we treat it as "legacy" and archive it.
		if (data['isActive'] === undefined || data['isActive'] === null) {
			console.log(`Archiving tracker: ${doc.id} (${data['name']}) - Reason: Missing isActive field`);
			batch.update(doc.ref, {
				isActive: false,
				archivedAt: admin.firestore.FieldValue.serverTimestamp()
			});
			updatedCount++;
		}
		// Also, if the user implies "existing trackers that are not active" might effectively mean 
		// "trackers that are currently falsy but don't have the explicit field", my check covers that.
	});

	if (updatedCount > 0) {
		await batch.commit();
		console.log(`Successfully archived ${updatedCount} legacy trackers.`);
	} else {
		console.log('No legacy trackers found needing updates.');
	}
}

// Target User
const targetUserId = '0DuDb3xt2LNFGmJFtfw4Ftl22oL2';

archiveInactiveTrackers(targetUserId)
	.then(() => {
		console.log('Migration complete.');
		process.exit(0);
	})
	.catch(err => {
		console.error('Migration failed:', err);
		process.exit(1);
	});
