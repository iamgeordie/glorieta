// Finds server-side secrets in text: Stripe secret and restricted keys, Stripe webhook signing secrets,
// and Supabase secret keys. None of them may ever reach the browser bundle.
const PATTERNS = [
  { name: 'Stripe secret key', re: /\bsk_(?:live|test)_[A-Za-z0-9]{10,}/g },
  { name: 'Stripe restricted key', re: /\brk_(?:live|test)_[A-Za-z0-9]{10,}/g },
  { name: 'Stripe webhook secret', re: /\bwhsec_[A-Za-z0-9]{10,}/g },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/g },
];

/** Returns one finding per match, with the secret itself cut to its prefix so it is never printed. */
export function findSecrets(text) {
  const found = [];
  for (const { name, re } of PATTERNS) {
    for (const m of text.matchAll(re)) found.push({ name, index: m.index, preview: `${m[0].slice(0, m[0].indexOf('_', 3) + 1)}…` });
  }
  return found;
}
