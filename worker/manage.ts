// Managing a support plan inside Glorieta, instead of Stripe's hosted portal (which can only carry the
// shared account's branding): read the plan, cancel or resume it, switch interval, and change the card.
import type Stripe from 'stripe';
import { requireUser } from './auth.ts';
import { APP_TAG, parseInterval, parseLocale, type Interval } from './catalog.ts';
import { HttpError, json, readJson } from './http.ts';
import { brandingSettings, loadPlans } from './billing.ts';
import { readOwnBilling } from './mirror.ts';
import { getStripe } from './stripe.ts';

const idOf = (ref: string | { id?: string } | null | undefined): string | null =>
  typeof ref === 'string' ? ref : (ref?.id ?? null);

/** Statuses in which a subscription is still the person's plan (it can be managed, not only viewed). */
const LIVE = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due', 'unpaid']);

/** The Glorieta subscription among a customer's subscriptions: the newest one that is still live. */
export function pickSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const mine = subs.filter((s) => s.metadata.app === APP_TAG && LIVE.has(s.status));
  return mine.sort((a, b) => b.created - a.created)[0] ?? null;
}

export interface PlanSummary {
  interval: Interval | null;
  amount: number | null;
  currency: string;
  status: Stripe.Subscription.Status;
  /** Seconds since the epoch: when the current period ends (the renewal, or the end if cancelled). */
  period_end: number | null;
  cancel_at_period_end: boolean;
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  created: number;
  total: number;
  currency: string;
  status: string | null;
  url: string | null;
  pdf: string | null;
}

/** What the browser is shown about a subscription. Its payment method must be expanded. */
export function summarize(sub: Stripe.Subscription): PlanSummary {
  const item = sub.items.data[0];
  const interval = parseInterval(item?.price.recurring?.interval);
  const pm = sub.default_payment_method;
  const card = pm && typeof pm === 'object' && pm.card ? pm.card : null;
  return {
    interval,
    amount: item?.price.unit_amount ?? null,
    currency: item?.price.currency ?? sub.currency,
    status: sub.status,
    period_end: item?.current_period_end ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
    card: card ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year } : null,
  };
}

export function summarizeInvoice(inv: Stripe.Invoice): InvoiceSummary {
  return {
    id: inv.id ?? '',
    number: inv.number,
    created: inv.created,
    total: inv.total,
    currency: inv.currency,
    status: inv.status,
    url: inv.hosted_invoice_url ?? null,
    pdf: inv.invoice_pdf ?? null,
  };
}

/** The signed-in person's Glorieta customer and live subscription, or a 404 if they have none. */
async function ownSubscription(request: Request, env: Cloudflare.Env) {
  const { user, jwt } = await requireUser(request, env);
  const row = await readOwnBilling(env, jwt);
  if (!row) throw new HttpError(404, 'no_customer', 'You have no support plan.');
  const stripe = getStripe(env);
  const subs = await stripe.subscriptions.list({
    customer: row.stripe_customer_id,
    status: 'all',
    expand: ['data.default_payment_method'],
    limit: 20,
  });
  const sub = pickSubscription(subs.data);
  return { user, stripe, customer: row.stripe_customer_id, sub };
}

/** GET /api/billing/plan: the current plan and the recent invoices. `plan` is null once it has ended. */
export async function plan(request: Request, env: Cloudflare.Env): Promise<Response> {
  const { stripe, customer, sub } = await ownSubscription(request, env);
  const invoices = await stripe.invoices.list({ customer, limit: 12 });
  return json({
    plan: sub ? summarize(sub) : null,
    invoices: invoices.data.filter((i) => i.status !== 'draft').map(summarizeInvoice),
  });
}

/** POST /api/billing/cancel {"cancel": true|false}: cancel at the end of the period, or undo that. */
export async function cancel(request: Request, env: Cloudflare.Env): Promise<Response> {
  const body = await readJson(request);
  if (typeof body.cancel !== 'boolean') throw new HttpError(400, 'bad_request', 'cancel must be true or false.');
  const { stripe, sub } = await ownSubscription(request, env);
  if (!sub) throw new HttpError(404, 'no_plan', 'You have no active support plan.');
  const updated = await stripe.subscriptions.update(sub.id, {
    cancel_at_period_end: body.cancel,
    expand: ['default_payment_method'],
  });
  return json({ plan: summarize(updated) });
}

/**
 * POST /api/billing/switch {"interval": "month"|"year"}: move the plan to the other Price. The difference
 * is invoiced at once: moving up is charged now, moving down leaves the unused part as credit for the
 * next charges. (Stripe's default would hold the difference until the next renewal, a year away.)
 */
export async function switchPlan(request: Request, env: Cloudflare.Env): Promise<Response> {
  const body = await readJson(request);
  const interval = parseInterval(body.interval);
  if (!interval) throw new HttpError(400, 'bad_request', 'interval must be "month" or "year".');
  const { stripe, sub } = await ownSubscription(request, env);
  if (!sub) throw new HttpError(404, 'no_plan', 'You have no active support plan.');
  const item = sub.items.data[0];
  if (!item) throw new Error(`Subscription ${sub.id} has no items`);
  if (item.price.recurring?.interval === interval) throw new HttpError(409, 'same_plan', 'You are already on that plan.');
  const target = (await loadPlans(stripe)).find((p) => p.interval === interval);
  if (!target) throw new HttpError(503, 'catalog_incomplete', `No ${interval}ly price.`);
  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: target.price_id }],
    proration_behavior: 'always_invoice',
    // Switching is a choice to keep supporting, so it also undoes a pending cancellation.
    cancel_at_period_end: false,
    expand: ['default_payment_method', 'latest_invoice'],
  });
  // The invoice the switch just made: a charge (moving up) or a credit (moving down).
  const latest = updated.latest_invoice;
  const invoice = latest && typeof latest === 'object' && latest.id !== idOf(sub.latest_invoice) ? summarizeInvoice(latest) : null;
  return json({ plan: summarize(updated), invoice });
}

/**
 * POST /api/billing/card {"locale": "es"|"en"}: a Stripe Checkout page in setup mode, in Glorieta's
 * branding, to save a new card. The webhook makes it the plan's card when the page completes.
 */
export async function card(request: Request, env: Cloudflare.Env): Promise<Response> {
  const body = await readJson(request);
  const locale = parseLocale(body.locale);
  if (!locale) throw new HttpError(400, 'bad_request', 'locale must be "es" or "en".');
  const { user, stripe, customer, sub } = await ownSubscription(request, env);
  if (!sub) throw new HttpError(404, 'no_plan', 'You have no active support plan.');
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer,
    currency: sub.currency,
    client_reference_id: user.id,
    setup_intent_data: { metadata: { app: APP_TAG, glorieta_user_id: user.id, subscription_id: sub.id } },
    branding_settings: brandingSettings(env),
    locale,
    success_url: `${env.SITE_ORIGIN}/?card=saved#/support`,
    cancel_url: `${env.SITE_ORIGIN}/#/support`,
  });
  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return json({ url: session.url });
}

/**
 * For the webhook: a completed setup-mode session saved a card. Make it the default for the customer's
 * invoices and for the subscription named in its metadata, if that subscription is Glorieta's and theirs.
 */
export async function applySavedCard(stripe: Stripe, session: Stripe.Checkout.Session): Promise<'applied' | 'ignored'> {
  const setupId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!setupId || !customerId) return 'ignored';
  const setup = await stripe.setupIntents.retrieve(setupId);
  const pm = typeof setup.payment_method === 'string' ? setup.payment_method : setup.payment_method?.id;
  const subId = setup.metadata?.subscription_id;
  if (setup.status !== 'succeeded' || !pm || setup.metadata?.app !== APP_TAG || !subId) return 'ignored';
  const sub = await stripe.subscriptions.retrieve(subId);
  const subCustomer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  if (sub.metadata.app !== APP_TAG || subCustomer !== customerId) return 'ignored';
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm } });
  await stripe.subscriptions.update(subId, { default_payment_method: pm });
  return 'applied';
}
