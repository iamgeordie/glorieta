// The support plan, from the browser's side. The Worker (/api/billing/*) talks to Stripe; this module
// asks it for plans, Checkout and the portal, and reads the person's own mirror row from the database.
import { signal } from '@preact/signals';
import type { Bi } from '../i18n';
import { describeAuthError } from './auth-errors';
import { requireClient } from './supabase';

export type Interval = 'month' | 'year';
export type Plan = { interval: Interval; amount: number; currency: string; name: string };
export type BillingRow = { stripe_customer_id: string; entitlements: string[] };

/** The signed-in person's mirror row: undefined until read, null when they have none. */
export const billing = signal<BillingRow | null | undefined>(undefined);
export const isSupporter = (row: BillingRow | null | undefined): boolean => !!row?.entitlements.includes('glorieta_supporter');

/** How the person came back from Checkout, read once from `?checkout=` and then removed from the address. */
export const checkoutReturn = signal<'success' | 'cancel' | null>(takeCheckoutParam());

function takeCheckoutParam(): 'success' | 'cancel' | null {
  const url = new URL(location.href);
  const v = url.searchParams.get('checkout');
  if (v === null) return null;
  url.searchParams.delete('checkout');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return v === 'success' ? 'success' : 'cancel';
}

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function accessToken(): Promise<string> {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new ApiError('unauthenticated', 'No session');
  return token;
}

async function api<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; signedIn?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.signedIn) headers.Authorization = `Bearer ${await accessToken()}`;
  const res = await fetch(`/api/billing/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? `http_${res.status}`, body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (body === null) throw new ApiError('bad_response', `The billing API returned no JSON for ${path}`);
  return body;
}

export async function getPlans(): Promise<{ ok: true; plans: Plan[] } | { ok: false; error: Bi }> {
  try {
    return { ok: true, plans: (await api<{ plans: Plan[] }>('prices')).plans };
  } catch (err) {
    return { ok: false, error: describeAuthError(err) };
  }
}

/** Reads the person's own row (row level security limits it to them) into `billing`. */
export async function readBilling(): Promise<Bi | null> {
  try {
    const { data, error } = await requireClient().from('billing').select('stripe_customer_id, entitlements').maybeSingle();
    if (error) throw error;
    billing.value = (data as BillingRow | null) ?? null;
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/** Sends the browser to Stripe Checkout. Returns an error only if it could not. */
export async function startCheckout(interval: Interval, locale: 'es' | 'en'): Promise<Bi | null> {
  try {
    const { url } = await api<{ url: string }>('checkout', { method: 'POST', body: { interval, locale }, signedIn: true });
    location.assign(url);
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/** Sends the browser to the Stripe customer portal. */
export async function openPortal(): Promise<Bi | null> {
  try {
    const { url } = await api<{ url: string }>('portal', { method: 'POST', signedIn: true });
    location.assign(url);
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/**
 * Before "Delete my Glorieta data": deletes the person's Stripe customer (which cancels the plan at once)
 * and clears the mirror. Throws if Stripe could not, so the erasure stops with the data intact.
 */
export async function eraseBilling(): Promise<void> {
  await api<{ erased: boolean }>('erase', { method: 'POST', signedIn: true });
  billing.value = null;
}
