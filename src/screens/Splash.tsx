import { useEffect, useRef } from 'preact/hooks';
import { LangSwitch, T } from '../i18n';
import { ui } from '../ui';
import { createSplash } from '../lib/splash-canvas';
import { authStatus } from '../lib/auth';
import { authEnabled } from '../lib/supabase';
import { a } from '../authStrings';
import { Flag } from '../Flag';

const COMMONS_PAGE = 'https://commons.wikimedia.org/wiki/File:Spain_traffic_signal_r402.svg';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

export function Splash() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mark = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas.current || !mark.current) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scene = createSplash(canvas.current, mark.current, { reducedMotion: query.matches });
    return () => scene.destroy();
  }, []);

  return (
    <div class="splash">
      <canvas ref={canvas} class="splash-canvas" aria-hidden="true" />
      <header class="splash-top">
        <LangSwitch />
      </header>

      <main class="splash-main">
        <div ref={mark} class="splash-mark" aria-hidden="true" />
        <h1 class="splash-title">Glorieta</h1>
        <p class="splash-slogan"><Flag /><T t={ui.slogan} /></p>
        <p class="splash-lede"><T t={ui.tagline} /></p>
        <div class="splash-actions">
          <a class="primary splash-cta" href="#/">
            <T t={ui.startStudying} />
          </a>
          {authEnabled && authStatus.value !== 'in' && (
            <a class="secondary splash-cta splash-signin" href="#/account">
              <T t={a.signInOrCreate} />
            </a>
          )}
        </div>
      </main>

      <footer class="splash-foot">
        <p><T t={ui.unofficialFull} /></p>
        <p>
          Señal / Sign R-402:{' '}
          <a href={COMMONS_PAGE} target="_blank" rel="noreferrer noopener">Majafego</a>,{' '}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer noopener">CC BY-SA 4.0</a>, Wikimedia Commons.
        </p>
      </footer>
    </div>
  );
}
