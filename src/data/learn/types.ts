import type { Bi } from '../../i18n';

/**
 * One multiple-choice question inside a lesson. Same shape as the question bank, minus `cat`
 * (it takes the module's category). Every check is also added to the bank, so it must make sense
 * on its own: no "as in the figure above".
 */
export type CheckQuestion = {
  /** `<module id>-<anything>`; the part before the first hyphen is the topic the server groups by. */
  id: string;
  answer: number;
  es: { q: string; options: string[]; why: string };
  en: { q: string; options: string[]; why: string };
  terms?: { es: string; en: string }[];
  note?: Bi;
  src: string;
};

export type Block =
  /** A paragraph. `**bold**` marks the key term or number. */
  | { t: 'p'; text: Bi }
  /** A rule that comes from a law. `src` cites the article. */
  | { t: 'rule'; text: Bi; src: string }
  | { t: 'list'; items: Bi[]; ordered?: boolean }
  | { t: 'table'; head: Bi[]; rows: Bi[][] }
  /** An SVG from src/learn-figures. The SVG holds no words; `legend` explains its letters and numbers. */
  | { t: 'figure'; file: string; alt: Bi; caption: Bi; legend?: { mark: string; text: Bi }[] }
  /** Official signs from signs.json, shown with their names. */
  | { t: 'signs'; ids: string[]; caption?: Bi }
  /** What differs from the US. */
  | { t: 'us'; text: Bi }
  /** Advice or a memory trick. Not law. */
  | { t: 'tip'; text: Bi }
  /** A worked example: a situation, what to do, and why. */
  | { t: 'example'; title?: Bi; situation: Bi; action: Bi; why: Bi }
  | { t: 'check'; q: CheckQuestion };

export type Step = { title: Bi; blocks: Block[] };

export type Lesson = {
  /** Unique inside the module; used in the URL. */
  id: string;
  title: Bi;
  minutes: number;
  /** "By the end you can ..." */
  goals: Bi[];
  /** Key terms, shown before the lesson starts. */
  terms: { es: string; en: string }[];
  /** An unmarked guess shown before the content. Its answer must be taught in the lesson. */
  pretest?: CheckQuestion;
  steps: Step[];
  /** The few things to keep. */
  recap: Bi[];
  /** Bank question ids (questions.json) whose answers this lesson teaches. */
  covers?: string[];
  /** Laws and official documents the lesson rests on. */
  src: string[];
};

export type Module = {
  /** Also the question category and the file name. */
  id: string;
  title: Bi;
  blurb: Bi;
  lessons: Lesson[];
};
