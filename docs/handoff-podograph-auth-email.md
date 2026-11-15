# Handoff to Podograph: send every app's auth emails, branded per app

**Run in:** the `appliedrelevance/podograph` checkout, on the branch that checkout is on. Run `git status`
first; if it shows changes you did not make, stop and ask Geordie.

**Order:** this handoff first. The monorepo then points the shared project's hook at Podograph
([handoff-monorepo-auth-email-hook.md](handoff-monorepo-auth-email-hook.md)). Until that switch, nothing
here changes what users receive.

## Why

The shared Supabase project `qgfmwstgkwyqqwyqroav` has one Send Email hook for every app on it. Today
that hook is Fibertarian's (`https://fibertarian.com/api/auth/email-hook`), and it always sends from
`hello@fibertarian.com` with Fibertarian copy. A Glorieta sign-up on 2026-11-15 received
"Confirm your Fibertarian account", and Gmail filed it as spam: the sender, the brand and the link's
domain disagree. Auth email is email for every property, so it belongs in Podograph, which already holds
the brands, the verified sender domains and per-brand system-notification templates
(`src/lib/notification-templates.ts`).

Decided by Geordie:

- Brands with their own verified sender domain send from it.
- Brands without one (Glorieta today) send from `appliedrelevance.com`, with the brand's name as the
  display name. Glorieta's sender is **"Glorieta" <glorieta@appliedrelevance.com>**. That address is a
  Google Workspace alias on Geordie's mailbox, so replies reach him; it is also the Reply-To.

## Facts already established

- `appliedrelevance.com` is a verified Podograph sender (brand `appliedrelevance`, bounce domain
  `bounces.appliedrelevance.com`).
- Brand `glorieta` exists with **no domains** and **no sender domain**. Its app is served at
  `https://glorieta.anaidic.com`. `anaidic.com` has no MX and cannot receive mail.
- Fibertarian's hook code to port: `src/lib/auth/emailHook.ts`, `src/lib/auth/verifyEmailHookSignature.ts`,
  `src/lib/email/authHookEmail.ts` in `appliedrelevance/fibertarian` (read only; do not edit that repo).
  Standard Webhooks signature, secret formatted `v1,whsec_<base64>`, stored as a Worker secret
  (`SEND_EMAIL_HOOK_SECRET`), never in a file.
- The link format must stay exactly as Fibertarian builds it (`buildMagicLinkUrl`): `email_data.redirect_to`
  as given, plus `token_hash` and `type` query params; `site_url + /auth/confirm` only when `redirect_to`
  is empty. Fibertarian relies on its `nonce` param surviving; Glorieta completes `?token_hash=` links
  (Glorieta commit `778f47f`).

## Changes

1. **Hook endpoint** `POST /api/auth/email-hook` on the Podograph Worker: verify the Standard Webhooks
   signature with `SEND_EMAIL_HOOK_SECRET` (401 on failure, no send), parse the payload, render, send,
   return 200 `{}`; a send failure returns 500 with a JSON error, as Supabase expects.
2. **Brand resolution** from the origin of `redirect_to` (else `site_url`), matched against brand domains.
   Add `glorieta.anaidic.com` to brand `glorieta`'s domains. An origin that matches no brand resolves to
   `appliedrelevance`. Never fall back to Fibertarian.
3. **Sender for a brand without a verified domain.** Today the from address always comes from the brand's
   verified default sender (`getBrandDefaultSender`). Add a way for a brand to send on another brand's
   verified domain with its own from address and name, and set Glorieta's: domain `appliedrelevance.com`,
   from `glorieta@appliedrelevance.com`, name "Glorieta", Reply-To `glorieta@appliedrelevance.com`.
   Choose the data shape; keep the rule that a from address is always on a verified domain.
4. **Templates** `auth_signup`, `auth_recovery` and `auth_other` (magic link, email change, invite) as
   system-notification templates, with a `{{link}}` token. Built-in defaults are brand-neutral
   ("Confirm your account" etc.). Fibertarian's override reproduces today's Fibertarian copy exactly.
   Glorieta's override is bilingual, Spanish first:

   | Key | Subject | Body |
   |---|---|---|
   | `auth_signup` | Confirma tu cuenta de Glorieta / Confirm your Glorieta account | Pulsa el enlace para confirmar tu correo y terminar de crear tu cuenta de Glorieta. / Click the link to confirm your email and finish creating your Glorieta account. |
   | `auth_recovery` | Restablece tu contraseña de Glorieta / Reset your Glorieta password | Pulsa el enlace para elegir una contraseña nueva de Glorieta. / Click the link to choose a new Glorieta password. |
   | `auth_other` | Tu enlace de Glorieta / Your Glorieta link | Pulsa el enlace para continuar en Glorieta. / Click the link to continue in Glorieta. |

   Every Glorieta body ends with: "Si no lo has pedido tú, puedes ignorar este correo. / If you didn't
   request this, you can ignore this email." and the footer "Glorieta, una app gratuita de Applied
   Relevance. / Glorieta, a free app by Applied Relevance."
5. **Not CRM.** An auth email is not marketing: it never creates or updates a contact, never checks
   consent, and is never suppressed by an unsubscribe.
6. **Tests:** signature accepted and rejected; a Glorieta `redirect_to` gets the Glorieta sender, Reply-To
   and bilingual copy; a Fibertarian one gets today's Fibertarian email byte for byte; an unknown origin gets
   the Applied Relevance neutral email; the link keeps `redirect_to`'s own query params (a `nonce`).

## Do not

- Do not change the Supabase project's hook setting; the monorepo does that after this is deployed.
- Do not edit the Fibertarian or Glorieta repos.
- Do not add contacts or timeline events for auth emails.

## Verify and hand back

1. Podograph's tests pass. Deploy.
2. Generate a new hook secret (`v1,whsec_` plus base64 of 32 random bytes), set it as the Podograph Worker
   secret `SEND_EMAIL_HOOK_SECRET`, and save it in 1Password (AppliedRelevance vault, "Supabase Send Email
   hook secret (shared project)"). The monorepo sets the same value on the project when it switches.
3. Report to Geordie: the commit SHA, the endpoint URL, the 1Password item name, and the data shape chosen
   for step 3.
