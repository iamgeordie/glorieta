import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mirrorBody, signBody } from './mirror.ts';

// scripts/test-schema.mjs proves that glorieta.billing_apply() accepts exactly Node's HMAC-SHA256 hex.
// This proves the Worker's Web Crypto signature is that same value, so the two halves agree.
test('the Worker signature equals HMAC-SHA256 hex, which the database verifies', async () => {
  const key = 'k'.repeat(64);
  const body = mirrorBody({ op: 'clear', user_id: '11111111-1111-1111-1111-111111111111', customer_id: 'cus_TestA1' });
  assert.equal(await signBody(body, key), createHmac('sha256', key).update(body).digest('hex'));
  assert.notEqual(await signBody(body, 'x'.repeat(64)), await signBody(body, key));
});

test('the body carries the op and an ISO issued_at', () => {
  const at = new Date('2026-11-14T12:00:00.000Z');
  assert.deepEqual(JSON.parse(mirrorBody({ op: 'crm_reported', user_id: 'u', state: 'none' }, at)), {
    op: 'crm_reported',
    user_id: 'u',
    state: 'none',
    issued_at: '2026-11-14T12:00:00.000Z',
  });
});
