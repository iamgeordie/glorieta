// POST /api/billing/webhook: Stripe events for the shared Applied Relevance account. Only Glorieta's own
// customers are acted on; everything else is acknowledged and left alone.
import type Stripe from 'stripe';
import { APP_TAG } from './catalog.ts';
import { sendSupporterSignal } from './crm.ts';
import { crmSignal, glorietaKeys } from './entitlements.ts';
import { json } from './http.ts';
import { applySavedCard } from './manage.ts';
import { applyEntitlements, linkCustomer, recordCoffee, recordCrmReported } from './mirror.ts';
import { getStripe, webhookCrypto } from './stripe.ts';

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'entitlements.active_entitlement_summary.updated',
] as const;

type Outcome = 'applied' | 'noop' | 'no_row' | 'foreign' | 'ignored' | 'linked' | 'no_profile' | 'unpaid';

const idOf = (ref: string | { id: string } | null | undefined): string | null =>
  typeof ref === 'string' ? ref : (ref?.id ?? null);

export async function webhook(request: Request, env: Cloudflare.Env): Promise<Response> {
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) return json({ error: { code: 'bad_signature', message: 'No Stripe-Signature header.' } }, 400);
  const raw = await request.text();
  const stripe = getStripe(env);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, env.STRIPE_WEBHOOK_SECRET, undefined, webhookCrypto);
  } catch (err) {
    console.warn('[webhook] signature verification failed', (err as Error).message);
    return json({ error: { code: 'bad_signature', message: 'Invalid signature.' } }, 400);
  }

  try {
    const outcome = await dispatch(stripe, env, event);
    console.log(JSON.stringify({ webhook: event.id, type: event.type, outcome }));
    return json({ received: true, outcome });
  } catch (err) {
    console.error(JSON.stringify({ webhook: event.id, type: event.type, outcome: 'failed', error: (err as Error).message }));
    // 500, so Stripe retries the delivery.
    return json({ error: { code: 'webhook_failed', message: (err as Error).message } }, 500);
  }
}

async function dispatch(stripe: Stripe, env: Cloudflare.Env, event: Stripe.Event): Promise<Outcome> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = idOf(session.customer);
      const userId = session.client_reference_id;
      if (!customerId || !userId) return 'ignored';
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || customer.metadata.app !== APP_TAG) return 'foreign';
      // A setup-mode session is the "change card" page: make the saved card the plan's card.
      if (session.mode === 'setup') return applySavedCard(stripe, session);
      // The customer was linked when Checkout started; this only confirms it. No entitlements here:
      // the subscription and entitlement events that follow carry those.
      const link = await linkCustomer(env, userId, customerId);
      if (link.status !== 'linked') return link.status;
      // A one-time coffee: record it once it is paid; that is what earns the Café badge.
      if (session.mode === 'payment' && session.metadata?.kind === 'coffee') {
        if (session.payment_status !== 'paid') return 'unpaid';
        // The amount before tax: the price the person chose, the same in every country.
        const amount = session.amount_subtotal;
        if (amount === null || !session.currency) throw new Error(`Coffee session ${session.id} has no amount`);
        return (await recordCoffee(env, customerId, session.id, amount, session.currency)).status;
      }
      return link.status;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = idOf(event.data.object.customer);
      return customerId ? syncCustomer(stripe, env, customerId, event.id) : 'ignored';
    }
    case 'entitlements.active_entitlement_summary.updated': {
      const customerId = idOf(event.data.object.customer);
      return customerId ? syncCustomer(stripe, env, customerId, event.id) : 'ignored';
    }
    default:
      return 'ignored';
  }
}

/**
 * Mirrors the customer's current active entitlements, fetched from Stripe (never from the event, so
 * event order does not matter), then tells Podograph if a consenting person's status changed.
 */
async function syncCustomer(stripe: Stripe, env: Cloudflare.Env, customerId: string, eventId: string): Promise<Outcome> {
  const customer = await stripe.customers.retrieve(customerId);
  let keys: string[];
  if (customer.deleted) {
    // A deleted customer has no metadata to check. It holds nothing any more, and billing_apply()
    // touches only a row that already holds this customer id, which only a Glorieta customer can have.
    keys = [];
  } else {
    if (customer.metadata.app !== APP_TAG) return 'foreign';
    const active = await stripe.entitlements.activeEntitlements.list({ customer: customerId, limit: 100 });
    keys = glorietaKeys(active.data.map((e) => e.lookup_key));
  }

  const result = await applyEntitlements(env, eventId, customerId, keys);
  if (result.status === 'no_row') return 'no_row';

  const signal = crmSignal(result);
  if (signal) {
    const email = customer.deleted ? null : customer.email;
    if (email) {
      await sendSupporterSignal(env, email, signal);
      await recordCrmReported(env, result.user_id, signal.state);
    } else {
      console.warn(JSON.stringify({ webhook: eventId, crm: 'skipped', reason: 'customer has no email' }));
    }
  }
  return result.status;
}
