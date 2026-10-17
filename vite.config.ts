import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import { learnData } from './scripts/vite-learn-data';

export default defineConfig(({ mode }) => {
  // Half a configuration would build a site that fails on load. Refuse to build it instead.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) {
    throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or neither.');
  }
  if (env.VITE_GOOGLE_AUTH_ENABLED === 'true' && !url) {
    throw new Error('VITE_GOOGLE_AUTH_ENABLED=true needs the Supabase variables as well.');
  }
  return { plugins: [preact(), learnData()] };
});
