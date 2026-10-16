# Accounts and progress sync

Glorieta works with no account and no server. Accounts are an **optional layer**: when the app is
built with a Supabase project configured, people can sign in and their progress syncs across devices.
Without that configuration the account screens do not exist and no Supabase code is in the bundle.

## How it works

```
browser (local-first)                         Supabase project
  localStorage  <-- sync (merge) -->   schema "glorieta": profiles, progress, exam_results
       |                                     row level security: a user sees only their own rows
       +-- once, if opted in and email confirmed --> CRM lead-intake endpoint
```

- **Local-first.** Studying never waits on the network. Progress is always saved in the browser first.
- **Sync.** On sign-in the app pulls the server's rows, merges them with the local ones (newest answer
  per item wins, see `src/lib/merge.ts`), and pushes whatever differs. After that, changes are pushed a
  couple of seconds after each answer. A failed sync is shown on the Account screen and retried; it never
  blocks studying.
- **Auth.** Email and password through Supabase Auth, with the PKCE flow (the app routes with the URL
  hash, which the default flow would also use). Sign-up, sign-in, email confirmation, forgot password and
  set-new-password are all implemented. "Continue with Google" is in place but disabled until a Google
  OAuth client is configured and the build sets `VITE_GOOGLE_AUTH_ENABLED=true`.
- **Consent.** Sending someone to a CRM is marketing, so it is opt-in: a checkbox that is **unticked by
  default**. Only people who tick it, and whose email is confirmed, are ever sent, once. Everyone else
  stays in the schema and nowhere else.
- **Erasure.** "Delete my Glorieta data" removes the person's rows (a function that can only touch the
  caller's own data) and withdraws the stored consent. The login itself is not deleted; it may be shared
  with other apps on the same project. The CRM is not touched by it.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Meaning |
|---|---|
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` | Set **both** to turn accounts on, or neither. One without the other fails at start-up on purpose. Both are public by design; row level security is the protection. |
| `VITE_GOOGLE_AUTH_ENABLED` | `true` only once the Google provider is configured. |
| `VITE_PODOGRAPH_BRAND_ID` | The CRM brand id. Leads are sent only when this is set. |

## Database

`glorieta-schema.sql` in this folder creates the schema, tables, policies and privileges. It is meant for
a project where the signed-in role can reach nothing but its own data, so check that before turning
sign-up on. The schema has no trigger on `auth.users`, no `SECURITY DEFINER` function, and grants
nothing to `anon`.

Apply it with your own migration process, then expose the `glorieta` schema to the API and add the
site's address to the auth redirect URLs (email links return there).

## Tests

```bash
npm test
```

- `src/lib/merge.test.ts`: the merge rules (newest wins, ties, missing timestamps, exam union).
- `src/lib/auth-errors.test.ts`: every error message exists in both languages and unknown errors are
  shown with their code, never swallowed.
- `scripts/test-schema.mjs`: applies `glorieta-schema.sql` to an embedded Postgres ([PGlite](https://pglite.dev))
  with Supabase's roles and `auth.uid()` modeled, then checks that one user cannot read, write, move or
  delete another's rows, that `anon` and a token with no subject see nothing, that the constraints hold,
  and that the erase function is scoped to the caller.

What the tests do **not** prove: behavior against a real Supabase project (PostgREST, GoTrue, email
delivery, the CRM endpoint). The sign-up, sign-in and reset flows have been checked for rendering and
client-side validation only, and have not been exercised end to end.

## Limits

- Last write wins per item: if you answer the same card on two devices, the later answer replaces the
  earlier one, including its counters. The schedule stays consistent; the counters can lose an update.
- The user's consent is recorded in their account metadata at sign-up and acted on after the first
  confirmed sign-in, so the person is never sent before their email is verified.
