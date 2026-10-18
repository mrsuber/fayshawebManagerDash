// Unit tests for HQ access rules and audit summaries. Run: npm test (node's built-in test runner).
const test = require('node:test');
const assert = require('node:assert');
const { hasArea, areasOf, describe } = require('../middleware/hq');

test('super administrators have every area and action', () => {
  const boss = { role: 'superadmin', permissions: {} };
  assert.ok(hasArea(boss, 'finance', 'approve'));
  assert.strictEqual(areasOf(boss).length, 9);
});

test('other roles get exactly what their permissions grant', () => {
  const finance = { role: 'finance_director', permissions: { finance: { view: true, approve: true }, approvals: { approve: true } } };
  assert.ok(hasArea(finance, 'finance'));
  assert.ok(hasArea(finance, 'finance', 'approve'));
  assert.ok(!hasArea(finance, 'finance', 'manage'));
  assert.ok(hasArea(finance, 'approvals'), 'approve implies view');
  assert.ok(!hasArea(finance, 'staff'));
  assert.deepStrictEqual(areasOf(finance), ['finance', 'approvals']);
});

test('older permission keys still open their HQ area', () => {
  const editor = { role: 'editor', permissions: { pages: { view: true, edit: true } } };
  assert.ok(hasArea(editor, 'website'));
  assert.ok(hasArea(editor, 'website', 'manage'));
  const manager = { role: 'manager', permissions: { reservations: { view: true } } };
  assert.deepStrictEqual(areasOf(manager), []);
  assert.ok(!hasArea(null, 'overview'));
});

test('audit summaries name the thing that changed', () => {
  assert.deepStrictEqual(describe('POST', '/api/manager/reservations/12/check-in'), {
    area: 'manager', entity: 'reservations', entityId: '12', action: 'check-in', summary: 'Check in reservations #12',
  });
  assert.strictEqual(describe('PATCH', '/api/admin/staff/3').summary, 'Updated staff #3');
  assert.strictEqual(describe('DELETE', '/api/apartments/7').summary, 'Deleted apartments #7');
  assert.strictEqual(describe('POST', '/api/admin/approvals/leave-4/decide').summary, 'Decide approvals #leave-4');
});
