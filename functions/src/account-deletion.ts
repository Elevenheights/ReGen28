import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export function validateDeletionRequest(request: {
  auth?: { uid: string; token: { auth_time?: unknown } };
  data?: { confirm?: unknown };
}, nowSeconds = Date.now() / 1000): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
  if (request.data?.confirm !== true) throw new HttpsError('invalid-argument', 'Explicit confirmation is required.');
  const authenticatedAt = Number(request.auth.token.auth_time);
  if (!Number.isFinite(authenticatedAt) || nowSeconds - authenticatedAt > 600 || authenticatedAt > nowSeconds + 60) {
    throw new HttpsError('failed-precondition', 'For your security, sign out and sign in again before deleting your account.');
  }
  return request.auth.uid;
}

// Explicit prefixes only; a user's deletion must never touch another user's media.
export function mediaPrefixesForUser(uid: string): string[] {
  if (!uid || uid.includes('/')) throw new Error('Invalid user ID');
  return ['profile-images', 'user-media', 'feed-media', 'ai-media', 'users', 'feed-images', 'wrapped-videos']
    .map(prefix => `${prefix}/${uid}/`);
}

export async function deleteAccountData(uid: string, db: Firestore,
  deleteMedia: (prefix: string) => Promise<unknown>, deleteIdentity: (uid: string) => Promise<unknown>): Promise<void> {
  const prefixes = mediaPrefixesForUser(uid);
  const profile = db.collection('users').doc(uid);
  // Stop AI dispatch and client changes while cleanup runs. A failed call is retryable.
  if ((await profile.get()).exists) {
    await profile.update({ deletionPending: true, aiConsent: false, updatedAt: FieldValue.serverTimestamp() });
  }
  for (const prefix of prefixes) await deleteMedia(prefix);
  // Discover root collections so new user-owned data types are included automatically.
  for (const collection of await db.listCollections()) {
    if (collection.id === 'users') continue;
    while (true) {
      const owned = await collection.where('userId', '==', uid).limit(100).get();
      if (owned.empty) break;
      for (const document of owned.docs) await db.recursiveDelete(document.ref);
    }
  }
  await db.recursiveDelete(db.collection('backfill-progress').doc(uid));
  await db.recursiveDelete(profile);
  await deleteIdentity(uid);
}

export const deleteUserAccount = onCall({ invoker: 'public', timeoutSeconds: 540 }, async request => {
  const uid = validateDeletionRequest(request);
  const bucket = getStorage().bucket('regen28-2fe51.firebasestorage.app');
  await deleteAccountData(uid, getFirestore(), prefix => bucket.deleteFiles({ prefix }), id => getAuth().deleteUser(id));
  return { deleted: true };
});
