import { useState } from 'preact/hooks';
import { T, type Bi } from '../i18n';
import { a } from '../authStrings';
import { authStatus, currentUser, notice, recovering, returnError, requestPasswordReset, signIn, signInWithGoogle, signOut, signUp, updatePassword } from '../lib/auth';
import { googleEnabled } from '../lib/supabase';
import { Field, Message, MIN_PASSWORD, PasswordField } from './form-parts';
import { Profile } from './Profile';

export function Account({ view }: { view: string }) {
  if (view === 'reset' && recovering.value) return <ResetPassword />;
  const status = authStatus.value;
  if (status === 'loading') return <p class="muted"><T t={a.loading} /></p>;
  return (
    <section>
      <h1><T t={a.account} /></h1>
      {notice.value && <p class="note" role="status"><T t={notice.value} /></p>}
      {returnError.value && (
        <p class="form-error" role="alert">
          <T t={a.signInFailed} /> <span class="muted small block">{returnError.value}</span>
        </p>
      )}
      {status === 'in' ? <Profile /> : <Forms />}
    </section>
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
