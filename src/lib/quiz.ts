import questions from '../data/questions.json';
import { signs, signFile, type Sign } from '../data/signs';
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
  /** Path to a sign image shown above the question. */
  image?: string;
  src: string;
};

export const textQuestions = questions as unknown as Question[];

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

/** "What does this sign mean?" questions, one per sign. Wrong options come from the same group first. */
function signQuestion(sign: Sign): Question {
  const sameGroup = shuffle(signs.filter((s) => s.id !== sign.id && s.group === sign.group && s.name.en !== sign.name.en));
  const others = shuffle(signs.filter((s) => s.group !== sign.group));
  const wrong = [...sameGroup, ...others].slice(0, 2);
  const choices = shuffle([sign, ...wrong]);
  const pick = (lang: 'es' | 'en') => choices.map((c) => c.name[lang]);
  return {
    id: `sign:${sign.id}`,
    cat: 'signs',
    answer: choices.indexOf(sign),
    image: signFile(sign),
    es: { q: '¿Qué significa esta señal?', options: pick('es'), why: sign.why.es },
    en: { q: 'What does this sign mean?', options: pick('en'), why: sign.why.en },
    src: `RGC Anexo I (${sign.code})`,
  };
}

export const signQuestions: Question[] = signs.map(signQuestion);

export const allQuestions: Question[] = [...textQuestions, ...signQuestions];

/** A mock exam: mostly text questions, with a few sign questions, as in the real test. */
export function buildExam(total: number, signCount = 4): Question[] {
  const withSigns = shuffle(signQuestions).slice(0, signCount);
  const rest = shuffle(textQuestions).slice(0, Math.max(0, total - withSigns.length));
  return shuffle([...withSigns, ...rest]);
}
