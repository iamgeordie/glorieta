// Every LinguaMama episode Glorieta plays must be in LinguaMama's production CDN: both renders, their captions and
// posters. Studio's own bucket is never used. A missing file fails the check (and so the deploy) and names the file.
// An episode marked "planned" is in the series plan but not built yet: the app hides it, so it is not checked. Drop the
// flag once Studio promotes it.
import { readFileSync } from 'node:fs';

const lm = JSON.parse(readFileSync(new URL('../src/data/linguamama.json', import.meta.url), 'utf8'));
const files = (slug) => {
  const base = `${lm.cdn}/episodes/${slug}`;
  const out = [];
  for (const audio of ['es-ES', 'en-GB']) {
    const stem = `${lm.level}_${audio}-${slug}`;
    out.push(`${base}/videos/${stem}-h.mp4`, `${base}/thumbnails/${stem}.png`, `${base}/chapters/${stem}-captions.vtt`);
  }
  out.push(`${base}/chapters/${lm.level}_es-ES-en-${slug}-captions.vtt`);
  return out;
};

const problems = [];
// One request at a time: a burst of parallel connections times out on some networks.
const live = lm.episodes.filter((e) => !e.planned);
for (const e of live) {
  for (const url of files(e.slug)) {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) problems.push(`${e.slug}: ${res.status} ${url}`);
    else if (res.headers.get('access-control-allow-origin') !== '*') problems.push(`${e.slug}: no CORS on ${url}`);
  }
}
if (problems.length) {
  console.error(`LinguaMama media missing from production (promote the episode in Studio):\n- ${problems.sort().join('\n- ')}`);
  process.exit(1);
}
console.log(`LinguaMama media: ${live.length} episode(s) in production, OK (${lm.episodes.length - live.length} planned, not checked)`);
