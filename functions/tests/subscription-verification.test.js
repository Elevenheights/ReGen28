const { test } = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionFromSubscriber, hasBillingOverride } = require('../lib/services/subscription-verification');

const now = new Date('2026-09-30T12:00:00Z');
const future = '2026-10-01T12:00:00.000Z';
const past = '2026-09-29T12:00:00Z';
const subscriber = (expires, extra = {}, subscription = {}) => ({
  entitlements: { 'Regen28 Pro': { product_identifier: 'monthly', expires_date: expires, ...extra } },
  subscriptions: { monthly: subscription }
});

test('no entitlement cannot grant access', () => {
  assert.equal(subscriptionFromSubscriber({ entitlements: {} }, now).status, 'inactive');
});
test('trial access derives from verified subscription period and expiration', () => {
  const result = subscriptionFromSubscriber(subscriber(future, {}, { period_type: 'trial' }), now);
  assert.equal(result.status, 'active');
  assert.equal(result.subscriptionType, 'trial');
  assert.equal(result.trialEndsAt.toISOString(), future);
});
test('paid subscriptions clear stale trial dates', () => {
  const result = subscriptionFromSubscriber(subscriber(future), now);
  assert.equal(result.subscriptionType, 'premium');
  assert.equal(result.trialEndsAt, null);
});
test('expiration at or before now removes access', () => {
  for (const date of [past, now.toISOString()]) {
    assert.equal(subscriptionFromSubscriber(subscriber(date), now).status, 'inactive');
  }
});
test('billing grace period preserves access until its actual end', () => {
  const result = subscriptionFromSubscriber(subscriber(past, { grace_period_expires_date: future }), now);
  assert.equal(result.status, 'active');
  assert.equal(result.subscriptionExpiration.toISOString(), future);
});
test('refund removes access even when expiration is in the future', () => {
  assert.equal(subscriptionFromSubscriber(subscriber(future, {}, { refunded_at: past }), now).status, 'inactive');
});
test('explicit lifetime entitlement has no expiration', () => {
  const result = subscriptionFromSubscriber(subscriber(null), now);
  assert.equal(result.status, 'active');
  assert.equal(result.subscriptionExpiration, null);
});
test('missing or malformed expiration cannot become lifetime access', () => {
  assert.equal(subscriptionFromSubscriber(subscriber(undefined), now).status, 'inactive');
  assert.throws(() => subscriptionFromSubscriber(subscriber('invalid'), now));
});
test('reviewer grant must be explicit and may not override suspension', () => {
  assert.equal(hasBillingOverride({ status: 'active' }), false);
  assert.equal(hasBillingOverride({ status: 'active', billingAccessOverride: 'true' }), false);
  assert.equal(hasBillingOverride({ status: 'active', billingAccessOverride: true }), true);
  assert.equal(hasBillingOverride({ status: 'suspended', billingAccessOverride: true }), false);
});
