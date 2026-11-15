// The support plan, from the browser's side. The Worker (/api/billing/*) talks to Stripe; this module
// asks it for plans, Checkout and plan changes, and reads the person's own mirror row from the database.
import { signal } from '@preact/signals';
import type { Bi } from '../i18n';
import { describeAuthError } from './auth-errors';
import { requireClient } from './supabase';

export type Interval = 'month' | 'year';
export type Plan = { interval: Interval; amount: number; currency: string; name: string };
/** "Buy me a coffee": the preset amounts and the allowed range, in cents, as the Worker reports them. */
export type Coffee = { currency: string; presets: number[]; min: number; max: number };
export type BillingRow = { stripe_customer_id: string; entitlements: string[]; coffee: boolean };
export type PlanState = {
  interval: Interval | null;
  amount: number | null;
  currency: string;
  status: 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
  /** Seconds since the epoch. */
  period_end: number | null;
  cancel_at_period_end: boolean;
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
};
export type Invoice = { id: string; number: string | null; created: number; total: number; currency: string; status: string | null; url: string | null; pdf: string | null };

/** The signed-in person's mirror row: undefined until read, null when they have none. */
export const billing = signal<BillingRow | null | undefined>(undefined);
export const isSupporter = (row: BillingRow | null | undefined): boolean => !!row?.entitlements.includes('glorieta_supporter');
/** The badge to show: Mecenas while a plan is active, otherwise Café once any coffee is paid. */
export const badgeOf = (row: BillingRow | null | undefined): 'supporter' | 'coffee' | null =>
  isSupporter(row) ? 'supporter' : row?.coffee ? 'coffee' : null;

/** How the person came back from Checkout, read once from `?checkout=` and then removed from the address. */
export const checkoutReturn = signal<'success' | 'cancel' | null>(takeCheckoutParam());

/** True once, after a coffee was paid (`?coffee=thanks`), then removed from the address. */
export const coffeeThanks = signal<boolean>(takeParam('coffee') === 'thanks');

/** Sends the browser to Stripe Checkout for a one-time coffee of `amount` cents. */
export async function buyCoffee(amount: number, locale: 'es' | 'en'): Promise<Bi | null> {
  try {
    const { url } = await api<{ url: string }>('coffee', { method: 'POST', body: { amount, locale }, signedIn: true });
    location.assign(url);
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}

/** True once, after the change-card page saved a card (`?card=saved`), then removed from the address. */
export const cardSaved = signal<boolean>(takeParam('card') === 'saved');

function takeParam(name: string): string | null {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  if (v === null) return null;
  url.searchParams.delete(name);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return v;
}

function takeCheckoutParam(): 'success' | 'cancel' | null {
  const v = takeParam('checkout');
  return v === null ? null : v === 'success' ? 'success' : 'cancel';
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

export async function getPlans(): Promise<{ ok: true; plans: Plan[]; coffee: Coffee } | { ok: false; error: Bi }> {
  try {
    const r = await api<{ plans: Plan[]; coffee: Coffee }>('prices');
    return { ok: true, plans: r.plans, coffee: r.coffee };
  } catch (err) {
    return { ok: false, error: describeAuthError(err) };
  }
}

/** Reads the person's own row (row level security limits it to them) into `billing`. */
export async function readBilling(): Promise<Bi | null> {
  try {
    const client = requireClient();
    const [row, coffees] = await Promise.all([
      client.from('billing').select('stripe_customer_id, entitlements').maybeSingle(),
      client.from('coffees').select('session_id').limit(1),
    ]);
    if (row.error) throw row.error;
    if (coffees.error) throw coffees.error;
    const data = row.data as { stripe_customer_id: string; entitlements: string[] } | null;
    billing.value = data ? { ...data, coffee: (coffees.data ?? []).length > 0 } : null;
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

type Result<T> = { ok: true; value: T } | { ok: false; error: Bi };
const attempt = async <T>(run: () => Promise<T>): Promise<Result<T>> => {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    return { ok: false, error: describeAuthError(err) };
  }
};

/** The current plan (null once it has ended) and the recent invoices. */
export const getPlan = () => attempt(() => api<{ plan: PlanState | null; invoices: Invoice[] }>('plan', { signedIn: true }));

/** Cancel at the end of the period (true), or keep the plan after all (false). */
export const setCancel = (cancel: boolean) =>
  attempt(async () => (await api<{ plan: PlanState }>('cancel', { method: 'POST', body: { cancel }, signedIn: true })).plan);

/** Move the plan to the other interval; Stripe prorates the difference. */
export const switchTo = (interval: Interval) =>
  attempt(() => api<{ plan: PlanState; invoice: Invoice | null }>('switch', { method: 'POST', body: { interval }, signedIn: true }));

/** Sends the browser to Glorieta's change-card page on Stripe. Returns an error only if it could not. */
export async function changeCard(locale: 'es' | 'en'): Promise<Bi | null> {
  const r = await attempt(() => api<{ url: string }>('card', { method: 'POST', body: { locale }, signedIn: true }));
  if (!r.ok) return r.error;
  location.assign(r.value.url);
  return null;
}

/**
 * Before "Delete my Glorieta data": deletes the person's Stripe customer (which cancels the plan at once)
 * and clears the mirror. Throws if Stripe could not, so the erasure stops with the data intact.
 */
export async function eraseBilling(): Promise<void> {
  await api<{ erased: boolean }>('erase', { method: 'POST', signedIn: true });
  billing.value = null;
}
