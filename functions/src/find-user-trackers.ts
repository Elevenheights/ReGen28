import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

const userId = "0DuDb3xt2LNFGmJFtfw4Ftl22oL2";
initializeApp();
const db = getFirestore();

async function findTrackers() {
	console.log(`Checking trackers for user: ${userId}`);
	const trackersSnapshot = await db.collection("trackers")
		.where("userId", "==", userId)
		.where("isActive", "==", true)
		.get();

	const trackers = trackersSnapshot.docs.map(doc => ({
		id: doc.id,
		...doc.data()
	}));

	fs.writeFileSync("../trackers-info.json", JSON.stringify(trackers, null, 2));
	console.log(`Wrote ${trackers.length} trackers to trackers-info.json`);
}

findTrackers().catch(err => {
	fs.writeFileSync("../find-error.txt", err.stack || err.message);
	process.exit(1);
});
