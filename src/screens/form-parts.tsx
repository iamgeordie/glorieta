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
