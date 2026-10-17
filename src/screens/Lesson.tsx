import { useEffect, useState } from 'preact/hooks';
import { ModeOverride, mode, T } from '../i18n';
import { bi } from '../i18n';
import { L } from '../learnStrings';
import { checksOf, lessonById } from '../data/learn';
import type { Block, CheckQuestion, Lesson as LessonData } from '../data/learn/types';
import { signs, signFile } from '../data/signs';
import { Figure, FigureDefs } from '../learn/Figure';
import { learn, completeLesson, lessonRecord, saveCheck, saveStep } from '../lib/learn';
import { optionOrder, type Question } from '../lib/quiz';
import { grade } from '../lib/store';
import { QuestionCard } from './Study';

const signById = new Map(signs.map((s) => [s.id, s]));

function SignStrip({ ids, caption }: { ids: string[]; caption?: { es: string; en: string } }) {
  return (
    <div class="sign-strip-box">
      <ul class="sign-strip">
        {ids.map((id) => {
          const s = signById.get(id);
          if (!s) throw new Error(`Lesson shows unknown sign "${id}"`);
          return (
            <li key={id}>
              <img src={signFile(s)} alt="" width="84" height="84" loading="lazy" />
              <span class="sign-name"><T t={s.name} /></span>
              <span class="sign-code">{s.code}</span>
            </li>
          );
        })}
      </ul>
      {caption && <p class="muted small"><T t={caption} /></p>}
    </div>
  );
}

function InlineCheck({ moduleId, lessonId, q }: { moduleId: string; lessonId: string; q: CheckQuestion }) {
  const [order] = useState(optionOrder);
  const answered = lessonRecord(moduleId, lessonId).answered[q.id];
  const question: Question = { ...q, cat: moduleId };
  const pick = (original: number) => {
    if (answered) return;
    const ok = original === q.answer;
    grade(q.id, ok, 'practice');
    saveCheck(moduleId, lessonId, q.id, { sel: original, ok });
  };
  return (
    <div class="check-box">
      <p class="check-label"><T t={L.checkLabel} /></p>
      <QuestionCard q={question} order={answered ? [0, 1, 2] : order} selected={answered?.sel ?? null} reveal={!!answered} onSelect={pick} />
    </div>
  );
}

function BlockView({ block, moduleId, lessonId }: { block: Block; moduleId: string; lessonId: string }) {
  switch (block.t) {
    case 'p':
      return <p class="lp"><T t={block.text} /></p>;
    case 'rule':
      return (
        <aside class="callout rule">
          <strong class="label"><T t={L.lawLabel} /></strong>
          <p><T t={block.text} /></p>
          <span class="src">{block.src}</span>
        </aside>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag class="lp-list">
          {block.items.map((it) => (
            <li key={it.en}><T t={it} /></li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div class="table-wrap">
          <table>
            <thead>
              <tr>{block.head.map((h) => <th key={h.en} scope="col"><T t={h} /></th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((r) => (
                <tr key={r[0]?.en}>{r.map((c, i) => <td key={i}><T t={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'figure':
      return <Figure block={block} />;
    case 'signs':
      return <SignStrip ids={block.ids} caption={block.caption} />;
    case 'us':
      return (
        <aside class="note">
          <strong class="label"><T t={bi('Diferencia con EE. UU.', 'Different from the US')} /></strong>
          <T t={block.text} />
        </aside>
      );
    case 'tip':
      return (
        <aside class="callout tip">
          <strong class="label"><T t={L.tipLabel} /></strong>
          <p><T t={block.text} /></p>
        </aside>
      );
    case 'example':
      return (
        <aside class="callout example">
          <strong class="label"><T t={block.title ?? L.exampleLabel} /></strong>
          <dl>
            <dt><T t={L.situation} /></dt>
            <dd><T t={block.situation} /></dd>
            <dt><T t={L.whatToDo} /></dt>
            <dd><T t={block.action} /></dd>
            <dt><T t={L.why} /></dt>
            <dd><T t={block.why} /></dd>
          </dl>
        </aside>
      );
    case 'check':
      return <InlineCheck moduleId={moduleId} lessonId={lessonId} q={block.q} />;
  }
}

const hash = (m: string, l: string, step?: number) => `#/learn/${m}/${l}${step === undefined ? '' : `/${step}`}`;

/** Intro (pretraining and a guess), the steps, then the recap. */
export function LessonScreen({ moduleId, lessonId, step: wanted }: { moduleId: string; lessonId: string; step: number | null }) {
  const found = lessonById(moduleId, lessonId);
  if (!found) {
    return (
      <section>
        <p><T t={L.unknownLesson} /></p>
        <a class="secondary" href="#/learn"><T t={L.backToCourse} /></a>
      </section>
    );
  }
  return <LessonBody key={`${moduleId}/${lessonId}`} moduleId={moduleId} lessonId={lessonId} wanted={wanted} />;
}

function LessonBody({ moduleId, lessonId, wanted }: { moduleId: string; lessonId: string; wanted: number | null }) {
  const found = lessonById(moduleId, lessonId);
  if (!found) return null;
  const { module, lesson, index } = found;
  const total = lesson.steps.length;
  // Reading the signal subscribes the page to progress changes.
  learn.value;
  const rec = lessonRecord(moduleId, lessonId);
  const [peek, setPeek] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);
  const [guessOrder] = useState(optionOrder);

  // 0 = intro, 1..total = steps, total + 1 = recap.
  const step = Math.min(Math.max(wanted ?? rec.step, 0), total + 1);

  useEffect(() => {
    scrollTo(0, 0);
    saveStep(moduleId, lessonId, step);
  }, [moduleId, lessonId, step]);

  const go = (n: number) => {
    location.hash = hash(moduleId, lessonId, n);
  };

  const content = step >= 1 && step <= total ? lesson.steps[step - 1] : undefined;
  const checks = content ? content.blocks.filter((b): b is Extract<Block, { t: 'check' }> => b.t === 'check') : [];
  const unanswered = checks.some((c) => !rec.answered[c.q.id]);
  const last = step === total;

  const override = peek && mode.value === 'es' ? 'both' : null;
  const nextLesson = module.lessons[index + 1];

  return (
    <section class="lesson">
      <FigureDefs />
      <p class="crumbs">
        <a href={`#/learn/${module.id}`}><T t={module.title} /></a>
      </p>
      <h1><T t={lesson.title} /></h1>
      <ol class="seg" aria-label={`${step} / ${total + 1}`}>
        {Array.from({ length: total + 2 }, (_, i) => (
          <li key={i} class={i < step ? 'done' : i === step ? 'current' : ''} />
        ))}
      </ol>

      <ModeOverride.Provider value={override}>
        {step === 0 && <Intro moduleId={moduleId} lesson={lesson} guess={guess} setGuess={setGuess} order={guessOrder} onStart={() => go(1)} />}

        {content && (
          <article class="card step">
            <header class="card-head">
              <span class="chip"><T t={L.stepOf(step, total)} /></span>
              {mode.value === 'es' && (
                <button type="button" class={`peek wide ${peek ? 'on' : ''}`} aria-pressed={peek} onClick={() => setPeek(!peek)}>EN</button>
              )}
            </header>
            <h2 class="step-title"><T t={content.title} /></h2>
            {content.blocks.map((b, i) => (
              <BlockView key={i} block={b} moduleId={moduleId} lessonId={lessonId} />
            ))}
          </article>
        )}

        {step === total + 1 && <Recap moduleId={moduleId} lesson={lesson} nextId={nextLesson?.id} />}
      </ModeOverride.Provider>

      {content && (
        <div class="lesson-nav">
          <button type="button" class="secondary" onClick={() => go(step - 1)}><T t={L.back} /></button>
          <button type="button" class="primary" disabled={unanswered} onClick={() => go(step + 1)}>
            <T t={last ? L.finishLesson : L.nextStep} />
          </button>
        </div>
      )}
      {content && unanswered && <p class="muted small center"><T t={L.answerToContinue} /></p>}
    </section>
  );
}

function Intro({
  moduleId,
  lesson,
  guess,
  setGuess,
  order,
  onStart,
}: {
  moduleId: string;
  lesson: LessonData;
  guess: number | null;
  setGuess: (n: number) => void;
  order: number[];
  onStart: () => void;
}) {
  const pre = lesson.pretest;
  const question: Question | null = pre ? { ...pre, cat: moduleId } : null;
  return (
    <>
      <div class="card">
        <h2><T t={L.goals} /></h2>
        <ul class="lp-list">
          {lesson.goals.map((g) => (
            <li key={g.en}><T t={g} /></li>
          ))}
        </ul>
        <p class="muted small"><T t={L.lessonMeta(lesson.minutes, lesson.steps.length, null)} /></p>
      </div>

      {lesson.terms.length > 0 && (
        <div class="card">
          <h2><T t={L.keyWords} /></h2>
          <p class="terms">
            {lesson.terms.map((t) => (
              <span class="term" key={t.es}>
                <b>{t.es}</b> = {t.en}
              </span>
            ))}
          </p>
        </div>
      )}

      {question && (
        <div class="card guess">
          <h2><T t={L.guess} /></h2>
          <p class="muted small"><T t={L.guessHint} /></p>
          <p class="stem"><T t={bi(question.es.q, question.en.q)} /></p>
          <div class="options" role="group">
            {order.map((original, position) => {
              const state =
                guess !== null && original === question.answer ? 'right' : guess !== null && original === guess ? 'wrong' : '';
              return (
                <button type="button" key={original} class={`option ${state}`} disabled={guess !== null} onClick={() => setGuess(original)}>
                  <span class="letter">{'ABC'[position]}</span>
                  <T t={bi(question.es.options[original] ?? '', question.en.options[original] ?? '')} />
                </button>
              );
            })}
          </div>
          {guess !== null && (
            <p class="guess-why"><T t={bi(question.es.why, question.en.why)} /></p>
          )}
        </div>
      )}

      <button type="button" class="primary" onClick={onStart}><T t={L.startLesson} /></button>
    </>
  );
}

function Recap({ moduleId, lesson, nextId }: { moduleId: string; lesson: LessonData; nextId: string | undefined }) {
  useEffect(() => {
    completeLesson(moduleId, lesson.id);
  }, [moduleId, lesson.id]);
  const rec = lessonRecord(moduleId, lesson.id);
  const checks = checksOf(lesson);
  const right = checks.filter(({ q }) => rec.answered[q.id]?.ok).length;
  return (
    <>
      <div class="card">
        <h2><T t={L.recap} /></h2>
        <ul class="lp-list">
          {lesson.recap.map((r) => (
            <li key={r.en}><T t={r} /></li>
          ))}
        </ul>
        {checks.length > 0 && <p class="muted"><T t={L.checksResult(right, checks.length)} /></p>}
      </div>
      <div class="card">
        <h2><T t={L.sources} /></h2>
        <ul class="facts small">
          {lesson.src.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div class="actions">
        {nextId ? (
          <a class="primary" href={hash(moduleId, nextId)}><T t={L.nextLesson} /></a>
        ) : (
          <a class="primary" href={`#/learn/${moduleId}/quiz`}><T t={L.takeQuiz} /></a>
        )}
        <a class="secondary" href={`#/learn/${moduleId}`}><T t={L.backToCourse} /></a>
        <a class="secondary" href={`#/practice/${moduleId}`}><T t={L.practiceTopic} /></a>
      </div>
    </>
  );
}
