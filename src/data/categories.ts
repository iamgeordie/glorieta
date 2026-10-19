import { bi, type Bi } from '../i18n';

export type Category = { id: string; name: Bi };

export const categories: Category[] = [
  { id: 'road', name: bi('La vía y los carriles', 'Roads & lanes') },
  { id: 'signs', name: bi('Señales y marcas viales', 'Signs & markings') },
  { id: 'speed', name: bi('Límites de velocidad', 'Speed limits') },
  { id: 'priority', name: bi('Prioridad, cruces y semáforos', 'Right of way, junctions & lights') },
  { id: 'roundabouts', name: bi('Glorietas', 'Roundabouts') },
  { id: 'overtaking', name: bi('Adelantamientos y maniobras', 'Overtaking & maneuvers') },
  { id: 'situations', name: bi('Estacionamiento, autopistas y túneles', 'Parking, motorways & tunnels') },
  { id: 'safety', name: bi('Cinturón, móvil y distancia', 'Seat belts, phones & distance') },
  { id: 'alcohol', name: bi('Alcohol, drogas y fatiga', 'Alcohol, drugs & fatigue') },
  { id: 'hazards', name: bi('Riesgo y usuarios vulnerables', 'Hazards & vulnerable users') },
  { id: 'emergencies', name: bi('Accidentes y primeros auxilios', 'Accidents & first aid') },
  { id: 'equipment', name: bi('Vehículo y equipamiento', 'Vehicle & equipment') },
  { id: 'docs', name: bi('Permisos, puntos y sanciones', 'Licenses, points & penalties') },
  { id: 'examlang', name: bi('Leer el examen', 'Reading the exam') },
];

export const categoryById = (id: string): Category => {
  const c = categories.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
};
