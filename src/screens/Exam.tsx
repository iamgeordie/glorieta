import { useEffect, useMemo, useState } from 'preact/hooks';
import { T } from '../i18n';
import { EXAM_MAX_ERRORS, EXAM_MINUTES, EXAM_QUESTIONS } from '../data/facts';
import { ui } from '../ui';
import { allQuestions, optionOrder, shuffle } from '../lib/quiz';
import { grade, saveExam } from '../lib/store';
import { QuestionCard } from './Study';

type Phase = 'intro' | 'run' | 'done';

export function Exam() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [seed, setSeed] = useState(0);

  if (phase === 'intro') {
    return (
      <section class="center">
        <h1><T t={ui.exam} /></h1>
        <p><T t={ui.examHint} /></p>
        <p class="note">
          {EXAM_QUESTIONS} <T t={ui.questionsWord} /> · {EXAM_MINUTES} <T t={ui.minutes} /> · <T t={ui.maxMistakes} />: {EXAM_MAX_ERRORS}
        </p>
        <button type="button" class="primary" onClick={() => setPhase('run')}><T t={ui.start} /></button>
      </section>
    );
  }
  return (
    <ExamRun
      key={seed}
      phase={phase}
      onDone={() => setPhase('done')}
      onRestart={() => {
        setSeed(seed + 1);
        setPhase('run');
      }}
    />
  );
}

function ExamRun({ phase, onDone, onRestart }: { phase: Phase; onDone: () => void; onRestart: () => void }) {
  const exam = useMemo(() => {
    const questions = shuffle(allQuestions).slice(0, Math.min(EXAM_QUESTIONS, allQuestions.length));
    return { questions, orders: questions.map(() => optionOrder()), endAt: Date.now() + EXAM_MINUTES * 60_000 };
  }, []);
  const [answers, setAnswers] = useState<(number | null)[]>(() => exam.questions.map(() => null));
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(exam.endAt - Date.now());
  const [timedOut, setTimedOut] = useState(false);

  const finished = phase === 'done';

  const submit = (byTime: boolean) => {
    if (finished) return;
    setTimedOut(byTime);
    let errors = 0;
    let unanswered = 0;
    exam.questions.forEach((q, i) => {
      const a = answers[i];
      if (a === null || a === undefined) unanswered++;
      const ok = a === q.answer;
      if (!ok) errors++;
      grade(q.id, ok);
    });
    saveExam({ at: new Date().toISOString(), total: exam.questions.length, errors, passed: errors <= EXAM_MAX_ERRORS, unanswered });
    onDone();
  };

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      const remaining = exam.endAt - Date.now();
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        submit(true);
      }
    }, 1000);
    return () => clearInterval(id);
    // submit reads the latest answers through the closure, so re-subscribe when they change
  }, [finished, answers]);

  if (finished) {
    const wrong = exam.questions.map((q, i) => ({ q, i })).filter(({ q, i }) => answers[i] !== q.answer);
    const errors = wrong.length;
    const passed = errors <= EXAM_MAX_ERRORS;
    return (
      <section>
        <div class="center">
          <h1 class={passed ? 'right' : 'wrong'}><T t={passed ? ui.passed : ui.failed} /></h1>
          {timedOut && <p class="note"><T t={ui.timeUp} /></p>}
          <p class="bignum">{errors} <T t={ui.mistakes} /></p>
          <p class="note"><T t={ui.maxMistakes} />: {EXAM_MAX_ERRORS}</p>
          <div class="actions">
            <button type="button" class="primary" onClick={onRestart}><T t={ui.again} /></button>
            <a class="secondary" href="#/"><T t={ui.backHome} /></a>
          </div>
        </div>
        {wrong.length > 0 && <h2><T t={ui.reviewMistakes} /></h2>}
        {wrong.map(({ q, i }) => (
          <QuestionCard key={q.id} q={q} order={exam.orders[i] ?? [0, 1, 2]} selected={answers[i] ?? null} reveal onSelect={() => {}} />
        ))}
      </section>
    );
  }

  const q = exam.questions[index];
  if (!q) return null;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
  const answered = answers.filter((a) => a !== null).length;

  return (
    <section>
      <div class="exam-bar">
        <span><T t={ui.question} /> {index + 1} <T t={ui.of} /> {exam.questions.length}</span>
        <span class={`timer ${left < 5 * 60_000 ? 'low' : ''}`} aria-label="timer">
          <T t={ui.timeLeft} /> {mm}:{ss}
        </span>
      </div>
      <QuestionCard
        key={q.id}
        q={q}
        order={exam.orders[index] ?? [0, 1, 2]}
        selected={answers[index] ?? null}
        reveal={false}
        onSelect={(original) => setAnswers(answers.map((a, i) => (i === index ? original : a)))}
      />
      <nav class="grid" aria-label="questions">
        {exam.questions.map((x, i) => (
          <button
            type="button"
            key={x.id}
            class={`dot ${i === index ? 'current' : ''} ${answers[i] !== null ? 'done' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <div class="actions">
        <button type="button" class="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>←</button>
        <button type="button" class="secondary" disabled={index === exam.questions.length - 1} onClick={() => setIndex(index + 1)}>→</button>
        <button type="button" class="primary" onClick={() => submit(false)}>
          <T t={ui.submitExam} /> ({answered}/{exam.questions.length})
        </button>
      </div>
    </section>
  );
}
