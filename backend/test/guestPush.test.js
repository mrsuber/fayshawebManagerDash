// Unit tests for guest notifications (services/guestPush.js) with a stand-in database, socket server and Expo push API.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const queries = [];
const fakeDb = {
  query: async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT token FROM fcm_tokens/.test(sql)) {
      return { rows: [{ token: 'ExponentPushToken[alive]' }, { token: 'ExponentPushToken[gone]' }, { token: 'fcm-web-token' }] };
    }
    return { rows: [] };
  },
};
require.cache[path.resolve(__dirname, '../config/database.js')] = { exports: fakeDb };
const { notifyGuest } = require('../services/guestPush');

test('a guest notification reaches the socket room and Expo, and forgets uninstalled devices', async () => {
  const emitted = [];
  const app = { get: (k) => (k === 'io' ? { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) } : undefined) };
  let sent;
  global.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return { json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }) };
  };

  await notifyGuest(app, 7, { title: 'Dining', body: 'Your order is on its way.', event: 'dining:updated', data: { id: 3, screen: 'Dining' } });

  assert.deepStrictEqual(emitted, [{ room: 'user_7', event: 'dining:updated', payload: { title: 'Dining', body: 'Your order is on its way.', id: 3, screen: 'Dining' } }]);
  assert.strictEqual(sent.url, 'https://exp.host/--/api/v2/push/send');
  assert.deepStrictEqual(sent.body.map((m) => m.to), ['ExponentPushToken[alive]', 'ExponentPushToken[gone]'], 'only Expo tokens are pushed');
  assert.strictEqual(sent.body[0].data.screen, 'Dining');
  const cleanup = queries.find((q) => /SET is_active = false/.test(q.sql));
  assert.deepStrictEqual(cleanup.params, [['ExponentPushToken[gone]']]);
});

test('notifications never throw, even when the push service is down', async () => {
  global.fetch = async () => {
    throw new Error('network down');
  };
  await assert.doesNotReject(notifyGuest({ get: () => null }, 7, { title: 't', body: 'b' }));
  await assert.doesNotReject(notifyGuest(null, null, { title: 't', body: 'b' }));
});
