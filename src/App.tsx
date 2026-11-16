import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { bi, LangSwitch, mode, setMode, T } from './i18n';
import { ui } from './ui';
import { Exam } from './screens/Exam';
import { British } from './screens/British';
import { Facts } from './screens/Facts';
import { Home } from './screens/Home';
import { Phrases, Vocab } from './screens/Cards';
import { Signs } from './screens/Signs';
import { Account } from './screens/Account';
import { Splash } from './screens/Splash';
import { hasStoredSession, landingFor } from './lib/landing';
import { authStatus, currentUser } from './lib/auth';
import { profile } from './lib/sync';
import { initialOf, labelOf, pictureOf } from './lib/identity';
import { learn } from './lib/learn';
import outline from './data/learn/outline.json';
import { Bar } from './Bar';
import { Flag } from './Flag';
import { authEnabled } from './lib/supabase';
import { a } from './authStrings';
import { Practice } from './screens/Study';
import { SupporterBadge } from './SupporterBadge';
import { Support } from './screens/Support';
import { b } from './billingStrings';
import { billing, readBilling } from './lib/billing';
import { isTv } from './lib/tv';
import { Suspense, lazy } from 'preact/compat';

/**
 * A strip across the very top with nothing to click. TV browsers cover the top edge with their own menu
 * whenever the pointer moves, so every control sits in the row below this one.
 */
function Banner() {
  const done = Object.values(learn.value.lessons).filter((l) => l.done).length;
  const label = `${done} / ${outline.lessons}`;
  return (
    <div class="banner">
      <div class="banner-title">
        <img class="banner-mark" src="/signs/r-402.svg" width="36" height="36" alt="" />
        <Flag />
        <strong>Glorieta</strong>
        <span class="banner-slogan"><T t={ui.slogan} /></span>
      </div>
      <div class="banner-progress" title={label}>
        <span class="banner-count"><T t={bi('Lecciones', 'Lessons')} /> {label}</span>
        <Bar value={done} total={outline.lessons} label={label} />
      </div>
    </div>
  );
}

function AccountLink() {
  const user = currentUser.value;
  if (authStatus.value !== 'in' || !user) {
    return <a class="account-link" href="#/account"><T t={a.signInLink} /></a>;
  }
  const name = labelOf(user, profile.value?.display_name);
  const picture = pictureOf(user);
  return (
    <a class="account-link signed-in" href="#/account" aria-label={`${a.account.es}: ${name}`}>
      {picture ? (
        <img class="avatar mini" src={picture} alt="" width="28" height="28" referrerpolicy="no-referrer" />
      ) : (
        <span class="avatar mini initial" aria-hidden="true">{initialOf(name)}</span>
      )}
      <span class="account-name">{name}</span>
      <SupporterBadge mini />
    </a>
  );
}

// The course (a megabyte of lesson text and the diagrams) loads only when someone opens Learn.
const Course = lazy(() => import('./screens/Learn').then((m) => ({ default: m.Course })));
const ModuleScreen = lazy(() => import('./screens/Learn').then((m) => ({ default: m.ModuleScreen })));
const LessonScreen = lazy(() => import('./screens/Lesson').then((m) => ({ default: m.LessonScreen })));
const ModuleQuiz = lazy(() => import('./screens/ModuleQuiz').then((m) => ({ default: m.ModuleQuiz })));

// A preview of every lesson diagram, for authors. Not built into the production site.
const FigureGallery = import.meta.env.DEV ? lazy(() => import('./screens/FigureGallery')) : null;

// Opening the bare address lands on the welcome splash, unless the person is already signed in. A deep link
// (anything after the #) and a return from an email or Google link (?code=) go where they point. This is decided
// once, at arrival: afterwards "← Home" is ordinary navigation and always means the home screen.
const arrivedAtRoot = (location.hash === '' || location.hash === '#/') && !['code', 'token_hash'].some((k) => new URL(location.href).searchParams.has(k));
const landing = signal(arrivedAtRoot);

function settleLanding(giveUp = false) {
  if (!landing.value) return;
  const verdict = landingFor({ status: authStatus.value, storedSession: hasStoredSession() });
  if (verdict === 'wait' && !giveUp) return;
  landing.value = false;
  if (verdict !== 'home') location.replace('#/welcome');
}
settleLanding(); // most visitors can be decided at once; no saved session means no waiting
const route = signal(location.hash || '#/');
addEventListener('hashchange', () => {
  route.value = location.hash || '#/';
  scrollTo(0, 0);
});

function Screen() {
  const [, path = '', arg = '', arg2 = '', arg3 = ''] = route.value.split('/');
  switch (path) {
    case 'welcome':
      return <Splash />;
    case 'learn':
      return (
        <Suspense fallback={<p class="muted">…</p>}>
          {!arg ? (
            <Course />
          ) : !arg2 ? (
            <ModuleScreen moduleId={arg} />
          ) : arg2 === 'quiz' ? (
            <ModuleQuiz moduleId={arg} />
          ) : (
            <LessonScreen moduleId={arg} lessonId={arg2} step={arg3 === '' || Number.isNaN(Number(arg3)) ? null : Number(arg3)} />
          )}
        </Suspense>
      );
    case 'figures':
      return FigureGallery ? (
        <Suspense fallback={null}>
          <FigureGallery names={arg} at={arg2 === '' || Number.isNaN(Number(arg2)) ? undefined : Number(arg2)} theme={arg3} />
        </Suspense>
      ) : (
        <Home />
      );
    case 'practice':
      return <Practice categoryId={arg || null} />;
    case 'exam':
      return <Exam />;
    case 'vocab':
      return <Vocab />;
    case 'british':
      return <British />;
    case 'signs':
      return <Signs />;
    case 'account':
      return authEnabled ? <Account view={arg} /> : <Home />;
    case 'support':
      // No billing on the TV, and none in a build without accounts.
      return authEnabled && !isTv() ? <Support /> : <Home />;
    case 'phrases':
      return <Phrases />;
    case 'facts':
      return <Facts />;
    default:
      return <Home />;
  }
}

export function App() {
  // A saved session is being checked: hold the first screen for a moment instead of flashing the wrong one.
  // If sign-in cannot be determined (offline, blocked storage), the splash is the safe default.
  useEffect(() => {
    settleLanding();
    const giveUp = setTimeout(() => settleLanding(true), 3000);
    return () => clearTimeout(giveUp);
  }, [authStatus.value]);

  // The supporter badge in the menu bar needs the person's billing row; a sign-out forgets it.
  useEffect(() => {
    // The badge shows in TV mode too; only the ways to pay stay off the TV.
    if (!authEnabled) return;
    if (authStatus.value === 'in') void readBilling();
    else billing.value = undefined;
  }, [authStatus.value]);

  // E flips between Spanish and English; typing in a field is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key.toLowerCase() === 'e') setMode(mode.value === 'es' ? 'en' : 'es');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (landing.value) return null;
  const home = route.value === '#/' || route.value === '';
  if (route.value === '#/welcome') return <Screen />;
  return (
    <>
      <header class="topbar">
        <Banner />
        <nav class="bar" aria-label="Glorieta">
          <a class="navlink" href="#/" aria-current={home ? 'page' : undefined}><T t={bi('Inicio', 'Home')} /></a>
          <a class="navlink" href="#/welcome"><T t={bi('Bienvenida', 'Welcome')} /></a>
          {authEnabled && !isTv() && (
            <a class="navlink support-link" href="#/support" aria-current={route.value.startsWith('#/support') ? 'page' : undefined}><T t={b.navSupport} /></a>
          )}
          {authEnabled && <AccountLink />}
          <LangSwitch />
        </nav>
      </header>
      <main>
        <Screen />
      </main>
    </>
  );
}
