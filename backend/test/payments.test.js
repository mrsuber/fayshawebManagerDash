// Unit tests for payment keys in Settings (encrypted at rest), PayWithCAMSOL helpers and webhook signatures.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
let stored = null;
const fakeDb = {
  query: async (sql, params) => {
    if (/SELECT value/.test(sql)) return { rows: stored ? [{ value: stored, updated_at: new Date(), updated_by: 1 }] : [] };
    if (/INSERT INTO app_settings/.test(sql)) {
      stored = JSON.parse(params[1]);
      return { rows: [] };
    }
    return { rows: [] };
  },
};
require.cache[path.resolve(__dirname, '../config/database.js')] = { exports: fakeDb };
const box = require('../services/payments/secretBox');
const settings = require('../services/payments/settings');
const camsol = require('../services/payments/camsol');

test('secrets round-trip encrypted, and a changed server secret makes them unreadable', () => {
  const sealed = box.encrypt('sk_live_abcdef123456');
  assert.ok(sealed.startsWith('v1.') && !sealed.includes('abcdef'));
  assert.strictEqual(box.decrypt(sealed), 'sk_live_abcdef123456');
  process.env.SETTINGS_ENCRYPTION_KEY = 'another';
  assert.strictEqual(box.decrypt(sealed), null);
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.strictEqual(box.hint('sk_live_abcdef123456'), '…3456');
});

test('keys are validated, saved encrypted, never returned, and used at once', async () => {
  await assert.rejects(settings.save({ stripe: { secretKey: 'nope' } }), /sk_test_ or sk_live_/);
  await assert.rejects(settings.save({ stripe: { secretKey: 'sk_test_' + 'a'.repeat(20), publishableKey: 'pk_live_' + 'b'.repeat(20) } }), /both be test keys or both be live/);
  await assert.rejects(settings.save({ camsol: { webhookSecret: 'whatever' } }), /secret key too/);
  const changed = await settings.save({ stripe: { secretKey: 'sk_test_' + 'a'.repeat(20) + 'wxyz', publishableKey: 'pk_test_' + 'b'.repeat(20) }, camsol: { secretKey: 'sk_live_' + 'c'.repeat(20) } });
  assert.deepStrictEqual(changed, ['stripe.secretKey', 'stripe.publishableKey', 'camsol.secretKey']);
  assert.ok(!JSON.stringify(stored).includes('aaaa'), 'secret keys are not stored in clear');
  const status = await settings.status();
  assert.strictEqual(status.stripe.saved.secretKey, '…wxyz');
  assert.strictEqual(status.stripe.mode, 'test');
  assert.strictEqual(status.camsol.mode, 'live');
  assert.ok(!JSON.stringify(status).includes('cccccccc'), 'status never carries a secret');
  assert.strictEqual((await settings.load()).camsol.secretKey, 'sk_live_' + 'c'.repeat(20));
  const pub = await settings.publicConfig();
  assert.deepStrictEqual(pub.card, { publishableKey: 'pk_test_' + 'b'.repeat(20) });
  assert.strictEqual(pub.mobileMoney.automatic, true);
});

test('mobile money numbers and PayWithCAMSOL states', () => {
  assert.strictEqual(camsol.accountNumber('+237 6 70 12 34 56'), '237670123456');
  assert.strictEqual(camsol.accountNumber('670123456'), '237670123456');
  assert.throws(() => camsol.accountNumber('12345'), /Cameroon mobile money number/);
  assert.strictEqual(camsol.stateOf('COMPLETED'), 'succeeded');
  assert.strictEqual(camsol.stateOf('Processing'), 'succeeded');
  assert.strictEqual(camsol.stateOf('EXPIRED'), 'failed');
  assert.strictEqual(camsol.stateOf('PENDING'), 'pending');
});

test('webhooks are accepted only with a valid signature (raw body or sorted JSON)', async () => {
  await settings.save({ camsol: { secretKey: 'sk_live_' + 'c'.repeat(20), webhookSecret: 'hook-secret' } });
  const raw = Buffer.from('{"event":"payment.success","data":{"refillId":"r1","amount":5000}}');
  const sig = crypto.createHmac('sha256', 'hook-secret').update(raw).digest('hex');
  assert.strictEqual(await camsol.verifyWebhook(raw, { 'x-paywithcamsol-signature': sig }), true);
  assert.strictEqual(await camsol.verifyWebhook(raw, { 'x-webhook-signature': `sha256=${sig}` }), true);
  assert.strictEqual(await camsol.verifyWebhook(raw, { 'x-paywithcamsol-signature': 'deadbeef' }), false);
  assert.strictEqual(await camsol.verifyWebhook(raw, {}), false);
  const sorted = camsol.pythonJson(JSON.parse(raw));
  const sig2 = crypto.createHmac('sha256', 'hook-secret').update(sorted).digest('hex');
  assert.strictEqual(await camsol.verifyWebhook(raw, { 'x-suberpay-signature': sig2 }), true);
});
