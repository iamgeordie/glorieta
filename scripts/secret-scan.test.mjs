import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets } from './secret-scan.mjs';

// Built at run time, so this file itself contains nothing that looks like a key.
const fake = (prefix) => `${prefix}${'A1b2C3d4E5'.repeat(3)}`;

test('finds each kind of server secret', () => {
  for (const prefix of ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_', 'whsec_', 'sb_secret_']) {
    const found = findSecrets(`const k="${fake(prefix)}";`);
    assert.equal(found.length, 1, prefix);
    assert.ok(!found[0].preview.includes('A1b2'), 'the secret itself is never echoed');
  }
});

test('ignores public keys and ordinary identifiers', () => {
  const text = 'pk_live_' + 'x'.repeat(30) + ' sb_publishable_qGi7AfmrPvli1JOZWNwFzQ_eO5_rj9D task_list desk_test_ sk_ rk_ whsec_';
  assert.deepEqual(findSecrets(text), []);
});
