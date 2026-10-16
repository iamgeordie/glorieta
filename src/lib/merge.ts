/**
 * Pure merge rules for syncing progress between this device and the server.
 * No I/O here, so the rules can be tested on their own.
 *
 * Per question or card the newer record wins. This is last-write-wins: if you
 * study the same card on two devices, the later answer replaces the earlier
 * one, including its counters. For a study app that trade is acceptable, and
 * it keeps the schedule (what is due when) consistent.
 */
export type Stamped = { at?: string; seen: number };

const time = (s?: string) => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeProgress<T extends Stamped>(
  local: Record<string, T>,
  remote: Record<string, T>,
): { merged: Record<string, T>; push: string[]; changedLocally: boolean } {
  const merged: Record<string, T> = {};
  const push: string[] = [];
  let changedLocally = false;

  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[id];
    const r = remote[id];
    if (l && !r) {
      merged[id] = l;
      push.push(id);
    } else if (r && !l) {
      merged[id] = r;
      changedLocally = true;
    } else if (l && r) {
      const lt = time(l.at);
      const rt = time(r.at);
      const localWins = lt > rt || (lt === rt && l.seen >= r.seen);
      merged[id] = localWins ? l : r;
      if (localWins) {
        if (!sameJson(l, r)) push.push(id);
      } else {
        changedLocally = true;
      }
    }
  }
  return { merged, push, changedLocally };
}

export type Dated = { at: string };

/** Exam results are immutable events, so merging them is a union keyed by timestamp. */
export function mergeExams<T extends Dated>(local: T[], remote: T[]): { merged: T[]; push: T[]; changedLocally: boolean } {
  const remoteKeys = new Set(remote.map((e) => e.at));
  const localKeys = new Set(local.map((e) => e.at));
  const push = local.filter((e) => !remoteKeys.has(e.at));
  const pulled = remote.filter((e) => !localKeys.has(e.at));
  const merged = [...local, ...pulled].sort((a, b) => time(a.at) - time(b.at));
  return { merged, push, changedLocally: pulled.length > 0 };
}
