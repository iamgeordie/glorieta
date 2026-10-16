import type { User } from '@supabase/supabase-js';
import { signal } from '@preact/signals';
import { bi, mode, type Bi } from '../i18n';
import { describeAuthError } from './auth-errors';
import { mergeExams, mergeProgress } from './merge';
import { exams, onLocalChange, progress, replaceLocal, reviveProgress, type Entry, type ExamResult, type RawEntry } from './store';
import { clearAttempts, pendingAttempts, removeAttempts } from './attempts';
import { crmBrandId, requireClient } from './supabase';

/** Where a lead goes. Origin-checked and rate-limited by Podograph; see docs/backend/README.md. */
const LEADS_URL = 'https://api.podograph.com/leads/capture';
const PAGE = 1000;
const PUSH_DELAY_MS = 2000;

export type SyncState = { state: 'idle' | 'syncing' | 'ok' | 'error'; at?: string; error?: Bi };
export const syncStatus = signal<SyncState>({ state: 'idle' });

export type Profile = {
  user_id: string;
  display_name: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  crm_synced_at: string | null;
};
export const profile = signal<Profile | null>(null);

type ProgressRow = { item_id: string; card: RawEntry['card']; seen: number; right_count: number; updated_at: string };
type ExamRow = { taken_at: string; total: number; errors: number; unanswered: number; passed: boolean };

const dirtyIds = new Set<string>();
const dirtyExams = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let stopListening: (() => void) | undefined;
let activeUser: User | null = null;

const toRow = (userId: string, id: string, e: Entry) => ({
  user_id: userId,
  item_id: id,
  card: e.card,
  seen: e.seen,
  right_count: e.right,
  updated_at: e.at ?? new Date().toISOString(),
});

const examRow = (userId: string, e: ExamResult) => ({
  user_id: userId,
  taken_at: e.at,
  total: e.total,
  errors: e.errors,
  unanswered: e.unanswered,
  passed: e.passed,
});

/** Reads a whole table in pages. `orderBy` must name a unique column, or pages can overlap or skip rows. */
async function fetchAll<T>(table: 'progress' | 'exam_results' | 'attempts', columns: string, orderBy?: string): Promise<T[]> {
  const db = requireClient();
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const query = db.from(table).select(columns);
    const { data, error } = await (orderBy ? query.order(orderBy) : query).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

async function loadProfile(user: User): Promise<Profile> {
  const db = requireClient();
  const found = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data as Profile;
  // First sign-in: create the row, using the consent captured on the sign-up form.
  const meta = user.user_metadata ?? {};
  const optIn = meta.marketing_opt_in === true;
  const created = await db
    .from('profiles')
    .insert({
      user_id: user.id,
      display_name: [meta.display_name, meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '')?.trim().slice(0, 80) ?? null,
      marketing_opt_in: optIn,
      marketing_opt_in_at: optIn && typeof meta.marketing_consent_at === 'string' ? meta.marketing_consent_at : null,
    })
    .select('*')
    .single();
  if (created.error) throw created.error;
  return created.data as Profile;
}

/** Uploads the answer log in batches. Whatever was accepted is removed from the queue; the rest stays for next time. */
async function pushAttempts(user: User) {
  const db = requireClient();
  for (;;) {
    const batch = pendingAttempts().slice(0, 200);
    if (batch.length === 0) return;
    const { error } = await db
      .from('attempts')
      .upsert(batch.map((a) => ({ user_id: user.id, ...a })), { onConflict: 'user_id,item_id,answered_at', ignoreDuplicates: true });
    if (error) throw error;
    removeAttempts(batch);
  }
}

export type StatRow = { grp: string; attempts: number; correct: number; accuracy: number; last_at: string };
export const serverStats = signal<StatRow[] | null>(null);

/** Per-topic results, computed in the database from this person's own answers. */
export async function loadStats(): Promise<Bi | null> {
  try {
    const { data, error } = await requireClient().rpc('my_stats');
    if (error) throw error;
    serverStats.value = (data as StatRow[]).map((r) => ({ ...r, attempts: Number(r.attempts), correct: Number(r.correct), accuracy: Number(r.accuracy) }));
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/** Pull, merge, push. Safe to call again; each step only moves what differs. */
async function reconcile(user: User) {
  const db = requireClient();

  const rows = await fetchAll<ProgressRow>('progress', 'item_id, card, seen, right_count, updated_at');
  const remote = reviveProgress(
    Object.fromEntries(
      rows.map((r) => [r.item_id, { card: r.card, seen: r.seen, right: r.right_count, at: r.updated_at } as RawEntry]),
    ),
  );
  const p = mergeProgress(progress.value, remote);

  const examRows = await fetchAll<ExamRow>('exam_results', 'taken_at, total, errors, unanswered, passed');
  const remoteExams: ExamResult[] = examRows.map((r) => ({
    at: new Date(r.taken_at).toISOString(),
    total: r.total,
    errors: r.errors,
    unanswered: r.unanswered,
    passed: r.passed,
  }));
  const x = mergeExams(exams.value, remoteExams);

  if (p.changedLocally || x.changedLocally) replaceLocal({ progress: p.merged, exams: x.merged });

  for (let i = 0; i < p.push.length; i += 200) {
    const batch = p.push.slice(i, i + 200).map((id) => toRow(user.id, id, p.merged[id] as Entry));
    const { error } = await db.from('progress').upsert(batch, { onConflict: 'user_id,item_id' });
    if (error) throw error;
  }
  if (x.push.length) {
    const { error } = await db
      .from('exam_results')
      .upsert(x.push.map((e) => examRow(user.id, e)), { onConflict: 'user_id,taken_at', ignoreDuplicates: true });
    if (error) throw error;
  }
  await pushAttempts(user);
}

/**
 * Sends the person to the CRM, once, and only if they ticked the opt-in and their email is confirmed.
 * Podograph decides what happens next (segments, drips); this app only reports who consented, and when.
 */
async function sendToCrm(user: User, p: Profile): Promise<Profile> {
  if (!crmBrandId || !p.marketing_opt_in || p.crm_synced_at || !user.email || !user.email_confirmed_at) return p;
  const res = await fetch(LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      brand_id: crmBrandId,
      name: p.display_name ?? undefined,
      source_url: location.origin,
      event_type: 'glorieta_signup',
      payload: { app: 'glorieta', marketing_consent: true, consent_at: p.marketing_opt_in_at, ui_language: mode.value },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || body.success === false) {
    throw new Error(`CRM intake refused the request (HTTP ${res.status}${body.error ? `: ${body.error}` : ''}).`);
  }
  const { data, error } = await requireClient()
    .from('profiles')
    .update({ crm_synced_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Runs after sign-in. Failures stay visible in `syncStatus`; local progress keeps working regardless. */
export async function startSync(user: User) {
  activeUser = user;
  syncStatus.value = { state: 'syncing' };
  try {
    stopListening?.();
    let p = await loadProfile(user);
    await reconcile(user);
    p = await sendToCrm(user, p);
    profile.value = p;
    stopListening = onLocalChange((e) => {
      if (e.kind === 'progress') dirtyIds.add(e.id);
      else dirtyExams.add(e.at);
      schedulePush();
    });
    syncStatus.value = { state: 'ok', at: new Date().toISOString() };
  } catch (err) {
    syncStatus.value = { state: 'error', error: describeAuthError(err) };
  }
}

export function stopSync() {
  stopListening?.();
  stopListening = undefined;
  clearTimeout(timer);
  dirtyIds.clear();
  dirtyExams.clear();
  activeUser = null;
  profile.value = null;
  serverStats.value = null;
  syncStatus.value = { state: 'idle' };
}

function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => void pushDirty(), PUSH_DELAY_MS);
}

async function pushDirty() {
  const user = activeUser;
  if (!user || (dirtyIds.size === 0 && dirtyExams.size === 0 && pendingAttempts().length === 0)) return;
  const ids = [...dirtyIds];
  const examKeys = [...dirtyExams];
  dirtyIds.clear();
  dirtyExams.clear();
  syncStatus.value = { state: 'syncing' };
  try {
    const db = requireClient();
    if (ids.length) {
      const batch = ids.flatMap((id) => (progress.value[id] ? [toRow(user.id, id, progress.value[id] as Entry)] : []));
      const { error } = await db.from('progress').upsert(batch, { onConflict: 'user_id,item_id' });
      if (error) throw error;
    }
    if (examKeys.length) {
      const batch = exams.value.filter((e) => examKeys.includes(e.at)).map((e) => examRow(user.id, e));
      const { error } = await db.from('exam_results').upsert(batch, { onConflict: 'user_id,taken_at', ignoreDuplicates: true });
      if (error) throw error;
    }
    await pushAttempts(user);
    syncStatus.value = { state: 'ok', at: new Date().toISOString() };
  } catch (err) {
    // Put the work back so the next change or "Sync now" retries it; the failure stays on screen.
    ids.forEach((id) => dirtyIds.add(id));
    examKeys.forEach((k) => dirtyExams.add(k));
    syncStatus.value = { state: 'error', error: describeAuthError(err) };
  }
}

/** The "Sync now" button. */
export async function syncNow() {
  if (activeUser) await startSync(activeUser);
}

export async function saveProfile(patch: Partial<Pick<Profile, 'display_name' | 'marketing_opt_in'>>): Promise<Bi | null> {
  const user = activeUser;
  if (!user || !profile.value) return bi('No has iniciado sesión.', 'You are not signed in.');
  const update: Record<string, unknown> = { ...patch };
  if (patch.marketing_opt_in === true && !profile.value.marketing_opt_in) update.marketing_opt_in_at = new Date().toISOString();
  if (patch.marketing_opt_in === false) update.marketing_opt_in_at = null;
  try {
    const { data, error } = await requireClient().from('profiles').update(update).eq('user_id', user.id).select('*').single();
    if (error) throw error;
    profile.value = await sendToCrm(user, data as Profile);
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/** Erases this person's Glorieta rows on the server. Their login itself is not touched here. */
export async function deleteMyData(): Promise<Bi | null> {
  try {
    const db = requireClient();
    // Withdraw the consent captured at sign-up first, or the next sync would recreate the profile and re-send the lead.
    const meta = await db.auth.updateUser({ data: { marketing_opt_in: false, marketing_consent_at: null } });
    if (meta.error) throw meta.error;
    const { error } = await db.rpc('delete_my_data');
    if (error) throw error;
    clearAttempts();
    serverStats.value = null;
    dirtyIds.clear();
    dirtyExams.clear();
    profile.value = null;
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

export type ExportBundle = { exported_at: string; app: 'glorieta'; account: { email: string | undefined; created_at: string | undefined }; profile: Profile | null; progress: ProgressRow[]; exam_results: ExamRow[]; attempts: unknown[] };

/** Everything the database holds about this person in Glorieta, for them to keep. */
export async function exportMyData(): Promise<{ ok: true; data: ExportBundle } | { ok: false; error: Bi }> {
  const user = activeUser;
  if (!user) return { ok: false, error: bi('No has iniciado sesión.', 'You are not signed in.') };
  try {
    const [progressRows, examRows, attemptRows] = await Promise.all([
      fetchAll<ProgressRow>('progress', 'item_id, card, seen, right_count, updated_at', 'item_id'),
      fetchAll<ExamRow>('exam_results', 'taken_at, total, errors, unanswered, passed', 'taken_at'),
      fetchAll<unknown>('attempts', 'item_id, correct, mode, answered_at, id', 'id'),
    ]);
    return {
      ok: true,
      data: {
        exported_at: new Date().toISOString(),
        app: 'glorieta',
        account: { email: user.email, created_at: user.created_at },
        profile: profile.value,
        progress: progressRows,
        exam_results: examRows,
        attempts: attemptRows,
      },
    };
  } catch (err) {
    return { ok: false, error: describeAuthError(err) };
  }
}
