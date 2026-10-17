import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { T, bi } from '../i18n';
import { L } from '../learnStrings';
import { questionOf } from '../format';
import { lessonById, moduleById, modules, whereTaught } from '../data/learn';
import { saveQuiz } from '../lib/learn';
import { isPass, percent, pickQuiz } from '../lib/learn-core';
import { allQuestions, optionOrder, type Question } from '../lib/quiz';
import { grade, isDue, isSeen } from '../lib/store';
import { QuestionCard } from './Study';

type Result = { q: Question; ok: boolean };

export function ModuleQuiz({ moduleId }: { moduleId: string }) {
  const m = moduleById(moduleId);
  if (!m) {
    return (
      <section>
        <p><T t={L.unknownLesson} /></p>
        <a class="secondary" href="#/learn"><T t={L.backToCourse} /></a>
      </section>
    );
  }
  return <QuizRun key={moduleId} moduleId={moduleId} />;
}

function QuizRun({ moduleId }: { moduleId: string }) {
  const m = moduleById(moduleId);
  const [round, setRound] = useState(0);
  const plan = useMemo(() => {
    const earlier = new Set(modules.slice(0, Math.max(0, modules.findIndex((x) => x.id === moduleId))).map((x) => x.id));
    return pickQuiz({
      own: allQuestions.filter((q) => q.cat === moduleId),
      review: allQuestions.filter((q) => earlier.has(q.cat)),
      isDue,
      isSeen,
    });
    // a new round deliberately draws a new quiz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, round]);

  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState(optionOrder);
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const saved = useRef(false);

  const pick = plan[index];
  const finished = index >= plan.length;

  useEffect(() => {
    if (finished && plan.length > 0 && !saved.current) {
      saved.current = true;
      saveQuiz(moduleId, results.filter((r) => r.ok).length, plan.length);
    }
  }, [finished, plan.length, moduleId, results]);

  if (!m) return null;

  if (plan.length === 0) {
    return (
      <section>
        <p class="muted"><T t={bi('Este módulo todavía no tiene preguntas.', 'This module has no questions yet.')} /></p>
        <a class="secondary" href={`#/learn/${moduleId}`}><T t={L.backToCourse} /></a>
      </section>
    );
  }

  if (finished || !pick) {
    return (
      <QuizResult
        moduleId={moduleId}
        results={results}
        onRetry={() => {
          saved.current = false;
          setIndex(0);
          setSelected(null);
          setResults([]);
          setOrder(optionOrder());
          setRound(round + 1);
        }}
      />
    );
  }

  const q = pick.item;
  const answer = (original: number) => {
    if (selected !== null) return;
    setSelected(original);
    const ok = original === q.answer;
    grade(q.id, ok, 'practice');
    setResults([...results, { q, ok }]);
  };
  const advance = () => {
    setIndex(index + 1);
    setSelected(null);
    setOrder(optionOrder());
  };

  return (
    <section>
      <p class="crumbs"><a href={`#/learn/${moduleId}`}><T t={m.title} /></a> · <T t={L.quiz} /></p>
      <p class="progress-line">
        <T t={questionOf(index + 1, plan.length)} />
        {pick.review && <> · <strong><T t={L.review} /></strong></>}
      </p>
      <QuestionCard key={`${q.id}-${index}`} q={q} order={order} selected={selected} reveal={selected !== null} onSelect={answer} />
      {selected !== null && (
        <button type="button" class="primary" onClick={advance}>
          <T t={index + 1 === plan.length ? bi('Ver resultado', 'See result') : bi('Siguiente', 'Next')} />
        </button>
      )}
    </section>
  );
}

function QuizResult({ moduleId, results, onRetry }: { moduleId: string; results: Result[]; onRetry: () => void }) {
  const m = moduleById(moduleId);
  const correct = results.filter((r) => r.ok).length;
  const total = results.length;
  const passed = isPass(correct, total);

  // Missed questions point back to the lesson step that teaches them; one link per lesson.
  const links = new Map<string, { moduleId: string; lessonId: string; step: number }>();
  for (const r of results) {
    if (r.ok) continue;
    const where = whereTaught.get(r.q.id);
    if (where && !links.has(`${where.moduleId}/${where.lessonId}`)) links.set(`${where.moduleId}/${where.lessonId}`, where);
  }
  const index = modules.findIndex((x) => x.id === moduleId);
  const next = modules[index + 1];

  return (
    <section class="center">
      <h1><T t={L.quizDone} /></h1>
      <p class="bignum">{correct} / {total}</p>
      <p class="bignum small-num">{percent(correct, total)}%</p>
      <p class={`verdict ${passed ? 'right' : 'wrong'}`}>
        <T t={passed ? L.passedModule : L.notYet} />
      </p>
      {!passed && <p class="muted"><T t={L.needPercent} /></p>}

      {links.size > 0 && (
        <div class="card left">
          <h2><T t={L.reviewLessons} /></h2>
          <ul class="facts">
            {[...links.values()].map((w) => {
              const found = lessonById(w.moduleId, w.lessonId);
              if (!found) return null;
              return (
                <li key={`${w.moduleId}/${w.lessonId}`}>
                  <a href={`#/learn/${w.moduleId}/${w.lessonId}/${w.step}`}><T t={found.lesson.title} /></a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div class="actions">
        <button type="button" class="primary" onClick={onRetry}><T t={L.retry} /></button>
        {passed && next && <a class="secondary" href={`#/learn/${next.id}`}><T t={L.nextModule} /></a>}
        <a class="secondary" href={`#/learn/${moduleId}`}>{m ? <T t={m.title} /> : <T t={L.backToCourse} />}</a>
        <a class="secondary" href="#/learn"><T t={L.backToCourse} /></a>
      </div>
    </section>
  );
}
