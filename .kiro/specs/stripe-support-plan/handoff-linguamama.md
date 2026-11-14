# Handoff to LinguaMama: leave Glorieta's Stripe customers and products alone

**Run in:** the `appliedrelevance/linguamama` checkout, on the branch that checkout is on. Run
`git status` first; if it shows changes you did not make, stop and ask Geordie.

## Why

Glorieta (`iamgeordie/glorieta`) is adding a support plan on the same Applied Relevance Stripe
account LinguaMama uses. Stripe delivers every account event to both apps' webhook endpoints.
Glorieta tags everything it creates with metadata `app=glorieta`:

- Customers: `app=glorieta`, `glorieta_user_id=<Glorieta auth.users id>`
- Subscriptions: `app=glorieta`, `glorieta_user_id=<id>`
- Product *Glorieta Supporter*, its two Prices, and the Entitlements Feature
  `glorieta_supporter`: `app=glorieta`

Glorieta ignores every customer not tagged `app=glorieta`. LinguaMama today has four paths that
can reach a Glorieta customer or product, all in `supabase/functions/`:

| # | Where | What goes wrong for a person who uses one email in both apps |
|---|---|---|
| 1 | `_shared/entitlements-sync.ts`, `resolvePerson()` steps 2–3 | A Glorieta event misses the customer-id fast path, falls back to the customer's email, finds the LinguaMama `people` row, **overwrites its `stripe_customer_id`** with the Glorieta customer and **replaces its `sources.stripe` slice with `['glorieta_supporter']`**, removing their paid LinguaMama entitlements |
| 2 | `stripe-webhook/index.ts`, `persistCustomerIdFromCheckout()` | A Glorieta `checkout.session.completed` writes the Glorieta customer id onto the `people` row matched by email, when that row has no customer id yet |
| 3 | `create-checkout-session/index.ts`, `stripe.customers.list({ email, limit: 1 })` | LinguaMama checkout reuses the Glorieta customer, so the LinguaMama subscription lands on a customer tagged `app=glorieta` |
| 4 | `get-pricing/index.ts`, `stripe.products.list({ active: true })` | *Glorieta Supporter* appears on LinguaMama's pricing page |

## Changes

1. **Webhook guard, before any write.** In `stripe-webhook/index.ts`, retrieve the customer once
   per event and return 200 with no side effect when `customer.metadata.app === 'glorieta'`. For
   `checkout.session.completed` use `session.customer`; for the subscription events use
   `subscription.customer`; for `entitlements.active_entitlement_summary.updated` use
   `summary.customer`. Log `[stripe-webhook] skipped glorieta customer <id> (<event.id>)`.
2. **Same guard inside `resolvePerson()`.** In step 2, after `stripe.customers.retrieve`, return
   `null` when `customer.metadata?.app === 'glorieta'`, so no other caller of `syncEntitlements`
   can take the email fallback for a Glorieta customer.
3. **Checkout customer lookup.** In `create-checkout-session/index.ts`, replace
   `stripe.customers.list({ email, limit: 1 })` with a lookup that skips Glorieta customers:

   ```ts
   const existing = await stripe.customers.list({ email: lower, limit: 10 })
   const reusable = existing.data.find((c) => c.metadata?.app !== 'glorieta')
   ```

   Use `customers.list`, not `customers.search`: search indexes new customers with a delay, and
   list is immediate. Add `app: 'linguamama'` to the metadata of customers LinguaMama creates.
4. **Pricing filter.** In `get-pricing/index.ts`, drop products and prices whose
   `metadata.app === 'glorieta'` before building the response.
5. **Tests.** Add cases to the existing webhook and entitlements-sync tests: a Glorieta-tagged
   customer whose email matches a `people` row produces no update to `people` and no session
   revocation; `get-pricing` excludes a Glorieta-tagged product.

## Do not

- Do not change LinguaMama's Products, Prices, portal configuration or webhook endpoint in Stripe.
- Do not touch Glorieta's Stripe objects, its webhook endpoint or the shared Supabase project
  `qgfmwstgkwyqqwyqroav`.
- Do not backfill or rewrite existing `people` rows; no Glorieta customer exists yet.

## Verify

1. LinguaMama's own tests pass.
2. In Stripe test mode, with a test `people` row for an email:
   - Glorieta's session creates an `app=glorieta` customer with that email and subscribes it.
   - The `people` row's `stripe_customer_id`, `entitlements` and `entitlements_metadata` are
     unchanged, and LinguaMama's webhook logs show `skipped glorieta customer`.
   - `get-pricing` does not list *Glorieta Supporter*.
   - Starting LinguaMama checkout with that email creates or reuses a non-Glorieta customer.
3. Deploy `stripe-webhook`, `create-checkout-session` and `get-pricing` to **both** Supabase projects
   that receive LinguaMama's Stripe events, and report the commit SHA back to the Glorieta session.
   On the Applied Relevance Stripe account (`acct_103f1123tZR70mOf`), the test-mode webhook goes to
   `myekgdmvvpyfyvexmrgd` and the live-mode webhook goes to `prtfprwryjhspcdoyner`.
   The live project serves 4 active live subscriptions, so deploy there only after the
   test-mode checks pass.

Glorieta's live mode waits for this deploy (Glorieta spec Requirement 5.6 and 9.4).
