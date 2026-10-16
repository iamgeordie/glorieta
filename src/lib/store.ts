import { signal } from '@preact/signals';
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';

const PROGRESS_KEY = 'carnet.progress.v1';
const EXAMS_KEY = 'carnet.exams.v1';

export type Entry = { card: Card; seen: number; right: number; at?: string };
export type ExamResult = { at: string; total: number; errors: number; passed: boolean; unanswered: number };

export type RawEntry = Omit<Entry, 'card'> & {
  card: Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };
};

const scheduler = fsrs({ enable_fuzz: true });

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // unreadable or blocked storage: start fresh rather than crash
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // progress simply will not persist this visit
  }
}

export function reviveProgress(raw: Record<string, RawEntry>): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [id, e] of Object.entries(raw)) {
    out[id] = {
      seen: e.seen,
      right: e.right,
      // Older saves have no timestamp; the card's last review is the best stand-in.
      at: e.at ?? e.card.last_review,
      card: {
        ...e.card,
        due: new Date(e.card.due),
        last_review: e.card.last_review ? new Date(e.card.last_review) : undefined,
      },
    };
  }
  return out;
}

export const progress = signal<Record<string, Entry>>(reviveProgress(read(PROGRESS_KEY, {})));
export const exams = signal<ExamResult[]>(read(EXAMS_KEY, []));

type ChangeEvent = { kind: 'progress'; id: string } | { kind: 'exam'; at: string };
const listeners = new Set<(e: ChangeEvent) => void>();

/** Lets the sync layer hear about local changes without this file importing it. */
export function onLocalChange(fn: (e: ChangeEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Record an answer for a question or a vocabulary card and reschedule it. */
export function grade(id: string, correct: boolean) {
  const now = new Date();
  const prev = progress.value[id] ?? { card: createEmptyCard(now), seen: 0, right: 0 };
  const { card } = scheduler.next(prev.card, now, correct ? Rating.Good : Rating.Again);
  progress.value = {
    ...progress.value,
    [id]: { card, seen: prev.seen + 1, right: prev.right + (correct ? 1 : 0), at: now.toISOString() },
  };
  write(PROGRESS_KEY, progress.value);
  listeners.forEach((fn) => fn({ kind: 'progress', id }));
}

export function isDue(id: string, now = new Date()): boolean {
  const e = progress.value[id];
  return !!e && e.card.due <= now;
}

export function isSeen(id: string): boolean {
  return !!progress.value[id];
}

export function saveExam(result: ExamResult) {
  exams.value = [...exams.value, result];
  write(EXAMS_KEY, exams.value);
  listeners.forEach((fn) => fn({ kind: 'exam', at: result.at }));
}

/** Replace local state with a merged result from the server. */
export function replaceLocal(next: { progress: Record<string, Entry>; exams: ExamResult[] }) {
  progress.value = next.progress;
  exams.value = next.exams;
  write(PROGRESS_KEY, progress.value);
  write(EXAMS_KEY, exams.value);
}

export function resetAll() {
  progress.value = {};
  exams.value = [];
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(EXAMS_KEY);
  } catch {
    // nothing to remove
  }
}

export function statsFor(ids: string[]) {
  let seen = 0;
  let seenTotal = 0;
  let right = 0;
  let due = 0;
  const now = new Date();
  for (const id of ids) {
    const e = progress.value[id];
    if (!e) continue;
    seen++;
    seenTotal += e.seen;
    right += e.right;
    if (e.card.due <= now) due++;
  }
  return { seen, due, accuracy: seenTotal ? Math.round((right / seenTotal) * 100) : null };
}
