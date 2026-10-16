const { test } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-regen28-notification-tests' });
const { NotificationService } = require('../lib/services/notification.service');

async function sendsFor(preferences, preferenceKey) {
  const service = new NotificationService();
  const messages = [];
  // Replace both clients: these tests never contact Firebase or real devices.
  service.db = {
    collection: () => ({ doc: () => ({ get: async () => ({
      exists: true, data: () => ({ fcmTokens: ['test-token'], preferences })
    }) }) })
  };
  service.messaging = {
    sendEachForMulticast: async message => {
      messages.push(message);
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    }
  };
  await service.sendPushNotification('test-user', 'Title', 'Body', {}, preferenceKey);
  return messages.length;
}

test('legacy feed opt-out is preserved even when a channel is enabled', async () => {
  assert.equal(await sendsFor({ newFeedPostNotifications: false, morningCoachBoost: true }, 'morningCoachBoost'), 0);
});

test('disabled granular channel does not send', async () => {
  assert.equal(await sendsFor({ newFeedPostNotifications: true, morningCoachBoost: false }, 'morningCoachBoost'), 0);
});

test('disabled nudges do not send', async () => {
  assert.equal(await sendsFor({ dailyReminders: false, morningCoachBoost: true }, 'morningCoachBoost'), 0);
});

test('enabled channels and legacy users without channel preferences can send', async () => {
  assert.equal(await sendsFor({ morningCoachBoost: true }, 'morningCoachBoost'), 1);
  assert.equal(await sendsFor({}, 'morningCoachBoost'), 1);
  assert.equal(await sendsFor({}), 1);
});
