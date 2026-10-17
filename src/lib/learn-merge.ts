/**
 * Pure rules for merging course progress between this device and the server. No I/O, so they can be tested.
 *
 * Course progress is mostly monotone (you finish a lesson, you do not un-finish it; your best quiz score
 * does not shrink), so these merges keep the best of both sides instead of letting one device overwrite the
 * other. Only "where you stopped" and "the latest quiz result" follow the newer side.
 */
import type { CheckResult, LearnState, LessonRecord, QuizRecord } from './learn-core';

const time = (s?: string) => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One lesson. Finished stays finished; the answers are the union, and for a check answered on both
 * devices the earlier answer stays (only the first answer to a check counts); the resume position comes
 * from whichever side was used last.
 */
export function mergeLesson(a: LessonRecord, b: LessonRecord): LessonRecord {
  const aNewer = time(a.at) >= time(b.at);
  const newer = aNewer ? a : b;
  const older = aNewer ? b : a;
  const answered: Record<string, CheckResult> = { ...newer.answered };
  for (const [id, res] of Object.entries(older.answered)) answered[id] = res;
  // On a conflict the older record's answer is the one that was given first, so it wins the copy above.
  const at = newer.at ?? older.at;
  return { done: a.done || b.done, step: newer.step, answered, ...(at ? { at } : {}) };
}

/** One module quiz: the best result is the best of both, attempts are the larger count, the latest result is the newer one. */
export function mergeQuiz(a: QuizRecord, b: QuizRecord): QuizRecord {
  const aNewer = time(a.at) >= time(b.at);
  const newer = aNewer ? a : b;
  return { best: Math.max(a.best, b.best), last: newer.last, attempts: Math.max(a.attempts, b.attempts), at: newer.at };
}

export type CourseMerge = {
  merged: LearnState;
  /** Keys whose merged value differs from what the server has, so they must be uploaded. */
  pushLessons: string[];
  pushQuizzes: string[];
  /** True when the merged state differs from what this device had. */
  changedLocally: boolean;
};

/** Merges the whole course state. Nothing is ever dropped from either side. */
export function mergeCourse(local: LearnState, remote: LearnState): CourseMerge {
  const merged: LearnState = { lessons: {}, quizzes: {} };
  const pushLessons: string[] = [];
  const pushQuizzes: string[] = [];
  let changedLocally = false;

  for (const key of new Set([...Object.keys(local.lessons), ...Object.keys(remote.lessons)])) {
    const l = local.lessons[key];
    const r = remote.lessons[key];
    const value = l && r ? mergeLesson(l, r) : (l ?? r) as LessonRecord;
    merged.lessons[key] = value;
    if (!r || !sameJson(value, r)) pushLessons.push(key);
    if (!l || !sameJson(value, l)) changedLocally = true;
  }
  for (const id of new Set([...Object.keys(local.quizzes), ...Object.keys(remote.quizzes)])) {
    const l = local.quizzes[id];
    const r = remote.quizzes[id];
    const value = l && r ? mergeQuiz(l, r) : (l ?? r) as QuizRecord;
    merged.quizzes[id] = value;
    if (!r || !sameJson(value, r)) pushQuizzes.push(id);
    if (!l || !sameJson(value, l)) changedLocally = true;
  }
  return { merged, pushLessons, pushQuizzes, changedLocally };
}
