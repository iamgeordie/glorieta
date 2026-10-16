import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { LangSwitch, mode, setMode, T } from './i18n';
import { ui } from './ui';
import { Exam } from './screens/Exam';
import { Facts } from './screens/Facts';
import { Home } from './screens/Home';
import { Phrases, Vocab } from './screens/Cards';
import { Signs } from './screens/Signs';
import { Practice } from './screens/Study';

const route = signal(location.hash || '#/');
addEventListener('hashchange', () => {
  route.value = location.hash || '#/';
  scrollTo(0, 0);
});

function Screen() {
  const [, path = '', arg = ''] = route.value.split('/');
  switch (path) {
    case 'practice':
      return <Practice categoryId={arg || null} />;
    case 'exam':
      return <Exam />;
    case 'vocab':
      return <Vocab />;
    case 'signs':
      return <Signs />;
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
  return (
    <>
      <header class="topbar">
        <a class="brand" href="#/" aria-label={home ? ui.appName.es : ui.home.es}>
          {home ? <T t={ui.appName} /> : <>← <T t={ui.home} /></>}
        </a>
        <LangSwitch />
      </header>
      <main>
        <Screen />
      </main>
    </>
  );
}
