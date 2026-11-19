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
  /** Exam English: a literal rendering of `es` (docs/learn-authoring.md, "Exam English"). */
  exam?: { q: string; options: string[] };
  terms?: { es: string; en: string }[];
  note?: Bi;
  /**
   * Shows this official sign (an id in signs.json) above the question, as the real test does. Use it, and
   * write "this sign" in the question, instead of naming a sign by its catalogue code (R-303): nobody has
   * to memorize those codes. For a sign with no picture here, use its name, never its code.
   */
  sign?: string;
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
  /**
   * A change in the law: what the rule was, what it is now, and the date the new wording took effect
   * (`since`, YYYY-MM-DD). `src` cites the article in force. Collected on the Tricks and Tips screen.
   */
  | { t: 'new'; since: string; was: Bi; now: Bi; src: string }
  /**
   * A point where practice tests give an answer the law or the DGT does not: what they say, and the
   * correct rule. `src` cites the source of the correct rule. Collected on the Tricks and Tips screen.
   */
  | { t: 'trap'; was: Bi; now: Bi; src: string }
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
