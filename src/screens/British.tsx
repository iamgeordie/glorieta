import { T } from '../i18n';
import { glossary } from '../data/british';
import { ui } from '../ui';

export function British() {
  return (
    <section>
      <h1><T t={ui.british} /></h1>
      <p class="muted"><T t={ui.britishIntro} /></p>
      <div class="table-split">
        {[glossary.slice(0, Math.ceil(glossary.length / 2)), glossary.slice(Math.ceil(glossary.length / 2))].map((rows, half) => (
          <div class="table-wrap" key={half}>
            <table>
              <thead>
                <tr>
                  <th scope="col"><T t={ui.britishEs} /></th>
                  <th scope="col"><T t={ui.britishUs} /></th>
                  <th scope="col"><T t={ui.britishUk} /></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.es}>
                    <td lang="es"><b>{g.es}</b></td>
                    <td lang="en-US">{g.us}</td>
                    <td lang="en-GB">
                      <strong>{g.uk}</strong>
                      {g.note && <small class="muted"><br /><T t={g.note} /></small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
