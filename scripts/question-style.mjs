// Profiles how the question bank is worded, against the forms the DGT-style exam uses.
// Reference shares come from 208 questions of a commercial practice bank whose wording follows the
// DGT's (sampled 2026-11-19; the questions themselves are kept privately, not in this repo).
//
//   node scripts/question-style.mjs            # whole bank, then one line per module
//   node scripts/question-style.mjs priority   # one module, listing the checks behind each count
//
// Imported by check-learn.mjs for the two hard rules (exam register, longest-answer giveaway).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../src/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// Unicode-aware whole-word match: JavaScript's \b treats "á" as a word boundary.
const word = (alts, flags = 'iu') => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, flags);

/** Informal "tú" forms. The exam addresses the candidate as "usted" or impersonally ("se debe", "el conductor"). */
export const TU = word(
  'tú|tu|tus|ti|contigo|te|puedes|debes|tienes|conduces|estás|vas|haces|circulas|quieres|llevas|ves|llegas|sales|giras|' +
    'adelantas|paras|aparcas|estacionas|eres|sabes|necesitas|encuentras|notas|oyes|piensas|crees|has|hay que hacer tú|' +
    'detienes|cedes|entras|sigues|cambias|frenas|aceleras|pasas|miras|usas|enciendes|apagas|bebes|tomas|sientes|vives|' +
    'compras|vendes|pagas|recibes|quedas|vuelves|ibas|estabas|conducías|tenías|podrías|deberías|harías|tendrías',
);
const ABS = word('siempre|nunca|jamás|en ningún caso|en cualquier caso|en todo caso|todos|todas|cualquier|exclusivamente|únicamente|solo|sólo|solamente');
const YES = /^(sí|si)(?![\p{L}])/iu;
const NO = /^no(?![\p{L}])/iu;
const PICTURE = word('esta señal|estas señales|esta marca|estas marcas|la imagen|esta situación|esta intersección|este semáforo|este panel|este agente|esta glorieta|esta vía|este tramo|el vehículo (?:rojo|verde|azul|amarillo|blanco|gris)');

/** Each form: label, practice-bank share (0-1), and a test on { s, o, c } (stem, options, correct option). */
export const FORMS = [
  ['Correct option is the longest (a giveaway)', 0.471, ({ o, c }) => c.length === Math.max(...o.map((x) => x.length))],
  ['Informal tú in the question or options', 0, ({ s, o }) => TU.test(s) || o.some((x) => TU.test(x))],
  ['Bare "Sí." or "No." is the answer', 0.048, ({ c }) => /^(sí|si|no)\.?$/iu.test(c.trim())],
  ['Two or more "Sí, ..." options (which yes?)', 0.192, ({ o }) => o.filter((x) => YES.test(x)).length >= 2],
  ['Two or more "No, ..." options (which no?)', 0.072, ({ o }) => o.filter((x) => NO.test(x)).length >= 2],
  ['A reason in an option ("porque")', 0.12, ({ o }) => o.some((x) => word('porque').test(x))],
  ['Absolute word in a wrong option', 0.37, ({ o, c }) => o.some((x) => x !== c && ABS.test(x))],
  ['Negative stem (NO in capitals)', 0.029, ({ s }) => /(?<![\p{L}])NO(?![\p{L}])/u.test(s)],
  ['Completion stem (ends in "..." or ":")', 0.163, ({ s }) => /(\.\.\.|…|:)\s*$/u.test(s)],
  ['Superset option ("X y Y" beside X and Y)', 0.024, ({ o }) => {
    const lo = o.map((x) => x.toLowerCase().replace(/\.$/, ''));
    return lo.some((a, i) => lo.some((b, j) => i !== j && b.length > 3 && a.includes(b) && /\s(y|e)\s/u.test(a)));
  }],
  ['"Como norma general" framing', 0.043, ({ s }) => /como (norma|regla) general|con carácter general|por regla general/iu.test(s)],
  ['Advice, not duty ("aconsejable", "conveniente")', 0.077, ({ s }) => word('aconsejable|conveniente|recomendable|se recomienda|se aconseja|adecuad[ao]s?').test(s)],
  ['Add-on false extra ("y además")', 0.014, ({ o }) => o.some((x) => word('y además|e incluso').test(x))],
  ['Look-alike terms (distancia de frenado / detención / reacción)', 0.048, ({ o }) => {
    const two = o.map((x) => x.split(/\s+/).slice(0, 2).join(' ').toLowerCase());
    return o.length === 3 && new Set(two).size === 1 && o.every((x) => x.split(/\s+/).length > 2);
  }],
  ['Numeric options', 0.101, ({ o }) => o.filter((x) => /\d/.test(x)).length >= 2],
  ['Refers to a picture ("esta señal", "esta situación")', 0.067, ({ s }) => PICTURE.test(s)],
];

/** Every check in the course, with its module id, plus the 70 bank questions under "bank". */
export function allQuestions() {
  const out = [];
  for (const q of read('data/questions.json')) out.push({ module: 'bank', id: q.id, answer: q.answer, es: q.es });
  const dir = new URL('data/learn/modules/', root);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const module = f.slice(0, -5);
    const walk = (x) => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (!x || typeof x !== 'object') return;
      if (x.t === 'check' && x.q) out.push({ module, id: x.q.id, answer: x.q.answer, es: x.q.es });
      for (const v of Object.values(x)) walk(v);
    };
    walk(read(`data/learn/modules/${f}`));
  }
  return out;
}

export function formsOf(q) {
  const s = q.es.q.trim();
  const o = q.es.options.map((x) => x.trim());
  const c = o[q.answer] ?? '';
  return FORMS.map(([label, , test]) => [label, Boolean(test({ s, o, c }))]);
}

function report(qs) {
  const counts = FORMS.map(() => 0);
  for (const q of qs) formsOf(q).forEach(([, hit], i) => (counts[i] += hit));
  return counts;
}

const pct = (n, d) => `${((100 * n) / d).toFixed(1).padStart(5)}%`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const qs = allQuestions();
  const only = process.argv[2];
  if (only) {
    const mine = qs.filter((q) => q.module === only);
    if (!mine.length) throw new Error(`no questions in module "${only}"`);
    const counts = report(mine);
    console.log(`${only}: ${mine.length} questions`);
    FORMS.forEach(([label, ref], i) => {
      console.log(`\n${pct(counts[i], mine.length)}  (practice bank ${pct(ref * 1000, 1000).trim()})  ${label}`);
      for (const q of mine) if (formsOf(q)[i][1]) console.log(`         ${q.id}: ${q.es.q.slice(0, 90)}`);
    });
  } else {
    const counts = report(qs);
    console.log(`Whole bank: ${qs.length} questions\n`);
    console.log('  ours   practice bank   form');
    FORMS.forEach(([label, ref], i) => console.log(`${pct(counts[i], qs.length)}   ${pct(ref * 1000, 1000)}        ${label}`));
    console.log('\nBy module (longest-answer share, tú count, then each other form as a count):');
    const mods = [...new Set(qs.map((q) => q.module))];
    for (const m of mods) {
      const mine = qs.filter((q) => q.module === m);
      const c = report(mine);
      console.log(`  ${m.padEnd(12)} n=${String(mine.length).padStart(4)}  longest ${pct(c[0], mine.length)}  tú ${String(c[1]).padStart(3)}  ` +
        c.slice(2).map((n) => String(n).padStart(3)).join(''));
    }
  }
}
