import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeAuthError } from './auth-errors.ts';

test('known codes map to a plain message in both languages', () => {
  const m = describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' });
  assert.match(m.es, /incorrectos/);
  assert.match(m.en, /Wrong email or password/);
});

test('every known message exists in both languages and is non-empty', () => {
  for (const code of ['invalid_credentials', 'email_not_confirmed', 'user_already_exists', 'weak_password', 'same_password', 'over_request_rate_limit', 'otp_expired']) {
    const m = describeAuthError({ code });
    assert.ok(m.es.length > 10 && m.en.length > 10, code);
  }
});

test('an unknown code is shown with the code and message, never swallowed', () => {
  const m = describeAuthError({ code: 'brand_new_failure', message: 'something odd' });
  assert.match(m.en, /brand_new_failure: something odd/);
  assert.match(m.es, /brand_new_failure: something odd/);
});

test('a plain Error and a bare string are still reported', () => {
  assert.match(describeAuthError(new Error('network down')).en, /network down/);
  assert.match(describeAuthError('oops').en, /oops/);
});
