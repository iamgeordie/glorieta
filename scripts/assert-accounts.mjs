// Fails a deploy whose bundle does not contain accounts when .env.production says it should.
// Without this, a build made without the settings looks fine and simply has no login.
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const envPath = new URL('../.env.production', import.meta.url);
if (!existsSync(envPath)) {
  console.log('No .env.production: accounts are not configured, nothing to assert.');
  process.exit(0);
}
const url = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync(envPath, 'utf8'))?.[1]?.trim();
if (!url) {
  console.log('.env.production sets no Supabase URL: accounts are off.');
  process.exit(0);
}
const dir = new URL('../dist/assets/', import.meta.url);
const bundle = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
if (!bundle.includes(url)) {
  console.error(`The built bundle does not contain ${url}. Accounts would be missing from this deploy. Aborting.`);
  process.exit(1);
}
console.log('Accounts are in the bundle.');
