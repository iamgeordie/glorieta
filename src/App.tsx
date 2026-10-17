import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { LangSwitch, mode, setMode, T } from './i18n';
import { ui } from './ui';
import { Exam } from './screens/Exam';
import { Facts } from './screens/Facts';
import { Home } from './screens/Home';
import { Phrases, Vocab } from './screens/Cards';
import { Signs } from './screens/Signs';
import { Account } from './screens/Account';
import { Splash } from './screens/Splash';
import { hasStoredSession, landingFor } from './lib/landing';
import { authStatus } from './lib/auth';
import { authEnabled } from './lib/supabase';
import { a } from './authStrings';
import { Practice } from './screens/Study';
import { Suspense, lazy } from 'preact/compat';

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
const arrivedAtRoot = (location.hash === '' || location.hash === '#/') && !new URL(location.href).searchParams.has('code');
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
    case 'signs':
      return <Signs />;
    case 'account':
      return authEnabled ? <Account view={arg} /> : <Home />;
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
        <a class="brand" href={home ? '#/welcome' : '#/'} aria-label={home ? ui.appName.es : ui.home.es}>
          {home ? (
            <>
              <img class="brand-mark" src="/signs/r-402.svg" width="24" height="24" alt="" />
              <T t={ui.appName} />
            </>
          ) : (
            <>← <T t={ui.home} /></>
          )}
        </a>
        {authEnabled && (
          <a class="account-link" href="#/account"><T t={authStatus.value === 'in' ? a.account : a.signInLink} /></a>
        )}
        <LangSwitch />
      </header>
      <main>
        <Screen />
      </main>
    </>
  );
}
