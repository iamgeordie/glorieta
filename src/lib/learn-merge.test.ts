import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyState, type LearnState } from './learn-core.ts';
import { mergeCourse, mergeLesson, mergeQuiz } from './learn-merge.ts';

const lesson = (o: Partial<{ done: boolean; step: number; at: string; answered: Record<string, { sel: number; ok: boolean }> }> = {}) => ({
  done: false,
  step: 0,
  answered: {},
  ...o,
});
const quiz = (best: number, last: number, attempts: number, at: string) => ({ best, last, attempts, at });

test('a finished lesson stays finished, whichever side says so', () => {
  assert.equal(mergeLesson(lesson({ done: true, at: '2026-01-01' }), lesson({ at: '2026-02-01' })).done, true);
  assert.equal(mergeLesson(lesson({ at: '2026-02-01' }), lesson({ done: true, at: '2026-01-01' })).done, true);
});

test('where you stopped follows the side used last', () => {
  const r = mergeLesson(lesson({ step: 2, at: '2026-01-01T00:00:00Z' }), lesson({ step: 5, at: '2026-02-01T00:00:00Z' }));
  assert.equal(r.step, 5);
  assert.equal(r.at, '2026-02-01T00:00:00Z');
});

test('answers from both sides are kept, and the earlier answer to the same check wins', () => {
  const early = lesson({ at: '2026-01-01T00:00:00Z', answered: { a: { sel: 0, ok: true }, c: { sel: 1, ok: false } } });
  const late = lesson({ at: '2026-02-01T00:00:00Z', answered: { a: { sel: 2, ok: false }, b: { sel: 1, ok: true } } });
  const r = mergeLesson(late, early);
  assert.deepEqual(r.answered, { a: { sel: 0, ok: true }, b: { sel: 1, ok: true }, c: { sel: 1, ok: false } });
  assert.deepEqual(mergeLesson(early, late).answered, r.answered);
});

test('a missing timestamp counts as oldest, not as a crash', () => {
  const r = mergeLesson(lesson({ step: 1 }), lesson({ step: 4, at: '2026-02-01T00:00:00Z' }));
  assert.equal(r.step, 4);
});

test('a quiz keeps the best score and the larger attempt count, and the newer latest score', () => {
  const r = mergeQuiz(quiz(80, 80, 1, '2026-01-01T00:00:00Z'), quiz(100, 60, 3, '2026-02-01T00:00:00Z'));
  assert.deepEqual(r, { best: 100, last: 60, attempts: 3, at: '2026-02-01T00:00:00Z' });
  assert.deepEqual(mergeQuiz(quiz(100, 60, 3, '2026-02-01T00:00:00Z'), quiz(80, 80, 1, '2026-01-01T00:00:00Z')), r);
});

test('the merged latest score never exceeds the merged best', () => {
  const r = mergeQuiz(quiz(70, 70, 1, '2026-03-01T00:00:00Z'), quiz(90, 90, 1, '2026-01-01T00:00:00Z'));
  assert.ok(r.last <= r.best);
});

test('a lesson only on this device is pushed and kept; one only on the server is pulled', () => {
  const local: LearnState = { lessons: { 'a/x': lesson({ done: true }) }, quizzes: {} };
  const remote: LearnState = { lessons: { 'b/y': lesson({ step: 3 }) }, quizzes: {} };
  const r = mergeCourse(local, remote);
  assert.deepEqual(r.pushLessons, ['a/x']);
  assert.equal(r.changedLocally, true);
  assert.deepEqual(Object.keys(r.merged.lessons).sort(), ['a/x', 'b/y']);
});

test('identical state on both sides pushes nothing and changes nothing', () => {
  const s: LearnState = { lessons: { 'a/x': lesson({ done: true, step: 4, at: '2026-01-01T00:00:00Z' }) }, quizzes: { a: quiz(90, 90, 2, '2026-01-01T00:00:00Z') } };
  const r = mergeCourse(s, JSON.parse(JSON.stringify(s)));
  assert.deepEqual(r.pushLessons, []);
  assert.deepEqual(r.pushQuizzes, []);
  assert.equal(r.changedLocally, false);
});

test('when this device is ahead, only the differing rows are pushed', () => {
  const remote: LearnState = { lessons: { 'a/x': lesson({ step: 2, at: '2026-01-01T00:00:00Z' }) }, quizzes: { a: quiz(80, 80, 1, '2026-01-01T00:00:00Z') } };
  const local: LearnState = {
    lessons: { 'a/x': lesson({ done: true, step: 6, at: '2026-02-01T00:00:00Z' }), 'a/y': lesson() },
    quizzes: { a: quiz(90, 90, 2, '2026-02-01T00:00:00Z') },
  };
  const r = mergeCourse(local, remote);
  assert.deepEqual(r.pushLessons.sort(), ['a/x', 'a/y']);
  assert.deepEqual(r.pushQuizzes, ['a']);
  assert.equal(r.changedLocally, false);
});

test('merging with an empty side is the identity', () => {
  const s: LearnState = { lessons: { 'a/x': lesson({ done: true }) }, quizzes: { a: quiz(100, 100, 1, '2026-01-01T00:00:00Z') } };
  assert.deepEqual(mergeCourse(s, emptyState()).merged, s);
  assert.deepEqual(mergeCourse(emptyState(), s).merged, s);
});
