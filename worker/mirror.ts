// The Worker's only way to write glorieta.billing: a call to glorieta.billing_apply() as `anon`, with
// the exact JSON body signed by HMAC-SHA256 under BILLING_HMAC_KEY. The function checks the signature
// against the same key in glorieta.billing_key and refuses anything else.
import { createClient } from '@supabase/supabase-js';
import type { CrmState } from './entitlements.ts';

type MirrorEnv = Pick<Cloudflare.Env, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'BILLING_HMAC_KEY'>;

export type LinkResult = { status: 'linked'; customer_id: string } | { status: 'no_profile' };
export type EntitlementsResult =
  | { status: 'no_row' }
  | {
      status: 'applied' | 'noop';
      user_id: string;
      supporter: boolean;
      marketing_opt_in: boolean;
      crm_synced: boolean;
      crm_reported: CrmState | null;
    };
export type ClearResult = { status: 'cleared' | 'no_row' };
export type CrmReportedResult = { status: 'ok' | 'no_row' };
export type CoffeeResult = { status: 'applied' | 'noop'; user_id: string } | { status: 'no_row' };

export type MirrorOp =
  | { op: 'link_customer'; user_id: string; customer_id: string }
  | { op: 'entitlements'; event_id: string; customer_id: string; entitlements: string[] }
  | { op: 'clear'; user_id: string; customer_id: string }
  | { op: 'crm_reported'; user_id: string; state: CrmState }
  | { op: 'coffee'; customer_id: string; session_id: string; amount: number; currency: string };

const encoder = new TextEncoder();

/** The exact text that is signed and sent. issued_at lets the database refuse a replayed old call. */
export function mirrorBody(op: MirrorOp, now: Date = new Date()): string {
  return JSON.stringify({ ...op, issued_at: now.toISOString() });
}

export async function signBody(body: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function anonClient(env: MirrorEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'glorieta' },
  });
}

async function apply<T>(env: MirrorEnv, op: MirrorOp): Promise<T> {
  if (!env.BILLING_HMAC_KEY) throw new Error('BILLING_HMAC_KEY is not set');
  const p_body = mirrorBody(op);
  const p_sig = await signBody(p_body, env.BILLING_HMAC_KEY);
  const { data, error } = await anonClient(env).rpc('billing_apply', { p_body, p_sig });
  if (error) throw new Error(`billing_apply(${op.op}) failed: ${error.message}`);
  return data as T;
}

export const linkCustomer = (env: MirrorEnv, user_id: string, customer_id: string) =>
  apply<LinkResult>(env, { op: 'link_customer', user_id, customer_id });

export const applyEntitlements = (env: MirrorEnv, event_id: string, customer_id: string, entitlements: string[]) =>
  apply<EntitlementsResult>(env, { op: 'entitlements', event_id, customer_id, entitlements });

export const clearEntitlements = (env: MirrorEnv, user_id: string, customer_id: string) =>
  apply<ClearResult>(env, { op: 'clear', user_id, customer_id });

export const recordCoffee = (env: MirrorEnv, customer_id: string, session_id: string, amount: number, currency: string) =>
  apply<CoffeeResult>(env, { op: 'coffee', customer_id, session_id, amount, currency });

export const recordCrmReported = (env: MirrorEnv, user_id: string, state: CrmState) =>
  apply<CrmReportedResult>(env, { op: 'crm_reported', user_id, state });

export interface BillingRow {
  user_id: string;
  stripe_customer_id: string;
  entitlements: string[];
}

/** The caller's own billing row, read with their JWT, so row level security limits it to them. */
export async function readOwnBilling(env: Pick<Cloudflare.Env, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>, jwt: string): Promise<BillingRow | null> {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'glorieta' },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await client.from('billing').select('user_id, stripe_customer_id, entitlements').maybeSingle();
  if (error) throw new Error(`reading the billing row failed: ${error.message}`);
  return (data as BillingRow | null) ?? null;
}
