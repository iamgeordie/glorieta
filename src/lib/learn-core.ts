/**
 * The rules of the course, with no browser or UI in them so they can be tested.
 * Pedagogy this encodes: mastery learning (a pass mark per module), retrieval practice
 * (checks and a quiz), interleaving (the quiz mixes in items from earlier modules).
 */

/** Share of the quiz that must be right to count a module as mastered. */
export const PASS_PERCENT = 80;
export const QUIZ_SIZE = 10;
/** How many quiz slots go to items from earlier modules. */
export const REVIEW_SLOTS = 2;

export type CheckResult = { sel: number; ok: boolean };
export type LessonRecord = { done: boolean; step: number; answered: Record<string, CheckResult>; at?: string };
export type QuizRecord = { best: number; last: number; attempts: number; at: string };
export type LearnState = { lessons: Record<string, LessonRecord>; quizzes: Record<string, QuizRecord> };

export const emptyState = (): LearnState => ({ lessons: {}, quizzes: {} });

export const lessonKey = (moduleId: string, lessonId: string) => `${moduleId}/${lessonId}`;

export const percent = (correct: number, total: number) => (total > 0 ? Math.round((100 * correct) / total) : 0);
export const isPass = (correct: number, total: number) => percent(correct, total) >= PASS_PERCENT;

export type ModuleLike = { id: string; lessons: { id: string }[] };
export type ModuleStatus = 'new' | 'learning' | 'ready' | 'mastered';

export function lessonsDone(m: ModuleLike, s: LearnState): number {
  return m.lessons.filter((l) => s.lessons[lessonKey(m.id, l.id)]?.done).length;
}

/**
 * new: nothing started. learning: some lessons done. ready: every lesson done, quiz not yet passed.
 * mastered: quiz passed, even if the learner skipped the lessons (testing out is allowed).
 */
export function moduleStatus(m: ModuleLike, s: LearnState): ModuleStatus {
  const q = s.quizzes[m.id];
  if (q && q.best >= PASS_PERCENT) return 'mastered';
  const done = lessonsDone(m, s);
  if (done === m.lessons.length && m.lessons.length > 0) return 'ready';
  const started = m.lessons.some((l) => (s.lessons[lessonKey(m.id, l.id)]?.step ?? 0) > 0);
  if (done > 0 || started || q) return 'learning';
  return 'new';
}

export type NextUp =
  | { kind: 'lesson'; moduleId: string; lessonId: string; step: number }
  | { kind: 'quiz'; moduleId: string }
  | { kind: 'done' };

/** The recommended next thing: the first unfinished lesson, or the quiz after the last lesson of a module. */
export function nextUp(modules: ModuleLike[], s: LearnState): NextUp {
  for (const m of modules) {
    for (const l of m.lessons) {
      const rec = s.lessons[lessonKey(m.id, l.id)];
      if (!rec?.done) return { kind: 'lesson', moduleId: m.id, lessonId: l.id, step: rec?.step ?? 0 };
    }
    if (moduleStatus(m, s) !== 'mastered') return { kind: 'quiz', moduleId: m.id };
  }
  return { kind: 'done' };
}

export function courseProgress(modules: ModuleLike[], s: LearnState) {
  const lessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const done = modules.reduce((n, m) => n + lessonsDone(m, s), 0);
  const mastered = modules.filter((m) => moduleStatus(m, s) === 'mastered').length;
  return { lessons, done, modules: modules.length, mastered };
}

export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export type QuizPick<T> = { item: T; review: boolean };

/**
 * Builds one module quiz. Most items come from the module itself, due-for-review ones first, then
 * unseen ones, then the rest. A couple come from earlier modules the learner has already touched
 * (interleaving): due ones first, then ones they have seen. Never repeats an item.
 */
export function pickQuiz<T extends { id: string }>(opts: {
  own: readonly T[];
  review: readonly T[];
  isDue: (id: string) => boolean;
  isSeen: (id: string) => boolean;
  size?: number;
  reviewSlots?: number;
  rng?: () => number;
}): QuizPick<T>[] {
  const { own, review, isDue, isSeen, size = QUIZ_SIZE, reviewSlots = REVIEW_SLOTS, rng = Math.random } = opts;
  const due = shuffled(own.filter((q) => isDue(q.id)), rng);
  const fresh = shuffled(own.filter((q) => !isSeen(q.id)), rng);
  const rest = shuffled(own.filter((q) => isSeen(q.id) && !isDue(q.id)), rng);
  const ownOrdered = [...due, ...fresh, ...rest];

  const reviewDue = shuffled(review.filter((q) => isDue(q.id)), rng);
  const reviewSeen = shuffled(review.filter((q) => isSeen(q.id) && !isDue(q.id)), rng);
  const reviewOrdered = [...reviewDue, ...reviewSeen];

  const slots = Math.min(reviewSlots, reviewOrdered.length, size);
  // If the module is small, the review slots grow to fill the quiz rather than leaving it short.
  const ownTake = ownOrdered.slice(0, size - slots);
  const extra = size - ownTake.length - slots;
  const reviewTake = reviewOrdered.slice(0, slots + Math.max(0, extra));

  const picks: QuizPick<T>[] = [
    ...ownTake.map((item) => ({ item, review: false })),
    ...reviewTake.map((item) => ({ item, review: true })),
  ];
  return shuffled(picks, rng);
}
