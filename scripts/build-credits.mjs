// Writes public/signs/CREDITS.md. Run with: npm run credits
import { readFileSync, writeFileSync } from 'node:fs';
import { renderCredits } from './credits-lib.mjs';

const signs = JSON.parse(readFileSync(new URL('../src/data/signs.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../public/signs/CREDITS.md', import.meta.url), renderCredits(signs));
console.log(`CREDITS.md written for ${signs.length} signs`);
