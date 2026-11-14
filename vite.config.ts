import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import { learnData } from './scripts/vite-learn-data.ts';

export default defineConfig(({ mode }) => {
  // Half a configuration would build a site that fails on load. Refuse to build it instead.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) {
    throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or neither.');
  }
  if (url && !env.VITE_TURNSTILE_SITE_KEY?.trim()) {
    throw new Error('Accounts need VITE_TURNSTILE_SITE_KEY (the public Turnstile site key).');
  }
  if (env.VITE_GOOGLE_AUTH_ENABLED === 'true' && !url) {
    throw new Error('VITE_GOOGLE_AUTH_ENABLED=true needs the Supabase variables as well.');
  }
  return {
    plugins: [preact(), learnData()],
    // The billing API runs in the Worker. In development, `wrangler dev` serves it on 8787.
    server: { proxy: { '/api': 'http://localhost:8787' } },
  };
});
