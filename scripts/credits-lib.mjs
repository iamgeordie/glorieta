// Renders public/signs/CREDITS.md from src/data/signs.json, so the attribution cannot drift from the data.
export function renderCredits(signs) {
  const needs = (s) => s.license.startsWith('CC BY');
  const count = (pred) => signs.filter(pred).length;
  const page = (s) => (s.commons ? `https://commons.wikimedia.org/wiki/File:${s.commons}` : s.drawnFrom);
  const fromCommons = signs.filter((s) => s.commons);
  const drawn = signs.filter((s) => !s.commons);
  const row = (s) => `| \`${s.id}.svg\` | ${s.code} | ${s.license} | ${s.author} | ${page(s)} |`;
  const byLicense = (name) => signs.filter((s) => s.license === name);

  const lines = [
    '# Sign image credits',
    '',
    'Most SVG files in this folder are Spanish traffic sign drawings from',
    '[Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Road_signs_of_Spain).',
    'They are **unmodified copies** of the files named in the tables below. Each keeps the',
    'license it has on Commons; the Apache-2.0 license of this project does not apply to them.',
    'The vehicle signs listed last have no Commons file and were drawn for Glorieta from the figures in the regulation itself.',
    '',
    'The R-402 roundabout sign is also the app logo: `public/favicon.svg` is a byte-identical copy of `r-402.svg`, and the splash page draws the file unmodified, only rotating it as a whole. `public/brand/glorieta-icon.png` is the same sign rendered as a 512 px PNG, for the Stripe checkout page.',
    '',
    `This file is generated from \`src/data/signs.json\` by \`npm run credits\`. Do not edit it by hand.`,
    '',
    `Totals: ${signs.length} signs. ${count((s) => s.license === 'Public domain')} public domain, ${count((s) => s.license === 'CC0')} CC0, ${count(needs)} Creative Commons Attribution or Attribution-ShareAlike (credit required).`,
    '',
    '## Attribution required (Creative Commons BY and BY-SA)',
    '',
    'Credit goes to the author named in the table, with a link to the Commons file page and to the license.',
    '',
    'Licenses: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).',
    '',
    '| File | Code | License | Author | Source |',
    '|---|---|---|---|---|',
    ...fromCommons.filter(needs).map(row),
    '',
    '## CC0 (no attribution required; authors listed as a courtesy)',
    '',
    '| File | Code | License | Author | Source |',
    '|---|---|---|---|---|',
    ...byLicense('CC0').filter((s) => s.commons).map(row),
    '',
    '## Public domain (no attribution required)',
    '',
    'Marked "Public domain" on their Commons file pages. Where Commons names an author or',
    'issuing body, it is listed.',
    '',
    '| File | Code | License | Author | Source |',
    '|---|---|---|---|---|',
    ...byLicense('Public domain').filter((s) => s.commons).map(row),
    '',
    '## Drawn for Glorieta from the regulation',
    '',
    'Drawn from the figures of the Reglamento General de Vehículos (RD 2822/1998), Anexo XI, as published in the BOE.',
    'Legal and regulatory texts are not subject to copyright in Spain (Ley de Propiedad Intelectual, art. 13), and these',
    'drawings are dedicated to the public domain.',
    '',
    '| File | Code | License | Author | Source |',
    '|---|---|---|---|---|',
    ...drawn.map(row),
    '',
  ];
  return lines.join('\n');
}
