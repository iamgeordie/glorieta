import { T } from '../i18n';
import { modules } from '../data/learn';
import type { Block, Lesson, Module } from '../data/learn/types';
import { L } from '../learnStrings';
import { ui } from '../ui';
import { ChangeBox } from './Lesson';

type Found<B> = { block: B; module: Module; lesson: Lesson; step: number };
type ChangeBlock = Extract<Block, { t: 'new' | 'trap' }>;
type TipBlock = Extract<Block, { t: 'tip' }>;

/** Every block of one kind in the course, in teaching order, with the lesson step it sits in (1-based, as in URLs). */
function collect<K extends Block['t']>(kind: K): Found<Extract<Block, { t: K }>>[] {
  const out: Found<Extract<Block, { t: K }>>[] = [];
  for (const module of modules)
    for (const lesson of module.lessons)
      lesson.steps.forEach((s, i) => {
        for (const b of s.blocks) if (b.t === kind) out.push({ block: b as Extract<Block, { t: K }>, module, lesson, step: i + 1 });
      });
  return out;
}

const changes = collect('new').sort((a, b) => (a.block.since < b.block.since ? 1 : a.block.since > b.block.since ? -1 : 0));
const traps = collect('trap');
const tips = collect('tip');

function FromLesson({ f }: { f: Found<unknown> }) {
  return (
    <a class="from-lesson" href={`#/learn/${f.module.id}/${f.lesson.id}/${f.step}`}>
      <T t={f.module.title} /> · <T t={f.lesson.title} />
    </a>
  );
}

function Changes({ items }: { items: Found<ChangeBlock>[] }) {
  return (
    <ul class="tips-list">
      {items.map((f, i) => (
        <li key={i}>
          <ChangeBox block={f.block} />
          <FromLesson f={f} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Tricks and Tips: the course's law changes, practice-test traps and tips in one place. Built from the
 * lesson blocks themselves, so it can never drift from what the lessons teach.
 */
export function Tips() {
  return (
    <section>
      <h1><T t={ui.tips} /></h1>
      <p class="muted"><T t={ui.tipsIntro} /></p>

      <h2><T t={ui.tipsChanges} /> <span class="count">{changes.length}</span></h2>
      <Changes items={changes} />

      <h2><T t={ui.tipsTraps} /> <span class="count">{traps.length}</span></h2>
      <Changes items={traps} />

      <h2><T t={ui.tipsTips} /> <span class="count">{tips.length}</span></h2>
      <div class="group-grid">
        {modules.map((m) => {
          const inModule = tips.filter((f) => f.module.id === m.id);
          if (!inModule.length) return null;
          return (
            <details class="group-box" key={m.id}>
              <summary class="group">
                <T t={m.title} /> <span class="count">{inModule.length}</span>
              </summary>
              <ul class="tips-list">
                {inModule.map((f: Found<TipBlock>, i) => (
                  <li key={i}>
                    <aside class="callout tip">
                      <strong class="label"><T t={L.tipLabel} /></strong>
                      <p><T t={f.block.text} /></p>
                    </aside>
                    <FromLesson f={f} />
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
