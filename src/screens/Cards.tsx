import { useMemo, useState } from 'preact/hooks';
import { mode, Peek, T } from '../i18n';
import { phrases, terms, type Term } from '../data/vocab';
import { cardProgress } from '../format';
import { ui } from '../ui';
import { buildQueue } from '../lib/quiz';
import { grade } from '../lib/store';

type Item = Term & { id: string };

const withKey = (t: Term): Item => ({ ...t, id: `v:${t.id}` });

export function Vocab() {
  const plan = useMemo(() => buildQueue(terms.map(withKey), 15), []);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);

  const card = plan.queue[index];
  if (!card) {
    return (
      <section class="center">
        <h1><T t={ui.sessionDone} /></h1>
        <p class="bignum">{known} / {plan.queue.length}</p>
        <div class="actions">
          <button type="button" class="primary" onClick={() => location.reload()}><T t={ui.again} /></button>
          <a class="secondary" href="#/"><T t={ui.backHome} /></a>
        </div>
      </section>
    );
  }

  // Outside Spanish-only mode the meaning is already wanted, so show it straight away.
  const showBack = revealed || mode.value !== 'es';
  const rate = (ok: boolean) => {
    grade(card.id, ok, 'vocab');
    if (ok) setKnown(known + 1);
    setIndex(index + 1);
    setRevealed(false);
  };

  return (
    <section>
      <p class="progress-line"><T t={cardProgress(index + 1, plan.queue.length, plan.due, plan.fresh)} /></p>
      <article class="card flash">
        <p class="flash-es" lang="es">{card.es}</p>
        {showBack ? (
          <p class="flash-en" lang="en">{card.en}</p>
        ) : (
          <button type="button" class="secondary" onClick={() => setRevealed(true)}><T t={ui.showMeaning} /></button>
        )}
      </article>
      {showBack && (
        <div class="actions">
          <button type="button" class="secondary" onClick={() => rate(false)}><T t={ui.missedIt} /></button>
          <button type="button" class="primary" onClick={() => rate(true)}><T t={ui.knewIt} /></button>
        </div>
      )}
    </section>
  );
}

export function Phrases() {
  return (
    <section>
      <h1><T t={ui.phrases} /></h1>
      <p class="muted"><T t={ui.phrasesHint} /></p>
      <ul class="list stack">
        {phrases.map((p) => (
          <li class="card phrase" key={p.id}>
            <p class="label"><T t={ui.say} /></p>
            <p class="say"><Peek t={p.say} /></p>
            <p class="label"><T t={ui.doThis} /></p>
            <p><Peek t={p.do} /></p>
          </li>
        ))}
      </ul>
    </section>
  );
}
