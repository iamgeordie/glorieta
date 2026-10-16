/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Set together with VITE_SUPABASE_PUBLISHABLE_KEY to turn accounts on. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key (safe to ship in the browser; RLS is the protection). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** 'true' once the Google provider is configured on the Supabase project. */
  readonly VITE_GOOGLE_AUTH_ENABLED?: string;
  /** Podograph brand id for Carnet. Leads are only sent when this is set. */
  readonly VITE_PODOGRAPH_BRAND_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
