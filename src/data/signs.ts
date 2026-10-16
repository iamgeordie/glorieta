import raw from './signs.json';
import { bi, type Bi } from '../i18n';

export type SignGroup = 'priority' | 'entry' | 'restriction' | 'speed' | 'prohibition' | 'mandatory' | 'end' | 'warning';

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
  /** Title of the file page on Wikimedia Commons. */
  commons: string;
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
  commons: string;
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
};

export const groupOrder: SignGroup[] = ['priority', 'entry', 'restriction', 'speed', 'prohibition', 'mandatory', 'end', 'warning'];

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
}));

export const signFile = (s: Sign) => `/signs/${s.id}.svg`;

export const commonsPage = (s: Sign) => `https://commons.wikimedia.org/wiki/File:${s.commons}`;

/** Creative Commons Attribution licenses (BY, BY-SA) require a credit; public domain and CC0 do not. */
export const needsCredit = (s: Sign) => s.license.startsWith('CC BY');
