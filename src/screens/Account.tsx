import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { T, type Bi } from '../i18n';
import { a } from '../authStrings';
import { authStatus, currentUser, notice, recovering, requestPasswordReset, signIn, signInWithGoogle, signOut, signUp, updatePassword } from '../lib/auth';
import { deleteMyData, loadStats, profile, saveProfile, serverStats, syncNow, syncStatus } from '../lib/sync';
import { categories } from '../data/categories';
import { googleEnabled } from '../lib/supabase';
import { resetAll } from '../lib/store';

const MIN_PASSWORD = 8;

export function Account({ view }: { view: string }) {
  if (view === 'reset' && recovering.value) return <ResetPassword />;
  const status = authStatus.value;
  if (status === 'loading') return <p class="muted"><T t={a.loading} /></p>;
  return (
    <section>
      <h1><T t={a.account} /></h1>
      {notice.value && <p class="note" role="status"><T t={notice.value} /></p>}
      {status === 'in' ? <Panel /> : <Forms />}
    </section>
  );
}

function Message({ error, ok }: { error?: Bi | null; ok?: Bi | null }) {
  if (error) return <p class="form-error" role="alert"><T t={error} /></p>;
  if (ok) return <p class="note" role="status"><T t={ok} /></p>;
  return null;
}

function PasswordField({ label, value, onInput, autocomplete }: { label: Bi; value: string; onInput: (v: string) => void; autocomplete: string }) {
  const [shown, setShown] = useState(false);
  const inputProps = {
    value,
    required: true,
    minLength: MIN_PASSWORD,
    autocomplete,
    onInput: (e: Event) => onInput((e.currentTarget as HTMLInputElement).value),
  };
  return (
    <label class="field">
      <span class="field-label"><T t={label} /></span>
      <span class="password-row">
        {shown ? <input type="text" {...inputProps} /> : <input type="password" {...inputProps} />}
        <button type="button" class="peek wide" aria-pressed={shown} onClick={() => setShown(!shown)}>
          <T t={shown ? a.hide : a.show} />
        </button>
      </span>
    </label>
  );
}

function Field({ label, children }: { label: Bi; children: ComponentChildren }) {
  return (
    <label class="field">
      <span class="field-label"><T t={label} /></span>
      {children}
    </label>
  );
}

type Tab = 'signin' | 'signup' | 'forgot';

function Forms() {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Bi | null>(null);
  const [ok, setOk] = useState<Bi | null>(null);

  const go = (t: Tab) => {
    setTab(t);
    setError(null);
    setOk(null);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (tab !== 'forgot' && password.length < MIN_PASSWORD) return setError(a.passwordTooShort);
    setBusy(true);
    try {
      if (tab === 'signin') {
        const r = await signIn(email, password);
        if (!r.ok) setError(r.error);
        else location.hash = '#/account';
      } else if (tab === 'signup') {
        const r = await signUp({ email, password, name, marketing });
        if (!r.ok) setError(r.error);
        else if (r.next === 'confirm') setOk(a.checkEmail);
      } else {
        const r = await requestPasswordReset(email);
        if (!r.ok) setError(r.error);
        else setOk(a.resetSent);
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await signInWithGoogle();
    if (!r.ok) setError(r.error);
  };

  return (
    <div class="card">
      {tab !== 'forgot' && (
        <div class="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'signin'} class={tab === 'signin' ? 'on' : ''} onClick={() => go('signin')}><T t={a.signIn} /></button>
          <button type="button" role="tab" aria-selected={tab === 'signup'} class={tab === 'signup' ? 'on' : ''} onClick={() => go('signup')}><T t={a.signUp} /></button>
        </div>
      )}
      {tab === 'forgot' && <h2><T t={a.forgot} /></h2>}

      <form onSubmit={submit} noValidate={false}>
        {tab === 'signup' && (
          <Field label={a.name}>
            <input type="text" value={name} autocomplete="name" maxLength={80} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </Field>
        )}
        <Field label={a.email}>
          <input type="email" value={email} required autocomplete="email" onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)} />
        </Field>
        {tab !== 'forgot' && (
          <>
            <PasswordField label={a.password} value={password} onInput={setPassword} autocomplete={tab === 'signup' ? 'new-password' : 'current-password'} />
            {tab === 'signup' && <p class="muted small"><T t={a.passwordHint} /></p>}
          </>
        )}
        {tab === 'signup' && (
          <>
            <label class="check">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing((e.currentTarget as HTMLInputElement).checked)} />
              <span><T t={a.marketing} /><span class="muted small block"><T t={a.marketingDetail} /></span></span>
            </label>
            <p class="muted small"><T t={a.privacy} /></p>
          </>
        )}
        <Message error={error} ok={ok} />
        <button type="submit" class="primary full" disabled={busy}>
          <T t={busy ? a.working : tab === 'signin' ? a.signIn : tab === 'signup' ? a.signUp : a.sendReset} />
        </button>
      </form>

      {tab === 'signin' && (
        <button type="button" class="link" onClick={() => go('forgot')}><T t={a.forgot} /></button>
      )}
      {tab === 'forgot' && (
        <button type="button" class="link" onClick={() => go('signin')}><T t={a.backToSignIn} /></button>
      )}

      {tab !== 'forgot' && (
        <>
          <p class="divider"><T t={a.or} /></p>
          <button type="button" class="secondary full stack" disabled={!googleEnabled} aria-disabled={!googleEnabled} onClick={google}>
            <T t={a.google} />
            {!googleEnabled && <span class="soon"><T t={a.comingSoon} /></span>}
          </button>
        </>
      )}
    </div>
  );
}

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Bi | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(a.passwordTooShort);
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
    location.hash = '#/account';
  };

  if (done) return <p class="note" role="status"><T t={a.passwordUpdated} /></p>;
  return (
    <section>
      <h1><T t={a.resetTitle} /></h1>
      <form class="card" onSubmit={submit}>
        <PasswordField label={a.newPassword} value={password} onInput={setPassword} autocomplete="new-password" />
        <p class="muted small"><T t={a.passwordHint} /></p>
        <Message error={error} />
        <button type="submit" class="primary full" disabled={busy}><T t={busy ? a.working : a.saveNewPassword} /></button>
      </form>
    </section>
  );
}

const topicName = (grp: string): Bi =>
  grp === 'signs' ? a.topicSigns : grp === 'vocab' ? a.topicVocab : (categories.find((c) => c.id === grp)?.name ?? { es: grp, en: grp });

/** Results by topic, computed in the database from this person's own answers. */
function Stats() {
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

function Panel() {
  const user = currentUser.value;
  const p = profile.value;
  const sync = syncStatus.value;
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: Bi | null; ok?: Bi | null }>({});

  const saveName = async () => {
    const err = await saveProfile({ display_name: (name ?? p?.display_name ?? '').trim() || null });
    setMsg(err ? { error: err } : { ok: a.saved });
  };
  const toggleMarketing = async (on: boolean) => {
    const err = await saveProfile({ marketing_opt_in: on });
    setMsg(err ? { error: err } : { ok: a.saved });
  };
  const erase = async () => {
    if (!confirm(`${a.deleteConfirm.es}\n\n${a.deleteConfirm.en}`)) return;
    const err = await deleteMyData();
    if (err) return setMsg({ error: err });
    resetAll();
    setMsg({ ok: a.deleted });
  };

  return (
    <div>
      <div class="card">
        <p class="muted small"><T t={a.signedInAs} /></p>
        <p class="bold">{user?.email}</p>
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

      <Stats />

      {p && (
        <div class="card">
          <Field label={a.displayName}>
            <span class="password-row">
              <input type="text" value={name ?? p.display_name ?? ''} maxLength={80} autocomplete="name" onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
              <button type="button" class="secondary" onClick={() => void saveName()}><T t={a.save} /></button>
            </span>
          </Field>
          <label class="check">
            <input type="checkbox" checked={p.marketing_opt_in} onChange={(e) => void toggleMarketing((e.currentTarget as HTMLInputElement).checked)} />
            <span><T t={a.marketing} /><span class="muted small block"><T t={a.marketingDetail} /></span></span>
          </label>
          <Message error={msg.error} ok={msg.ok} />
        </div>
      )}

      <div class="card">
        <h2><T t={a.dangerZone} /></h2>
        <p class="muted small"><T t={a.privacy} /></p>
        <button type="button" class="secondary danger" onClick={() => void erase()}><T t={a.deleteData} /></button>
      </div>
    </div>
  );
}
