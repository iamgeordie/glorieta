import { bi, type Bi } from './i18n';

/**
 * Sentences that carry numbers, built whole in each language so that the
 * ES+EN view shows one Spanish line and one English line, not word fragments.
 */
export const questionOf = (n: number, total: number, due = 0): Bi =>
  bi(
    `Pregunta ${n} de ${total}${due > 0 ? ` · ${due} para repasar` : ''}`,
    `Question ${n} of ${total}${due > 0 ? ` · ${due} due for review` : ''}`,
  );

export const seenOf = (seen: number, total: number, due = 0): Bi =>
  bi(
    `${seen}/${total}${due > 0 ? ` · ${due} para repasar` : ''}`,
    `${seen}/${total}${due > 0 ? ` · ${due} due for review` : ''}`,
  );

export const timeLeft = (mm: number, ss: string): Bi => bi(`Tiempo restante ${mm}:${ss}`, `Time left ${mm}:${ss}`);

export const examFacts = (questions: number, minutes: number, maxErrors: number): Bi =>
  bi(
    `${questions} preguntas · ${minutes} min · Máximo de fallos permitidos: ${maxErrors}`,
    `${questions} questions · ${minutes} min · Maximum mistakes allowed: ${maxErrors}`,
  );

export const mistakes = (n: number): Bi => bi(`${n} fallos`, n === 1 ? '1 mistake' : `${n} mistakes`);

export const maxMistakes = (n: number): Bi => bi(`Máximo de fallos permitidos: ${n}`, `Maximum mistakes allowed: ${n}`);

export const submitExam = (answered: number, total: number): Bi =>
  bi(`Entregar examen (${answered}/${total})`, `Submit exam (${answered}/${total})`);

export const cardProgress = (n: number, total: number, due: number, fresh: number): Bi =>
  bi(
    `${n} de ${total} · ${due} tarjetas pendientes, ${fresh} nuevas`,
    `${n} of ${total} · ${due} cards due, ${fresh} new`,
  );

export const lastExam = (errors: number, passed: boolean): Bi =>
  bi(
    `Último simulacro: ${errors} fallos · ${passed ? 'Aprobado' : 'Suspenso'}`,
    `Last mock exam: ${errors === 1 ? '1 mistake' : `${errors} mistakes`} · ${passed ? 'Passed' : 'Failed'}`,
  );
