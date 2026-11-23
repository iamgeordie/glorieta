import { useState } from 'preact/hooks';
import { T, mode } from '../i18n';
import { L } from '../learnStrings';
import data from '../data/linguamama.json';

type Episode = (typeof data.episodes)[number];
/** The narration language of a LinguaMama render: Spanish, or the English version of the same episode. */
type Audio = 'es-ES' | 'en-GB';

/** The learner-app address of an episode, in the series it belongs to. */
export const episodeUrl = (e: Episode) => `${data.app}/${data.locale}/${data.level}/${e.slug}/${e.series}`;

/** Production media of an episode on LinguaMama's CDN (the promoted copy, never the studio bucket). */
export function episodeMedia(e: Episode, audio: Audio) {
  const base = `${data.cdn}/episodes/${e.slug}`;
  const stem = `${data.level}_${audio}-${e.slug}`;
  // The Spanish render carries Spanish captions and an English translation of them; the English render, English ones.
  const tracks =
    audio === 'es-ES'
      ? [
          { lang: 'es', label: 'Español', src: `${base}/chapters/${stem}-captions.vtt` },
          { lang: 'en', label: 'English', src: `${base}/chapters/${data.level}_es-ES-en-${e.slug}-captions.vtt` },
        ]
      : [{ lang: 'en', label: 'English', src: `${base}/chapters/${stem}-captions.vtt` }];
  return { video: `${base}/videos/${stem}-h.mp4`, poster: `${base}/thumbnails/${stem}.png`, tracks };
}

/** Published LinguaMama episodes for a module, or for one lesson of it. */
export function episodesFor(moduleId: string, lessonId?: string): Episode[] {
  return data.episodes.filter((e) => e.module === moduleId && (!lessonId || e.lessons.includes(lessonId)));
}

/** One episode: a poster until it is asked to play, so a lesson page never downloads video it does not show. */
function EpisodePlayer({ e }: { e: Episode }) {
  const [audio, setAudio] = useState<Audio>(mode.value === 'en' ? 'en-GB' : 'es-ES');
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const m = episodeMedia(e, audio);
  const pick = (a: Audio) => { setAudio(a); setFailed(false); };
  return (
    <li class="watch-episode">
      <h3><T t={e.title} /></h3>
      {playing ? (
        // Keyed by language, so switching audio loads the other render instead of keeping the old source.
        <video
          key={audio}
          class="watch-video"
          controls
          autoPlay
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          poster={m.poster}
          onError={() => setFailed(true)}
        >
          <source src={m.video} type="video/mp4" onError={() => setFailed(true)} />
          {m.tracks.map((t, i) => (
            <track key={t.src} kind="subtitles" srcLang={t.lang} label={t.label} src={t.src} default={i === 0} />
          ))}
        </video>
      ) : (
        <button type="button" class="watch-poster" onClick={() => setPlaying(true)}>
          <img src={m.poster} alt="" width="1280" height="720" loading="lazy" />
          <span class="watch-play"><T t={L.watchPlay} /></span>
        </button>
      )}
      {failed && <p class="watch-error"><T t={L.watchFailed} /></p>}
      <div class="watch-meta">
        <span class="watch-audio" role="group">
          <T t={L.watchAudio} />
          <button type="button" class={audio === 'es-ES' ? 'on' : ''} aria-pressed={audio === 'es-ES'} onClick={() => pick('es-ES')}>
            <T t={L.watchSpanish} />
          </button>
          <button type="button" class={audio === 'en-GB' ? 'on' : ''} aria-pressed={audio === 'en-GB'} onClick={() => pick('en-GB')}>
            <T t={L.watchEnglish} />
          </button>
        </span>
        <a href={episodeUrl(e)} target="_blank" rel="noopener noreferrer">
          <img class="promo-logo" src="/linguamama-logo.png" width="20" height="20" alt="" />
          <T t={L.watchOpen} />
        </a>
      </div>
    </li>
  );
}

/** A card that plays the LinguaMama episodes teaching this module or lesson. Renders nothing when there are none. */
export function WatchLinks({ moduleId, lessonId }: { moduleId: string; lessonId?: string }) {
  const eps = episodesFor(moduleId, lessonId);
  if (!eps.length) return null;
  return (
    <div class="card watch">
      <h2><T t={L.watchTitle} /></h2>
      <p class="muted"><T t={L.watchHint} /></p>
      <ul class="watch-list">
        {eps.map((e) => <EpisodePlayer key={e.slug} e={e} />)}
      </ul>
    </div>
  );
}
