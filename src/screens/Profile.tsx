import { useEffect, useState } from 'preact/hooks';
import type { User } from '@supabase/supabase-js';
import { T, type Bi } from '../i18n';
import { a } from '../authStrings';
import { currentUser, signOut, updatePassword } from '../lib/auth';
import { deleteMyData, exportMyData, loadStats, profile, saveProfile, serverStats, syncNow, syncStatus } from '../lib/sync';
import { exams, progress, resetAll } from '../lib/store';
import { categories } from '../data/categories';
import { Field, Message, MIN_PASSWORD, PasswordField } from './form-parts';

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** The picture Google supplies, if any. Only an https address is ever used as an image source. */
function pictureOf(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const url = asText(meta.avatar_url) ?? asText(meta.picture);
  return url && url.startsWith('https://') ? url : null;
}

function nameOf(user: User, saved: string | null | undefined): string {
  const meta = user.user_metadata ?? {};
  return saved ?? asText(meta.full_name) ?? asText(meta.name) ?? asText(meta.display_name) ?? user.email?.split('@')[0] ?? '';
}

const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

const day = (iso: string | undefined | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function providersOf(user: User): string[] {
  return Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : [user.app_metadata?.provider ?? 'email'];
}

function methodsOf(user: User): Bi[] {
  return providersOf(user).map((p) => (p === 'google' ? a.methodGoogle : p === 'email' ? a.methodEmail : { es: p, en: p }));
}

const topicName = (grp: string): Bi =>
  grp === 'signs' ? a.topicSigns : grp === 'vocab' ? a.topicVocab : (categories.find((c) => c.id === grp)?.name ?? { es: grp, en: grp });

export function Profile() {
  const user = currentUser.value;
  if (!user) return null;
  return (
    <div>
      <Header user={user} />
      <Study />
      <Topics />
      <Details />
      {providersOf(user).includes('email') ? <PasswordCard /> : <GooglePasswordNote />}
      <Data />
    </div>
  );
}

function Header({ user }: { user: User }) {
  const p = profile.value;
  const sync = syncStatus.value;
  const name = nameOf(user, p?.display_name);
  const picture = pictureOf(user);
  return (
    <div class="card profile-head">
      {picture ? (
        <img class="avatar" src={picture} alt="" width={64} height={64} referrerpolicy="no-referrer" />
      ) : (
        <span class="avatar initial" aria-hidden="true">{initialOf(name)}</span>
      )}
      <div class="profile-id">
        <p class="bold profile-name">{name}</p>
        <p class="muted small">{user.email}</p>
        <p class="small">
          <span class={user.email_confirmed_at ? 'badge ok' : 'badge'}>
            <T t={user.email_confirmed_at ? a.emailVerified : a.emailUnverified} />
          </span>
        </p>
      </div>
      <dl class="facts">
        <div><dt><T t={a.signInMethod} /></dt><dd>{methodsOf(user).map((m, i) => <span key={i}>{i > 0 && ', '}<T t={m} /></span>)}</dd></div>
        <div><dt><T t={a.memberSince} /></dt><dd>{day(user.created_at)}</dd></div>
        <div><dt><T t={a.lastSignIn} /></dt><dd>{day(user.last_sign_in_at)}</dd></div>
      </dl>
      <p class={`sync ${sync.state}`} role="status">
        <T t={sync.state === 'syncing' ? a.syncing : sync.state === 'ok' ? a.synced : sync.state === 'error' ? a.syncError : a.syncIdle} />
        {sync.state === 'ok' && sync.at && <span class="muted small"> · {new Date(sync.at).toLocaleTimeString()}</span>}
      </p>
      {sync.error && <p class="form-error" role="alert"><T t={sync.error} /></p>}
      <div class="actions">
        <button type="button" class="secondary" onClick={() => void syncNow()} disabled={sync.state === 'syncing'}><T t={a.syncNow} /></button>
        <button type="button" class="secondary" onClick={() => void signOut()}><T t={a.signOut} /></button>
      </div>
    </div>
  );
}

/** Totals from this device's merged progress, which is what the server holds after a sync. */
function Study() {
  const entries = Object.values(progress.value);
  const answers = entries.reduce((n, e) => n + e.seen, 0);
  const right = entries.reduce((n, e) => n + e.right, 0);
  const taken = exams.value;
  const passed = taken.filter((e) => e.passed).length;
  const best = taken.length > 0 ? taken.reduce((m, e) => (e.errors < m.errors ? e : m)) : null;
  return (
    <div class="card">
      <h2><T t={a.studyTitle} /></h2>
      <dl class="stats">
        <div><dt><T t={a.studyQuestions} /></dt><dd>{entries.length}</dd></div>
        <div><dt><T t={a.studyAnswers} /></dt><dd>{answers}</dd></div>
        <div><dt><T t={a.studyAccuracy} /></dt><dd>{answers > 0 ? `${Math.round((100 * right) / answers)}%` : '—'}</dd></div>
        <div><dt><T t={a.studyExams} /></dt><dd>{taken.length}<span class="muted small"> · {passed} <T t={a.studyPassed} /></span></dd></div>
      </dl>
      {best && (
        <p class="muted small">
          <T t={a.studyBest} />: {best.errors} <T t={a.studyBestErrors} /> · {day(best.at)}
        </p>
      )}
    </div>
  );
}

/** Results by topic, computed in the database from this person's own answers. */
function Topics() {
  const rows = serverStats.value;
  const synced = syncStatus.value.state === 'ok';
  useEffect(() => {
    if (synced) void loadStats();
  }, [synced]);
  return (
    <div class="card">
      <h2><T t={a.statsTitle} /></h2>
      {rows === null && <p class="muted small"><T t={a.loading} /></p>}
      {rows !== null && rows.length === 0 && <p class="muted small"><T t={a.statsEmpty} /></p>}
      {rows !== null && rows.length > 0 && (
        <ul class="stats-list">
          {rows.map((r) => (
            <li key={r.grp}>
              <span class="stat-name"><T t={topicName(r.grp)} /></span>
              <span class="stat-bar" role="img" aria-label={`${r.accuracy}%`}>
                <span style={{ width: `${Math.max(0, Math.min(100, r.accuracy))}%` }} />
              </span>
              <span class="stat-num">{Math.round(r.accuracy)}% · {r.attempts} <T t={a.statsAnswers} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Details() {
  const p = profile.value;
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: Bi | null; ok?: Bi | null }>({});
  if (!p) return null;
  const saveName = async () => {
    const err = await saveProfile({ display_name: (name ?? p.display_name ?? '').trim() || null });
    setMsg(err ? { error: err } : { ok: a.saved });
  };
  const toggleMarketing = async (on: boolean) => {
    const err = await saveProfile({ marketing_opt_in: on });
    setMsg(err ? { error: err } : { ok: a.saved });
  };
  return (
    <div class="card">
      <h2><T t={a.detailsTitle} /></h2>
      <Field label={a.displayName}>
        <span class="password-row">
          <input type="text" value={name ?? p.display_name ?? ''} maxLength={80} autocomplete="name" onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          <button type="button" class="secondary" onClick={() => void saveName()}><T t={a.save} /></button>
        </span>
      </Field>
      <label class="check">
        <input type="checkbox" checked={p.marketing_opt_in} onChange={(e) => void toggleMarketing((e.currentTarget as HTMLInputElement).checked)} />
        <span>
          <T t={a.marketing} />
          <span class="muted small block"><T t={a.marketingDetail} /></span>
          <span class="muted small block">
            {p.marketing_opt_in ? (
              <>
                <T t={a.consentOn} /> {day(p.marketing_opt_in_at)}
                {p.crm_synced_at && <> · <T t={a.consentSynced} /> {day(p.crm_synced_at)}</>}
              </>
            ) : (
              <T t={a.consentOff} />
            )}
          </span>
        </span>
      </label>
      <Message error={msg.error} ok={msg.ok} />
    </div>
  );
}

function PasswordCard() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: Bi | null; ok?: Bi | null }>({});
  const submit = async (e: Event) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setMsg({ error: a.passwordTooShort });
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (r.ok) {
      setPassword('');
      setMsg({ ok: a.passwordUpdated });
    } else {
      setMsg({ error: r.error });
    }
  };
  return (
    <form class="card" onSubmit={submit}>
      <h2><T t={a.passwordTitle} /></h2>
      <PasswordField label={a.newPassword} value={password} onInput={setPassword} autocomplete="new-password" />
      <p class="muted small"><T t={a.passwordHint} /></p>
      <Message error={msg.error} ok={msg.ok} />
      <button type="submit" class="secondary" disabled={busy}><T t={busy ? a.working : a.changePassword} /></button>
    </form>
  );
}

function GooglePasswordNote() {
  return (
    <div class="card">
      <h2><T t={a.passwordTitle} /></h2>
      <p class="muted small"><T t={a.passwordGoogle} /></p>
    </div>
  );
}

function Data() {
  const [msg, setMsg] = useState<{ error?: Bi | null; ok?: Bi | null }>({});
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    setMsg({ ok: a.exporting });
    const r = await exportMyData();
    setBusy(false);
    if (!r.ok) return setMsg({ error: r.error });
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `glorieta-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMsg({});
  };
  const erase = async () => {
    if (!confirm(`${a.deleteConfirm.es}\n\n${a.deleteConfirm.en}`)) return;
    const err = await deleteMyData();
    if (err) return setMsg({ error: err });
    resetAll();
    setMsg({ ok: a.deleted });
  };

  return (
    <div class="card">
      <h2><T t={a.dangerZone} /></h2>
      <p class="muted small"><T t={a.privacy} /></p>
      <div class="actions">
        <button type="button" class="secondary" onClick={() => void download()} disabled={busy}><T t={a.exportData} /></button>
      </div>
      <p class="muted small"><T t={a.exportHint} /></p>
      <div class="actions">
        <button type="button" class="secondary danger" onClick={() => void erase()}><T t={a.deleteData} /></button>
      </div>
      <p class="muted small"><T t={a.deleteAccountNote} /></p>
      <Message error={msg.error} ok={msg.ok} />
    </div>
  );
}
