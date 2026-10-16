import { T } from '../i18n';
import { terms } from '../data/vocab';
import { lastExam } from '../format';
import { authStatus } from '../lib/auth';
import { authEnabled } from '../lib/supabase';
import { a } from '../authStrings';
import { ui } from '../ui';
import { allQuestions } from '../lib/quiz';
import { exams, progress, resetAll, statsFor } from '../lib/store';

export function Home() {
  // Reading the signal subscribes the page to progress changes.
  progress.value;
  const q = statsFor(allQuestions.map((x) => x.id));
  const v = statsFor(terms.map((t) => `v:${t.id}`));
  const last = exams.value[exams.value.length - 1];

  const tiles = [
    { href: '#/practice', title: ui.practice, hint: ui.practiceHint },
    { href: '#/exam', title: ui.exam, hint: ui.examHint },
    { href: '#/signs', title: ui.signsTile, hint: ui.signsTileHint },
    { href: '#/vocab', title: ui.vocab, hint: ui.vocabHint },
    { href: '#/phrases', title: ui.phrases, hint: ui.phrasesHint },
    { href: '#/facts', title: ui.facts, hint: ui.factsHint },
    ...(authEnabled ? [{ href: '#/account', title: authStatus.value === 'in' ? a.accountTile : a.accountTileOut, hint: a.accountTileHint }] : []),
  ];

  return (
    <section>
      <p class="slogan"><T t={ui.slogan} /></p>
      <p class="lede"><T t={ui.tagline} /></p>
      <ul class="list">
        {tiles.map((t) => (
          <li key={t.href}>
            <a class="tile" href={t.href}>
              <strong><T t={t.title} /></strong>
              <small><T t={t.hint} /></small>
            </a>
          </li>
        ))}
      </ul>

      <div class="card">
        <h2><T t={ui.progress} /></h2>
        <dl class="stats">
          <div><dt><T t={ui.practice} /></dt><dd>{q.seen}/{allQuestions.length}</dd></div>
          <div><dt><T t={ui.accuracy} /></dt><dd>{q.accuracy === null ? '–' : `${q.accuracy}%`}</dd></div>
          <div><dt><T t={ui.dueNow} /></dt><dd>{q.due}</dd></div>
          <div><dt><T t={ui.vocab} /></dt><dd>{v.seen}/{terms.length}</dd></div>
        </dl>
        <p class="muted">
          {last ? <T t={lastExam(last.errors, last.passed)} /> : <><T t={ui.lastExam} />: <T t={ui.noExamYet} /></>}
        </p>
      </div>

      <p class="muted small"><strong><T t={ui.unofficialTitle} />.</strong> <T t={ui.unofficial} /></p>
      <p class="muted small"><T t={ui.langHint} /></p>
      <button
        type="button"
        class="link"
        onClick={() => {
          if (confirm(`${ui.resetConfirm.es}\n${ui.resetConfirm.en}`)) resetAll();
        }}
      >
        <T t={ui.resetProgress} />
      </button>
    </section>
  );
}
