import { signal } from '@preact/signals';
import { emptyState, lessonKey, percent, type CheckResult, type LearnState, type LessonRecord } from './learn-core';

const KEY = 'glorieta.learn.v1';

function read(): LearnState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LearnState>;
    return { lessons: parsed.lessons ?? {}, quizzes: parsed.quizzes ?? {} };
  } catch {
    // unreadable or blocked storage: start fresh rather than crash
    return emptyState();
  }
}

/** Where the learner is in the course. Kept on this device only. */
export const learn = signal<LearnState>(read());

export type LearnChange = { kind: 'lesson'; key: string } | { kind: 'quiz'; id: string };
const listeners = new Set<(e: LearnChange) => void>();

/** Lets the sync layer hear about local changes without this file importing it. */
export function onLearnChange(fn: (e: LearnChange) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next: LearnState, change?: LearnChange) {
  learn.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // progress simply will not persist this visit
  }
  if (change) listeners.forEach((fn) => fn(change));
}

/** Replace local state with a merged result from the server. Not reported as a local change. */
export function replaceLearn(next: LearnState) {
  commit(next);
}

const blank = (): LessonRecord => ({ done: false, step: 0, answered: {} });

function updateLesson(moduleId: string, lessonId: string, change: (r: LessonRecord) => LessonRecord) {
  const key = lessonKey(moduleId, lessonId);
  const prev = learn.value.lessons[key] ?? blank();
  commit({ ...learn.value, lessons: { ...learn.value.lessons, [key]: { ...change(prev), at: new Date().toISOString() } } }, { kind: 'lesson', key });
}

export const lessonRecord = (moduleId: string, lessonId: string): LessonRecord =>
  learn.value.lessons[lessonKey(moduleId, lessonId)] ?? blank();

export const saveStep = (moduleId: string, lessonId: string, step: number) =>
  updateLesson(moduleId, lessonId, (r) => (r.step === step ? r : { ...r, step }));

/** Only the first answer to a check counts, so reading back through a lesson cannot change the record. */
export const saveCheck = (moduleId: string, lessonId: string, id: string, result: CheckResult) =>
  updateLesson(moduleId, lessonId, (r) => (r.answered[id] ? r : { ...r, answered: { ...r.answered, [id]: result } }));

export const completeLesson = (moduleId: string, lessonId: string) =>
  updateLesson(moduleId, lessonId, (r) => ({ ...r, done: true }));

export function saveQuiz(moduleId: string, correct: number, total: number) {
  const score = percent(correct, total);
  const prev = learn.value.quizzes[moduleId];
  commit({
    ...learn.value,
    quizzes: {
      ...learn.value.quizzes,
      [moduleId]: { best: Math.max(prev?.best ?? 0, score), last: score, attempts: (prev?.attempts ?? 0) + 1, at: new Date().toISOString() },
    },
  }, { kind: 'quiz', id: moduleId });
}

export function resetLearn() {
  commit(emptyState());
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to remove
  }
}
