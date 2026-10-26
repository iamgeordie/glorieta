import { bi, type Bi } from '../i18n';

/**
 * The app teaches in American English, but the official English exam may be translated with British
 * words (a learner reported "verge" for "shoulder"). Every American road term here has its British
 * counterpart; the app shows it beside the American one, labelled "UK". These pairs are standard British
 * driving vocabulary, not quotations from the exam.
 */
export type BritishTerm = { es: string; us: string; uk: string; note?: Bi };

export const glossary: BritishTerm[] = [
  { es: 'el arcén', us: 'shoulder', uk: 'verge', note: bi('En una autopista, la franja pavimentada se llama "hard shoulder".', 'On a motorway the paved strip is called the "hard shoulder".') },
  { es: 'ceda el paso', us: 'yield', uk: 'give way' },
  { es: 'la intersección / el cruce', us: 'intersection', uk: 'junction' },
  { es: 'la acera', us: 'sidewalk', uk: 'pavement' },
  { es: 'el bordillo', us: 'curb', uk: 'kerb' },
  { es: 'el vado', us: 'curb cut (driveway)', uk: 'dropped kerb' },
  { es: 'la mediana', us: 'median', uk: 'central reservation' },
  { es: 'la autopista', us: 'freeway', uk: 'motorway' },
  { es: 'la autovía', us: 'divided highway', uk: 'dual carriageway' },
  { es: 'adelantar', us: 'to pass', uk: 'to overtake' },
  { es: 'el camión', us: 'truck', uk: 'lorry' },
  { es: 'la grúa', us: 'tow truck', uk: 'recovery vehicle (breakdown truck)' },
  { es: 'el turismo', us: 'passenger car', uk: 'car' },
  { es: 'el intermitente', us: 'turn signal', uk: 'indicator' },
  { es: 'la luz de cruce', us: 'low beam', uk: 'dipped beam' },
  { es: 'la luz de carretera (larga)', us: 'high beam', uk: 'main beam (full beam)' },
  { es: 'las luces de emergencia', us: 'hazard lights', uk: 'hazard warning lights' },
  { es: 'las luces antiniebla', us: 'fog lights', uk: 'fog lamps' },
  { es: 'el freno de mano / de estacionamiento', us: 'parking brake', uk: 'handbrake' },
  { es: 'el parabrisas', us: 'windshield', uk: 'windscreen' },
  { es: 'el neumático', us: 'tire', uk: 'tyre' },
  { es: 'la matrícula', us: 'license plate', uk: 'number plate' },
  { es: 'el permiso de conducir', us: "driver's license", uk: 'driving licence' },
  { es: 'la gasolinera', us: 'gas station', uk: 'petrol station' },
  { es: 'la gasolina', us: 'gas (gasoline)', uk: 'petrol' },
  { es: 'el capó', us: 'hood', uk: 'bonnet' },
  { es: 'el maletero', us: 'trunk', uk: 'boot' },
  { es: 'el desvío', us: 'detour', uk: 'diversion' },
  { es: 'el área de servicio / de descanso', us: 'rest stop', uk: 'lay-by / service area' },
  { es: 'el resalto', us: 'speed bump', uk: 'speed hump' },
  { es: 'el aparcamiento', us: 'parking lot', uk: 'car park' },
  { es: 'el carril bici', us: 'bike lane', uk: 'cycle lane' },
  { es: 'el semáforo', us: 'traffic light', uk: 'traffic lights' },
  { es: 'la denuncia', us: 'traffic ticket', uk: 'fine' },
  { es: 'apartarse (a un lado)', us: 'to pull over', uk: 'to pull in' },
];

/** Ordered, longest first: each rule rewrites an American phrase inside an English gloss. */
const rules: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\s*\((?:freeway|freeway-like road)\)/gi, ''],
  [/\bdriver['’]s license\b/gi, 'driving licence'],
  [/\bdriver license\b/gi, 'driving licence'],
  [/\blicense plate\b/gi, 'number plate'],
  [/\blicense\b/gi, 'licence'],
  [/\bdivided highway\b/gi, 'dual carriageway'],
  [/\bfreeway\b/gi, 'motorway'],
  [/\b(?:hard )?shoulder\b/gi, 'verge'],
  [/\byield\b/gi, 'give way'],
  [/\bintersection\b/gi, 'junction'],
  [/\bsidewalk\b/gi, 'pavement'],
  [/\bcurb cut\b/gi, 'dropped kerb'],
  [/\bcurb\b/gi, 'kerb'],
  [/\bmedian\b/gi, 'central reservation'],
  [/\bto pass\b/gi, 'to overtake'],
  [/\bpass on\b/gi, 'overtake on'],
  [/\bpassing\b/gi, 'overtaking'],
  [/\btow truck\b/gi, 'recovery vehicle'],
  [/\btruck\b/gi, 'lorry'],
  [/\bpassenger car\b/gi, 'car'],
  [/\bturn signal\b/gi, 'indicator'],
  [/\blow beam\b/gi, 'dipped beam'],
  [/\bhigh beam\b/gi, 'main beam'],
  [/\bhazard lights\b/gi, 'hazard warning lights'],
  [/\bfog lights\b/gi, 'fog lamps'],
  [/\bparking brake\b/gi, 'handbrake'],
  [/\bwindshield\b/gi, 'windscreen'],
  [/\btires\b/gi, 'tyres'],
  [/\btire\b/gi, 'tyre'],
  [/\bgas station\b/gi, 'petrol station'],
  [/\brest stop\b/gi, 'lay-by'],
  [/\bdetour\b/gi, 'diversion'],
  [/\bspeed bump\b/gi, 'speed hump'],
  [/\bbike lane\b/gi, 'cycle lane'],
  [/\btraffic light\b/gi, 'traffic lights'],
  [/\btraffic ticket\b/gi, 'fine'],
  [/\bparking lot\b/gi, 'car park'],
  [/\bpull over\b/gi, 'pull in'],
];

/** Drops repeats left behind when two alternatives map to one word: "give way / give way", "to overtake, to overtake". */
function tidy(s: string): string {
  const dedupe = (text: string, sep: string) => {
    const parts = text.split(sep);
    if (parts.some((p) => /[()]/.test(p))) return text;
    const seen = new Set<string>();
    return parts.filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase())).join(sep);
  };
  return dedupe(dedupe(s, ' / '), ', ');
}

/**
 * The British wording of an English gloss, or null when it is already the same.
 * ("hard shoulder" -> "verge", "to merge" is left alone: British English merges too.)
 */
export function toBritish(en: string): string | null {
  // "Passing side" signs are about passing an obstacle, which is not overtaking.
  if (/\bpassing side\b/i.test(en)) return null;
  let out = en;
  for (const [re, to] of rules) out = out.replace(re, to as string);
  out = tidy(out);
  if (/^[A-Z]/.test(en)) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out === en ? null : out;
}
