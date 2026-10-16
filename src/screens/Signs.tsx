import { T } from '../i18n';
import { commonsPage, groupOrder, groupTitles, signFile, signs } from '../data/signs';
import { ui } from '../ui';

export function Signs() {
  const credited = signs.filter((s) => s.credit !== 'public-domain');
  return (
    <section>
      <h1><T t={ui.signs} /></h1>
      <p class="muted"><T t={ui.signsHint} /></p>
      <a class="primary cta" href="#/practice/signs"><T t={ui.practiceSigns} /></a>

      {groupOrder.map((group) => (
        <div key={group}>
          <h2 class="group"><T t={groupTitles[group]} /></h2>
          <ul class="sign-grid">
            {signs
              .filter((s) => s.group === group)
              .map((s) => (
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
        </div>
      ))}

      <p class="muted small">
        <T t={ui.signCredits} />{' '}
        {credited.map((s) => {
          const c = s.credit;
          if (c === 'public-domain') return null;
          return (
            <span key={s.id} class="term">
              <a href={commonsPage(s)} target="_blank" rel="noreferrer noopener">{s.code}</a>: {c.author}, {c.license}
            </span>
          );
        })}
      </p>
    </section>
  );
}
