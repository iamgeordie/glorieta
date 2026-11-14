import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { handle } from './index.ts';

// Real Stripe signing, with a secret made for this test. The two cases here never reach Stripe or the
// database: a bad signature stops before any call, and an unhandled event type is acknowledged as is.
const secret = `whsec_${'t'.repeat(32)}`;
const env = {
  STRIPE_RESTRICTED_KEY: `rk_test_${'u'.repeat(24)}`,
  STRIPE_WEBHOOK_SECRET: secret,
  BILLING_HMAC_KEY: 'k'.repeat(64),
  SUPABASE_URL: 'https://qgfmwstgkwyqqwyqroav.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_qGi7AfmrPvli1JOZWNwFzQ_eO5_rj9D',
  SITE_ORIGIN: 'https://glorieta.anaidic.com',
  PODOGRAPH_BRAND_ID: 'glorieta',
} as unknown as Cloudflare.Env;
const ctx = {} as ExecutionContext;
const signer = new Stripe(env.STRIPE_RESTRICTED_KEY);

const event = (type: string) =>
  JSON.stringify({ id: 'evt_Test1', object: 'event', type, api_version: Stripe.API_VERSION, created: Math.floor(Date.now() / 1000), data: { object: {} } });

const post = (payload: string, signature: string | null) =>
  handle(
    new Request('https://glorieta.anaidic.com/api/billing/webhook', {
      method: 'POST',
      headers: signature ? { 'Stripe-Signature': signature } : {},
      body: payload,
    }),
    env,
    ctx,
  );

test('no signature header is a 400', async () => {
  const res = await post(event('customer.subscription.updated'), null);
  assert.equal(res.status, 400);
});

test('a signature made with another secret is a 400', async () => {
  const payload = event('customer.subscription.updated');
  const header = await signer.webhooks.generateTestHeaderStringAsync({ payload, secret: `whsec_${'x'.repeat(32)}` });
  const res = await post(payload, header);
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'bad_signature');
});

test('a body changed after signing is a 400', async () => {
  const payload = event('customer.subscription.updated');
  const header = await signer.webhooks.generateTestHeaderStringAsync({ payload, secret });
  const res = await post(payload.replace('evt_Test1', 'evt_Test2'), header);
  assert.equal(res.status, 400);
});

test('a correctly signed event of another type is acknowledged and changes nothing', async () => {
  const payload = event('invoice.paid');
  const header = await signer.webhooks.generateTestHeaderStringAsync({ payload, secret });
  const res = await post(payload, header);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true, outcome: 'ignored' });
});
