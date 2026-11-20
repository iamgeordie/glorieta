import { T } from '../i18n';
import { L } from '../learnStrings';
import data from '../data/linguamama.json';

type Episode = (typeof data.episodes)[number];

/** The learner-app address of an episode, in the series it belongs to. */
export const episodeUrl = (e: Episode) => `${data.app}/${data.locale}/${data.level}/${e.slug}/${e.series}`;

/** Published LinguaMama episodes for a module, or for one lesson of it. */
export function episodesFor(moduleId: string, lessonId?: string): Episode[] {
  return data.episodes.filter((e) => e.module === moduleId && (!lessonId || e.lessons.includes(lessonId)));
}

/** A card linking to the LinguaMama episodes that teach this module or lesson. Renders nothing when there are none. */
export function WatchLinks({ moduleId, lessonId }: { moduleId: string; lessonId?: string }) {
  const eps = episodesFor(moduleId, lessonId);
  if (!eps.length) return null;
  return (
    <div class="card watch">
      <h2><T t={L.watchTitle} /></h2>
      <p class="muted"><T t={L.watchHint} /></p>
      <ul class="watch-list">
        {eps.map((e) => (
          <li key={e.slug}>
            <a href={episodeUrl(e)} target="_blank" rel="noopener noreferrer">
              <img class="promo-logo" src="/linguamama-logo.png" width="28" height="28" alt="" />
              <T t={e.title} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
