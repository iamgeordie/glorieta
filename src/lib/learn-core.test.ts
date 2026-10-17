import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  courseProgress,
  emptyState,
  isPass,
  lessonKey,
  moduleStatus,
  nextUp,
  percent,
  pickQuiz,
  type LearnState,
} from './learn-core.ts';

const mods = [
  { id: 'a', lessons: [{ id: 'one' }, { id: 'two' }] },
  { id: 'b', lessons: [{ id: 'one' }] },
];
const done = (...keys: string[]): LearnState => ({
  lessons: Object.fromEntries(keys.map((k) => [k, { done: true, step: 9, answered: {} }])),
  quizzes: {},
});
const A = mods[0]!;
const B = mods[1]!;

test('80 percent passes, 70 does not', () => {
  assert.equal(percent(8, 10), 80);
  assert.equal(isPass(8, 10), true);
  assert.equal(isPass(7, 10), false);
  assert.equal(isPass(0, 0), false);
});

test('a module moves from new to learning to ready to mastered', () => {
  assert.equal(moduleStatus(A, emptyState()), 'new');
  assert.equal(moduleStatus(A, done(lessonKey('a', 'one'))), 'learning');
  const all = done(lessonKey('a', 'one'), lessonKey('a', 'two'));
  assert.equal(moduleStatus(A, all), 'ready');
  all.quizzes.a = { best: 70, last: 70, attempts: 1, at: 'x' };
  assert.equal(moduleStatus(A, all), 'ready');
  all.quizzes.a = { best: 90, last: 70, attempts: 2, at: 'x' };
  assert.equal(moduleStatus(A, all), 'mastered');
});

test('a half-read lesson counts as learning, and testing out is allowed', () => {
  const s = emptyState();
  s.lessons[lessonKey('a', 'one')] = { done: false, step: 2, answered: {} };
  assert.equal(moduleStatus(A, s), 'learning');
  const t = emptyState();
  t.quizzes.a = { best: 100, last: 100, attempts: 1, at: 'x' };
  assert.equal(moduleStatus(A, t), 'mastered');
});

test('next up resumes the first unfinished lesson, then the quiz, then the next module', () => {
  assert.deepEqual(nextUp(mods, emptyState()), { kind: 'lesson', moduleId: 'a', lessonId: 'one', step: 0 });
  const s = done(lessonKey('a', 'one'));
  s.lessons[lessonKey('a', 'two')] = { done: false, step: 3, answered: {} };
  assert.deepEqual(nextUp(mods, s), { kind: 'lesson', moduleId: 'a', lessonId: 'two', step: 3 });
  const all = done(lessonKey('a', 'one'), lessonKey('a', 'two'));
  assert.deepEqual(nextUp(mods, all), { kind: 'quiz', moduleId: 'a' });
  all.quizzes.a = { best: 80, last: 80, attempts: 1, at: 'x' };
  assert.deepEqual(nextUp(mods, all), { kind: 'lesson', moduleId: 'b', lessonId: 'one', step: 0 });
  all.lessons[lessonKey('b', 'one')] = { done: true, step: 4, answered: {} };
  all.quizzes.b = { best: 100, last: 100, attempts: 1, at: 'x' };
  assert.deepEqual(nextUp(mods, all), { kind: 'done' });
});

test('course progress counts lessons and mastered modules', () => {
  const s = done(lessonKey('a', 'one'), lessonKey('b', 'one'));
  s.quizzes.b = { best: 90, last: 90, attempts: 1, at: 'x' };
  assert.deepEqual(courseProgress(mods, s), { lessons: 3, done: 2, modules: 2, mastered: 1 });
  void B;
});

const q = (id: string) => ({ id });
const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => q(`${p}${i}`));
const never = () => false;

test('a quiz has the requested size, no repeats, and the review slots', () => {
  const review = ids(5, 'r');
  const picks = pickQuiz({ own: ids(20, 'o'), review, isDue: never, isSeen: (id) => id.startsWith('r') });
  assert.equal(picks.length, 10);
  assert.equal(new Set(picks.map((p) => p.item.id)).size, 10);
  assert.equal(picks.filter((p) => p.review).length, 2);
});

test('review items come only from what the learner has seen', () => {
  const picks = pickQuiz({ own: ids(20, 'o'), review: ids(5, 'r'), isDue: never, isSeen: never });
  assert.equal(picks.filter((p) => p.review).length, 0);
  assert.equal(picks.length, 10);
});

test('due items of the module come before new ones, and new before seen', () => {
  const own = ids(6, 'o');
  const due = new Set(['o0', 'o1']);
  const seen = new Set(['o0', 'o1', 'o2', 'o3']);
  const picks = pickQuiz({ own, review: [], isDue: (id) => due.has(id), isSeen: (id) => seen.has(id), size: 4 });
  const got = new Set(picks.map((p) => p.item.id));
  assert.deepEqual([...got].sort(), ['o0', 'o1', 'o4', 'o5']);
});

test('a small module fills the quiz with review rather than running short', () => {
  const picks = pickQuiz({ own: ids(3, 'o'), review: ids(9, 'r'), isDue: never, isSeen: (id) => id.startsWith('r') });
  assert.equal(picks.length, 10);
  assert.equal(picks.filter((p) => !p.review).length, 3);
});

test('a module with too few questions gives a short quiz, not a crash', () => {
  const picks = pickQuiz({ own: ids(3, 'o'), review: [], isDue: never, isSeen: never });
  assert.equal(picks.length, 3);
});
