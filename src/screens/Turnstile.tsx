import { useEffect, useRef, useState } from 'preact/hooks';
import { T } from '../i18n';
import { a } from '../authStrings';
import { turnstileSiteKey } from '../lib/supabase';

type Api = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<Api> | null = null;

/** Loads Cloudflare's official script once. A failed load rejects, and the next try starts again. */
function loadApi(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')));
    s.onerror = () => {
      s.remove();
      loading = null;
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile check. Supabase Auth requires its token on sign-in, sign-up and password reset.
 * Bump `resetKey` after every attempt: a token works once. A failed check is shown, never skipped.
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let gone = false;
    setFailed(false);
    loadApi()
      .then((api) => {
        if (gone || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: turnstileSiteKey,
          size: 'flexible',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => {
            onToken(null);
            setFailed(true);
            return true;
          },
        });
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
      onToken(null);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  return (
    <div class="captcha">
      <div ref={box} />
      {failed && (
        <p class="form-error" role="alert">
          <T t={a.captchaLoadFailed} />
        </p>
      )}
    </div>
  );
}
