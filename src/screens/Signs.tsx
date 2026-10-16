import { T } from '../i18n';
import { commonsPage, groupOrder, groupTitles, needsCredit, signFile, signs } from '../data/signs';
import { ui } from '../ui';

export function Signs() {
  const credited = signs.filter(needsCredit);
  return (
    <section>
      <h1><T t={ui.signs} /></h1>
      <p class="muted"><T t={ui.signsHint} /></p>
      <a class="primary cta" href="#/practice/signs"><T t={ui.practiceSigns} /></a>

      {groupOrder.map((group, i) => {
        const inGroup = signs.filter((s) => s.group === group);
        return (
          <details class="group-box" key={group} open={i === 0}>
            <summary class="group">
              <T t={groupTitles[group]} /> <span class="count">{inGroup.length}</span>
            </summary>
            <ul class="sign-grid">
              {inGroup.map((s) => (
                <li key={s.id}>
                  <details class="sign-card">
                    <summary>
                      <img src={signFile(s)} alt="" width="88" height="88" loading="lazy" />
                      <span class="sign-name"><T t={s.name} /></span>
                      <span class="sign-code">{s.code}</span>
                    </summary>
                    <p><T t={s.why} /></p>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        );
      })}

      <details class="credits">
        <summary><T t={ui.signCredits} /> ({credited.length})</summary>
        <p class="muted small"><T t={ui.signCreditsIntro} /></p>
        <ul class="facts small">
          {credited.map((s) => (
            <li key={s.id}>
              <a href={commonsPage(s)} target="_blank" rel="noreferrer noopener">{s.code}</a>: {s.author},{' '}
              <a href={s.licenseUrl} target="_blank" rel="noreferrer noopener">{s.license}</a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
