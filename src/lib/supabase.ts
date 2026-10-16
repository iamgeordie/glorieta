import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Half a configuration is a mistake, not a mode: say so at once instead of silently running without accounts.
if (Boolean(url) !== Boolean(key)) {
  throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or neither.');
}

/** Accounts exist only when the app was built with a Supabase project configured. */
export const authEnabled = Boolean(url && key);
export const googleEnabled = authEnabled && import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
export const crmBrandId = import.meta.env.VITE_PODOGRAPH_BRAND_ID?.trim() || undefined;

/**
 * Talks to the dedicated `glorieta` schema. PKCE is used because this app routes with
 * the URL hash, which the default implicit flow would also use to return tokens.
 */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        db: { schema: 'glorieta' },
      })
    : null;

export function requireClient(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Accounts are not configured in this build.');
  return supabase;
}
