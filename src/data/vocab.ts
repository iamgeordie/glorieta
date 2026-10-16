import questions from './questions.json';
import { bi, type Bi } from '../i18n';

export type Term = { id: string; es: string; en: string };

/** Extra road vocabulary that the questions do not already teach. */
const extra: Array<[string, string]> = [
  ['el carnet / el permiso de conducir', 'driver license'],
  ['la matrícula', 'license plate'],
  ['el turismo', 'passenger car'],
  ['el remolque', 'trailer'],
  ['la multa', 'fine / ticket'],
  ['los puntos', 'points (on the license)'],
  ['el seguro', 'insurance'],
  ['el peaje', 'toll'],
  ['el área de servicio', 'rest stop / service area'],
  ['el atasco / la retención', 'traffic jam'],
  ['el desvío', 'detour'],
  ['el carril bici', 'bike lane'],
  ['el carril bus', 'bus lane'],
  ['el semáforo', 'traffic light'],
  ['la acera', 'sidewalk'],
  ['la isleta', 'traffic island'],
  ['el resalto / el badén', 'speed bump / dip'],
  ['la curva peligrosa', 'dangerous curve'],
  ['el firme deslizante', 'slippery surface'],
  ['la niebla', 'fog'],
  ['el hielo', 'ice'],
  ['la lluvia', 'rain'],
  ['la nieve', 'snow'],
  ['el viento fuerte', 'strong wind'],
  ['las luces antiniebla', 'fog lights'],
  ['el freno de mano', 'parking brake'],
  ['el embrague', 'clutch'],
  ['el acelerador', 'accelerator'],
  ['la marcha', 'gear'],
  ['el volante', 'steering wheel'],
  ['el retrovisor', 'rear-view mirror'],
  ['el ángulo muerto', 'blind spot'],
  ['el parabrisas', 'windshield'],
  ['el neumático', 'tire'],
  ['la gasolinera', 'gas station'],
  ['la zona azul / ORA', 'metered street parking'],
  ['aparcar / estacionar', 'to park'],
  ['la parada', 'stop (brief halt, e.g. bus stop)'],
  ['el estacionamiento', 'parking (staying put)'],
  ['la velocidad', 'speed'],
  ['adelantar', 'to overtake'],
  ['frenar', 'to brake'],
  ['ceder el paso', 'to yield'],
  ['incorporarse', 'to merge'],
  ['girar', 'to turn'],
  ['cambiar de carril', 'to change lanes'],
  ['dar marcha atrás', 'to reverse'],
  ['la conducción', 'driving'],
  ['el conductor / la conductora', 'driver'],
  ['el peatón / la peatona', 'pedestrian'],
  ['la autoescuela', 'driving school'],
  ['la Jefatura de Tráfico', 'local DGT traffic office'],
  ['el examinador / la examinadora', 'examiner'],
];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

function build(): Term[] {
  const seen = new Set<string>();
  const out: Term[] = [];
  const add = (es: string, en: string) => {
    const id = slug(es);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, es, en });
  };
  for (const q of questions) for (const t of q.terms ?? []) add(t.es, t.en);
  for (const [es, en] of extra) add(es, en);
  return out;
}

export const terms: Term[] = build();

const enEs = (en: string, es: string): Bi => bi(es, en);

export type Phrase = { id: string; say: Bi; do: Bi };

/** What the examiner says in the practical test, and what to do. */
export const phrases: Phrase[] = [
  { id: 'p01', say: bi('Arranque el motor y, cuando pueda, incorpórese a la circulación.', 'Start the engine and, when you can, pull out into traffic.'), do: enEs('Check mirrors, signal, and pull out when it is safe.', 'Revise los espejos, señalice y salga cuando sea seguro.') },
  { id: 'p02', say: bi('Siga recto.', 'Go straight.'), do: enEs('Stay in your lane through the intersection.', 'Continúe en su carril por la intersección.') },
  { id: 'p03', say: bi('Gire a la derecha en la próxima.', 'Turn right at the next one.'), do: enEs('Signal early and turn at the next street on the right.', 'Señalice con antelación y gire en la próxima calle a la derecha.') },
  { id: 'p04', say: bi('Gire a la izquierda en el semáforo.', 'Turn left at the light.'), do: enEs('Get in the left lane, signal, and turn when it is clear.', 'Colóquese en el carril izquierdo, señalice y gire cuando esté libre.') },
  { id: 'p05', say: bi('En la glorieta, tome la segunda salida.', 'At the roundabout, take the second exit.'), do: enEs('Count exits, use the right lane, signal as you leave.', 'Cuente las salidas, use el carril adecuado y señalice al salir.') },
  { id: 'p06', say: bi('Tome la primera a la derecha.', 'Take the first right.'), do: enEs('Do not take the second one. Count the streets.', 'No tome la segunda. Cuente las calles.') },
  { id: 'p07', say: bi('Continúe por esta calle hasta que le diga.', 'Continue along this street until I tell you.'), do: enEs('Keep going straight and wait for the next instruction.', 'Siga recto y espere la siguiente indicación.') },
  { id: 'p08', say: bi('Pare aquí, por favor.', 'Stop here, please.'), do: enEs('Find a safe place to stop, signal, and stop.', 'Busque un lugar seguro, señalice y detenga el vehículo.') },
  { id: 'p09', say: bi('Aparque en el lado derecho.', 'Park on the right-hand side.'), do: enEs('Signal and park parallel to the curb.', 'Señalice y aparque paralelo al bordillo.') },
  { id: 'p10', say: bi('Aparque en batería.', 'Park nose-in (perpendicular).'), do: enEs('Perpendicular parking in a space.', 'Estacionamiento perpendicular en una plaza.') },
  { id: 'p11', say: bi('Aparque en línea, marcha atrás.', 'Parallel park, reversing in.'), do: enEs('Parallel park by reversing into the space.', 'Estacione en paralelo, entrando marcha atrás.') },
  { id: 'p12', say: bi('Dé la vuelta cuando sea seguro.', 'Turn around when it is safe.'), do: enEs('Make a safe U-turn where it is permitted.', 'Haga un cambio de sentido seguro donde esté permitido.') },
  { id: 'p13', say: bi('Adelante, puede pasar.', 'Go ahead, you can go.'), do: enEs('The way is yours; check again before moving.', 'Tiene paso; compruebe de nuevo antes de avanzar.') },
  { id: 'p14', say: bi('Ahora, por favor, incorpórese a la autovía.', 'Now, please, merge onto the highway.'), do: enEs('Use the acceleration lane, match speed, merge.', 'Use el carril de aceleración, iguale la velocidad e incorpórese.') },
  { id: 'p15', say: bi('Ha cometido una falta.', 'You have committed a fault.'), do: enEs('The examiner is noting an error. Stay calm and keep driving.', 'El examinador anota un error. Mantenga la calma y siga conduciendo.') },
  { id: 'p16', say: bi('Hemos terminado el examen.', 'We have finished the exam.'), do: enEs('Park safely, switch off, wait for the result.', 'Aparque con seguridad, apague el motor y espere el resultado.') },
];

export const phraseTitle: Bi = bi('Frases del examinador', 'Examiner phrases');
