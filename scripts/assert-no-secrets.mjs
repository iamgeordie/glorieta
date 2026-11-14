// Fails the build if the browser bundle in dist/ contains a server-side secret.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSecrets } from './secret-scan.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(dist)) {
  console.error('dist/ does not exist. Run the build first.');
  process.exit(1);
}
const TEXT = /\.(?:js|mjs|css|html|json|map|txt|svg|webmanifest)$/;
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (TEXT.test(name)) files.push(p);
  }
};
walk(dist);
let bad = 0;
for (const f of files) {
  for (const s of findSecrets(readFileSync(f, 'utf8'))) {
    console.error(`${s.name} (${s.preview}) in ${f.slice(dist.length)} at offset ${s.index}`);
    bad++;
  }
}
if (bad) {
  console.error(`The bundle contains ${bad} server secret(s). Aborting.`);
  process.exit(1);
}
console.log(`No server secrets in ${files.length} bundle files.`);
