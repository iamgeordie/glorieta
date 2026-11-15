// Creates or checks Glorieta's support-plan catalog in Stripe, idempotently:
//   Product        glorieta_supporter           "Glorieta Supporter", metadata app=glorieta,
//                                               card statement "APPREL GLORIETA"
//   Feature        lookup key glorieta_supporter, attached to the Product
//   Prices         glorieta_supporter_monthly / glorieta_supporter_annual, EUR, recurring
//
// Usage (amounts in euro cents, so no rounding is ever involved):
//   STRIPE_SETUP_KEY=rk_test_... node scripts/stripe-catalog.mjs --monthly 300 --annual 3000
//   STRIPE_SETUP_KEY=rk_live_... node scripts/stripe-catalog.mjs --monthly 300 --annual 3000 --live
//
// STRIPE_SETUP_KEY is a restricted key used only here, with write access to Products, Prices,
// Entitlements Features. It is not the Worker's key, which can only
// read the catalog. Running it again changes nothing that already matches. A Price whose amount differs
// is never edited (Stripe Prices are immutable): pass --replace-prices to create a new one and move the
// lookup key to it; existing subscriptions keep their old Price. Tax behaviour (VAT inclusive or not) is
// left to the Stripe account's default, like the rest of its tax configuration.
import Stripe from 'stripe';

const APP = 'glorieta';
const PRODUCT_ID = 'glorieta_supporter';
const FEATURE_KEY = 'glorieta_supporter';
const PRICES = { month: 'glorieta_supporter_monthly', year: 'glorieta_supporter_annual' };
const SITE = 'https://glorieta.anaidic.com';
// What a supporter's card statement shows for the plan, instead of the account-wide "APPLIED RELEVANCE".
const STATEMENT_DESCRIPTOR = 'APPREL GLORIETA';
// The product picture on the checkout page and in receipts.
const IMAGE = `${SITE}/brand/glorieta-icon.png`;

function args() {
  const a = process.argv.slice(2);
  const val = (name) => {
    const i = a.indexOf(name);
    return i === -1 ? undefined : a[i + 1];
  };
  const cents = (name) => {
    const v = val(name);
    if (!v || !/^[1-9][0-9]*$/.test(v)) throw new Error(`${name} <euro cents> is required, a positive whole number (e.g. 300 for €3.00)`);
    return Number(v);
  };
  return { month: cents('--monthly'), year: cents('--annual'), live: a.includes('--live'), replace: a.includes('--replace-prices') };
}

const opts = args();
const key = process.env.STRIPE_SETUP_KEY;
if (!key) throw new Error('Set STRIPE_SETUP_KEY (from 1Password).');
const live = /^(rk|sk)_live_/.test(key);
if (!/^(rk|sk)_(live|test)_/.test(key)) throw new Error('STRIPE_SETUP_KEY is not a Stripe key.');
if (live !== opts.live) throw new Error(live ? 'This is a live key: pass --live to confirm.' : '--live was passed with a test key.');

const stripe = new Stripe(key, { apiVersion: Stripe.API_VERSION, appInfo: { name: 'glorieta-catalog' } });
const log = (what, id, action) => console.log(`${action.padEnd(9)} ${what.padEnd(16)} ${id}`);

// Product, with a fixed id so it is found again without searching.
let product;
try {
  product = await stripe.products.retrieve(PRODUCT_ID);
  if (product.metadata.app !== APP) throw new Error(`Product ${PRODUCT_ID} exists without metadata app=${APP}; refusing to touch it.`);
  if (!product.active || product.statement_descriptor !== STATEMENT_DESCRIPTOR || product.images?.[0] !== IMAGE) {
    product = await stripe.products.update(PRODUCT_ID, { active: true, statement_descriptor: STATEMENT_DESCRIPTOR, images: [IMAGE] });
    log('product', product.id, 'updated');
  } else log('product', product.id, 'ok');
} catch (err) {
  if (err?.code !== 'resource_missing') throw err;
  product = await stripe.products.create({
    id: PRODUCT_ID,
    name: 'Glorieta Supporter',
    statement_descriptor: STATEMENT_DESCRIPTOR,
    images: [IMAGE],
    description: 'Optional support plan for Glorieta, the free study app for the Spanish driving theory test. Every study feature stays free.',
    metadata: { app: APP },
  });
  log('product', product.id, 'created');
}

// Entitlements Feature, and its attachment to the Product.
let feature = (await stripe.entitlements.features.list({ lookup_key: FEATURE_KEY, limit: 1 })).data[0];
if (feature) {
  if (feature.metadata.app !== APP) throw new Error(`Feature ${FEATURE_KEY} exists without metadata app=${APP}; refusing to use it.`);
  log('feature', feature.id, 'ok');
} else {
  feature = await stripe.entitlements.features.create({ name: 'Glorieta Supporter', lookup_key: FEATURE_KEY, metadata: { app: APP } });
  log('feature', feature.id, 'created');
}
const attached = (await stripe.products.listFeatures(PRODUCT_ID, { limit: 100 })).data.some((pf) => pf.entitlement_feature.id === feature.id);
if (attached) log('product feature', FEATURE_KEY, 'ok');
else {
  await stripe.products.createFeature(PRODUCT_ID, { entitlement_feature: feature.id });
  log('product feature', FEATURE_KEY, 'attached');
}

// The two Prices, by lookup key.
const existing = (await stripe.prices.list({ lookup_keys: Object.values(PRICES), limit: 10 })).data;
const priceIds = {};
for (const [interval, lookup_key] of Object.entries(PRICES)) {
  const amount = opts[interval];
  const current = existing.find((p) => p.lookup_key === lookup_key);
  const matches =
    current &&
    current.active &&
    current.unit_amount === amount &&
    current.currency === 'eur' &&
    current.recurring?.interval === interval &&
    current.product === PRODUCT_ID &&
    current.metadata.app === APP;
  if (matches) {
    priceIds[interval] = current.id;
    log(`price ${interval}`, `${current.id} ${amount} eur cents`, 'ok');
    continue;
  }
  if (current && !opts.replace) {
    throw new Error(
      `Price ${lookup_key} (${current.id}) is ${current.unit_amount} ${current.currency}/${current.recurring?.interval}, active=${current.active}. ` +
        'Pass --replace-prices to create a new Price and move the lookup key to it.',
    );
  }
  const created = await stripe.prices.create({
    product: PRODUCT_ID,
    currency: 'eur',
    unit_amount: amount,
    recurring: { interval },
    lookup_key,
    transfer_lookup_key: Boolean(current),
    metadata: { app: APP },
  });
  if (current) await stripe.prices.update(current.id, { active: false });
  priceIds[interval] = created.id;
  log(`price ${interval}`, `${created.id} ${amount} eur cents`, current ? 'replaced' : 'created');
}

console.log(`\nCatalog ready (${live ? 'live' : 'test'} mode): monthly ${priceIds.month}, annual ${priceIds.year}.`);
