// Validates the Learn course: modules, lessons, blocks, check questions and figures.
// Called by check-questions.mjs, so `npm run check` covers it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const root = new URL('../src/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const BLOCKS = ['p', 'rule', 'list', 'table', 'figure', 'signs', 'us', 'tip', 'example', 'check'];
// Words that make a check depend on the lesson text or a figure. Checks join the question bank, so they must stand alone.
const DEPENDENT = /\b(figura|figure|arriba|above|diagrama|diagram|paso anterior|previous step|esta lección|this lesson|en el texto|in the text)\b/i;


/**
 * RGC articles 159 to 173 (sign and marking articles) were repealed on 2025-06-17 by RD 465/2025: their
 * content now lives in Anexo I, ap. 5 (the Catalogue). Articles 151 to 158 are a different, newer set
 * (cyclists, pedestrians, personal mobility vehicles, parking regime, environmental limits, safe school
 * routes) added by RD 518/2026. A citation that uses those numbers for sign or marking content is wrong.
 * Returns the problem, or '' when the citation is acceptable.
 */
export function badCitation(src) {
  if (!/RGC|Reglamento General de Circulaci/i.test(src)) return '';
  const cleaned = src.replace(/RD\s+\d+\/\d{4}/gi, '').replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '');
  const numbers = [...cleaned.matchAll(/(?<![\d.])(\d{3})(?![\d])/g)].map((m) => Number(m[1]));
  const gone = numbers.filter((n) => n >= 159 && n <= 173);
  if (gone.length) return `cites RGC art. ${gone.join(', ')}: repealed 2025-06-17 (sign and marking text is now in Anexo I, ap. 5; cite "RGC Anexo I, ap. 5.1" or "5.2")`;
  const oldSigns = numbers.filter((n) => n >= 151 && n <= 158);
  if (oldSigns.length && /\((?:[RPSMV]-\d|[RPSMV]\d)|\bsign\b|\bseñal/i.test(cleaned))
    return `cites RGC art. ${oldSigns.join(', ')} for a sign: arts. 151-158 are now the cyclist/pedestrian/VMP articles, not sign articles`;
  return '';
}

export function checkLearn({ questions, signs, categoryIds }) {
  const problems = [];
  const notes = [];
  const bad = (where, msg) => problems.push(`${where}: ${msg}`);

  const order = read('data/learn/order.json');
  const moduleFiles = readdirSync(new URL('data/learn/modules/', root)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  for (const id of order) if (!moduleFiles.includes(id)) bad('order.json', `lists "${id}" but modules/${id}.json does not exist`);
  for (const id of moduleFiles) if (!order.includes(id)) bad(`modules/${id}.json`, 'is not listed in order.json');
  if (new Set(order).size !== order.length) bad('order.json', 'has a duplicate');

  const figureDir = new URL('learn-figures/', root);
  const figureFiles = new Set(readdirSync(figureDir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
  const usedFigures = new Set();
  const signIds = new Set(signs.map((s) => s.id));
  const bankIds = new Set(questions.map((q) => q.id));
  const allIds = new Set(bankIds);
  const covered = new Set();
  const shownSigns = new Set();
  const checksPerCat = {};
  const quizPool = {};

  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  const bi = (where, v) => {
    if (!v || !str(v.es) || !str(v.en)) {
      bad(where, 'needs both es and en text');
      return;
    }
    // A long string that is identical in both languages was almost certainly not translated.
    if (v.es === v.en && /[a-záéíóúñ]{4,}/i.test(v.es) && v.es.length > 30) bad(where, 'es and en are identical');
    for (const lang of ['es', 'en']) if ((v[lang].match(/\*\*/g) ?? []).length % 2) bad(where, `unbalanced ** in ${lang}`);
  };

  const checkQuestion = (where, q, cat, { bank }) => {
    if (!q || typeof q !== 'object') return bad(where, 'is not an object');
    if (!str(q.id)) return bad(where, 'missing id');
    if (!q.id.startsWith(`${cat}-`)) bad(where, `id "${q.id}" must start with "${cat}-" (the server groups topics by that prefix)`);
    if (allIds.has(q.id)) bad(where, `duplicate id "${q.id}"`);
    allIds.add(q.id);
    if (![0, 1, 2].includes(q.answer)) bad(where, 'answer must be 0, 1 or 2');
    for (const lang of ['es', 'en']) {
      const v = q[lang];
      if (!str(v?.q)) bad(where, `${lang}.q is empty`);
      if (!str(v?.why)) bad(where, `${lang}.why is empty`);
      if (!Array.isArray(v?.options) || v.options.length !== 3 || v.options.some((o) => !str(o))) bad(where, `${lang}.options must be exactly 3 non-empty strings`);
      else if (new Set(v.options).size !== 3) bad(where, `${lang}.options has duplicates`);
      if (bank && DEPENDENT.test(`${v?.q ?? ''} ${v?.options?.join(' ') ?? ''}`)) bad(where, `${lang} question refers to the lesson or a figure; it must stand alone`);
    }
    if (!str(q.src)) bad(where, 'missing src');
    else if (badCitation(q.src)) bad(where, badCitation(q.src));
    if (q.note) bi(`${where}.note`, q.note);
    for (const t of q.terms ?? []) if (!str(t.es) || !str(t.en)) bad(where, 'terms need es and en');
  };

  const checkBlock = (where, b, cat, lessonCtx) => {
    if (!BLOCKS.includes(b?.t)) return bad(where, `unknown block type "${b?.t}"`);
    switch (b.t) {
      case 'p':
      case 'us':
      case 'tip':
        bi(where, b.text);
        break;
      case 'rule':
        bi(where, b.text);
        if (!str(b.src)) bad(where, 'a rule needs src (the article it comes from)');
        else if (badCitation(b.src)) bad(where, badCitation(b.src));
        break;
      case 'list':
        if (!Array.isArray(b.items) || b.items.length < 2) bad(where, 'a list needs at least 2 items');
        else b.items.forEach((it, i) => bi(`${where}.items[${i}]`, it));
        break;
      case 'table':
        if (!Array.isArray(b.head) || !Array.isArray(b.rows) || b.rows.length === 0) return bad(where, 'a table needs head and rows');
        b.head.forEach((h, i) => bi(`${where}.head[${i}]`, h));
        b.rows.forEach((r, i) => {
          if (!Array.isArray(r) || r.length !== b.head.length) bad(`${where}.rows[${i}]`, 'row length must match the head');
          else r.forEach((c, j) => bi(`${where}.rows[${i}][${j}]`, c));
        });
        break;
      case 'figure': {
        if (!figureFiles.has(b.file)) bad(where, `src/learn-figures/${b.file}.svg does not exist`);
        usedFigures.add(b.file);
        bi(`${where}.alt`, b.alt);
        bi(`${where}.caption`, b.caption);
        for (const l of b.legend ?? []) {
          if (!str(l.mark) || [...l.mark].length > 2) bad(where, 'legend marks are one or two characters');
          bi(`${where}.legend`, l.text);
        }
        break;
      }
      case 'signs':
        if (!Array.isArray(b.ids) || b.ids.length === 0) bad(where, 'signs needs ids');
        for (const id of b.ids ?? []) {
          if (!signIds.has(id)) bad(where, `unknown sign "${id}"`);
          shownSigns.add(id);
        }
        if (b.caption) bi(`${where}.caption`, b.caption);
        break;
      case 'example':
        if (b.title) bi(`${where}.title`, b.title);
        bi(`${where}.situation`, b.situation);
        bi(`${where}.action`, b.action);
        bi(`${where}.why`, b.why);
        break;
      case 'check':
        checkQuestion(`${where}.q`, b.q, cat, { bank: true });
        lessonCtx.checks.push(b.q);
        checksPerCat[cat] = (checksPerCat[cat] ?? 0) + 1;
        (quizPool[cat] ??= []).push(b.q.answer);
        break;
    }
  };


  const SCENE_KINDS = ['car', 'truck', 'moto', 'bike', 'ped'];
  const SCENE_TONES = ['me', 'other', 'danger', 'ok', 'neutral'];
  const num = (v) => typeof v === 'number' && Number.isFinite(v);

  /** An animation (<name>.anim.json): moving vehicles and reveals on top of the figure's base SVG. */
  const checkScene = (w, scene, svg) => {
    const fail = (m) => bad(w, m);
    if (!num(scene.seconds) || scene.seconds <= 0 || scene.seconds > 20) fail('seconds must be a number above 0 and up to 20');
    if (scene.poster !== undefined && (!num(scene.poster) || scene.poster < 0 || scene.poster > scene.seconds)) fail('poster must be inside the scene');
    if ((!Array.isArray(scene.actors) || scene.actors.length === 0) && !scene.reveals?.length) fail('needs at least one actor or reveal');
    const ids = new Set();
    for (const a of scene.actors ?? []) {
      const aw = `actor "${a.id}"`;
      if (!a.id || ids.has(a.id)) fail(`${aw}: missing or duplicate id`);
      ids.add(a.id);
      if (!SCENE_KINDS.includes(a.kind)) fail(`${aw}: kind must be one of ${SCENE_KINDS.join(', ')}`);
      if (!SCENE_TONES.includes(a.tone)) fail(`${aw}: tone must be one of ${SCENE_TONES.join(', ')}`);
      if (a.path) {
        if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/.test(a.path) || !/^[Mm]/.test(a.path.trim())) fail(`${aw}: path is not valid SVG path data`);
        if (!num(a.from) || !num(a.to) || a.from < 0 || a.to <= a.from || a.to > scene.seconds) fail(`${aw}: needs 0 <= from < to <= seconds`);
        if (a.ease && !['linear', 'inOut'].includes(a.ease)) fail(`${aw}: ease must be linear or inOut`);
      } else if (!Array.isArray(a.at) || a.at.length !== 3 || !a.at.every(num)) fail(`${aw}: with no path it needs at: [x, y, rotation]`);
      if (a.show && (!Array.isArray(a.show) || a.show.length !== 2 || !a.show.every(num) || a.show[0] >= a.show[1])) fail(`${aw}: show must be [from, to]`);
      if (a.badge && (!str(a.badge.mark) || [...a.badge.mark].length > 2 || !num(a.badge.dx) || !num(a.badge.dy))) fail(`${aw}: badge needs a 1-2 character mark, dx and dy`);
    }
    for (const r of scene.reveals ?? []) {
      if (!r.id || !new RegExp(`\\sid="${r.id}"`).test(svg)) fail(`reveal "${r.id}": the base SVG has no element with that id`);
      if (!num(r.from) || r.from < 0 || r.from >= scene.seconds) fail(`reveal "${r.id}": from must be inside the scene`);
      if (r.to !== undefined && (!num(r.to) || r.to <= r.from)) fail(`reveal "${r.id}": to must come after from`);
    }
  };

  let lessonCount = 0;
  let checkCount = 0;
  // Every module file is checked, listed in order.json or not, so an author can validate before it is registered.
  for (const modId of [...order.filter((id) => moduleFiles.includes(id)), ...moduleFiles.filter((id) => !order.includes(id))]) {
    const m = read(`data/learn/modules/${modId}.json`);
    const mw = `module ${modId}`;
    if (m.id !== modId) bad(mw, `id "${m.id}" must equal the file name`);
    if (!categoryIds.includes(modId)) bad(mw, 'id must be a category id in categories.ts');
    bi(`${mw}.title`, m.title);
    bi(`${mw}.blurb`, m.blurb);
    if (!Array.isArray(m.lessons) || m.lessons.length === 0) {
      bad(mw, 'has no lessons');
      continue;
    }
    const lessonIds = new Set();
    for (const l of m.lessons) {
      lessonCount++;
      const lw = `${modId}/${l.id}`;
      if (!/^[a-z0-9-]+$/.test(l.id ?? '')) bad(lw, 'lesson id must be lowercase letters, digits and hyphens');
      if (lessonIds.has(l.id)) bad(lw, 'duplicate lesson id');
      lessonIds.add(l.id);
      if (['quiz'].includes(l.id)) bad(lw, 'lesson id is reserved');
      bi(`${lw}.title`, l.title);
      if (!Number.isInteger(l.minutes) || l.minutes < 1 || l.minutes > 20) bad(lw, 'minutes must be a whole number from 1 to 20');
      if (!Array.isArray(l.goals) || l.goals.length < 1 || l.goals.length > 4) bad(lw, 'goals: 1 to 4');
      else l.goals.forEach((g, i) => bi(`${lw}.goals[${i}]`, g));
      if (!Array.isArray(l.terms) || l.terms.length > 8) bad(lw, 'terms: at most 8');
      else for (const t of l.terms) if (!str(t.es) || !str(t.en)) bad(lw, 'terms need es and en');
      if (l.pretest) checkQuestion(`${lw}.pretest`, l.pretest, modId, { bank: false });
      if (!Array.isArray(l.steps) || l.steps.length < 3 || l.steps.length > 8) bad(lw, 'steps: 3 to 8');
      const ctx = { checks: [] };
      (l.steps ?? []).forEach((s, i) => {
        bi(`${lw}.steps[${i}].title`, s.title);
        if (!Array.isArray(s.blocks) || s.blocks.length === 0) bad(`${lw}.steps[${i}]`, 'has no blocks');
        (s.blocks ?? []).forEach((b, j) => checkBlock(`${lw}.steps[${i}].blocks[${j}]`, b, modId, ctx));
      });
      checkCount += ctx.checks.length;
      if (ctx.checks.length < 1) bad(lw, 'needs at least one check question (retrieval practice)');
      if (!Array.isArray(l.recap) || l.recap.length < 3 || l.recap.length > 6) bad(lw, 'recap: 3 to 6 points');
      else l.recap.forEach((r, i) => bi(`${lw}.recap[${i}]`, r));
      if (!Array.isArray(l.src) || l.src.length === 0 || l.src.some((s) => !str(s))) bad(lw, 'src must list the laws or documents the lesson rests on');
      else for (const s of l.src) if (badCitation(s)) bad(lw, `src "${s.slice(0, 60)}...": ${badCitation(s)}`);
      for (const id of l.covers ?? []) {
        if (!bankIds.has(id)) bad(lw, `covers unknown question "${id}"`);
        covered.add(id);
      }
    }
    // Answer positions: a module whose right answer is mostly in one slot teaches a trick, not the rules.
    const pos = quizPool[modId] ?? [];
    if (pos.length >= 6) {
      for (const p of [0, 1, 2]) {
        const share = pos.filter((x) => x === p).length / pos.length;
        if (share > 0.5) bad(mw, `${Math.round(share * 100)}% of the checks have the right answer in position ${p + 1}`);
      }
    }
  }

  // Every written question in a category that has a module must be taught somewhere in it.
  const withModule = new Set([...order, ...moduleFiles]);
  for (const q of questions) {
    if (withModule.has(q.cat) && !covered.has(q.id)) bad(`question ${q.id}`, `is in category "${q.cat}" but no lesson lists it in "covers"`);
  }
  const missingModules = categoryIds.filter((c) => !withModule.has(c));
  if (missingModules.length) notes.push(`categories without a module yet: ${missingModules.join(', ')}`);

  // Figures: no words inside, only the shared parts.
  for (const f of figureFiles) {
    const svg = readFileSync(new URL(`${f}.svg`, figureDir), 'utf8');
    const w = `figure ${f}.svg`;
    if (!/viewBox="[^"]+"/.test(svg)) bad(w, 'needs a viewBox');
    if (/<svg[^>]*\s(width|height)=/.test(svg.split('>')[0] ?? '')) bad(w, 'the root <svg> must not set width or height');
    if (/<script|on\w+=|<image|<foreignObject|href="https?:/i.test(svg)) bad(w, 'contains script, an image or an external link');
    for (const m of svg.matchAll(/<text[^>]*>([^<]*)</g)) {
      if ([...(m[1] ?? '').trim()].length > 2) bad(w, `text "${m[1]}": diagrams hold no words, only one or two characters; explain in the legend`);
    }
    for (const m of svg.matchAll(/<use[^>]*href="#([^"]+)"/g)) {
      if (!['v-car', 'v-truck', 'v-moto', 'v-bike', 'v-ped'].includes(m[1] ?? '')) bad(w, `<use> of unknown shared shape "#${m[1]}"`);
    }
    if (!usedFigures.has(f)) bad(w, 'is not used by any lesson');
    const animPath = new URL(`${f}.anim.json`, figureDir);
    if (existsSync(animPath)) checkScene(`${f}.anim.json`, JSON.parse(readFileSync(animPath, 'utf8')), svg);
  }
  for (const f of readdirSync(figureDir).filter((f) => f.endsWith('.anim.json')))
    if (!figureFiles.has(f.slice(0, -'.anim.json'.length))) bad(f, 'has no matching .svg');

  const signsMissing = signs.filter((s) => !shownSigns.has(s.id)).length;
  if (order.includes('signs') && signsMissing) notes.push(`${signsMissing} of ${signs.length} signs are not shown in any lesson`);

  return { problems, notes, checksPerCat, lessonCount, checkCount, moduleCount: order.length, figureCount: figureFiles.size };
}
