# Handoff to Fibertarian: brand auth emails by the app that asked for them

**Run in:** the `appliedrelevance/fibertarian` checkout, on the branch that checkout is on. Run
`git status` first; if it shows changes you did not make, stop and ask Geordie.

## Why

The shared Supabase project `qgfmwstgkwyqqwyqroav` has one Send Email hook for every app on it:
`https://fibertarian.com/api/auth/email-hook` (`src/lib/auth/emailHook.ts`, `src/lib/email/authHookEmail.ts`).
It always sends as Fibertarian: `FROM` is fixed to `hello@fibertarian.com` / "Fibertarian"
(`src/lib/email/sendViaCloudflare.ts`), and `COPY` says "Confirm your Fibertarian account".

A Glorieta sign-up on 2026-11-15 (auth log, 14:21:47 UTC, referer `https://glorieta.anaidic.com/`)
got "Confirm your Fibertarian account" from `hello@fibertarian.com`, with a link to
`https://glorieta.anaidic.com/?token_hash=…&type=signup`. Gmail filed it as spam: the sender, the brand
and the link's domain all disagree. Every other app on the project gets the same Fibertarian email.

Glorieta already handles the `?token_hash=` link (Glorieta commit `778f47f`). Only the email's brand is
wrong.

## Change

Pick the brand from the origin of `email_data.redirect_to` (falling back to `site_url`), and use a neutral
Applied Relevance brand for any origin not listed. Never send Fibertarian copy for another app.

| Origin | From name | Subject (signup / recovery / other) |
|---|---|---|
| `https://fibertarian.com` | Fibertarian | as today |
| `https://glorieta.anaidic.com` | Glorieta | "Confirma tu cuenta de Glorieta / Confirm your Glorieta account", "Restablece tu contraseña de Glorieta / Reset your Glorieta password", "Tu enlace de Glorieta / Your Glorieta link" |
| any other | Applied Relevance | "Confirm your account", "Reset your password", "Your sign-in link" |

Glorieta's body, in both languages, Spanish first:

- signup: "Pulsa el enlace para confirmar tu correo y terminar de crear tu cuenta de Glorieta." /
  "Click the link to confirm your email and finish creating your Glorieta account."
- recovery: "Pulsa el enlace para elegir una contraseña nueva de Glorieta." /
  "Click the link to choose a new Glorieta password."
- closing line: "Si no lo has pedido tú, puedes ignorar este correo." / "If you didn't request this, you can
  ignore this email."

The from address must be on a domain verified for the Worker's `EMAIL` binding. Use
`hello@glorieta.anaidic.com` if `anaidic.com` can be verified for it; otherwise an address on a domain that
already is (for example `appliedrelevance.com`) with the display name "Glorieta". Check which domains are
verified before choosing, and say which one you used.

Keep `buildMagicLinkUrl` exactly as it is: the link format is what Glorieta now expects.

## Do not

- Do not change the hook's URL, secret or enablement on the Supabase project; the monorepo root owns that.
- Do not change the link format (`redirect_to` plus `token_hash` and `type`).
- Do not touch Glorieta's repo.

## Verify

1. Fibertarian's tests pass, plus new cases: a payload whose `redirect_to` is on `glorieta.anaidic.com` gets
   the Glorieta from name and subject; an unknown origin gets the neutral brand; Fibertarian's own is unchanged.
2. Deploy, then sign up on `https://glorieta.anaidic.com` with a fresh address: the email comes from
   "Glorieta", says Glorieta, and the link confirms the account.
3. Report the commit SHA and the from address used back to Geordie.
