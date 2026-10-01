const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDeletionRequest, mediaPrefixesForUser } = require('../lib/account-deletion');
const { hasAiConsent } = require('../lib/services/ai-consent');

test('deletion requires authentication, explicit confirmation, and recent sign-in', () => {
  const now = 10000;
  assert.throws(() => validateDeletionRequest({}, now), { code: 'unauthenticated' });
  assert.throws(() => validateDeletionRequest({ auth: { uid: 'owner', token: { auth_time: now } }, data: {} }, now), { code: 'invalid-argument' });
  assert.throws(() => validateDeletionRequest({ auth: { uid: 'owner', token: { auth_time: now - 601 } }, data: { confirm: true } }, now), { code: 'failed-precondition' });
  assert.equal(validateDeletionRequest({ auth: { uid: 'owner', token: { auth_time: now } }, data: { confirm: true, userId: 'someone-else' } }, now), 'owner');
});
test('deletion storage prefixes are bounded to exactly one user', () => {
  const prefixes = mediaPrefixesForUser('owner');
  assert.equal(prefixes.length, 7);
  assert.ok(prefixes.every(prefix => prefix.endsWith('/owner/')));
  assert.throws(() => mediaPrefixesForUser(''));
  assert.throws(() => mediaPrefixesForUser('owner/another'));
});
test('AI sharing requires explicit, current consent and no pending deletion', () => {
  assert.equal(hasAiConsent(undefined), false);
  assert.equal(hasAiConsent({}), false);
  assert.equal(hasAiConsent({ aiConsent: false, aiConsentVersion: 1 }), false);
  assert.equal(hasAiConsent({ aiConsent: true, aiConsentVersion: 0 }), false);
  assert.equal(hasAiConsent({ aiConsent: true, aiConsentVersion: 1 }), true);
  assert.equal(hasAiConsent({ aiConsent: true, aiConsentVersion: 1, deletionPending: true }), false);
});
