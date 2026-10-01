import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const AI_CONSENT_VERSION = 1;
export function hasAiConsent(profile: { aiConsent?: unknown; aiConsentVersion?: unknown; deletionPending?: unknown } | undefined): boolean {
  return profile?.aiConsent === true && profile.aiConsentVersion === AI_CONSENT_VERSION && profile.deletionPending !== true;
}
export async function requireAiConsent(uid: string): Promise<void> {
  const profile = await getFirestore().collection('users').doc(uid).get();
  if (!hasAiConsent(profile.data())) throw new HttpsError('failed-precondition', 'Enable AI data sharing in Settings before using AI features.');
}
