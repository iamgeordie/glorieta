import assert from 'node:assert/strict';
import { test } from 'node:test';
import { landingFor } from './landing.ts';

test('a signed-in person goes straight in', () => {
  assert.equal(landingFor({ status: 'in', storedSession: true }), 'home');
});

test('a signed-out person, or a build with accounts off, sees the splash', () => {
  assert.equal(landingFor({ status: 'out', storedSession: false }), 'splash');
  assert.equal(landingFor({ status: 'disabled', storedSession: false }), 'splash');
});

test('while sign-in is loading: wait if a session is saved, otherwise show the splash at once', () => {
  assert.equal(landingFor({ status: 'loading', storedSession: true }), 'wait');
  assert.equal(landingFor({ status: 'loading', storedSession: false }), 'splash');
});

test('a saved session that turns out to be expired ends at the splash, not Home', () => {
  assert.equal(landingFor({ status: 'out', storedSession: true }), 'splash');
});
