// The signed-in and public billing endpoints: prices, checkout, portal, erase.
import type Stripe from 'stripe';
import { requireUser } from './auth.ts';
import { APP_TAG, PRICE_LOOKUP_KEYS, parseInterval, parseLocale, type Interval } from './catalog.ts';
import { isSupporter } from './entitlements.ts';
import { HttpError, json, readJson } from './http.ts';
import { clearEntitlements, linkCustomer, readOwnBilling } from './mirror.ts';
import { getStripe } from './stripe.ts';

export interface Plan {
  interval: Interval;
  amount: number;
  currency: string;
  name: string;
  price_id: string;
}

/** Both Glorieta Prices, read from Stripe by lookup key, checked to be Glorieta's own and complete. */
export async function loadPlans(stripe: Stripe): Promise<Plan[]> {
  const list = await stripe.prices.list({
    lookup_keys: Object.values(PRICE_LOOKUP_KEYS),
    active: true,
    expand: ['data.product'],
    limit: 10,
  });
  const plans: Plan[] = [];
  for (const interval of ['month', 'year'] as const) {
    const price = list.data.find((p) => p.lookup_key === PRICE_LOOKUP_KEYS[interval]);
    const product = price?.product;
    if (
      !price ||
      price.metadata.app !== APP_TAG ||
      price.recurring?.interval !== interval ||
      price.unit_amount === null ||
      typeof product !== 'object' ||
      product.deleted ||
      product.metadata.app !== APP_TAG ||
      !product.active
    ) {
      throw new HttpError(503, 'catalog_incomplete', `The ${interval}ly Glorieta Supporter price is missing or not Glorieta's in Stripe.`);
    }
    plans.push({ interval, amount: price.unit_amount, currency: price.currency, name: product.name, price_id: price.id });
  }
  return plans;
}

export async function prices(_request: Request, env: Cloudflare.Env): Promise<Response> {
  const plans = await loadPlans(getStripe(env));
  return json(
    { plans: plans.map(({ interval, amount, currency, name }) => ({ interval, amount, currency, name })) },
    200,
    { 'Cache-Control': 'public, max-age=300' },
  );
}

export async function checkout(request: Request, env: Cloudflare.Env): Promise<Response> {
  const { user, jwt } = await requireUser(request, env);
  const body = await readJson(request);
  const interval = parseInterval(body.interval);
  const locale = parseLocale(body.locale);
  if (!interval) throw new HttpError(400, 'bad_request', 'interval must be "month" or "year".');
  if (!locale) throw new HttpError(400, 'bad_request', 'locale must be "es" or "en".');

  const row = await readOwnBilling(env, jwt);
  if (row && isSupporter(row.entitlements)) {
    throw new HttpError(409, 'already_supporter', 'You already have a support plan.');
  }

  const stripe = getStripe(env);
  const plan = (await loadPlans(stripe)).find((p) => p.interval === interval);
  if (!plan) throw new HttpError(503, 'catalog_incomplete', `No ${interval}ly price.`);

  let customer = row?.stripe_customer_id ?? null;
  if (!customer) {
    if (!user.email) throw new HttpError(400, 'no_email', 'Your account has no email address.');
    // Never look a customer up by email: the Stripe account is shared with LinguaMama.
    const created = await stripe.customers.create({
      email: user.email,
      metadata: { app: APP_TAG, glorieta_user_id: user.id },
    });
    const link = await linkCustomer(env, user.id, created.id);
    if (link.status === 'no_profile') {
      await stripe.customers.del(created.id);
      throw new HttpError(409, 'no_profile', 'Your account is still being set up. Try again in a moment.');
    }
    // Two tabs raced: the first customer stored wins, and the one just made is removed.
    if (link.customer_id !== created.id) await stripe.customers.del(created.id);
    customer = link.customer_id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: plan.price_id, quantity: 1 }],
    subscription_data: { metadata: { app: APP_TAG, glorieta_user_id: user.id } },
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    billing_address_collection: 'required',
    allow_promotion_codes: true,
    // Glorieta's name and mark on this page only; the account's own branding (LinguaMama's) stays as it is.
    branding_settings: {
      display_name: 'Glorieta',
      icon: { type: 'url', url: `${env.SITE_ORIGIN}/brand/glorieta-icon.png` },
      button_color: '#1f4fd8',
    },
    locale,
    success_url: `${env.SITE_ORIGIN}/?checkout=success#/support`,
    cancel_url: `${env.SITE_ORIGIN}/?checkout=cancel#/support`,
  });
  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return json({ url: session.url });
}

export async function portal(request: Request, env: Cloudflare.Env): Promise<Response> {
  const { jwt } = await requireUser(request, env);
  const row = await readOwnBilling(env, jwt);
  if (!row) throw new HttpError(404, 'no_customer', 'You have no support plan to manage.');
  const configuration = env.STRIPE_PORTAL_CONFIGURATION;
  if (!configuration) throw new HttpError(503, 'portal_not_configured', 'The billing portal is not configured yet.');
  const session = await getStripe(env).billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    configuration,
    return_url: `${env.SITE_ORIGIN}/#/account`,
  });
  return json({ url: session.url });
}

export async function erase(request: Request, env: Cloudflare.Env): Promise<Response> {
  const { user, jwt } = await requireUser(request, env);
  const row = await readOwnBilling(env, jwt);
  if (!row) return json({ erased: false });
  try {
    // Deleting the customer cancels every subscription it has, at once.
    await getStripe(env).customers.del(row.stripe_customer_id);
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Already gone (a retry after a half-finished erasure): that is the outcome we want.
    if (code !== 'resource_missing') {
      throw new HttpError(502, 'stripe_delete_failed', `Stripe could not cancel your plan: ${(err as Error).message}`);
    }
  }
  await clearEntitlements(env, user.id, row.stripe_customer_id);
  return json({ erased: true });
}
