// Read-only lookup of Spanish law in the BOE's consolidated-legislation open-data API.
// Prints exact text to the terminal; writes nothing. Used to cite and verify lesson content.
//
//   node scripts/boe.mjs <BOE id> index                  list every block (articles, annexes) with its title
//   node scripts/boe.mjs <BOE id> a57 a58 ...            print blocks by id (see `index`). CAUTION: ids can belong to a repealed
//                                                        block; a new article with the same number may sit in another block
//   node scripts/boe.mjs <BOE id> art 153 [154 ...]      print every IN-FORCE block titled "Artículo 153" (the safe way to cite by number)
//   node scripts/boe.mjs catalogue <regex> [--lines 30]  the in-force sign Catalogue (RGC Anexo I, ap. 5; as published in RD 465/2025):
//                                                        every place the regex matches, with the lines after it, e.g. `catalogue "R-305"`,
//                                                        `catalogue "^\\s*M-2\\.1"`. Needs poppler's pdftotext (brew install poppler).
//   node scripts/boe.mjs original <BOE id> [regex]       the text as originally published (a disposition that amends a law, e.g.
//                                                        BOE-A-2025-12199 = RD 465/2025); with a regex, only the matching paragraphs
//   node scripts/boe.mjs <BOE id> grep <regex> [--repealed]   print every IN-FORCE block whose text matches (case-insensitive)
//   node scripts/boe.mjs <BOE id> repealed               list the blocks that are no longer in force, with the date
//   node scripts/boe.mjs laws                            the laws this app relies on
//
// A block with a fecha_caducidad on or before today has been repealed: it is printed with a loud REPEALED
// warning, left out of `grep` unless --repealed is given, and listed by `repealed`. Never cite one.
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

if (id === 'catalogue') {
  // The per-sign definitions are not in the consolidated API's text. They are in the published PDF of RD 465/2025,
  // which becomes Anexo I, ap. 5 of the RGC. Streamed through pdftotext; nothing is written to disk.
  const pattern = cmd;
  if (!pattern) {
    console.error('usage: node scripts/boe.mjs catalogue <regex> [--lines 30]');
    process.exit(2);
  }
  const li = rest.indexOf('--lines');
  const lines = li >= 0 ? Number(rest[li + 1]) || 30 : 30;
  const res = await fetch('https://www.boe.es/boe/dias/2025/06/17/pdfs/BOE-A-2025-12199.pdf');
  if (!res.ok) throw new Error(`BOE PDF ${res.status}`);
  const { spawnSync } = await import('node:child_process');
  const out = spawnSync('pdftotext', ['-layout', '-', '-'], { input: Buffer.from(await res.arrayBuffer()), maxBuffer: 200 * 1024 * 1024 });
  if (out.error || out.status !== 0) throw new Error('pdftotext failed (is poppler installed? brew install poppler)');
  const text = out.stdout.toString('utf8').split('\n');
  const re = new RegExp(pattern, 'i');
  let page = '';
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const pg = /Sec\. I\. Pág\. (\d+)/.exec(text[i] ?? '');
    if (pg) page = pg[1] ?? '';
    if (!re.test(text[i] ?? '')) continue;
    n++;
    console.log(`\n=== match ${n} (BOE-A-2025-12199, Sec. I, pág. ${page}) ===`);
    console.log(text.slice(i, i + lines).map((l) => l.replace(/\s+$/, '')).filter((l, k, a) => l || (a[k - 1] ?? '')).join('\n'));
  }
  if (!n) console.log('no match');
  process.exit(0);
}
if (id === 'original') {
  // As-published text of any BOE disposition (not consolidated), e.g. the decree that amends a law.
  const target = cmd;
  if (!target) {
    console.error('usage: node scripts/boe.mjs original <BOE id> [regex]');
    process.exit(2);
  }
  const res = await fetch(`https://www.boe.es/diario_boe/xml.php?id=${target}`);
  if (!res.ok) throw new Error(`BOE ${res.status} for ${target}`);
  const xml = await res.text();
  const paras = [...xml.matchAll(/<(p|h\d)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => decode(m[2] ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const re = rest[0] ? new RegExp(rest[0], 'i') : null;
  for (const p of paras) if (!re || re.test(p)) console.log(p);
  process.exit(0);
}
if (id === 'laws') {
  for (const [k, v] of Object.entries(LAWS)) console.log(`${k}  ${v}`);
  process.exit(0);
}
if (!id || (!cmd && id !== 'laws')) {
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

/** Date (YYYYMMDD) from which a block is no longer in force, or '' if it still is. */
const repealedOn = (attrs) => {
  const d = attr(attrs, 'fecha_caducidad');
  return d && d <= today() ? d : '';
};
const fmt = (d) => d.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

const blocksOf = (xml) => [...xml.matchAll(/<bloque\b([^>]*)>([\s\S]*?)<\/bloque>/g)].map((m) => ({ attrs: m[1] ?? '', body: m[2] ?? '' }));

if (cmd === 'index') {
  const xml = await get(`${id}/texto/indice`);
  for (const b of xml.matchAll(/<bloque>([\s\S]*?)<\/bloque>/g)) {
    const body = b[1] ?? '';
    const bid = /<id>([^<]*)<\/id>/.exec(body)?.[1] ?? '';
    const title = decode(/<titulo>([^<]*)<\/titulo>/.exec(body)?.[1] ?? '');
    const gone = /<fecha_caducidad>(\d{8})<\/fecha_caducidad>/.exec(body)?.[1] ?? '';
    if (bid) console.log(`${bid}\t${title}${gone && gone <= today() ? `\t[REPEALED ${fmt(gone)}]` : ''}`);
  }
} else if (cmd === 'art') {
  const xml = await get(`${id}/texto`);
  for (const num of rest) {
    const re = new RegExp(`^Art[ií]culo ${num}\\b`, 'i');
    let found = 0;
    for (const b of blocksOf(xml)) {
      if (repealedOn(b.attrs)) continue;
      const { text, note } = currentText(b.body);
      if (!re.test(text.trimStart())) continue;
      found++;
      console.log(`\n=== Artículo ${num} (block ${attr(b.attrs, 'id')}) ${note} ===`);
      console.log(text);
    }
    if (!found) console.log(`\n=== Artículo ${num}: no in-force block with that title (it may be repealed: see \`repealed\`) ===`);
  }
} else if (cmd === 'repealed') {
  const xml = await get(`${id}/texto`);
  for (const b of blocksOf(xml)) {
    const gone = repealedOn(b.attrs);
    if (gone) console.log(`${attr(b.attrs, 'id')}\t${fmt(gone)}\t${attr(b.attrs, 'titulo')}`);
  }
} else if (cmd === 'grep') {
  const re = new RegExp(rest[0] ?? '', 'i');
  const withRepealed = rest.includes('--repealed');
  const xml = await get(`${id}/texto`);
  let n = 0;
  let skipped = 0;
  for (const b of blocksOf(xml)) {
    const gone = repealedOn(b.attrs);
    const { text, note } = currentText(b.body);
    if (!re.test(text)) continue;
    if (gone && !withRepealed) {
      skipped++;
      continue;
    }
    n++;
    console.log(`\n=== ${attr(b.attrs, 'id')} (${attr(b.attrs, 'tipo')}) ${gone ? `*** REPEALED since ${fmt(gone)}: NOT IN FORCE, DO NOT CITE *** ` : ''}${note} ===`);
    console.log(text.length > 6000 ? `${text.slice(0, 6000)}\n[... block continues; fetch it by id]` : text);
  }
  if (n === 0) console.log('no match');
  if (skipped) console.log(`\n(${skipped} repealed block(s) also matched and were left out; add --repealed to see them)`);
} else {
  for (const block of [cmd, ...rest]) {
    const xml = await get(`${id}/texto/bloque/${block}`);
    const { text, note } = currentText(xml);
    const gone = repealedOn(/<bloque\b([^>]*)>/.exec(xml)?.[1] ?? '');
    console.log(`\n=== ${block} ${gone ? `*** REPEALED since ${fmt(gone)}: NOT IN FORCE, DO NOT CITE *** ` : ''}${note} ===`);
    console.log(text);
  }
}
