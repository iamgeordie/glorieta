import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capAttempts, withoutSent, type Attempt } from './attempts.ts';

const a = (item: string, at: string): Attempt => ({ item_id: item, correct: true, mode: 'practice', answered_at: at });

test('capping keeps the newest attempts and drops the oldest', () => {
  const list = [a('q1', '2026-01-01T00:00:00Z'), a('q2', '2026-01-02T00:00:00Z'), a('q3', '2026-01-03T00:00:00Z')];
  assert.deepEqual(capAttempts(list, 2).map((x) => x.item_id), ['q2', 'q3']);
  assert.equal(capAttempts(list, 5), list);
});

test('uploaded attempts are removed by item and time, nothing else', () => {
  const list = [a('q1', '2026-01-01T00:00:00Z'), a('q1', '2026-01-02T00:00:00Z'), a('q2', '2026-01-01T00:00:00Z')];
  const left = withoutSent(list, [a('q1', '2026-01-01T00:00:00Z')]);
  assert.deepEqual(left.map((x) => `${x.item_id}@${x.answered_at.slice(8, 10)}`), ['q1@02', 'q2@01']);
});

test('removing nothing changes nothing', () => {
  const list = [a('q1', '2026-01-01T00:00:00Z')];
  assert.deepEqual(withoutSent(list, []), list);
});
