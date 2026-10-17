import { T } from '../i18n';
import { L } from '../learnStrings';
import { modules, moduleById } from '../data/learn';
import { learn, lessonRecord } from '../lib/learn';
import { courseProgress, lessonsDone, moduleStatus, nextUp, type ModuleStatus } from '../lib/learn-core';
import { allQuestions } from '../lib/quiz';
import { statsFor } from '../lib/store';
import { bi } from '../i18n';
import { authStatus } from '../lib/auth';
import { authEnabled } from '../lib/supabase';
import { syncStatus } from '../lib/sync';
import { Flag } from '../Flag';

const statusLabel: Record<ModuleStatus, ReturnType<typeof bi>> = {
  new: L.statusNew,
  learning: L.statusLearning,
  ready: L.statusReady,
  mastered: L.statusMastered,
};

const minutesOf = (m: { lessons: { minutes: number }[] }) => m.lessons.reduce((n, l) => n + l.minutes, 0);

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((100 * value) / total) : 0;
  return (
    <span class="stat-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Says where the course progress lives, truthfully for the current state. */
function ProgressNote() {
  if (!authEnabled) return <p class="muted small"><T t={L.progressDevice} /></p>;
  if (authStatus.value === 'loading') return null;
  if (authStatus.value !== 'in') {
    return (
      <p class="muted small">
        <T t={L.progressSignIn} /> <a href="#/account"><T t={L.signInLink} /></a>
      </p>
    );
  }
  const st = syncStatus.value.state;
  return <p class={`muted small ${st === 'error' ? 'wrong' : ''}`}><T t={st === 'error' ? L.progressSyncError : st === 'syncing' ? L.progressSyncing : L.progressSynced} /></p>;
}

export function Course() {
  // Reading the signal subscribes the page to progress changes.
  const state = learn.value;
  const next = nextUp(modules, state);
  const prog = courseProgress(modules, state);
  const started = prog.done > 0 || Object.keys(state.lessons).length > 0;

  const nextHref =
    next.kind === 'lesson'
      ? `#/learn/${next.moduleId}/${next.lessonId}`
      : next.kind === 'quiz'
        ? `#/learn/${next.moduleId}/quiz`
        : null;

  return (
    <section>
      <h1><Flag /><T t={L.courseTitle} /></h1>
      <p class="lede"><T t={L.courseLede} /></p>

      <div class="card">
        <h2><T t={L.courseProgress} /></h2>
        <Bar value={prog.done} total={prog.lessons} />
        <p class="muted small"><T t={L.courseLine(prog.done, prog.lessons, prog.mastered, prog.modules)} /></p>
        {nextHref ? (
          <a class="primary" href={nextHref}><T t={started ? L.continueCourse : L.startCourse} /></a>
        ) : (
          <p><T t={L.courseDone} /></p>
        )}
      </div>

      <details class="credits">
        <summary><T t={L.howTitle} /></summary>
        <ol class="lp-list">
          {L.how.map((h) => (
            <li key={h.en}><T t={h} /></li>
          ))}
        </ol>
      </details>

      <ol class="modules">
        {modules.map((m, i) => {
          const status = moduleStatus(m, state);
          const done = lessonsDone(m, state);
          return (
            <li key={m.id}>
              <a class={`module-card ${status}`} href={`#/learn/${m.id}`}>
                <span class="module-num">{i + 1}</span>
                <span class="module-body">
                  <strong><T t={m.title} /></strong>
                  <small><T t={m.blurb} /></small>
                  <Bar value={done} total={m.lessons.length} />
                  <span class="module-meta">
                    <T t={L.moduleMeta(m.lessons.length, minutesOf(m))} />
                    <span class={`badge status-${status}`}><T t={statusLabel[status]} /></span>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <ProgressNote />
    </section>
  );
}

export function ModuleScreen({ moduleId }: { moduleId: string }) {
  const state = learn.value;
  const m = moduleById(moduleId);
  if (!m) {
    return (
      <section>
        <p><T t={L.unknownLesson} /></p>
        <a class="secondary" href="#/learn"><T t={L.backToCourse} /></a>
      </section>
    );
  }
  const status = moduleStatus(m, state);
  const quiz = state.quizzes[m.id];
  const ids = allQuestions.filter((q) => q.cat === m.id).map((q) => q.id);
  const stats = statsFor(ids);

  return (
    <section>
      <p class="crumbs"><a href="#/learn"><T t={L.courseTitle} /></a></p>
      <h1><T t={m.title} /></h1>
      <p class="lede"><T t={m.blurb} /></p>
      <p><span class={`badge status-${status}`}><T t={statusLabel[status]} /></span></p>

      <h2 class="group"><T t={L.lessons} /></h2>
      <ol class="lessons">
        {m.lessons.map((l, i) => {
          const rec = lessonRecord(m.id, l.id);
          return (
            <li key={l.id}>
              <a class={`lesson-row ${rec.done ? 'done' : ''}`} href={`#/learn/${m.id}/${l.id}`}>
                <span class="lesson-mark" aria-hidden="true">{rec.done ? '✓' : i + 1}</span>
                <span class="lesson-body">
                  <strong><T t={l.title} /></strong>
                  <small><T t={L.lessonMeta(l.minutes, l.steps.length, rec.done ? 'done' : rec.step > 0 ? 'resume' : null)} /></small>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <div class="card">
        <h2><T t={L.quiz} /></h2>
        <p class="muted"><T t={L.quizHint} /></p>
        {quiz && (
          <p class={quiz.best >= 80 ? 'right bold' : 'wrong bold'}><T t={L.bestScore(quiz.best)} /></p>
        )}
        <a class="primary" href={`#/learn/${m.id}/quiz`}><T t={quiz ? L.retakeQuiz : L.takeQuiz} /></a>
      </div>

      <div class="actions">
        <a class="secondary" href={`#/practice/${m.id}`}><T t={L.practiceTopic} /></a>
        <span class="muted small"><T t={L.topicLine(stats.seen, ids.length, stats.due)} /></span>
      </div>
    </section>
  );
}
