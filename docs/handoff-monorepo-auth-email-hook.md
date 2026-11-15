# Handoff to the appliedrelevance monorepo: point the shared Send Email hook at Podograph

**Run in:** the `appliedrelevance/appliedrelevance` checkout (repo root, which owns the shared Supabase
project's configuration), on the branch that checkout is on. Run `git status` first; if it shows changes
you did not make, stop and ask Geordie.

**Precondition:** Podograph's auth-email endpoint is deployed and its hook secret is in 1Password
([handoff-podograph-auth-email.md](handoff-podograph-auth-email.md)). Do not start before Podograph reports
back.

## Why

Project `qgfmwstgkwyqqwyqroav` has one Send Email hook for every app. It points at
`https://fibertarian.com/api/auth/email-hook`, so every app's sign-up and reset emails go out as
Fibertarian. Podograph now sends them, branded per app. The hook is set in the project's Auth settings
(it is not in `supabase/config.toml`, whose `[auth.hook.*]` sections are commented out).

## Change

1. In the Supabase dashboard, project `qgfmwstgkwyqqwyqroav`, Authentication → Hooks → Send Email hook:
   - URI: the Podograph endpoint Podograph reported (`…/api/auth/email-hook`)
   - Secret: the value in 1Password "Supabase Send Email hook secret (shared project)"
   Save both together: a URI with the old secret fails every send.
2. Record it in this repo, so the project's configuration is not only in the dashboard: an
   `[auth.hook.send_email]` section in `supabase/config.toml` with `enabled = true`, the URI, and
   `secrets = "env(SEND_EMAIL_HOOK_SECRET)"`, and a line in `supabase/README.md` saying Podograph owns
   auth email for every app on the project. Commit.

## Do not

- Do not `supabase db reset`, push migrations, or `config push` anything else: the project holds real
  production data for several properties.
- Do not delete Fibertarian's endpoint; Fibertarian removes it itself once this has run for a while.
- Do not change any other auth setting (redirect URLs, providers, CAPTCHA).

## Verify

1. Sign up at `https://glorieta.anaidic.com` with a fresh address: the email comes from
   "Glorieta" <glorieta@appliedrelevance.com>, in Spanish and English, and the link confirms the account.
2. Request a Fibertarian sign-in: the email is Fibertarian's, unchanged, and its link works.
3. Auth logs show `Hook ran successfully` with the Podograph URI.
4. If either fails, point the hook back at the Fibertarian URI. A Worker secret cannot be read back, so
   before step 1 find Fibertarian's current hook secret in 1Password; if it is not there, roll back with a
   fresh secret set on both the project and Fibertarian's Worker (`npx wrangler secret put
   SEND_EMAIL_HOOK_SECRET` in the Fibertarian checkout, with Geordie's say-so, since that is another repo's
   Worker). Report what failed.
5. Report the commit SHA to Geordie, and tell the Fibertarian session it can remove its hook endpoint.
