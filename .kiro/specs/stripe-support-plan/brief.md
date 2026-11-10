# Brief: stripe-support-plan

## Problem

Glorieta (glorieta.anaidic.com) is free, open source (Apache-2.0 code, CC BY 4.0 content) and
has no way for a grateful learner to pay for it. People who pass the theory test with it have
nowhere to put that gratitude, and Applied Relevance has no revenue signal from the app at all.

A paywall is the wrong answer. The code and content are openly licensed, anyone can fork them,
and the app's job is to be a lead magnet where the app itself is the reward. What fits is a
**support plan**: an optional recurring payment that funds the app and earns the supporter a
visible thank-you, while every study feature stays free for everyone.

## Current State

**Glorieta** (`iamgeordie/glorieta`, branch `main`):

- Cloudflare Worker serving static assets only (`wrangler.jsonc`: `assets.directory ./dist`,
  SPA fallback, custom domain `glorieta.anaidic.com`, `workers_dev` and preview URLs off). No
  Worker script, so no server-side code runs today.
- Preact SPA with hash routes, ES / ES+EN / EN toggle on every string.
- Accounts live since 2026-10-16: Supabase auth on the shared Applied Relevance project
  (`qgfmwstgkwyqqwyqroav`), email/password plus Google. User data lives in schema `glorieta`
  (`profiles`, `progress`, `exam_results`, `attempts`, `lesson_progress`, `quiz_progress`), RLS
  owner-only, every table `on delete cascade` from `auth.users`. The `glorieta` schema belongs to
  Glorieta; nothing outside it does.
- CRM: an unticked opt-in on `glorieta.profiles.marketing_opt_in` (+ timestamp). Only consenting
  users are sent to Podograph, through `api.podograph.com/leads/capture`, brand `glorieta`.

**LinguaMama** already runs Stripe billing on the Applied Relevance Stripe account, on its own
Supabase project (`myekgdmvvpyfyvexmrgd`):

| Piece | Path in `appliedrelevance/linguamama` | What it does |
|---|---|---|
| SDK singleton | `supabase/functions/_shared/stripe-client.ts` | One `new Stripe()`, API version pinned `2026-03-25.dahlia`, fetch HTTP client |
| Checkout | `supabase/functions/create-checkout-session/index.ts` | Signed-in user → Stripe customer (lookup, else create) → hosted Checkout, `mode: subscription`, `automatic_tax`, billing address required, promo codes allowed |
| Portal | `supabase/functions/create-portal-session/index.ts` | Hosted Stripe customer portal for cancel / change card |
| Pricing | `supabase/functions/get-pricing/index.ts` | Reads Prices from Stripe so the app never hard-codes amounts |
| Webhook | `supabase/functions/stripe-webhook/index.ts` | Verifies signature; handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `entitlements.active_entitlement_summary.updated`; everything else is a 200 no-op |
| Entitlement mirror | `supabase/functions/_shared/entitlements-sync.ts` | Stripe Entitlements are the model; the database is a one-way mirror of active feature `lookup_key`s, idempotent on the Stripe event id, with bounded history |
| Setup guide | `docs/STRIPE_SETUP.md` | CLI, test cards, webhook forwarding |

**Podograph** has no billing surface, and should not grow one: Stripe owns billing, Podograph owns
outbound contact. LinguaMama's `podograph-learner-lifecycle` brief already defines the pattern
that fits here: the app emits a small state signal on a contact, Podograph decides what, if
anything, to send.

## Desired Outcome

A signed-in Glorieta user can start a monthly or annual support plan through Stripe-hosted
Checkout, manage or cancel it through the Stripe customer portal, and see a supporter badge on
their profile. Glorieta's database holds a one-way mirror of the user's Stripe entitlements,
written only by a verified Stripe webhook. Supporters who opted in to marketing appear in
Podograph as Glorieta supporters. Nothing in the study experience changes for anyone.

## Approach

Reuse LinguaMama's mechanism, unchanged in shape:

- **Same Stripe account.** A new Product, *Glorieta Supporter*, with monthly and annual Prices
  in EUR and one Stripe Entitlements Feature, lookup key `glorieta_supporter`. Stripe Tax and
  receipts come from the account's existing configuration.
- **Same mirror model.** Stripe is the source of truth; `glorieta` stores the active
  entitlement keys per user, written idempotently by the webhook. No local subscription state
  machine.
- **Same code.** Port LinguaMama's stripe-client, checkout, portal, pricing, webhook and
  entitlement-sync logic to Glorieta, changing only identity resolution (Glorieta's
  `auth.users` id instead of LinguaMama's `people` row) and the storage target (`glorieta`
  schema).
- **Hosting.** LinguaMama's deployed functions run against LinguaMama's own Supabase project
  and cannot see Glorieta's users, so Glorieta runs its own copy, in the Glorieta Worker (a
  script for `/api/billing/*`). The Worker writes the mirror only through one HMAC-signed
  `security definer` function in the `glorieta` schema, so its database credential reaches
  nothing else. An Edge Function on the shared project was rejected: the platform injects the
  service-role key into it, and deploys there belong to the monorepo.
- **Two webhooks, one account.** Stripe delivers every account event to both LinguaMama's and
  Glorieta's endpoints. Each app tags the customers it creates and acts only on its own.
  LinguaMama's resolver falls back to matching by email, so a person using one address in both
  apps would let a Glorieta subscription reach LinguaMama's mirror; the LinguaMama-side guard is
  a handoff to a LinguaMama session.
- **Podograph as signal consumer only.** Supporter status reaches Podograph for consenting users
  through an existing Podograph surface. A missing capability becomes a Podograph handoff.

## Scope

- **In**: Stripe Product/Prices/Feature setup (test mode, then live); checkout, portal, pricing
  and webhook endpoints for Glorieta; the entitlement mirror table and RLS in `glorieta`;
  supporter UI (support page, profile badge, success and cancel screens) in ES and EN; account
  erasure cancelling an active plan; the consent-gated Podograph signal; end-to-end verification
  in Stripe test mode.
- **Out**: any paywall or gated study feature; Apple/Google in-app purchase; one-time donations;
  changes to LinguaMama's pricing or products; billing inside Podograph; tax registration and
  filing (owned by the accounting side, not this spec).

## Constraints

- Glorieta writes nothing outside the `glorieta` schema of the shared database. Edge Functions,
  roles or settings at project level belong to the appliedrelevance monorepo and are handoffs.
- LinguaMama's repo and Podograph's repo are not edited from a Glorieta session; changes there are
  handoffs with exact instructions.
- Glorieta's Stripe access uses its own restricted key and its own webhook signing secret, never
  LinguaMama's key.
- No mocks: development runs against Stripe test mode and the real `glorieta` schema.
