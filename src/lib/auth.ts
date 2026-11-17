import type { User } from '@supabase/supabase-js';
import { signal } from '@preact/signals';
import { bi, type Bi } from '../i18n';
import { describeAuthError } from './auth-errors';
import { authEnabled, googleEnabled, requireClient, supabase } from './supabase';
import { startSync, stopSync } from './sync';

export type AuthStatus = 'disabled' | 'loading' | 'out' | 'in';
export type Result<T = void> = ({ ok: true } & (T extends void ? object : T)) | { ok: false; error: Bi };

export const authStatus = signal<AuthStatus>(authEnabled ? 'loading' : 'disabled');
export const currentUser = signal<User | null>(null);
/** True between clicking a password-reset email link and choosing the new password. */
export const recovering = signal(false);
/** A one-off message for the account screen, such as "email confirmed". */
export const notice = signal<Bi | null>(null);
/** A sign-in that Supabase or Google rejected, as reported in the return URL (OAuth and email links). */
export const returnError = signal<string | null>(null);

// Supabase strips ?code= from the URL as soon as it exchanges it, so look before it does.
const startUrl = typeof location !== 'undefined' ? new URL(location.href) : null;
/**
 * The shared project's Send Email hook links straight to the app with ?token_hash=…&type=…, instead of
 * Supabase's verify endpoint (which would come back with ?code=). Such a link is verified here.
 */
const emailToken = startUrl?.searchParams.get('token_hash')
  ? { token_hash: startUrl.searchParams.get('token_hash') as string, type: startUrl.searchParams.get('type') ?? 'signup' }
  : null;
const returnedFromEmailLink = Boolean(startUrl?.searchParams.has('code') || emailToken);
const OTP_TYPES = ['signup', 'recovery', 'invite', 'magiclink', 'email', 'email_change'] as const;
type OtpType = (typeof OTP_TYPES)[number];
let syncedFor: string | null = null;

// A failed sign-in comes back as ?error=...&error_description=... (or the same in the #fragment). Show it
// instead of dropping the person on the home screen with no explanation.
if (typeof location !== 'undefined') {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.startsWith('#') && url.hash.includes('=') ? url.hash.slice(1) : '');
  const text = url.searchParams.get('error_description') ?? fragment.get('error_description') ?? url.searchParams.get('error') ?? fragment.get('error');
  if (text) {
    const code = url.searchParams.get('error_code') ?? fragment.get('error_code');
    returnError.value = code ? `${text} (${code})` : text;
    history.replaceState(null, '', `${url.pathname}#/account`);
  }
}

const origin = () => `${location.origin}/`;

/** Call once at start-up. Does nothing when accounts are not configured. */
export function initAuth() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovering.value = true;
      currentUser.value = session?.user ?? null;
      authStatus.value = session ? 'in' : 'out';
      location.hash = '#/account/reset';
      return;
    }
    if (event === 'SIGNED_OUT') {
      currentUser.value = null;
      authStatus.value = 'out';
      syncedFor = null;
      stopSync();
      return;
    }
    if (session) {
      currentUser.value = session.user;
      authStatus.value = 'in';
      if (returnedFromEmailLink && event === 'SIGNED_IN') {
        const viaGoogle = session.user.app_metadata?.provider === 'google';
        notice.value = viaGoogle
          ? bi('Has iniciado sesión con Google.', 'You are signed in with Google.')
          : bi('Tu correo está confirmado. Ya has iniciado sesión.', 'Your email is confirmed. You are signed in.');
        // Signing in lands on the main page, which shows the notice above; the account page is one tap away.
        location.hash = '#/';
      }
      // Supabase asks that its own calls are not made inside this callback, so hand off to the next tick.
      if (syncedFor !== session.user.id) {
        syncedFor = session.user.id;
        const user = session.user;
        setTimeout(() => void startSync(user), 0);
      }
    } else {
      currentUser.value = null;
      authStatus.value = 'out';
    }
  });
  if (emailToken) void verifyEmailToken(supabase, emailToken);
}

const fail = (err: unknown): { ok: false; error: Bi } => ({ ok: false, error: describeAuthError(err) });

export type SignUpInput = { email: string; password: string; name: string; marketing: boolean; captchaToken: string };

/** `confirm` means the account exists but the email link must be clicked before signing in. */
export async function signUp(input: SignUpInput): Promise<Result<{ next: 'confirm' | 'signed-in' }>> {
  const { data, error } = await requireClient().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: origin(),
      captchaToken: input.captchaToken,
      // Consent is captured here, at the moment it is given, and acted on after the email is confirmed.
      data: {
        display_name: input.name.trim() || null,
        marketing_opt_in: input.marketing,
        marketing_consent_at: input.marketing ? new Date().toISOString() : null,
      },
    },
  });
  if (error) return fail(error);
  // With email confirmation on, Supabase answers an existing address with a user that has no identities.
  if (data.user && data.user.identities?.length === 0) return fail({ code: 'user_already_exists' });
  return { ok: true, next: data.session ? 'signed-in' : 'confirm' };
}

export async function signIn(email: string, password: string, captchaToken: string): Promise<Result> {
  const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } });
  return error ? fail(error) : { ok: true };
}

export async function signOut(): Promise<Result> {
  const { error } = await requireClient().auth.signOut();
  return error ? fail(error) : { ok: true };
}

export async function requestPasswordReset(email: string, captchaToken: string): Promise<Result> {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: origin(), captchaToken });
  return error ? fail(error) : { ok: true };
}

export async function updatePassword(password: string): Promise<Result> {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) return fail(error);
  recovering.value = false;
  return { ok: true };
}

/**
 * Starts Google sign-in. Not available until the provider is set up on the Supabase
 * project and the build has VITE_GOOGLE_AUTH_ENABLED=true; the button reflects that.
 */
export async function signInWithGoogle(): Promise<Result> {
  if (!googleEnabled) {
    return { ok: false, error: bi('El acceso con Google aún no está configurado.', 'Google sign-in is not set up yet.') };
  }
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: 'google',
    // Always show Google's account chooser: signing out of the app leaves the browser signed in
    // to Google, which would otherwise hand back the default account with no way to pick another.
    options: { redirectTo: origin(), queryParams: { prompt: 'select_account' } },
  });
  return error ? fail(error) : { ok: true };
}

/** Completes a ?token_hash= email link: confirms the address (or starts a password reset) and signs in. */
async function verifyEmailToken(client: NonNullable<typeof supabase>, link: { token_hash: string; type: string }) {
  // Take the token out of the address bar at once: it works only once, and must not be bookmarked or shared.
  const url = new URL(location.href);
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  if (!(OTP_TYPES as readonly string[]).includes(link.type)) {
    returnError.value = `Unknown email link type: ${link.type}`;
    return;
  }
  const { error } = await client.auth.verifyOtp({ token_hash: link.token_hash, type: link.type as OtpType });
  if (error) {
    returnError.value = error.code ? `${error.message} (${error.code})` : error.message;
    location.hash = '#/account';
  }
}
