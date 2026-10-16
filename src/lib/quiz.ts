import questions from '../data/questions.json';
import { isDue, isSeen, progress } from './store';

export type LangBlock = { q: string; options: string[]; why: string };
export type Question = {
  id: string;
  cat: string;
  answer: number;
  en: LangBlock;
  es: LangBlock;
  terms?: { es: string; en: string }[];
  note?: { es: string; en: string };
  src: string;
};

export const allQuestions = questions as unknown as Question[];

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** A random order for showing the three options. */
export const optionOrder = (): number[] => shuffle([0, 1, 2]);

/** Due questions first (oldest due first), then unseen ones, capped at `size`. */
export function buildQueue<T extends { id: string }>(pool: T[], size = 12): { queue: T[]; due: number; fresh: number } {
  const due = pool
    .filter((q) => isDue(q.id))
    .sort((a, b) => (progress.value[a.id]?.card.due.getTime() ?? 0) - (progress.value[b.id]?.card.due.getTime() ?? 0));
  const fresh = shuffle(pool.filter((q) => !isSeen(q.id)));
  const queue = [...due, ...fresh].slice(0, size);
  return { queue, due: due.length, fresh: fresh.length };
}
