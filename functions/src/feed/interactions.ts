import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const db = getFirestore();

/**
 * Consolidated Feed Interactions Handler
 * Handles all feed social interactions: likes, comments, and comment retrieval
 */
export const feedInteractions = onCall(
	{
		invoker: 'public',
		timeoutSeconds: 60,
		memory: '256MiB',
		cpu: 1
	},
	async (request) => {
		const { action, ...params } = request.data;

		if (!action) {
			throw new HttpsError('invalid-argument', 'action is required');
		}

		switch (action) {
			case 'toggle-like':
				return handleToggleLike(request, params);
			case 'add-comment':
				return handleAddComment(request, params);
			case 'get-comments':
				return handleGetComments(params);
			default:
				throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
		}
	}
);



// ============================================================================
// INTERNAL HANDLERS (used by consolidated function)
// ============================================================================

async function handleToggleLike(request: any, params: any) {
	const { feedItemId } = params;
	const userId = request.auth?.uid;

	if (!userId) {
		throw new HttpsError('unauthenticated', 'User must be logged in to like items.');
	}
	if (!feedItemId) {
		throw new HttpsError('invalid-argument', 'feedItemId is required.');
	}

	const feedItemRef = db.collection('feed-items').doc(feedItemId);
	const likeRef = db.collection('feed-likes').doc(`${feedItemId}_${userId}`);

	try {
		const result = await db.runTransaction(async (transaction) => {
			const likeDoc = await transaction.get(likeRef);
			const feedItemDoc = await transaction.get(feedItemRef);

			if (!feedItemDoc.exists) {
				throw new HttpsError('not-found', 'Feed item not found.');
			}

			let newLikesCount = feedItemDoc.data()?.likesCount || 0;
			let hasLiked = false;

			if (likeDoc.exists) {
				// User already liked, so unlike
				transaction.delete(likeRef);
				newLikesCount = Math.max(0, newLikesCount - 1);
				transaction.update(feedItemRef, { likesCount: newLikesCount });
				hasLiked = false;
			} else {
				// User hasn't liked, so like
				transaction.set(likeRef, {
					feedItemId,
					userId,
					createdAt: FieldValue.serverTimestamp(),
				});
				newLikesCount += 1;
				transaction.update(feedItemRef, { likesCount: newLikesCount });
				hasLiked = true;
			}

			return { likesCount: newLikesCount, hasLiked };
		});

		return result;
	} catch (error) {
		logger.error("Error toggling like", error);
		throw new HttpsError('internal', 'Failed to toggle like.');
	}
}

async function handleAddComment(request: any, params: any) {
	const { feedItemId, text } = params;
	const userId = request.auth?.uid;
	const userName = request.auth?.token?.name || 'Anonymous';
	const userPicture = request.auth?.token?.picture || null;

	if (!userId) {
		throw new HttpsError('unauthenticated', 'User must be logged in to comment.');
	}
	if (!feedItemId || !text) {
		throw new HttpsError('invalid-argument', 'feedItemId and text are required.');
	}

	const feedItemRef = db.collection('feed-items').doc(feedItemId);
	const commentsRef = db.collection('feed-comments');

	try {
		const commentData = {
			feedItemId,
			userId,
			text,
			createdAt: FieldValue.serverTimestamp(),
			author: {
				name: userName,
				avatarUrl: userPicture,
			},
		};

		const result = await db.runTransaction(async (transaction) => {
			const feedItemDoc = await transaction.get(feedItemRef);
			if (!feedItemDoc.exists) {
				throw new HttpsError('not-found', 'Feed item not found.');
			}

			const newCommentRef = commentsRef.doc();
			transaction.set(newCommentRef, commentData);

			const currentCommentsCount = feedItemDoc.data()?.commentsCount || 0;
			transaction.update(feedItemRef, { commentsCount: currentCommentsCount + 1 });

			return { id: newCommentRef.id, ...commentData, createdAt: new Date().toISOString() };
		});

		return result;
	} catch (error) {
		logger.error("Error adding comment", error);
		throw new HttpsError('internal', 'Failed to add comment.');
	}
}

async function handleGetComments(params: any) {
	const { feedItemId, limit = 20, startAfterId } = params;

	if (!feedItemId) {
		throw new HttpsError('invalid-argument', 'feedItemId is required.');
	}

	try {
		let query = db.collection('feed-comments')
			.where('feedItemId', '==', feedItemId)
			.orderBy('createdAt', 'desc')
			.limit(limit);

		if (startAfterId) {
			const startAfterDoc = await db.collection('feed-comments').doc(startAfterId).get();
			if (startAfterDoc.exists) {
				query = query.startAfter(startAfterDoc);
			}
		}

		const snapshot = await query.get();
		const comments = snapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			createdAt: doc.data().createdAt?.toDate().toISOString()
		}));

		return { comments };
	} catch (error) {
		logger.error("Error getting comments", error);
		throw new HttpsError('internal', 'Failed to get comments.');
	}
}
