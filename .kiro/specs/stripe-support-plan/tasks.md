# Implementation Plan: stripe-support-plan

Tasks run in order. Each ends with `npm test` passing and a commit to `main` that stages only its
own files. Tasks marked **(Geordie)** need access only Geordie has: the Stripe dashboard,
1Password, or the switch to live mode. Development uses Stripe test mode and the real `glorieta`
schema; nothing is mocked.

- [x] 1. Billing schema (003) and its tests
- [x] 1.1 Write `docs/backend/glorieta-schema-003-billing.sql`
  - `glorieta.only_glorieta_keys(text[])`, `glorieta.billing`, `glorieta.billing_key`, exactly as in
    the design's Data Models section, each `create … if not exists` / `create or replace`
  - `glorieta.billing_apply(p_body text, p_sig text) returns jsonb`: `security definer`,
    `set search_path = ''`, HMAC-SHA256 check with `extensions.hmac`, 300-second `issued_at`
    window, ops `link_customer`, `entitlements`, `clear`, `crm_reported`, history capped at 50
  - Row level security, the single `billing_select_own` policy, revokes and grants as designed:
    `anon` gets `usage` on the schema and `execute` on `billing_apply` only
  - `delete_my_data()` rewritten in `plpgsql`, still `security invoker`, raising
    `active_support_plan` while the caller's row holds `glorieta_supporter`
  - _Requirements: 4.1, 4.4, 4.5, 4.6, 4.8, 6.3, 8.3_
- [x] 1.2 Extend `scripts/test-schema.mjs` to apply 003 after 002, twice
  - Model Supabase's `extensions` schema in PGlite with the `pgcrypto` contrib extension, and sign
    test calls with `node:crypto` `createHmac('sha256', key)`
  - Assert: unsigned, wrongly signed and stale calls are refused; a replayed event id changes
    nothing; non-`glorieta_` keys are never stored; history stops at 50; unknown customer returns
    `no_row` and creates nothing; `link_customer` keeps the first customer on conflict and returns
    `no_profile` without a profile; user A cannot read user B's row; no client role can insert,
    update or delete `billing`; no role can read `billing_key`; `anon` holds exactly one execute
    grant in the schema and no table grant; `delete_my_data` refuses a supporter, succeeds after
    `clear`, and removes the billing row through the profile foreign key
  - _Requirements: 4.1–4.8, 6.3, 8.3, 9.5_
- [x] 1.3 Update `docs/backend/README.md`: the third file, the one `security definer` function and
  the one `anon` grant (replacing "no `SECURITY DEFINER` function, grants nothing to `anon`"), how
  `billing_key` is set, and the new tests
  - _Requirements: 6.3, 6.4_

- [x] 2. Worker scaffold
- [x] 2.1 Add the `stripe` npm package at major version 22; add `worker/index.ts` with a router
  that answers only `/api/billing/*` and returns a JSON 404 for any other `/api/*` path
- [x] 2.2 Update `wrangler.jsonc`: `main`, `compatibility_flags: ["nodejs_compat"]`,
  `assets.binding`, `assets.run_worker_first: ["/api/*"]`, and the `vars` from the design
- [x] 2.3 Add `worker/stripe.ts` (the only `new Stripe()`, API version `2026-03-25.dahlia`, fetch
  HTTP client, SubtleCrypto provider) and `worker/auth.ts` (`Authorization: Bearer`, resolved
  with `supabase.auth.getUser`, 401 `unauthenticated` otherwise)
  - _Requirements: 2.5, 6.1_
- [x] 2.4 Add a `tsconfig` for `worker/` with Workers types, and include it in `npm run build`
- [x] 2.5 Proxy `/api` to `wrangler dev` (port 8787) in `vite.config.ts`; add a `.dev.vars.example`
  listing the three secret names with no values
- [x] 2.6 Add `scripts/assert-no-secrets.mjs`: fail if `dist/` contains `sk_`, `rk_`, `whsec_` or
  `sb_secret_` followed by key characters; it runs at the end of `npm run build` (so in every
  deploy), its detector `scripts/secret-scan.mjs` is unit-tested in `npm test`, and `npm test` runs
  `worker/*.test.ts`
  - _Requirements: 6.4, 6.5, 9.5_

- [x] 3. Pure billing logic
- [x] 3.1 `worker/catalog.ts`: `month` → `glorieta_supporter_monthly`, `year` →
  `glorieta_supporter_annual`; reject any other interval
  - _Requirements: 1.5, 2.1_
- [x] 3.2 `worker/entitlements.ts`: filter keys to `glorieta_*`, supporter decision, and the
  Podograph decision (consent on, `crm_synced_at` set, reported state differs)
  - _Requirements: 4.5, 4.7, 8.4, 8.5_
- [x] 3.3 `worker/entitlements.test.ts` covering every branch of 3.2
  - _Requirements: 9.5_

- [x] 4. Mirror client
- [x] 4.1 `worker/mirror.ts`: build the body as a JSON string with `op` and `issued_at`, sign it
  with `BILLING_HMAC_KEY` through Web Crypto, call `rpc('billing_apply', { p_body, p_sig })` on
  schema `glorieta` with the publishable key; throw on any database error
- [x] 4.2 `readOwnBilling(jwt)`: read the caller's `glorieta.billing` row with their JWT
  - _Requirements: 4.6, 6.3_

- [x] 5. User-facing endpoints
- [x] 5.1 `GET /api/billing/prices`: both Prices by lookup key with the product expanded, both
  tagged `app=glorieta`, else 503 `catalog_incomplete`; `Cache-Control: public, max-age=300`
  - _Requirements: 1.3, 1.5_
- [x] 5.2 `POST /api/billing/checkout`: 409 `already_supporter`; reuse the stored customer or
  create one tagged `app=glorieta` and `glorieta_user_id`, link it, delete the loser of a race;
  409 `no_profile`; Checkout Session exactly as in the design (subscription metadata, automatic tax,
  required billing address, promotion codes, `client_reference_id`, locale, `?checkout=` return
  URLs)
  - _Requirements: 2.1–2.6_
- [x] 5.3 `POST /api/billing/portal`: 404 `no_customer`; otherwise a portal session with
  `STRIPE_PORTAL_CONFIGURATION` and `return_url` `#/account`
  - _Requirements: 3.1, 3.3, 3.4_
- [x] 5.4 `POST /api/billing/erase`: delete the customer (treating `resource_missing` as done),
  then `clear`; 502 `stripe_delete_failed` stops the erasure
  - _Requirements: 8.1, 8.2_

- [x] 6. Webhook
- [x] 6.1 `POST /api/billing/webhook`: `constructEventAsync` (400 on failure); the four event
  types, everything else 200; retrieve the customer and skip unless `metadata.app === 'glorieta'`,
  treating a deleted customer as an empty entitlement set; list active entitlements from Stripe and
  call `billing_apply` `entitlements`; `link_customer` for `checkout.session.completed`; 500 on any
  failure; one log line per event with id, type and outcome, and no email address
  - _Requirements: 4.2, 4.3, 4.4, 4.7, 4.8, 5.1–5.4_
- [x] 6.2 `worker/crm.ts`: post `glorieta_supporter_started` / `glorieta_supporter_ended` to
  `/leads/capture` with no `Origin` header when 3.2 says so, then `crm_reported`; a Podograph
  failure returns 500 from the webhook
  - _Requirements: 8.4, 8.5_
- [x] 6.3 `worker/webhook.test.ts`: signatures made with `stripe.webhooks.generateTestHeaderString`
  and a test secret; a bad signature returns 400, an unknown event type returns 200, and neither
  reaches Stripe or the database
  - _Requirements: 5.1, 5.3, 9.5_

- [x] 7. Supporter UI
- [x] 7.1 `src/billingStrings.ts` with every new string in `{ es, en }`; map `active_support_plan`,
  `already_supporter`, `no_profile`, `no_customer`, `catalog_incomplete` and
  `stripe_delete_failed` in `src/lib/auth-errors.ts`, and extend `auth-errors.test.ts` to check
  them in both languages
  - _Requirements: 7.3_
- [x] 7.2 `src/lib/billing.ts`: `getPrices`, `startCheckout`, `openPortal`, `eraseBilling`,
  `readBilling`, present only when `authEnabled`
- [x] 7.3 `src/screens/Support.tsx` at `#/support`: what the plan pays for, that every study
  feature stays free, the plans from Stripe, a sign-in prompt when signed out, Manage when already a
  supporter, thank-you and cancelled notices from `?checkout=` (read once, then removed from the
  address bar), and a re-read of the mirror on every open
  - _Requirements: 2.6, 2.7, 2.8, 7.4, 7.5_
- [x] 7.4 Menu bar link in `src/Bar.tsx`; supporter badge and Manage plan in
  `src/screens/Profile.tsx` and on the account link; no link from the welcome or sign-up flows
  - _Requirements: 7.1, 7.2_
- [x] 7.5 `deleteMyData()` in `src/lib/sync.ts` calls `eraseBilling()` first and stops on its error
  - _Requirements: 8.1, 8.2_
- [x] 7.6 Hide the menu link, badge, Manage button and `#/support` route in TV mode (`src/lib/tv.ts`)
  - _Requirements: 7.6_
- [x] 7.7 Check the signed-out support page in the browser pane (production build, `wrangler dev`
  behind it) in ES and EN, at phone and desktop width, in TV mode, and the `?checkout=` notices
- [ ] 7.8 Check the signed-in views (plans with Choose buttons, supporter badge in the menu bar and
  profile, the profile's support card, Manage, erase) with a real signed-in test account, as part of
  task 9.1

- [ ] 8. Stripe test-mode setup
- [x] 8.1 `scripts/stripe-catalog.mjs`: idempotent by lookup key; creates the Product, both EUR
  Prices (amounts as arguments), the `glorieta_supporter` Feature, the product feature, and the
  portal configuration limited to the two Prices; all tagged `app=glorieta`; prints the portal
  configuration id
  - _Requirements: 1.1–1.4, 3.2_
- [ ] 8.2 **(Geordie)** In Stripe test mode: create the Worker's restricted key with the design's
  permissions, and a second restricted key for `scripts/stripe-catalog.mjs` (write on Products,
  Prices, Entitlements Features and Customer portal configuration; the Worker's key can only read the
  catalog). Save both in 1Password; give Claude the monthly and annual amounts. Steps in
  `docs/billing.md`
  - _Requirements: 6.1, 6.4_
- [ ] 8.3 Run the catalog script against test mode with the agreed amounts, €3 a month and €30 a
  year (`--monthly 300 --annual 3000`); add the portal configuration id to `vars`
- [x] 8.4 Apply 003 to the live `glorieta` schema the way 002 was applied: plain SQL in one
  transaction, `notify pgrst, 'reload schema'`, no migration-history entry; then check read-only
  that RLS is on for all eight tables, `anon` holds only the `billing_apply` grant, and existing
  rows are unchanged
  - _Requirements: 4.6, 6.3_
- [x] 8.5 Generate `BILLING_HMAC_KEY`, save it in 1Password (AppliedRelevance vault, "Glorieta billing
  HMAC key"), insert it into `glorieta.billing_key`, and set it as a Worker secret; checked live: a
  call signed by `worker/mirror.ts` with it is accepted and one with another key is refused
  - _Requirements: 6.2, 6.4_
- [ ] 8.5b **(Geordie)** Set `STRIPE_RESTRICTED_KEY` and `STRIPE_WEBHOOK_SECRET` on the Worker with
  `wrangler secret put`
  - _Requirements: 6.2, 6.4_
- [ ] 8.6 **(Geordie)** Create the test-mode webhook endpoint for
  `https://glorieta.anaidic.com/api/billing/webhook` with only the four event types, and save its
  signing secret
  - _Requirements: 5.5, 6.2_

- [ ] 9. End-to-end in test mode
- [ ] 9.1 Locally (`wrangler dev`, `stripe listen`, `npm run dev`): subscribe with `4242 4242 4242
  4242`, see `glorieta_supporter` in the mirror and the badge in the app
  - _Requirements: 9.1_
- [ ] 9.2 `stripe events resend` the last applied event; `updated_at` and `history` unchanged
  - _Requirements: 9.3_
- [ ] 9.3 Cancel in the portal, advance a Stripe test clock past the period end, see the mirror empty
  - _Requirements: 9.2_
- [ ] 9.4 With a consenting test account, see `glorieta_supporter_started` and `_ended` on its
  Podograph contact through the Podograph MCP; with a non-consenting one, see nothing
  - _Requirements: 8.4, 8.5_
- [ ] 9.5 Erase data as a supporter: customer deleted in Stripe, billing row gone, no new row after
  the trailing webhooks
  - _Requirements: 4.8, 8.1, 8.3_
- [ ] 9.6 After the LinguaMama handoff is deployed: subscribe with an email that has a LinguaMama
  `people` row and confirm, read-only on project `myekgdmvvpyfyvexmrgd`, that the row is unchanged
  and `get-pricing` lists no *Glorieta Supporter*
  - _Requirements: 5.6, 9.4_
- [ ] 9.7 Deploy with test-mode keys and repeat 9.1 against `glorieta.anaidic.com`

- [ ] 10. Live mode **(Geordie)**
- [ ] 10.1 Live restricted key, live catalog through `scripts/stripe-catalog.mjs`, live portal
  configuration id in `vars`, live webhook endpoint and secret, `wrangler secret put` for both,
  `npm run deploy`
  - _Requirements: 1.4, 9.6_
- [ ] 10.2 One real subscription and cancellation on Geordie's own account; refund it in Stripe
  - _Requirements: 9.6_
