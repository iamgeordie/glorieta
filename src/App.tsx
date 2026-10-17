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
import { hasSeenSplash } from './lib/splash-seen';
import { authStatus } from './lib/auth';
import { authEnabled } from './lib/supabase';
import { a } from './authStrings';
import { Practice } from './screens/Study';
import { Course, ModuleScreen } from './screens/Learn';
import { LessonScreen } from './screens/Lesson';
import { ModuleQuiz } from './screens/ModuleQuiz';

// First visit with no deep link: show the splash once. A returning email link (?code=) goes straight in.
if (!location.hash && !hasSeenSplash() && !new URL(location.href).searchParams.has('code')) {
  location.hash = '#/welcome';
}
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
      if (!arg) return <Course />;
      if (!arg2) return <ModuleScreen moduleId={arg} />;
      if (arg2 === 'quiz') return <ModuleQuiz moduleId={arg} />;
      return <LessonScreen moduleId={arg} lessonId={arg2} step={arg3 === '' || Number.isNaN(Number(arg3)) ? null : Number(arg3)} />;
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
