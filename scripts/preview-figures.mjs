// Screenshots lesson diagrams from the running dev server, so they can be checked by eye.
//
//   node scripts/preview-figures.mjs <output dir> <name[,name...]|all> [--at 2.5[,4,6]] [--dark] [--url http://localhost:5199]
//
// It opens the dev-only #/figures page in headless Chrome, which draws each diagram with the real
// Figure component (animations included) at the given second(s). --at takes a comma list for several
// frames of one animation. The dev server must already be running (npm run dev); this script does
// not start one. Writes <dir>/<name>-<seconds>s-<light|dark>.png and prints the paths.
// Needs Google Chrome in /Applications (macOS).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const [, v] = args.splice(i, 2);
  return v;
};
const dark = args.includes('--dark');
if (dark) args.splice(args.indexOf('--dark'), 1);
const url = flag('--url') ?? 'http://localhost:5199';
const at = (flag('--at') ?? '').split(',').filter(Boolean);
const [outArg, namesArg] = args;
if (!outArg || !namesArg) {
  console.error('usage: node scripts/preview-figures.mjs <output dir> <name[,name...]|all> [--at 2.5[,4]] [--dark] [--url ...]');
  process.exit(2);
}

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) {
  console.error('Google Chrome not found at /Applications; cannot render.');
  process.exit(1);
}
try {
  await fetch(url);
} catch {
  console.error(`No dev server at ${url}. Start one with: npm run dev -- --port 5199`);
  process.exit(1);
}

const dir = join(root, 'src/learn-figures');
const all = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
const names = namesArg === 'all' ? all : namesArg.split(',');
for (const n of names) if (!all.includes(n)) throw new Error(`no such figure: ${n}`);

const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const times = at.length ? at : [''];
for (const name of names) {
  for (const t of times) {
    const png = join(out, `${name}${t === '' ? '' : `-${t}s`}-${dark ? 'dark' : 'light'}.png`);
    const page = `${url}/#/figures/${name}/${t}/${dark ? 'dark' : 'light'}`;
    execFileSync(
      chrome,
      ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=760,1000', '--virtual-time-budget=6000', `--screenshot=${png}`, page],
      { stdio: 'ignore' },
    );
    console.log(png);
  }
}
