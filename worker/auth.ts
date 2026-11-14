// Resolves the signed-in Supabase user behind a request, or refuses it with 401. The token is checked
// by Supabase Auth itself (getUser), so a revoked session is refused even before its JWT expires.
import { createClient, type User } from '@supabase/supabase-js';
import { HttpError } from './http.ts';

export interface SignedIn {
  user: User;
  /** The caller's own access token, for reads that row level security limits to their rows. */
  jwt: string;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function requireUser(
  request: Request,
  env: Pick<Cloudflare.Env, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>,
): Promise<SignedIn> {
  const jwt = bearerToken(request);
  if (!jwt) throw new HttpError(401, 'unauthenticated', 'Sign in first.');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', 'Your session is not valid. Sign in again.');
  return { user: data.user, jwt };
}
