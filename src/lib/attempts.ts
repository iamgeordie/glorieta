/**
 * The answer log. Every answer is appended here as it happens, and uploaded to the server when
 * signed in. Answers given before signing in are kept too, so a new account starts with its history.
 * The queue only holds what has not been uploaded yet; the server holds the record.
 */
export type AttemptMode = 'practice' | 'exam' | 'vocab';
export type Attempt = { item_id: string; correct: boolean; mode: AttemptMode; answered_at: string };

const KEY = 'glorieta.attempts.pending.v1';
/** Enough for months of practice; beyond this the oldest unsent answers are dropped, never the newest. */
export const MAX_PENDING = 2000;

const keyOf = (a: Attempt) => `${a.item_id}|${a.answered_at}`;

/** Keeps the newest `max` attempts. */
export function capAttempts(list: Attempt[], max: number): Attempt[] {
  return list.length > max ? list.slice(list.length - max) : list;
}

/** What is left after some attempts have been uploaded. */
export function withoutSent(list: Attempt[], sent: Attempt[]): Attempt[] {
  const done = new Set(sent.map(keyOf));
  return list.filter((a) => !done.has(keyOf(a)));
}

function read(): Attempt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attempt[]) : [];
  } catch {
    // unreadable or blocked storage: start with an empty queue rather than crash
    return [];
  }
}

function write(list: Attempt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // answers still count toward the schedule; only the history upload is lost
  }
}

export function recordAttempt(a: Attempt) {
  write(capAttempts([...read(), a], MAX_PENDING));
}

export const pendingAttempts = (): Attempt[] => read();

export function removeAttempts(sent: Attempt[]) {
  write(withoutSent(read(), sent));
}

export function clearAttempts() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to remove
  }
}
