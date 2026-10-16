import { bi, type Bi } from '../i18n';

export type SignGroup = 'priority' | 'prohibition' | 'speed' | 'mandatory' | 'warning';

export type Credit = 'public-domain' | { license: string; author: string };

export type Sign = {
  /** File name inside public/signs, without the extension. */
  id: string;
  /** Code in the official catalogue (RGC Anexo I). */
  code: string;
  group: SignGroup;
  name: Bi;
  why: Bi;
  credit: Credit;
};

export const groupTitles: Record<SignGroup, Bi> = {
  priority: bi('Prioridad', 'Priority'),
  prohibition: bi('Prohibiciones', 'Prohibitions'),
  speed: bi('Velocidad', 'Speed limits'),
  mandatory: bi('Obligación', 'Mandatory'),
  warning: bi('Peligro', 'Warnings'),
};

export const groupOrder: SignGroup[] = ['priority', 'prohibition', 'speed', 'mandatory', 'warning'];

const pd = 'public-domain' as const;

export const signs: Sign[] = [
  { id: 'r-1', code: 'R-1', group: 'priority', credit: pd, name: bi('Ceda el paso', 'Yield'), why: bi('Debe ceder el paso a los vehículos de la vía en la que entra, y detenerse solo si es necesario.', 'Give way to traffic on the road you are entering, and stop only if necessary.') },
  { id: 'r-2', code: 'R-2', group: 'priority', credit: pd, name: bi('STOP (detención obligatoria)', 'STOP (mandatory stop)'), why: bi('Debe detenerse por completo ante la línea de detención, aunque no vengan vehículos, y ceder el paso.', 'Stop completely at the stop line, even if no traffic is coming, and give way.') },
  { id: 'r-3', code: 'R-3', group: 'priority', credit: pd, name: bi('Calzada con prioridad', 'Priority road'), why: bi('Tiene prioridad en las intersecciones hasta que otra señal la anule.', 'You have priority at intersections until another sign ends it.') },
  { id: 'r-4', code: 'R-4', group: 'priority', credit: pd, name: bi('Fin de prioridad', 'End of priority road'), why: bi('Termina la prioridad de la calzada. Vuelven a aplicarse las normas generales.', 'Priority ends here. The general rules apply again.') },

  { id: 'r-100', code: 'R-100', group: 'prohibition', credit: pd, name: bi('Circulación prohibida', 'No vehicles'), why: bi('No puede circular ningún vehículo por esta vía, salvo las excepciones que indique un panel.', 'No vehicles may use this road, apart from any exceptions shown on a panel.') },
  { id: 'r-101', code: 'R-101', group: 'prohibition', credit: pd, name: bi('Entrada prohibida', 'No entry'), why: bi('No puede entrar en esta vía en ese sentido.', 'You may not enter this road in this direction.') },
  { id: 'r-302', code: 'R-302', group: 'prohibition', credit: pd, name: bi('Giro a la derecha prohibido', 'No right turn'), why: bi('No puede girar a la derecha en la próxima intersección.', 'You may not turn right at the next intersection.') },
  { id: 'r-303', code: 'R-303', group: 'prohibition', credit: pd, name: bi('Giro a la izquierda prohibido', 'No left turn'), why: bi('No puede girar a la izquierda en la próxima intersección.', 'You may not turn left at the next intersection.') },
  { id: 'r-304', code: 'R-304', group: 'prohibition', credit: pd, name: bi('Media vuelta prohibida', 'No U-turn'), why: bi('No puede cambiar de sentido en este lugar.', 'You may not turn around here.') },
  { id: 'r-305', code: 'R-305', group: 'prohibition', credit: pd, name: bi('Adelantamiento prohibido', 'No overtaking'), why: bi('No puede adelantar a otros vehículos de motor, salvo motocicletas de dos ruedas, hasta la señal de fin.', 'You may not overtake other motor vehicles, except two-wheeled motorcycles, until the end sign.') },
  { id: 'r-307', code: 'R-307', group: 'prohibition', credit: pd, name: bi('Parada y estacionamiento prohibido', 'No stopping or parking'), why: bi('No puede parar ni estacionar en ese lado de la vía.', 'You may neither stop nor park on that side of the road.') },
  { id: 'r-308', code: 'R-308', group: 'prohibition', credit: pd, name: bi('Estacionamiento prohibido', 'No parking'), why: bi('No puede estacionar. Una parada breve sí está permitida.', 'You may not park. A brief stop is allowed.') },

  { id: 'r-301-30', code: 'R-301', group: 'speed', credit: pd, name: bi('Velocidad máxima: 30 km/h', 'Maximum speed: 30 km/h'), why: bi('No puede superar los 30 km/h.', 'You may not exceed 30 km/h.') },
  { id: 'r-301-50', code: 'R-301', group: 'speed', credit: pd, name: bi('Velocidad máxima: 50 km/h', 'Maximum speed: 50 km/h'), why: bi('No puede superar los 50 km/h.', 'You may not exceed 50 km/h.') },
  { id: 'r-301-90', code: 'R-301', group: 'speed', credit: pd, name: bi('Velocidad máxima: 90 km/h', 'Maximum speed: 90 km/h'), why: bi('No puede superar los 90 km/h.', 'You may not exceed 90 km/h.') },

  { id: 'r-400a', code: 'R-400a', group: 'mandatory', credit: { license: 'CC BY-SA 3.0', author: 'Gigillo83' }, name: bi('Sentido obligatorio', 'Mandatory direction'), why: bi('Solo puede avanzar en el sentido que indica la flecha.', 'You may only proceed in the direction the arrow shows.') },
  { id: 'r-402', code: 'R-402', group: 'mandatory', credit: { license: 'CC BY-SA 4.0', author: 'Majafego' }, name: bi('Glorieta (sentido giratorio obligatorio)', 'Roundabout (mandatory circulation)'), why: bi('Debe circular por la glorieta en el sentido que indican las flechas.', 'Circulate around the roundabout in the direction the arrows show.') },

  { id: 'p-2', code: 'P-2', group: 'warning', credit: pd, name: bi('Intersección con prioridad a la derecha', 'Intersection with priority to the right'), why: bi('Se aproxima a un cruce donde tiene prioridad quien llega por la derecha.', 'You are approaching a crossing where traffic from the right has priority.') },
  { id: 'p-3', code: 'P-3', group: 'warning', credit: pd, name: bi('Semáforos', 'Traffic lights ahead'), why: bi('Hay un semáforo próximo. Prepárese para detenerse.', 'There is a traffic light ahead. Be ready to stop.') },
  { id: 'p-4', code: 'P-4', group: 'warning', credit: pd, name: bi('Glorieta próxima', 'Roundabout ahead'), why: bi('Hay una glorieta próxima. Reduzca la velocidad y prepárese para ceder el paso.', 'A roundabout is ahead. Slow down and be ready to yield.') },
  { id: 'p-7', code: 'P-7', group: 'warning', credit: pd, name: bi('Paso a nivel con barreras', 'Level crossing with barriers'), why: bi('Hay un cruce con el ferrocarril con barreras. Esté preparado para detenerse.', 'A railway crossing with barriers is ahead. Be ready to stop.') },
  { id: 'p-13a', code: 'P-13a', group: 'warning', credit: pd, name: bi('Curva peligrosa a la derecha', 'Dangerous curve to the right'), why: bi('Hay una curva peligrosa a la derecha. Reduzca la velocidad.', 'A dangerous curve to the right is ahead. Slow down.') },
  { id: 'p-15', code: 'P-15', group: 'warning', credit: pd, name: bi('Perfil irregular', 'Uneven road surface'), why: bi('La calzada tiene baches o badenes. Modere la velocidad.', 'The road has bumps or dips. Reduce speed.') },
  { id: 'p-18', code: 'P-18', group: 'warning', credit: pd, name: bi('Obras', 'Roadworks'), why: bi('Hay trabajos en la vía. Modere la velocidad.', 'Work is under way on the road. Reduce speed.') },
  { id: 'p-19', code: 'P-19', group: 'warning', credit: pd, name: bi('Pavimento deslizante', 'Slippery road'), why: bi('El pavimento puede estar resbaladizo. Reduzca la velocidad y evite frenar bruscamente.', 'The surface may be slippery. Slow down and avoid hard braking.') },
  { id: 'p-21', code: 'P-21', group: 'warning', credit: pd, name: bi('Niños', 'Children'), why: bi('Hay un lugar frecuentado por niños, como un colegio. Extreme la precaución.', 'Children are often here, for example near a school. Take extra care.') },
  { id: 'p-22', code: 'P-22', group: 'warning', credit: pd, name: bi('Ciclistas', 'Cyclists'), why: bi('Puede haber ciclistas en la calzada o cruzándola.', 'Cyclists may be on or crossing the road.') },
  { id: 'p-24', code: 'P-24', group: 'warning', credit: pd, name: bi('Animales en libertad', 'Wild animals'), why: bi('Pueden cruzar la vía animales salvajes.', 'Wild animals may cross the road.') },
  { id: 'p-26', code: 'P-26', group: 'warning', credit: pd, name: bi('Desprendimientos', 'Falling rocks'), why: bi('Pueden caer piedras a la calzada.', 'Rocks may fall onto the road.') },
];

export const signFile = (s: Sign) => `/signs/${s.id}.svg`;

/** The file page on Wikimedia Commons, for credits. R-2 is filed under its 1992 design. */
export const commonsPage = (s: Sign) => {
  const name = s.id === 'r-2' ? 'r2_1992' : s.id.replace('-', '');
  return `https://commons.wikimedia.org/wiki/File:Spain_traffic_signal_${name}.svg`;
};
