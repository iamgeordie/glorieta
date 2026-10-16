import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeExams, mergeProgress } from './merge.ts';

type E = { at?: string; seen: number; right: number };
const e = (at: string | undefined, seen: number, right = 0): E => ({ at, seen, right });

test('an item only on this device is pushed and kept', () => {
  const r = mergeProgress({ a: e('2026-01-01T00:00:00Z', 1) }, {});
  assert.deepEqual(r.push, ['a']);
  assert.equal(r.changedLocally, false);
  assert.equal(r.merged.a?.seen, 1);
});

test('an item only on the server is pulled, not pushed', () => {
  const r = mergeProgress({}, { a: e('2026-01-01T00:00:00Z', 3) });
  assert.deepEqual(r.push, []);
  assert.equal(r.changedLocally, true);
  assert.equal(r.merged.a?.seen, 3);
});

test('the newer record wins, with its counters', () => {
  const older = e('2026-01-01T00:00:00Z', 5, 5);
  const newer = e('2026-02-01T00:00:00Z', 2, 1);
  const localNewer = mergeProgress({ a: newer }, { a: older });
  assert.equal(localNewer.merged.a, newer);
  assert.deepEqual(localNewer.push, ['a']);
  const remoteNewer = mergeProgress({ a: older }, { a: newer });
  assert.equal(remoteNewer.merged.a, newer);
  assert.deepEqual(remoteNewer.push, []);
  assert.equal(remoteNewer.changedLocally, true);
});

test('identical records are neither pushed nor pulled', () => {
  const x = e('2026-01-01T00:00:00Z', 2, 1);
  const r = mergeProgress({ a: { ...x } }, { a: { ...x } });
  assert.deepEqual(r.push, []);
  assert.equal(r.changedLocally, false);
});

test('on equal timestamps the record with more answers wins, and ties keep local', () => {
  const t = '2026-01-01T00:00:00Z';
  assert.equal(mergeProgress({ a: e(t, 1) }, { a: e(t, 4) }).merged.a?.seen, 4);
  const tie = mergeProgress({ a: e(t, 2, 1) }, { a: e(t, 2, 2) });
  assert.equal(tie.merged.a?.right, 1);
});

test('a missing or invalid timestamp counts as oldest', () => {
  const r = mergeProgress({ a: e(undefined, 9) }, { a: e('2026-01-01T00:00:00Z', 1) });
  assert.equal(r.merged.a?.seen, 1);
  const bad = mergeProgress({ a: e('not a date', 9) }, { a: e('2026-01-01T00:00:00Z', 1) });
  assert.equal(bad.merged.a?.seen, 1);
});

test('exam results are a union keyed by time, sorted, with only new local ones pushed', () => {
  const a = { at: '2026-01-01T00:00:00Z', errors: 2 };
  const b = { at: '2026-01-02T00:00:00Z', errors: 5 };
  const c = { at: '2026-01-03T00:00:00Z', errors: 1 };
  const r = mergeExams([b, c], [a, b]);
  assert.deepEqual(r.merged.map((x) => x.at), [a.at, b.at, c.at]);
  assert.deepEqual(r.push, [c]);
  assert.equal(r.changedLocally, true);
  const same = mergeExams([a], [a]);
  assert.equal(same.changedLocally, false);
  assert.deepEqual(same.push, []);
});
