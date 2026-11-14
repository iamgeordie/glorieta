// The only place in this repo that constructs a Stripe client. Every Worker module that talks to
// Stripe calls getStripe(). The API version is pinned to the one this SDK release is typed against,
// so the types and the wire agree without overrides.
import Stripe from 'stripe';

export const STRIPE_API_VERSION = Stripe.API_VERSION;

let client: Stripe | null = null;

export function getStripe(env: Pick<Cloudflare.Env, 'STRIPE_RESTRICTED_KEY'>): Stripe {
  if (client) return client;
  const key = env.STRIPE_RESTRICTED_KEY;
  if (!key) throw new Error('STRIPE_RESTRICTED_KEY is not set');
  if (!key.startsWith('rk_')) throw new Error('STRIPE_RESTRICTED_KEY must be a restricted key (rk_…), never a secret key');
  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: 'glorieta' },
  });
  return client;
}

/** Web Crypto signature checks for webhooks (the Workers runtime has no Node crypto by default). */
export const webhookCrypto = Stripe.createSubtleCryptoProvider();

export { Stripe };
