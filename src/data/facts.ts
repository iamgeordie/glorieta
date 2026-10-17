import { bi, type Bi } from '../i18n';

export type Confidence = 'official' | 'secondary' | 'verify';

export type Fact = { text: Bi; confidence: Confidence };
export type FactGroup = { title: Bi; facts: Fact[] };

/** Exam length in minutes: 1 minute per question (RGCond Anexo VI B.2), so 30 for 30 questions; it grows with video length. */
export const EXAM_MINUTES = 30;
export const EXAM_QUESTIONS = 30;
export const EXAM_MAX_ERRORS = 3;

export const confidenceLabel: Record<Confidence, Bi> = {
  official: bi('Fuente oficial', 'Official source'),
  secondary: bi('Fuente no oficial', 'Secondary source'),
  verify: bi('Comprobar', 'Verify'),
};

export const factGroups: FactGroup[] = [
  {
    title: bi('El examen teórico', 'The theory exam'),
    facts: [
      { text: bi('30 preguntas de test con tres opciones.', '30 multiple-choice questions with three options.'), confidence: 'official' },
      { text: bi('Se aprueba con un máximo de 3 fallos. La norma permite errores hasta el 10 % de las preguntas, redondeando hacia arriba: con 30 preguntas, 3.', 'You pass with at most 3 mistakes. The regulation allows errors up to 10% of the questions, rounded up: with 30 questions, that is 3.'), confidence: 'official' },
      { text: bi('Tienes 1 minuto por pregunta: 30 minutos con 30 preguntas. El tiempo se amplía en proporción a la duración de los vídeos.', 'You get 1 minute per question: 30 minutes with 30 questions. The time is extended in proportion to the length of the videos.'), confidence: 'official' },
      { text: bi('La DGT anunció en octubre de 2025 una pregunta con un vídeo de una situación de riesgo (hasta 3 visionados antes de ver la pregunta), prevista para el último trimestre de ese año. Su página de examen actual no la menciona: comprueba en dgt.es si ya se aplica en tu fecha.', 'In October 2025 the DGT announced a question with a video of a risk situation (up to 3 viewings before the question appears), planned for the last quarter of that year. Its current exam page does not mention it: check dgt.es to see whether it applies on your date.'), confidence: 'verify' },
      { text: bi('El aprobado del teórico vale dos años. La tasa incluye dos intentos.', 'A theory pass is valid for two years. The fee includes two attempts.'), confidence: 'official' },
    ],
  },
  {
    title: bi('Idioma del examen', 'Exam language'),
    facts: [
      { text: bi('El impreso oficial de solicitud (Mod. 04) permite elegir castellano, inglés, francés o alemán para el teórico del permiso B.', 'The official application form (Mod. 04) lets you choose Spanish, English, French or German for the permiso B theory test.'), confidence: 'official' },
      { text: bi('Confirma en tu Jefatura qué idiomas hay disponibles en tu fecha.', 'Confirm with your local Jefatura which languages are available on your date.'), confidence: 'verify' },
      { text: bi('El examen práctico es en español.', 'The practical test is in Spanish.'), confidence: 'secondary' },
    ],
  },
  {
    title: bi('Tu permiso estadounidense', 'Your US license'),
    facts: [
      { text: bi('EE. UU. no figura en la lista de países con convenio de canje de la DGT, así que hay que hacer el teórico y el práctico.', 'The US is not on the DGT list of countries with a license exchange agreement, so you take both the theory and practical tests.'), confidence: 'official' },
      { text: bi('Un permiso extranjero vale como máximo seis meses desde que adquieres la residencia normal en España. Confirma tu caso con un gestor.', 'A foreign license is valid for at most six months from when you become a normal resident of Spain. Confirm your case with a gestor.'), confidence: 'official' },
    ],
  },
];

export const usVsSpain: Bi[] = [
  bi('Sin señales, tiene prioridad el que viene por la derecha.', 'With no signs, the vehicle coming from the right has priority.'),
  bi('No hay giro a la derecha con el semáforo en rojo.', 'There is no right turn on red.'),
  bi('En las glorietas cede el que entra al que ya circula.', 'In roundabouts, the entering driver yields to the one already circulating.'),
  bi('Las velocidades están en km/h: 30 km/h ≈ 19 mph, 50 ≈ 31, 90 ≈ 56, 120 ≈ 75.', 'Speeds are in km/h: 30 ≈ 19 mph, 50 ≈ 31, 90 ≈ 56, 120 ≈ 75.'),
  bi('El límite de alcohol es 0,25 mg/l en aire (0,5 g/l); EE. UU. usa 0,08 % (0,8 g/l).', 'The alcohol limit is 0.25 mg/L breath (0.5 g/L); the US uses 0.08% (0.8 g/L).'),
  bi('Las líneas centrales son blancas, no amarillas.', 'Center lines are white, not yellow.'),
  bi('Las señales de orientación de autopista son azules, no verdes.', 'Motorway direction signs are blue, not green.'),
  bi('El número de emergencias es el 112, no el 911.', 'The emergency number is 112, not 911.'),
  bi('El claxon solo se usa para evitar un accidente en poblado.', 'The horn is only for avoiding an accident in built-up areas.'),
  bi('En autopista se circula por la derecha y se adelanta por la izquierda.', 'On motorways you keep right and pass on the left.'),
];

export type SourceLink = { label: string; href: string };

export const sources: SourceLink[] = [
  { label: 'DGT: requisitos, preparación y presentación a examen', href: 'https://www.dgt.es/nuestros-servicios/permisos-de-conducir/obtener-un-nuevo-permiso-de-conducir/requisitos-preparacion-y-presentacion-a-examen/' },
  { label: 'Revista DGT: cambios en el examen teórico (oct. 2025)', href: 'https://revista.dgt.es/es/reportajes/2025/10OCTUBRE/1015N275-_CambiosTeorico.shtml' },
  { label: 'Sede electrónica DGT: impreso Mod. 04 (idioma del examen)', href: 'https://sede.dgt.gob.es/.galleries/modelos-solicitud/04/Mod.04-ES.pdf' },
  { label: 'BOE: Reglamento General de Circulación (RD 1428/2003)', href: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514' },
  { label: 'BOE: Ley de Tráfico y Seguridad Vial (RDL 6/2015)', href: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722' },
  { label: 'BOE: Reglamento General de Conductores (RD 818/2009), Anexo VI y art. 21', href: 'https://www.boe.es/buscar/act.php?id=BOE-A-2009-9481' },
  { label: 'DGT: países con convenio de canje de permisos', href: 'https://www.dgt.es/nuestros-servicios/permisos-de-conducir/permisos-extranjeros-y-de-fuerzas-y-cuerpos-de-seguridad/canjes-de-permisos/paises-con-convenio-de-canjes/' },
];

/** Abbreviations used in the `src` line under each question. */
export const abbreviations: Array<[string, string]> = [
  ['RGC', 'Reglamento General de Circulación (RD 1428/2003)'],
  ['Ley', 'Ley de Tráfico y Seguridad Vial (RDL 6/2015)'],
  ['RGV', 'Reglamento General de Vehículos (RD 2822/1998)'],
  ['RGCond', 'Reglamento General de Conductores (RD 818/2009)'],
];
