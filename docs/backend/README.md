# Accounts and progress sync

Glorieta works with no account and no server. Accounts are an **optional layer**: when the app is
built with a Supabase project configured, people can sign in and their progress syncs across devices.
Without that configuration the account screens do not exist and no Supabase code is in the bundle.

## How it works

```
browser (local-first)                         Supabase project
  localStorage  <-- sync (merge) -->   schema "glorieta": profiles, progress, attempts, exam_results,
                                                       lesson_progress, quiz_progress
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

## What is stored, and what is computed where

| Where | What |
|---|---|
| `progress` | each question or card's current spaced-repetition state (when it is due, how it is going) |
| `attempts` | every answer as an append-only event: item, right or wrong, mode (practice, exam, vocab), when. Answers given before signing in are uploaded too, so a new account starts with its history |
| `exam_results` | each mock exam, once |
| `lesson_progress` | the Learn course, per lesson: finished or not, where you stopped, and your first answer to each check |
| `quiz_progress` | the Learn course, per module quiz: best and latest percent, and how many attempts |
| `profiles` | display name and the CRM opt-in with its timestamp |
| `my_stats()` | a SQL function: per-topic attempts and accuracy for the signed-in person, computed in the database. The Account screen shows it |
| `item_difficulty` | a view across everyone: per question, how many tried, how many got it right. No user ids, and readable by the service role only, so the owner can see which questions are too hard or too easy |

The question bank, the sign data and the vocabulary stay in the app as JSON. That keeps the app fast, usable offline, public, and reviewed through git. The database holds what changes per person.

## Configuration

Copy `.env.example` to `.env.local` to try accounts in development. A deploy builds with `.env.production`, which is committed because everything in it is public by design (the project URL and publishable key ship in the browser; row level security is the protection) and which makes a deploy reproducible. `npm run deploy` also fails if the built bundle does not contain accounts when that file says it should, so a login-less build cannot go out by accident.

| Variable | Meaning |
|---|---|
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` | Set **both** to turn accounts on, or neither. One without the other fails at start-up on purpose. Both are public by design; row level security is the protection. |
| `VITE_GOOGLE_AUTH_ENABLED` | `true` only once the Google provider is configured. |
| `VITE_PODOGRAPH_BRAND_ID` | The CRM brand id. Leads are sent only when this is set. |

## Database

Everything per person lives in the `glorieta` schema, and the schema belongs to this app. The Applied
Relevance Supabase project is shared on purpose: one small instance carries several hobby projects instead of
paying for one each. If Glorieta ever outgrows it, moving it is a matter of dumping the `glorieta` schema into a
project of its own and changing the two public values in `.env.production`.

Two files, applied in order. 001 is for an empty project; 002 is idempotent (safe to run twice):

1. `glorieta-schema.sql` (001) creates the schema, tables, policies and privileges.
2. `glorieta-schema-002-course-progress.sql` adds `lesson_progress` and `quiz_progress` and extends the erase function to cover them.

**How 002 reached the live database (2026-10-17).** It was run as plain SQL in one transaction, then the API
cache was reloaded (`notify pgrst, 'reload schema'`), and the result was checked read-only: row level security
on all six tables, no grants to `anon` or `PUBLIC`, the erase function still `SECURITY INVOKER`, existing rows
unchanged. It was *not* recorded as a Supabase migration, so the shared project's migration history gained
no entry that has no file in the appliedrelevance monorepo. If you want 002 in that history, copy the file into
the monorepo's `supabase/migrations/` under a new timestamped name and mark it applied
(`supabase migration repair --status applied <timestamp>`), rather than applying it a second time.

001 is meant for
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
- `src/lib/attempts.test.ts`: the answer-log queue (cap keeps the newest, uploaded answers are removed by item and time).
- `src/lib/learn-merge.test.ts`: the course-progress merge rules (finished stays finished, answers union with the earlier answer winning, best quiz score and attempt count are kept, nothing is ever dropped).
- `scripts/test-schema.mjs`: applies `glorieta-schema.sql`, then 002 (twice, to prove it is idempotent), to an embedded Postgres ([PGlite](https://pglite.dev))
  with Supabase's roles and `auth.uid()` modeled, then checks that one user cannot read, write, move or
  delete another's rows, that `anon` and a token with no subject see nothing, that the constraints hold,
  that the answer log is append-only and de-duplicated, that `my_stats()` sees only the caller's answers, that the cross-user view is closed to signed-in users and exposes no user ids, and that the erase function is scoped to the caller.

What the tests do **not** prove: behavior against a real Supabase project (PostgREST, GoTrue, email
delivery, the CRM endpoint). The sign-up, sign-in and reset flows have been checked for rendering and
client-side validation only, and have not been exercised end to end.

## Limits

- Course progress merges by keeping the best of both devices (it is mostly one-way: you finish lessons and improve scores), except that "where you stopped" and the latest quiz score follow the device used last.
- Resetting progress on a device clears that device only; signed in, the course comes back from the account on the next sync. "Delete my Glorieta data" on the Account screen removes it from the account.
- Last write wins per item: if you answer the same card on two devices, the later answer replaces the
  earlier one, including its counters. The schedule stays consistent; the counters can lose an update.
- The user's consent is recorded in their account metadata at sign-up and acted on after the first
  confirmed sign-in, so the person is never sent before their email is verified.
