# Requirements Document

## Project Description (Input)

Add an optional Stripe support plan to Glorieta (glorieta.anaidic.com), the free, openly
licensed study app for the Spanish permiso B theory test. A signed-in user can subscribe monthly
or annually to support the app, manage the plan in the Stripe customer portal, and gets a
supporter badge. Every study feature stays free for everyone.

The implementation reuses LinguaMama's existing Stripe mechanism: the same Applied Relevance
Stripe account, Stripe Entitlements as the model, hosted Checkout and portal, and a verified
webhook keeping a one-way, idempotent mirror of active entitlement keys. Podograph receives
supporter status for users who consented to marketing, and holds no billing logic. Full context
in [`brief.md`](./brief.md).

## Boundary Context

- **In scope**: Stripe catalog setup for Glorieta; checkout, portal, pricing and webhook
  endpoints; the entitlement mirror in the `glorieta` schema with RLS; supporter UI in ES and EN;
  plan cancellation on account erasure; the consent-gated Podograph supporter signal; test-mode
  end-to-end verification and the switch to live mode.
- **Out of scope**: gating any study content; in-app purchase on iOS or Android; one-time
  donations; LinguaMama's products, prices and app code; billing features in Podograph; tax
  registration and filing.
- **Adjacent expectations**: the Applied Relevance Stripe account has Stripe Tax configured and
  Entitlements available (LinguaMama uses both). LinguaMama ignores Glorieta's customers and
  products (handoff to LinguaMama, Requirement 5.6). Podograph's existing `/leads/capture`
  accepts the supporter events with no change; a durable "current supporter" segment would need
  a Podograph handoff and is not in this spec.

## Requirements

### Requirement 1: Stripe Catalog

**Objective:** As the operator, I want Glorieta's plan defined in Stripe the same way
LinguaMama's tiers are, so that one account and one model cover both apps.

#### Acceptance Criteria

1. The Stripe account shall hold a Product named *Glorieta Supporter* with one monthly and one
   annual recurring Price in EUR.
2. The Stripe account shall hold an Entitlements Feature with lookup key `glorieta_supporter`,
   attached to the *Glorieta Supporter* Product.
3. The Glorieta Product, Prices and Feature shall carry metadata `app=glorieta`.
4. The catalog shall exist in Stripe test mode first and be recreated in live mode only after
   Requirement 9 passes in test mode.
5. The Glorieta App shall read plan names, amounts and intervals from Stripe at runtime, and
   shall contain no hard-coded price amount.

### Requirement 2: Start a Support Plan

**Objective:** As a signed-in learner, I want to start a support plan from inside the app, so
that I can fund Glorieta without leaving my account.

#### Acceptance Criteria

1. When a signed-in user chooses a plan on the support page, the Billing Service shall create a
   Stripe Checkout Session in `subscription` mode for that Price and return its URL.
2. When the user has no Stripe customer yet, the Billing Service shall create one with the
   user's email and metadata `app=glorieta` and `glorieta_user_id=<auth.users id>`, and shall
   store the customer id for that user. It shall never look up an existing Stripe customer by
   email, because the account is shared with LinguaMama.
3. When the user already has a stored Stripe customer id, the Billing Service shall reuse it.
4. The Checkout Session shall enable automatic tax, require a billing address, allow promotion
   codes, set `client_reference_id` to the user's id, and set the Checkout locale to the app's
   current language (`es` or `en`), and set subscription metadata `app=glorieta` and
   `glorieta_user_id=<auth.users id>`.
5. If the request carries no valid Supabase session, then the Billing Service shall refuse it
   with 401 and create nothing in Stripe.
6. If the user already holds `glorieta_supporter`, then the support page shall show the active
   plan and a manage button instead of the plan choices.
7. When Checkout succeeds, the Glorieta App shall show a thank-you screen; when the user
   cancels Checkout, it shall return to the support page with nothing changed.
8. The thank-you screen shall not wait for the webhook. It shall say the badge appears shortly,
   and the profile and support pages shall re-read the mirror each time they open.

### Requirement 3: Manage or Cancel

**Objective:** As a supporter, I want to change my card or cancel without writing to anyone, so
that support stays a free choice.

#### Acceptance Criteria

Revised 2026-11-15: the hosted customer portal carries the shared account's branding (LinguaMama's
logo and "Return to Applied Relevance, LLC") and cannot be branded per configuration, so the plan is
managed inside Glorieta.

1. When a supporter opens the support page, Glorieta shall show the plan's interval and price, its
   renewal or end date, the saved card, and the recent invoices with links to Stripe's invoice pages.
2. A supporter shall be able to cancel at the end of the period, undo that before the period ends,
   and switch between the monthly and annual Prices with proration, without leaving Glorieta.
3. A supporter shall be able to change the card on a Stripe Checkout page in setup mode, in
   Glorieta's branding; when it completes, the Webhook Handler shall make that card the default for
   the customer's invoices and for the Glorieta subscription.
4. If a user without a stored Stripe customer asks for their plan, then the Billing Service shall
   refuse it with 404 `no_customer`; with no live subscription, plan changes are refused with 404
   `no_plan`.

### Requirement 4: Entitlement Mirror

**Objective:** As the operator, I want the database to mirror Stripe rather than run its own
subscription logic, so that Stripe stays the only source of truth, as in LinguaMama.

#### Acceptance Criteria

1. The `glorieta` schema shall hold, per user, the Stripe customer id, the set of active
   entitlement lookup keys, the id of the last applied Stripe event, and a bounded history of
   transitions (LinguaMama's limit: 50 entries).
2. When the Webhook Handler receives `customer.subscription.updated`,
   `customer.subscription.deleted` or `entitlements.active_entitlement_summary.updated` for a
   Glorieta customer, it shall fetch the customer's active entitlements from Stripe and write
   that set to the mirror.
3. When the Webhook Handler receives `checkout.session.completed` for a Glorieta customer, it
   shall store the customer id for the user named by `client_reference_id`, and shall not write
   entitlements from that event.
4. When an event id equals the stored last applied event id, the Webhook Handler shall change
   nothing and return 200.
5. The mirror shall store only lookup keys that start with `glorieta_`.
6. A signed-in user shall be able to read their own mirror row and no other; no client role
   shall be able to insert, update or delete mirror rows.
7. While a subscription is in Stripe status `active` or `trialing`, the mirror shall hold
   `glorieta_supporter` for that user; after Stripe ends the subscription, the mirror shall not.
8. When an event names a Stripe customer with no mirror row (the user erased their data, or the
   row was never created), the Webhook Handler shall return 200 and create no row.

### Requirement 5: Webhook Isolation on a Shared Account

**Objective:** As the operator, I want LinguaMama and Glorieta to share one Stripe account
without either app touching the other's customers.

#### Acceptance Criteria

1. If the Stripe signature on a webhook request does not verify against Glorieta's signing
   secret, then the Webhook Handler shall return 400 and change nothing.
2. When an event concerns a customer whose metadata `app` is not `glorieta`, the Webhook Handler
   shall return 200 and change nothing.
3. When an event type is not one of the four in Requirement 4, the Webhook Handler shall return
   200 and change nothing.
4. If writing the mirror fails, then the Webhook Handler shall return 500 so that Stripe
   retries the delivery.
5. Glorieta's Stripe webhook endpoint shall subscribe only to the four event types in
   Requirement 4.
6. LinguaMama shall leave Glorieta's customers and products alone (LinguaMama handoff; this
   spec verifies it, LinguaMama's session builds it):
   - its webhook skips customers with metadata `app=glorieta`, including through its email
     fallback and its `checkout.session.completed` customer-id write;
   - its checkout never reuses a customer with metadata `app=glorieta` found by email;
   - its pricing endpoint never lists a product with metadata `app=glorieta`.

### Requirement 6: Credentials

**Objective:** As the operator, I want Glorieta's billing to hold the least power it needs, so
that a leak cannot reach LinguaMama's billing or the shared database outside `glorieta`.

#### Acceptance Criteria

1. Glorieta shall call Stripe with its own restricted API key, limited to: write on Checkout
   Sessions, Customers and Subscriptions; read on Products, Prices, Invoices, SetupIntents and
   Entitlements.
2. Glorieta shall verify webhooks with its own endpoint signing secret.
3. The credential the Webhook Handler uses to write the mirror shall grant no access outside
   the `glorieta` schema.
4. Secrets shall live in 1Password and in the hosting platform's secret store only, and never in
   the repo, `.env.production`, the client bundle or a commit.
5. The build shall fail if the client bundle contains a Stripe secret or restricted key prefix
   (`sk_`, `rk_`) or a webhook secret prefix (`whsec_`).

### Requirement 7: Supporter Experience

**Objective:** As a learner, I want the support plan to be visible but never in the way.

#### Acceptance Criteria

1. The Glorieta App shall offer the support page from the menu bar on screens wider than 520 px
   (a phone's menu bar has no room beside the language switch) and from the profile page, and
   shall never interrupt a lesson, practice session or mock exam with it. The welcome and
   sign-up flows shall not link to it.
2. While a user holds `glorieta_supporter`, the profile page and the account link shall show a
   supporter badge.
3. Every new string shall exist in Spanish and English and follow the ES / ES+EN / EN toggle.
4. The support page shall state plainly that every study feature stays free, and what the plan
   pays for.
5. A signed-out visitor who opens the support page shall see the plans and a sign-in prompt,
   and shall reach Checkout only after signing in.
6. In TV mode (`?tv`) the Glorieta App shall offer no way to pay: no support link, support page, support
   card or plan management. The supporter and Café badges still show, as on every other screen.

### Requirement 8: Erasure and Consent

**Objective:** As a learner, I want deleting my account to end my plan, and I want my payment
kept apart from marketing unless I said yes.

#### Acceptance Criteria

1. "Delete my Glorieta data" erases the user's Glorieta rows and leaves the shared login alone.
   When a user with a stored Stripe customer erases their data, the Billing Service shall first
   delete that Stripe customer, which cancels its subscriptions immediately, and clear the
   mirror's entitlements.
2. If the Stripe deletion fails, then the erasure shall stop and tell the user, leaving the data
   intact.
3. `glorieta.delete_my_data()` shall refuse while the caller's mirror row holds
   `glorieta_supporter`, so that no client can erase a paying user's data without the step in 1.
4. When a user's supporter status changes and their `marketing_opt_in` is true, the Webhook
   Handler shall send the new status to Podograph for the `glorieta` brand through
   `/leads/capture`, with event type `glorieta_supporter_started` or `glorieta_supporter_ended`.
5. While a user's `marketing_opt_in` is false, Glorieta shall send nothing about that user's
   plan to Podograph.
6. Receipts, payment failure notices and renewal notices shall come from Stripe, not from
   Glorieta or Podograph.

### Requirement 9: Verification

**Objective:** As the operator, I want the whole loop proven against real Stripe test mode
before any live money moves.

#### Acceptance Criteria

1. In Stripe test mode, a real signed-in Glorieta account shall complete Checkout with test
   card `4242 4242 4242 4242`, and the mirror shall then hold `glorieta_supporter` for that user.
2. Cancelling in the test-mode portal shall remove `glorieta_supporter` from the mirror once
   Stripe ends the subscription.
3. Replaying the same webhook event with `stripe events resend` shall leave the mirror
   unchanged.
4. A test-mode subscription on a Glorieta customer whose email also has a LinguaMama `people`
   row shall leave that `people` row's `stripe_customer_id` and `entitlements` unchanged, and
   LinguaMama's pricing endpoint shall not list *Glorieta Supporter*.
5. Automated tests shall cover entitlement filtering, idempotency, customer isolation, the
   erasure guard, the signed-call check and the bundle secret check, and shall run in `npm test`.
6. Live mode shall be switched on only by Geordie, after 1 to 5 pass.
