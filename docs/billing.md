# Support plan: setup and operation

An optional recurring support plan, through Stripe, on the Applied Relevance Stripe account that
LinguaMama also uses. Every study feature stays free. The spec is in
[`.kiro/specs/stripe-support-plan/`](../.kiro/specs/stripe-support-plan/); the database side is in
[`backend/README.md`](backend/README.md).

## How it fits together

| Piece | Where |
|---|---|
| Billing API (`/api/billing/prices`, `checkout`, `coffee`, `plan`, `cancel`, `switch`, `card`, `erase`, `webhook`) | `worker/`, served by the same Cloudflare Worker as the site, only for `/api/*` |
| Entitlement mirror | `glorieta.billing`, written only by `glorieta.billing_apply()` (HMAC-signed calls) |
| Catalog (Product, Prices, Feature; the coffee Product) | created by `scripts/stripe-catalog.mjs` |
| Support page, badge, profile card | `src/screens/Support.tsx`, `src/screens/Profile.tsx`, `src/App.tsx` |

## Keys and secrets

Three Stripe credentials and one shared key, each saved in 1Password. None goes in the repo,
`.env.production` or the bundle; `npm run build` fails if one reaches `dist/`.

| Name | What | Used by |
|---|---|---|
| `STRIPE_RESTRICTED_KEY` | Restricted key, "Glorieta Worker": **Write** Checkout Sessions, Customers, Subscriptions; **Read** Products, Prices, Invoices, SetupIntents, Entitlements; everything else None | the Worker (`wrangler secret`) |
| `STRIPE_SETUP_KEY` | Restricted key, "Glorieta catalog": **Write** Products, Prices, Entitlements Features; everything else None | `scripts/stripe-catalog.mjs`, run by hand |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Glorieta webhook endpoint (`whsec_…`) | the Worker (`wrangler secret`) |
| `BILLING_HMAC_KEY` | 64 hex characters, shared by the Worker and `glorieta.billing_key` | the Worker (`wrangler secret`) and the database |

Each exists once for test mode and once for live mode, except `BILLING_HMAC_KEY`, which is one value
for the one database.

## Test-mode setup

1. In the Stripe dashboard, **test mode**, Developers → API keys → Create restricted key: create
   "Glorieta Worker" and "Glorieta catalog" with the permissions above. Save both in 1Password.
   The test "Glorieta Worker" key is "Glorieta Worker (Stripe test restricted key)", item id
   `633fyrwp5w3ypgcaij4fx7z6hy`, and is set as the Worker secret `STRIPE_RESTRICTED_KEY`.
2. Create the catalog. Amounts are euro cents:

   ```bash
   STRIPE_SETUP_KEY="$(op read 'op://AppliedRelevance/<Glorieta catalog test key>/credential')" node scripts/stripe-catalog.mjs --monthly 300 --annual 3000
   ```

   In test mode the catalog exists, created with the test "Glorieta Worker" key as `STRIPE_SETUP_KEY`
   (that key also has catalog write): product `glorieta_supporter`, prices
   `price_1Uc38g23tZR70mOfmNijZBL0` (300 cents a month) and `price_1Uc38h23tZR70mOfkfZz7tNc` (3000 cents a
   year).
3. The HMAC key is already in place: 1Password item "Glorieta billing HMAC key" (AppliedRelevance
   vault), `glorieta.billing_key`, and the Worker secret `BILLING_HMAC_KEY`. To rotate it, generate a
   new one and save it in 1Password:

   ```bash
   openssl rand -hex 32
   ```

   then insert it into the database (Supabase SQL editor, project `qgfmwstgkwyqqwyqroav`) and set the
   Worker secret in step 5 in the same sitting, since calls fail while the two differ:

   ```sql
   insert into glorieta.billing_key (secret) values ('<the 64 hex characters>')
   on conflict (id) do update set secret = excluded.secret;
   ```

4. The webhook endpoint takes `https://glorieta.anaidic.com/api/billing/webhook`, the events
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and
   `entitlements.active_entitlement_summary.updated` and nothing else, API version
   `2026-08-26.dahlia` (the Worker's), and metadata `app=glorieta`. In test mode it exists:
   `we_1Ubgrm23tZR70mOfGtIlomnb`, secret in 1Password as "Glorieta Stripe webhook secret (test mode)".
   For live mode, create it the same way, with the Stripe CLI switched to live mode:

   ```bash
   stripe webhook_endpoints create --live -d url=https://glorieta.anaidic.com/api/billing/webhook -d api_version=2026-08-26.dahlia -d "description=Glorieta billing" -d "metadata[app]=glorieta" -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=customer.subscription.updated" -d "enabled_events[]=customer.subscription.deleted" -d "enabled_events[]=entitlements.active_entitlement_summary.updated"
   ```

   The signing secret is shown only in that response; save it to 1Password at once.
5. Set the Worker's secrets:

   ```bash
   npx wrangler secret put STRIPE_RESTRICTED_KEY
   ```

   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

   ```bash
   npx wrangler secret put BILLING_HMAC_KEY
   ```

## Local development

`.dev.vars` (git-ignored, copied from `.dev.vars.example`) holds the three Worker secrets in test
mode. The webhook secret there is the one `stripe listen` prints, not the dashboard endpoint's.

```bash
npx wrangler dev --port 8787
```

```bash
stripe listen --forward-to localhost:8787/api/billing/webhook
```

```bash
npm run dev
```

Vite proxies `/api` to the Worker on 8787.

## Checks before live mode

1. Subscribe with card `4242 4242 4242 4242`: `glorieta.billing.entitlements` holds
   `glorieta_supporter` and the badge shows.
2. `stripe events resend <evt_…>` for the last applied event: `updated_at` and `history` unchanged.
3. Cancel on the support page, advance a test clock past the period end: the entitlements empty.
4. A consenting test account gets `glorieta_supporter_started` and `_ended` on its Podograph contact; a
   non-consenting one gets nothing.
5. Delete my data as a supporter: the Stripe customer is deleted, the billing row is gone, and the
   trailing webhooks create no new row.
6. After LinguaMama's handoff is deployed: a subscription for an email that also has a LinguaMama
   `people` row leaves that row unchanged, and LinguaMama's pricing does not list Glorieta Supporter.

## Live mode

The live "Glorieta Worker" key is in 1Password: "Glorieta Worker (Stripe live restricted key)"
(AppliedRelevance vault, item id `7hbpjaz7flgfokj4xrg544m43q`; read it by id, since the parentheses
are not valid in an `op://` reference).

Repeat steps 1, 2, 4 and 5 of the setup in **live mode** (the HMAC key stays as it is), then:

```bash
npm run deploy
```

## Operating notes

- Each webhook delivery logs one JSON line in Workers Logs: event id, type and outcome (`applied`,
  `noop`, `no_row`, `foreign`, `ignored`, `linked`, `no_profile`, `unpaid`, or `failed` with the error). No
  email addresses are logged.
- A failed delivery returns 500 and Stripe retries it. Replays are harmless: an event already applied
  changes nothing.
- "Invítame a un café / Buy me a coffee" is a one-time payment on the Product `glorieta_coffee`: €3, €5 or
  €10, or another whole number of euros from €2 to €200, checked by the Worker. It needs a signed-in account,
  so the payment lands on the person's Glorieta-tagged customer, and Checkout creates an invoice as the
  receipt. Once paid, the webhook records it in `glorieta.coffees` (`billing_apply` op `coffee`, keyed by the
  Checkout Session, so a replay adds nothing), which earns the permanent Café badge. Mecenas shows instead
  while a plan is active.
- Supporters manage the plan on the support page (`worker/manage.ts`), not in Stripe's hosted portal,
  which can only carry the shared account's branding. A new card is entered on a setup-mode Checkout
  page and becomes the plan's card when the webhook sees it complete.
- Receipts, failed-payment and renewal emails come from Stripe, under the account's settings.
- Customers, subscriptions, products and prices Glorieta creates carry metadata `app=glorieta`.
  Glorieta ignores every customer without it.
