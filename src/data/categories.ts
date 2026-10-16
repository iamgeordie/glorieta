import { bi, type Bi } from '../i18n';

export type Category = { id: string; name: Bi };

export const categories: Category[] = [
  { id: 'speed', name: bi('Límites de velocidad', 'Speed limits') },
  { id: 'priority', name: bi('Prioridad y semáforos', 'Right of way & signals') },
  { id: 'roundabouts', name: bi('Glorietas', 'Roundabouts') },
  { id: 'overtaking', name: bi('Adelantamientos y líneas', 'Overtaking & lines') },
  { id: 'alcohol', name: bi('Alcohol, drogas y fatiga', 'Alcohol, drugs & fatigue') },
  { id: 'safety', name: bi('Cinturón, móvil y distancia', 'Seat belts, phones & distance') },
  { id: 'docs', name: bi('Permisos y puntos', 'Licenses & points') },
  { id: 'signs', name: bi('Señales y marcas viales', 'Signs & markings') },
  { id: 'equipment', name: bi('Vehículo y equipamiento', 'Vehicle & equipment') },
  { id: 'situations', name: bi('Estacionamiento, autopistas y emergencias', 'Parking, motorways & emergencies') },
  { id: 'hazards', name: bi('Percepción del riesgo', 'Hazard perception') },
];

export const categoryById = (id: string): Category => {
  const c = categories.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
};
