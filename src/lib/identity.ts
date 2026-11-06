import type { User } from '@supabase/supabase-js';

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** The picture Google supplies, if any. Only an https address is ever used as an image source. */
export function pictureOf(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const url = asText(meta.avatar_url) ?? asText(meta.picture);
  return url && url.startsWith('https://') ? url : null;
}

/** The name to show for a person; the e-mail address stands in when they have no name. */
export function labelOf(user: User, saved: string | null | undefined): string {
  const meta = user.user_metadata ?? {};
  return saved?.trim() || asText(meta.full_name) || asText(meta.name) || asText(meta.display_name) || user.email || '';
}

export const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
