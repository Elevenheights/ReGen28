const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, deleteDoc, deleteField } = require('firebase/firestore');

let env;
const profile = { status: 'inactive', subscriptionType: 'expired', role: 'user', displayName: 'New user' };
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-regen28-release',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
beforeEach(async () => env.clearFirestore());
after(async () => env?.cleanup());

test('owner may create an inactive account and edit their profile', async () => {
  const ref = doc(env.authenticatedContext('owner').firestore(), 'users/owner');
  await assertSucceeds(setDoc(ref, profile));
  await assertSucceeds(updateDoc(ref, { displayName: 'Updated', isOnboardingComplete: true }));
  await assertSucceeds(getDoc(ref));
});
test('signup cannot grant access, a trial, or an admin role', async () => {
  const ref = doc(env.authenticatedContext('owner').firestore(), 'users/owner');
  for (const changes of [
    { status: 'active' }, { role: 'admin' }, { subscriptionType: 'trial' },
    { trialEndsAt: new Date() }, { subscriptionExpiration: new Date() },
    { billingAccessOverride: true }, { subscriptionVerifiedAt: new Date() }
  ]) {
    await assertFails(setDoc(ref, { ...profile, ...changes }));
  }
});
test('owners cannot change or remove server-managed billing fields', async () => {
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'users/owner'), {
    ...profile, status: 'active', subscriptionType: 'premium', subscriptionExpiration: new Date(),
    trialEndsAt: null, billingAccessOverride: true, subscriptionVerifiedAt: new Date()
  }));
  const ref = doc(env.authenticatedContext('owner').firestore(), 'users/owner');
  for (const changes of [
    { status: 'inactive' }, { role: 'admin' }, { subscriptionType: 'trial' },
    { trialEndsAt: new Date() }, { subscriptionExpiration: null },
    { billingAccessOverride: false }, { subscriptionVerifiedAt: new Date() },
    { subscriptionExpiration: deleteField() }, { billingAccessOverride: deleteField() }
  ]) await assertFails(updateDoc(ref, changes));
  await assertSucceeds(updateDoc(ref, { displayName: 'Still editable' }));
});
test('other users and unauthenticated users cannot access a profile', async () => {
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'users/owner'), profile));
  for (const context of [env.authenticatedContext('other'), env.unauthenticatedContext()]) {
    const ref = doc(context.firestore(), 'users/owner');
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, { displayName: 'Changed' }));
  }
});
test('deleting and recreating a profile cannot reset billing access', async () => {
  const ref = doc(env.authenticatedContext('owner').firestore(), 'users/owner');
  await assertSucceeds(setDoc(ref, profile));
  await assertFails(deleteDoc(ref));
});
