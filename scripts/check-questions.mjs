// Validates the question bank before every deploy. Run with: npm run check
import { readFileSync } from 'node:fs';

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
}

for (const id of categoryIds) if (!perCat[id]) problems.push(`category "${id}" has no questions`);

console.log(`${questions.length} questions, answer positions: ${answers.join(' / ')}`);
console.log(Object.entries(perCat).map(([k, v]) => `${k}:${v}`).join('  '));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('OK');
