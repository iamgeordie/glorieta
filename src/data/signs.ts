import raw from './signs.json';
import { bi, type Bi } from '../i18n';

export type SignGroup = 'priority' | 'entry' | 'restriction' | 'speed' | 'prohibition' | 'mandatory' | 'end' | 'warning' | 'indication' | 'lanes' | 'services' | 'presign' | 'direction' | 'roadid' | 'location' | 'confirmation' | 'urban' | 'plates' | 'othersigns' | 'vehicle';

export type Sign = {
  /** Also the file name inside public/signs, without the extension. */
  id: string;
  /** Code in the official catalogue (RGC Anexo I). */
  code: string;
  group: SignGroup;
  name: Bi;
  why: Bi;
  license: string;
  licenseUrl: string;
  author: string;
  /** Title of the file page on Wikimedia Commons, for pictures copied from there. */
  commons?: string;
  /** BOE figure the picture was drawn from, for signs that have no Commons file. */
  drawnFrom?: string;
};

type RawSign = {
  id: string;
  code: string;
  group: SignGroup;
  es: { name: string; why: string };
  en: { name: string; why: string };
  license: string;
  licenseUrl: string;
  author: string;
  commons?: string;
  drawnFrom?: string;
};

export const groupTitles: Record<SignGroup, Bi> = {
  priority: bi('Prioridad', 'Priority'),
  entry: bi('Entrada prohibida', 'No entry'),
  restriction: bi('Restricciones de paso', 'Passage restrictions'),
  speed: bi('Velocidad', 'Speed limits'),
  prohibition: bi('Prohibiciones', 'Prohibitions'),
  mandatory: bi('Obligación', 'Mandatory'),
  end: bi('Fin de prohibición', 'End of restriction'),
  warning: bi('Peligro', 'Warnings'),
  indication: bi('Indicaciones generales', 'General information'),
  lanes: bi('Carriles', 'Lanes'),
  services: bi('Servicios', 'Services'),
  presign: bi('Preseñalización', 'Advance direction signs'),
  direction: bi('Dirección', 'Direction signs'),
  roadid: bi('Identificación de carreteras', 'Road numbers'),
  location: bi('Localización', 'Location signs'),
  confirmation: bi('Confirmación', 'Confirmation signs'),
  urban: bi('Uso específico en poblado', 'Town signs'),
  plates: bi('Paneles complementarios', 'Additional panels'),
  othersigns: bi('Otras señales', 'Other signs'),
  vehicle: bi('Señales en los vehículos', 'Vehicle signs'),
};

export const groupOrder: SignGroup[] = ['priority', 'entry', 'restriction', 'speed', 'prohibition', 'mandatory', 'end', 'warning', 'indication', 'lanes', 'services', 'presign', 'direction', 'roadid', 'location', 'confirmation', 'urban', 'plates', 'othersigns', 'vehicle'];

export const signs: Sign[] = (raw as RawSign[]).map((s) => ({
  id: s.id,
  code: s.code,
  group: s.group,
  name: bi(s.es.name, s.en.name),
  why: bi(s.es.why, s.en.why),
  license: s.license,
  licenseUrl: s.licenseUrl,
  author: s.author,
  commons: s.commons,
  drawnFrom: s.drawnFrom,
}));

export const signFile = (s: Sign) => `/signs/${s.id}.svg`;

/** Where the picture comes from: its Commons file page, or the BOE figure it was drawn from. */
export const commonsPage = (s: Sign) => (s.commons ? `https://commons.wikimedia.org/wiki/File:${s.commons}` : s.drawnFrom ?? '');

/** Creative Commons Attribution licenses (BY, BY-SA) require a credit; public domain and CC0 do not. */
export const needsCredit = (s: Sign) => s.license.startsWith('CC BY');
