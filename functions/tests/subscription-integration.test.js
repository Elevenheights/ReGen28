const { test, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run only through the local Firestore emulator');
process.env.REVENUECAT_WEBHOOK_SECRET = 'local-test-secret';
const app = initializeApp({ projectId: 'demo-regen28-release' });
const db = getFirestore();
const { revenueCatWebhook } = require('../lib/revenuecat-webhook');
const { updateUserSubscriptionStatus } = require('../lib/user-management');
const { deleteAccountData } = require('../lib/account-deletion');
const { requireAiConsent } = require('../lib/services/ai-consent');
const inactive = { status: 'inactive', subscriptionType: 'expired', role: 'user' };
let verifiedUsers;
let api;

beforeEach(async () => {
  await db.recursiveDelete(db.collection('users'));
  await db.recursiveDelete(db.collection('processed_webhooks'));
  mock.restoreAll();
  verifiedUsers = {};
  api = mock.method(axios, 'get', async url => {
    const uid = decodeURIComponent(url.split('/').pop());
    const active = verifiedUsers[uid];
    return { data: { subscriber: {
      entitlements: active ? { 'Regen28 Pro': {
        product_identifier: 'monthly', expires_date: new Date(Date.now() + 86400000).toISOString()
      } } : {}, subscriptions: { monthly: { period_type: 'normal' } }
    } } };
  });
});
after(async () => { mock.restoreAll(); await db.terminate(); await deleteApp(app); });

async function webhook(event, authorization = 'Bearer local-test-secret') {
  const res = { code: 200, body: null,
    set() { return this; }, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; }
  };
  await revenueCatWebhook({ method: 'POST', headers: { authorization }, body: { event } }, res);
  return res;
}
async function seed(uid, fields = {}) { await db.doc(`users/${uid}`).set({ ...inactive, ...fields }); }
async function status(uid) { return (await db.doc(`users/${uid}`).get()).data().status; }

test('AI generation is blocked until explicit current consent, and revocation blocks it again', async () => {
  await seed('owner');
  await assert.rejects(requireAiConsent('owner'), { code: 'failed-precondition' });
  await db.doc('users/owner').update({ aiConsent: true, aiConsentVersion: 1 });
  await requireAiConsent('owner');
  await db.doc('users/owner').update({ aiConsent: false });
  await assert.rejects(requireAiConsent('owner'), { code: 'failed-precondition' });
});
test('account cleanup removes only the owner data, nested records, media prefixes, and identity', async () => {
  await seed('owner');
  await seed('other');
  await db.doc('journal-entries/owned').set({ userId: 'owner', text: 'private' });
  await db.doc('journal-entries/owned/details/nested').set({ text: 'private' });
  await db.doc('journal-entries/other').set({ userId: 'other', text: 'keep' });
  await db.doc('users/owner/private/nested').set({ text: 'private' });
  const media = [];
  const identities = [];
  await deleteAccountData('owner', db, async prefix => media.push(prefix), async uid => identities.push(uid));
  assert.equal((await db.doc('users/owner').get()).exists, false);
  assert.equal((await db.doc('journal-entries/owned').get()).exists, false);
  assert.equal((await db.doc('journal-entries/owned/details/nested').get()).exists, false);
  assert.equal((await db.doc('users/owner/private/nested').get()).exists, false);
  assert.equal((await db.doc('users/other').get()).exists, true);
  assert.equal((await db.doc('journal-entries/other').get()).exists, true);
  assert.deepEqual(identities, ['owner']);
  assert.equal(media.length, 7);
  assert.ok(media.every(prefix => prefix.endsWith('/owner/')));
});

test('callable ignores client billing grants and verifies only the authenticated UID', async () => {
  await seed('owner');
  verifiedUsers.other = true;
  const result = await updateUserSubscriptionStatus.run({ auth: { uid: 'owner' }, data: { status: 'active', userId: 'other', trialEndsAt: '2099-01-01' } });
  assert.equal(result.active, false);
  assert.equal(await status('owner'), 'inactive');
  assert.match(api.mock.calls[0].arguments[0], /\/owner$/);
});
test('verified purchase activates the profile, but suspension remains authoritative', async () => {
  await seed('owner');
  verifiedUsers.owner = true;
  assert.equal((await updateUserSubscriptionStatus.run({ auth: { uid: 'owner' }, data: {} })).active, true);
  assert.equal(await status('owner'), 'active');
  await seed('owner', { status: 'suspended' });
  assert.equal((await updateUserSubscriptionStatus.run({ auth: { uid: 'owner' }, data: {} })).active, false);
  assert.equal(await status('owner'), 'suspended');
});
test('reviewer override survives synchronization without a RevenueCat purchase', async () => {
  await seed('reviewer', { status: 'active', billingAccessOverride: true });
  assert.equal((await updateUserSubscriptionStatus.run({ auth: { uid: 'reviewer' }, data: {} })).active, true);
  assert.equal(api.mock.callCount(), 0);
});
test('callable rejects unauthenticated calls', async () => {
  await assert.rejects(updateUserSubscriptionStatus.run({ data: {} }), error => error.code === 'unauthenticated');
});
test('webhook authentication is required before billing changes', async () => {
  await seed('owner');
  assert.equal((await webhook({ id: 'bad-auth', type: 'RENEWAL', app_user_id: 'owner' }, 'wrong')).code, 401);
  assert.equal(api.mock.callCount(), 0);
  assert.equal(await status('owner'), 'inactive');
});
test('stale expiration event refreshes current entitlement instead of revoking a renewal', async () => {
  await seed('owner');
  verifiedUsers.owner = true;
  const event = { id: 'stale-event', type: 'EXPIRATION', app_user_id: 'owner' };
  assert.equal((await webhook(event)).code, 200);
  assert.equal(await status('owner'), 'active');
  assert.equal((await webhook(event)).body.duplicate, true);
  assert.equal(api.mock.callCount(), 1);
});
test('failed verification does not mark webhook success and delivery can retry', async () => {
  await seed('owner');
  const event = { id: 'retry-event', type: 'INITIAL_PURCHASE', app_user_id: 'owner' };
  const original = axios.get;
  axios.get = async () => { throw new Error('RevenueCat unavailable'); };
  assert.equal((await webhook(event)).code, 500);
  assert.equal((await db.doc('processed_webhooks/retry-event').get()).exists, false);
  axios.get = original;
  verifiedUsers.owner = true;
  assert.equal((await webhook(event)).code, 200);
  assert.equal(await status('owner'), 'active');
});
test('TRANSFER without entitlement_ids refreshes both old and new owners', async () => {
  await seed('previous', { status: 'active' });
  await seed('next');
  verifiedUsers.next = true;
  const result = await webhook({ id: 'transfer', type: 'TRANSFER', transferred_from: ['previous'], transferred_to: ['next'] });
  assert.equal(result.code, 200);
  assert.equal(await status('previous'), 'inactive');
  assert.equal(await status('next'), 'active');
});
