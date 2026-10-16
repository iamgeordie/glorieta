import { Peek, T } from '../i18n';
import { abbreviations, confidenceLabel, factGroups, sources, usVsSpain } from '../data/facts';
import { ui } from '../ui';

export function Facts() {
  return (
    <section>
      <h1><T t={ui.facts} /></h1>
      {factGroups.map((g) => (
        <div key={g.title.en} class="card">
          <h2><T t={g.title} /></h2>
          <ul class="facts">
            {g.facts.map((f) => (
              <li key={f.text.en}>
                <Peek t={f.text} />
                <span class={`badge ${f.confidence}`}><T t={confidenceLabel[f.confidence]} /></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div class="card">
        <h2><T t={ui.differsFromUS} /></h2>
        <ul class="facts">
          {usVsSpain.map((t) => (
            <li key={t.en}><Peek t={t} /></li>
          ))}
        </ul>
      </div>
      <div class="card">
        <h2><T t={ui.source} /></h2>
        <ul class="facts">
          {sources.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer noopener">{s.label}</a>
            </li>
          ))}
        </ul>
        <p class="muted small">
          {abbreviations.map(([a, full]) => (
            <span key={a} class="term"><b>{a}</b> = {full}</span>
          ))}
        </p>
      </div>
      <p class="muted"><strong><T t={ui.unofficialTitle} />.</strong> <T t={ui.unofficial} /></p>
    </section>
  );
}
