// Validates the question bank before every deploy. Run with: npm run check
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { renderCredits } from './credits-lib.mjs';
import { checkLearn, badCitation } from './check-learn.mjs';

const questions = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'));
const categoriesSrc = readFileSync(new URL('../src/data/categories.ts', import.meta.url), 'utf8');
const categoryIds = [...categoriesSrc.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);

const problems = [];
const ids = new Set();
const answers = [0, 0, 0];
const perCat = {};

for (const q of questions) {
  const where = q.id ?? '(no id)';
  if (!q.id || ids.has(q.id)) problems.push(`${where}: missing or duplicate id`);
  ids.add(q.id);
  if (!categoryIds.includes(q.cat)) problems.push(`${where}: unknown category "${q.cat}"`);
  perCat[q.cat] = (perCat[q.cat] ?? 0) + 1;
  if (![0, 1, 2].includes(q.answer)) problems.push(`${where}: answer must be 0, 1 or 2`);
  else answers[q.answer]++;
  for (const lang of ['en', 'es']) {
    const v = q[lang];
    if (!v?.q?.trim()) problems.push(`${where}: ${lang}.q is empty`);
    if (!v?.why?.trim()) problems.push(`${where}: ${lang}.why is empty`);
    if (!Array.isArray(v?.options) || v.options.length !== 3 || v.options.some((o) => !o?.trim()))
      problems.push(`${where}: ${lang}.options must be exactly 3 non-empty strings`);
    else if (new Set(v.options).size !== 3) problems.push(`${where}: ${lang}.options contains duplicates`);
  }
  if (q.note && (!q.note.es?.trim() || !q.note.en?.trim())) problems.push(`${where}: note needs both es and en`);
  if (!q.src?.trim()) problems.push(`${where}: missing src`);
  else if (badCitation(q.src)) problems.push(`${where}: ${badCitation(q.src)}`);
}

// Signs: every entry is complete, has its SVG, no SVG sits unused, and CREDITS.md is current.
const signs = JSON.parse(readFileSync(new URL('../src/data/signs.json', import.meta.url), 'utf8'));
const signDir = new URL('../public/signs/', import.meta.url);
const signGroups = ['priority', 'entry', 'restriction', 'speed', 'prohibition', 'mandatory', 'end', 'warning'];
const licenses = ['Public domain', 'CC0', 'CC BY-SA 3.0', 'CC BY-SA 4.0'];
const signIds = new Set();
for (const s of signs) {
  const where = `sign "${s.id}"`;
  if (signIds.has(s.id)) problems.push(`${where}: duplicate id`);
  signIds.add(s.id);
  if (!existsSync(new URL(`${s.id}.svg`, signDir))) problems.push(`${where}: public/signs/${s.id}.svg is missing`);
  if (!signGroups.includes(s.group)) problems.push(`${where}: unknown group "${s.group}"`);
  for (const lang of ['es', 'en']) {
    if (!s[lang]?.name?.trim() || !s[lang]?.why?.trim()) problems.push(`${where}: ${lang} name and why are required`);
  }
  if (!licenses.includes(s.license)) problems.push(`${where}: unexpected license "${s.license}"`);
  if (!s.commons?.trim()) problems.push(`${where}: missing Commons file title`);
  if (s.license.startsWith('CC BY')) {
    if (!s.author?.trim() || s.author === 'Unknown author') problems.push(`${where}: ${s.license} requires a named author`);
    if (!s.licenseUrl?.startsWith('https://creativecommons.org/')) problems.push(`${where}: ${s.license} requires a license URL`);
  }
}
for (const f of readdirSync(signDir).filter((f) => f.endsWith('.svg')))
  if (!signIds.has(f.slice(0, -4))) problems.push(`public/signs/${f} is not listed in signs.json`);
// The logo claim in CREDITS.md only holds while the favicon is an untouched copy of the sign.
const faviconPath = new URL('../public/favicon.svg', import.meta.url);
const signPath = new URL('r-402.svg', signDir);
if (!existsSync(faviconPath) || !readFileSync(faviconPath).equals(readFileSync(signPath)))
  problems.push('public/favicon.svg must be a byte-identical copy of public/signs/r-402.svg (it is credited as unmodified)');
const credits = existsSync(new URL('CREDITS.md', signDir)) ? readFileSync(new URL('CREDITS.md', signDir), 'utf8') : '';
if (credits !== renderCredits(signs)) problems.push('public/signs/CREDITS.md is out of date; run npm run credits');

// The course: lessons, check questions and diagrams.
const learn = checkLearn({ questions, signs, categoryIds });
problems.push(...learn.problems);

// A category's questions are the bank's plus the checks written into its lesson.
for (const id of categoryIds) if (!perCat[id] && !learn.checksPerCat[id]) problems.push(`category "${id}" has no questions`);

console.log(`${questions.length} text questions, answer positions: ${answers.join(' / ')}; ${signs.length} sign questions generated from signs.json`);
console.log(Object.entries(perCat).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`course: ${learn.moduleCount} modules, ${learn.lessonCount} lessons, ${learn.checkCount} check questions, ${learn.figureCount} figures`);
for (const n of learn.notes) console.log(`note: ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('OK');
