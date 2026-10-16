import { useMemo, useState } from 'preact/hooks';
import { bi, ModeOverride, mode, T } from '../i18n';
import { categories, categoryById } from '../data/categories';
import { questionOf, seenOf } from '../format';
import { ui } from '../ui';
import { allQuestions, buildQueue, optionOrder, practicePool, type Question } from '../lib/quiz';
import { grade, statsFor } from '../lib/store';

/** One question. `selected` and `order` use the original option indexes from the data. */
export function QuestionCard({
  q,
  order,
  selected,
  reveal,
  onSelect,
}: {
  q: Question;
  order: number[];
  selected: number | null;
  reveal: boolean;
  onSelect: (original: number) => void;
}) {
  const [peek, setPeek] = useState(false);
  const override = peek && mode.value === 'es' ? 'both' : null;
  return (
    <ModeOverride.Provider value={override}>
      <article class="card question">
        <header class="card-head">
          <span class="chip"><T t={categoryById(q.cat).name} /></span>
          {mode.value === 'es' && (
            <button type="button" class={`peek wide ${peek ? 'on' : ''}`} aria-pressed={peek} onClick={() => setPeek(!peek)}>
              EN
            </button>
          )}
        </header>
        {q.image && <img class="sign" src={q.image} alt="Señal de tráfico / Traffic sign" width="160" height="160" />}
        <h2 class="stem"><T t={bi(q.es.q, q.en.q)} /></h2>
        <div class="options" role="group">
          {order.map((original, position) => {
            const state =
              reveal && original === q.answer ? 'right' : reveal && original === selected ? 'wrong' : original === selected ? 'picked' : '';
            return (
              <button
                type="button"
                key={original}
                class={`option ${state}`}
                disabled={reveal}
                onClick={() => onSelect(original)}
              >
                <span class="letter">{'ABC'[position]}</span>
                <T t={bi(q.es.options[original] ?? '', q.en.options[original] ?? '')} />
              </button>
            );
          })}
        </div>
        {reveal && (
          <div class="feedback">
            <p class={`verdict ${selected === q.answer ? 'right' : 'wrong'}`}>
              <T t={selected === q.answer ? ui.correct : ui.incorrect} />
            </p>
            <p><T t={bi(q.es.why, q.en.why)} /></p>
            {q.note && (
              <div class="note">
                <strong class="label"><T t={ui.differsFromUS} /></strong>
                <T t={q.note} />
              </div>
            )}
            {q.terms && q.terms.length > 0 && (
              <div class="terms">
                <strong class="label"><T t={ui.keyTerms} /></strong>
                {q.terms.map((t) => (
                  <span class="term" key={t.es}>
                    <b>{t.es}</b> = {t.en}
                  </span>
                ))}
              </div>
            )}
            <p class="src"><T t={ui.source} />: {q.src}</p>
          </div>
        )}
      </article>
    </ModeOverride.Provider>
  );
}

export function Practice({ categoryId }: { categoryId: string | null }) {
  if (!categoryId) return <CategoryPicker />;
  return <PracticeSession key={categoryId} categoryId={categoryId} />;
}

function CategoryPicker() {
  return (
    <section>
      <h1><T t={ui.chooseCategory} /></h1>
      <ul class="list">
        <li>
          <a class="tile" href="#/practice/all">
            <strong><T t={ui.allCategories} /></strong>
            <small>{allQuestions.length}</small>
          </a>
        </li>
        {categories.map((c) => {
          const ids = allQuestions.filter((q) => q.cat === c.id).map((q) => q.id);
          const s = statsFor(ids);
          return (
            <li key={c.id}>
              <a class="tile" href={`#/practice/${c.id}`}>
                <strong><T t={c.name} /></strong>
                <small><T t={seenOf(s.seen, ids.length, s.due)} /></small>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PracticeSession({ categoryId }: { categoryId: string }) {
  const plan = useMemo(() => {
    const pool = practicePool(categoryId);
    const { queue, due, fresh } = buildQueue(pool);
    // Nothing due and nothing new: fall back to a random refresher so the page is never empty.
    const useQueue = queue.length > 0 ? queue : buildFallback(pool);
    return { queue: useQueue, due, fresh, refresher: queue.length === 0 };
  }, [categoryId]);

  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState(optionOrder);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [round, setRound] = useState(0);

  const q = plan.queue[index];
  if (!q) return <Summary correct={correct} total={plan.queue.length} onAgain={() => location.reload()} />;

  const answer = (original: number) => {
    if (selected !== null) return;
    setSelected(original);
    const ok = original === q.answer;
    grade(q.id, ok, 'practice');
    if (ok) setCorrect((c) => c + 1);
  };
  const advance = () => {
    setIndex(index + 1);
    setSelected(null);
    setOrder(optionOrder());
    setRound(round + 1);
  };

  return (
    <section>
      <p class="progress-line"><T t={questionOf(index + 1, plan.queue.length, index === 0 ? plan.due : 0)} /></p>
      {index === 0 && plan.refresher && <p class="note"><T t={ui.nothingDue} /></p>}
      <QuestionCard key={`${q.id}-${round}`} q={q} order={order} selected={selected} reveal={selected !== null} onSelect={answer} />
      {selected !== null && (
        <button type="button" class="primary" onClick={advance}>
          <T t={index + 1 === plan.queue.length ? ui.finish : ui.next} />
        </button>
      )}
    </section>
  );
}

function buildFallback(pool: Question[]): Question[] {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 12);
}

function Summary({ correct, total, onAgain }: { correct: number; total: number; onAgain: () => void }) {
  return (
    <section class="center">
      <h1><T t={ui.sessionDone} /></h1>
      <p class="bignum">{correct} / {total}</p>
      <p><T t={ui.score} /></p>
      <div class="actions">
        <button type="button" class="primary" onClick={onAgain}><T t={ui.again} /></button>
        <a class="secondary" href="#/"><T t={ui.backHome} /></a>
      </div>
    </section>
  );
}
