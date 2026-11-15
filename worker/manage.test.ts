import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { handle } from './index.ts';
import { pickSubscription, summarize, summarizeInvoice } from './manage.ts';

// Subscriptions shaped as Stripe returns them, with only the fields these functions read.
const sub = (over: Partial<Record<string, unknown>>) =>
  ({
    id: 'sub_1',
    created: 1000,
    status: 'active',
    metadata: { app: 'glorieta' },
    currency: 'eur',
    cancel_at_period_end: false,
    default_payment_method: null,
    items: { data: [{ id: 'si_1', current_period_end: 2000, price: { unit_amount: 300, currency: 'eur', recurring: { interval: 'month' } } }] },
    ...over,
  }) as unknown as Stripe.Subscription;

test('pickSubscription takes the newest live Glorieta subscription and nothing else', () => {
  const old = sub({ id: 'sub_old', created: 1 });
  const newer = sub({ id: 'sub_new', created: 5 });
  const foreign = sub({ id: 'sub_lm', created: 9, metadata: { app: 'linguamama' } });
  const ended = sub({ id: 'sub_end', created: 10, status: 'canceled' });
  assert.equal(pickSubscription([old, foreign, newer, ended])?.id, 'sub_new');
  assert.equal(pickSubscription([foreign, ended]), null);
  assert.equal(pickSubscription([sub({ status: 'past_due' })])?.status, 'past_due');
});

test('summarize reports the price, period end, cancellation and card', () => {
  const s = summarize(
    sub({
      cancel_at_period_end: true,
      default_payment_method: { id: 'pm_1', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
    }),
  );
  assert.deepEqual(s, {
    interval: 'month',
    amount: 300,
    currency: 'eur',
    status: 'active',
    period_end: 2000,
    cancel_at_period_end: true,
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
  });
  assert.equal(summarize(sub({})).card, null);
});

test('summarizeInvoice keeps the links and amounts', () => {
  const inv = { id: 'in_1', number: 'ABC-0001', created: 3, total: 300, currency: 'eur', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/i/x', invoice_pdf: 'https://pay.stripe.com/invoice/x/pdf' } as unknown as Stripe.Invoice;
  assert.deepEqual(summarizeInvoice(inv), { id: 'in_1', number: 'ABC-0001', created: 3, total: 300, currency: 'eur', status: 'paid', url: 'https://invoice.stripe.com/i/x', pdf: 'https://pay.stripe.com/invoice/x/pdf' });
});

const env = { SUPABASE_URL: 'https://qgfmwstgkwyqqwyqroav.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_qGi7AfmrPvli1JOZWNwFzQ_eO5_rj9D' } as unknown as Cloudflare.Env;
const call = (method: string, path: string, body?: unknown) =>
  handle(
    new Request(`https://glorieta.anaidic.com${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    {} as ExecutionContext,
  );

test('the plan endpoints refuse a request with no session', async () => {
  for (const [method, path, body] of [
    ['GET', '/api/billing/plan', undefined],
    ['POST', '/api/billing/cancel', { cancel: true }],
    ['POST', '/api/billing/switch', { interval: 'year' }],
    ['POST', '/api/billing/card', { locale: 'en' }],
  ] as const) {
    const res = await call(method, path, body);
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('the plan endpoints refuse a malformed body before anything else', async () => {
  assert.equal((await call('POST', '/api/billing/cancel', { cancel: 'yes' })).status, 400);
  assert.equal((await call('POST', '/api/billing/switch', { interval: 'week' })).status, 400);
  assert.equal((await call('POST', '/api/billing/card', { locale: 'fr' })).status, 400);
});

test('the hosted portal endpoint is gone', async () => {
  assert.equal((await call('POST', '/api/billing/portal')).status, 404);
});

test('a coffee is whole euros between 2 and 200, given in cents', async () => {
  const { parseCoffeeAmount } = await import('./catalog.ts');
  for (const ok of [200, 300, 500, 1000, 20000]) assert.equal(parseCoffeeAmount(ok), ok);
  for (const bad of [100, 199, 250, 20100, 3.5, '500', null, -500]) assert.equal(parseCoffeeAmount(bad), null, String(bad));
});

test('a coffee needs a session', async () => {
  assert.equal((await call('POST', '/api/billing/coffee', { amount: 500, locale: 'es' })).status, 401);
});
