import { signal } from '@preact/signals';
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';

export type Bi = { es: string; en: string };
export type Mode = 'es' | 'en' | 'both';

const KEY = 'carnet.mode';

function load(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en' || v === 'both') return v;
  } catch {
    // storage unavailable: fall through to the default
  }
  return 'es';
}

export const mode = signal<Mode>(load());

export function setMode(m: Mode) {
  mode.value = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    // the choice still applies for this visit
  }
}

export const bi = (es: string, en: string): Bi => ({ es, en });

/** Lets one card show both languages while the rest of the app stays in Spanish. */
export const ModeOverride = createContext<Mode | null>(null);
const useMode = (): Mode => useContext(ModeOverride) ?? mode.value;

/** Renders a bilingual string according to the global mode. */
export function T({ t, class: cls }: { t: Bi; class?: string }) {
  const m = useMode();
  // Identical strings (numbers, "STOP", "112") need no translation line.
  if (m === 'es' || (m === 'both' && t.es === t.en)) return <span class={cls}>{t.es}</span>;
  if (m === 'en') return <span class={cls}>{t.en}</span>;
  return (
    <span class={cls}>
      {t.es}
      <span class="sub">{t.en}</span>
    </span>
  );
}

/**
 * Long text: in Spanish mode a small "EN" chip reveals the English underneath,
 * so you can check one passage without flipping the whole app.
 */
export function Peek({ t, class: cls }: { t: Bi; class?: string }) {
  const [open, setOpen] = useState(false);
  const m = useMode();
  if (m !== 'es') return <T t={t} class={cls} />;
  return (
    <span class={cls}>
      {t.es}
      <button
        type="button"
        class={`peek ${open ? 'on' : ''}`}
        aria-pressed={open}
        aria-label="English translation"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        EN
      </button>
      {open && <span class="sub peeked">{t.en}</span>}
    </span>
  );
}

export function LangSwitch() {
  const opts: { m: Mode; label: string; title: string }[] = [
    { m: 'es', label: 'ES', title: 'Solo español / Spanish only' },
    { m: 'both', label: 'ES+EN', title: 'Español e inglés / Both' },
    { m: 'en', label: 'EN', title: 'Solo inglés / English only' },
  ];
  return (
    <div class="langswitch" role="group" aria-label="Idioma / Language">
      {opts.map((o) => (
        <button
          type="button"
          key={o.m}
          title={o.title}
          aria-pressed={mode.value === o.m}
          class={mode.value === o.m ? 'on' : ''}
          onClick={() => setMode(o.m)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ children }: { children: ComponentChildren }) {
  return <div class="row">{children}</div>;
}
