import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { T, type Bi } from '../i18n';
import { a } from '../authStrings';

export const MIN_PASSWORD = 8;

export function Message({ error, ok }: { error?: Bi | null; ok?: Bi | null }) {
  if (error) return <p class="form-error" role="alert"><T t={error} /></p>;
  if (ok) return <p class="note" role="status"><T t={ok} /></p>;
  return null;
}

export function PasswordField({ label, value, onInput, autocomplete }: { label: Bi; value: string; onInput: (v: string) => void; autocomplete: string }) {
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

export function Field({ label, children }: { label: Bi; children: ComponentChildren }) {
  return (
    <label class="field">
      <span class="field-label"><T t={label} /></span>
      {children}
    </label>
  );
}

const PRIVACY_URL = 'https://appliedrelevance.com/privacy';
const TERMS_URL = 'https://appliedrelevance.com/terms';

/** The two documents an account is held under. They live on appliedrelevance.com, which owns the accounts. */
export function LegalLinks({ lead }: { lead?: Bi }) {
  return (
    <p class="legal muted small">
      {lead && <span class="block"><T t={lead} /></span>}
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer noopener"><T t={a.privacyLink} /></a>
      <span aria-hidden="true"> · </span>
      <a href={TERMS_URL} target="_blank" rel="noreferrer noopener"><T t={a.termsLink} /></a>
    </p>
  );
}
