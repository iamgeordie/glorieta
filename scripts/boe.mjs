// Read-only lookup of Spanish law in the BOE's consolidated-legislation open-data API.
// Prints exact text to the terminal; writes nothing. Used to cite and verify lesson content.
//
//   node scripts/boe.mjs <BOE id> index                  list every block (articles, annexes) with its title
//   node scripts/boe.mjs <BOE id> a57 a58 ...            print blocks by id (see `index`)
//   node scripts/boe.mjs <BOE id> grep <regex> [--ctx]   print every block whose text matches (case-insensitive)
//   node scripts/boe.mjs laws                            the laws this app relies on
//
// Note: the BOE marks consolidated text as informative; the signed BOE publication is the legal text.

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id';

export const LAWS = {
  'BOE-A-2003-23514': 'Reglamento General de Circulación (RGC), RD 1428/2003',
  'BOE-A-2015-11722': 'Ley de Tráfico y Seguridad Vial (LSV), RDL 6/2015',
  'BOE-A-2009-9481': 'Reglamento General de Conductores (RGCond), RD 818/2009',
  'BOE-A-1999-1826': 'Reglamento General de Vehículos (RGV), RD 2822/1998',
  'BOE-A-1995-25444': 'Código Penal (arts. 379 to 385 on road offences)',
  'BOE-A-2021-8447': 'Ley 7/2021 de cambio climático (art. 14, zonas de bajas emisiones)',
};

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

async function get(path) {
  // Several authors may query at once: back off and retry on rate limits and server errors.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${path}`, { headers: { Accept: 'application/xml' } });
    if (res.ok) return res.text();
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) throw new Error(`BOE API ${res.status} for ${path}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

const [, , id, cmd, ...rest] = process.argv;

if (id === 'laws') {
  for (const [k, v] of Object.entries(LAWS)) console.log(`${k}  ${v}`);
  process.exit(0);
}
if (!id || !cmd) {
  console.error('usage: node scripts/boe.mjs <BOE id> index | a57 [a58 ...] | grep <regex>   (or: laws)');
  process.exit(2);
}

const attr = (attrs, name) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';

const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');

/**
 * A block holds every historical wording as a dated <version>. Only the wording in force today is law
 * for a learner, so pick the latest version that has already taken effect, and drop the amendment
 * history (<blockquote>), which quotes superseded text.
 */
function currentText(body) {
  const versions = [...body.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)].map((m) => ({
    from: attr(m[1] ?? '', 'fecha_vigencia'),
    by: attr(m[1] ?? '', 'id_norma'),
    xml: m[2] ?? '',
  }));
  if (versions.length === 0) return { text: decode(body), note: '' };
  const live = versions.filter((v) => v.from <= today());
  const pick = live.sort((a, b) => a.from.localeCompare(b.from)).at(-1) ?? versions[0];
  const upcoming = versions.filter((v) => v.from > today()).map((v) => `${v.from} (${v.by})`);
  const text = decode(pick.xml.replace(/<blockquote\b[\s\S]*?<\/blockquote>/g, ''));
  const note = `[wording in force since ${pick.from.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}, from ${pick.by}${upcoming.length ? `; LATER VERSION(S) NOT YET IN FORCE: ${upcoming.join(', ')}` : ''}]`;
  return { text, note };
}

const blocksOf = (xml) => [...xml.matchAll(/<bloque\b([^>]*)>([\s\S]*?)<\/bloque>/g)].map((m) => ({ attrs: m[1] ?? '', body: m[2] ?? '' }));

if (cmd === 'index') {
  const xml = await get(`${id}/texto/indice`);
  for (const b of xml.matchAll(/<bloque>([\s\S]*?)<\/bloque>/g)) {
    const body = b[1] ?? '';
    const bid = /<id>([^<]*)<\/id>/.exec(body)?.[1] ?? '';
    const title = decode(/<titulo>([^<]*)<\/titulo>/.exec(body)?.[1] ?? '');
    if (bid) console.log(`${bid}\t${title}`);
  }
} else if (cmd === 'grep') {
  const re = new RegExp(rest[0] ?? '', 'i');
  const xml = await get(`${id}/texto`);
  let n = 0;
  for (const b of blocksOf(xml)) {
    const { text, note } = currentText(b.body);
    if (!re.test(text)) continue;
    n++;
    console.log(`\n=== ${attr(b.attrs, 'id')} (${attr(b.attrs, 'tipo')}) ${note} ===`);
    console.log(text.length > 6000 ? `${text.slice(0, 6000)}\n[... block continues; fetch it by id]` : text);
  }
  if (n === 0) console.log('no match');
} else {
  for (const block of [cmd, ...rest]) {
    const xml = await get(`${id}/texto/bloque/${block}`);
    const { text, note } = currentText(xml);
    console.log(`\n=== ${block} ${note} ===`);
    console.log(text);
  }
}
