-- Glorieta: accounts, progress and exam results.
--
-- WHERE THIS RUNS. The Applied Relevance Supabase project is shared on purpose (one small instance for
-- several hobby projects), and the `glorieta` schema is this app's own: it may change it freely, and it can
-- be moved to a project of its own by moving this schema. This file is 001; later changes are numbered
-- files beside it (glorieta-schema-002-course-progress.sql, ...), applied in order and idempotent.
-- See docs/backend/README.md for how each was applied, the checks to run, and what not to do.
--
-- DESIGN.
--   * One schema, `glorieta`, that only signed-in users can reach, and only for their own rows.
--   * `anon` gets nothing. `authenticated` is limited by row level security to user_id = auth.uid().
--   * No trigger on auth.users: that table is shared with every other app on the project, and a
--     trigger would create a Glorieta profile for all of their users. The app creates the profile
--     itself on first sign-in.
--   * Nothing here writes to the podograph schema. Leads reach the CRM through api.podograph.com.

create schema if not exists glorieta;

-- One row per person who signs in to Glorieta.
create table glorieta.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  display_name        text check (display_name is null or char_length(display_name) <= 80),
  -- Consent to be added to the CRM. Off unless the person ticked the box.
  marketing_opt_in    boolean not null default false,
  marketing_opt_in_at timestamptz,
  -- Set once the lead has been accepted by Podograph, so it is sent only once.
  crm_synced_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (marketing_opt_in or marketing_opt_in_at is null)
);

-- The spaced-repetition state of each question or vocabulary card (FSRS), one row per item.
create table glorieta.progress (
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null check (char_length(item_id) between 1 and 120),
  card        jsonb not null check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4096),
  seen        integer not null default 0 check (seen >= 0),
  right_count integer not null default 0 check (right_count >= 0 and right_count <= seen),
  updated_at  timestamptz not null,
  primary key (user_id, item_id)
);

-- Mock exam results. Immutable events: inserted once, keyed by when they were taken.
create table glorieta.exam_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  taken_at   timestamptz not null,
  total      integer not null check (total > 0),
  errors     integer not null check (errors >= 0 and errors <= total),
  unanswered integer not null check (unanswered >= 0 and unanswered <= total),
  passed     boolean not null,
  unique (user_id, taken_at)
);
create index exam_results_user_taken_idx on glorieta.exam_results (user_id, taken_at desc);

-- Every answer, as an append-only event. progress holds each item's current schedule; this holds the
-- history, so the database can answer "how am I doing by topic" and "which questions do people miss".
create table glorieta.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null check (char_length(item_id) between 1 and 120),
  correct     boolean not null,
  mode        text not null check (mode in ('practice', 'exam', 'vocab')),
  answered_at timestamptz not null,
  -- The same answer sent twice (a retry, or the same device after reconnecting) is stored once.
  unique (user_id, item_id, answered_at)
);
create index attempts_user_time_idx on glorieta.attempts (user_id, answered_at desc);
create index attempts_item_idx on glorieta.attempts (item_id);

comment on table glorieta.attempts is 'Append-only log of answers. progress holds the current schedule; this holds the history.';
comment on schema glorieta is 'Glorieta (Spanish driving theory study app): per-user progress. Reached only by signed-in users, only for their own rows.';
comment on column glorieta.profiles.marketing_opt_in is 'Explicit, unticked-by-default consent to be added to the Podograph CRM.';
comment on column glorieta.profiles.crm_synced_at is 'When Podograph accepted this person as a lead; null means not sent.';

create function glorieta.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch_updated_at
  before update on glorieta.profiles
  for each row execute function glorieta.touch_updated_at();

-- Row level security: a person sees and changes only their own rows.
alter table glorieta.profiles     enable row level security;
alter table glorieta.progress     enable row level security;
alter table glorieta.exam_results enable row level security;
alter table glorieta.attempts     enable row level security;

create policy profiles_select_own on glorieta.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_insert_own on glorieta.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_own on glorieta.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on glorieta.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy progress_select_own on glorieta.progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy progress_insert_own on glorieta.progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy progress_update_own on glorieta.progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy progress_delete_own on glorieta.progress for delete to authenticated
  using (user_id = (select auth.uid()));

create policy exam_results_select_own on glorieta.exam_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy exam_results_insert_own on glorieta.exam_results for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exam_results_delete_own on glorieta.exam_results for delete to authenticated
  using (user_id = (select auth.uid()));

create policy attempts_select_own on glorieta.attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy attempts_insert_own on glorieta.attempts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy attempts_delete_own on glorieta.attempts for delete to authenticated
  using (user_id = (select auth.uid()));

-- "Delete my Glorieta data". SECURITY INVOKER, so it can only ever remove the caller's own rows
-- (row level security applies). It leaves the login itself alone, which is shared with other apps.
create function glorieta.delete_my_data() returns void
language sql security invoker set search_path = '' as $$
  delete from glorieta.attempts     where user_id = (select auth.uid());
  delete from glorieta.exam_results where user_id = (select auth.uid());
  delete from glorieta.progress     where user_id = (select auth.uid());
  delete from glorieta.profiles     where user_id = (select auth.uid());
$$;


-- Per-topic results for the signed-in person, computed here and not in the browser. SECURITY INVOKER,
-- so row level security limits it to the caller's own attempts. The group is the item id's prefix:
-- 'speed-01' is speed, 'sign:r-1' is signs (the picture questions), 'v:...' is vocab.
create function glorieta.my_stats()
returns table (grp text, attempts bigint, correct bigint, accuracy numeric, last_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select case when item_id like 'sign:%' then 'signs'
              when item_id like 'v:%'    then 'vocab'
              else split_part(item_id, '-', 1) end                              as grp,
         count(*)                                                                 as attempts,
         count(*) filter (where correct)                                          as correct,
         round(100.0 * count(*) filter (where correct) / count(*), 1)             as accuracy,
         max(answered_at)                                                         as last_at
  from glorieta.attempts
  group by 1
  order by 1
$$;

-- How hard each question really is, across everyone. Aggregates only (no user ids, no individual
-- answers), and readable by the service role alone: for the owner, to improve the questions.
create view glorieta.item_difficulty with (security_invoker = true) as
  select item_id,
         count(*)                                                       as attempts,
         count(distinct user_id)                                        as learners,
         count(*) filter (where correct)                                as correct,
         round(100.0 * count(*) filter (where correct) / count(*), 1)   as accuracy
  from glorieta.attempts
  group by item_id;

-- Privileges: the second lock, behind row level security. anon holds nothing in this schema,
-- and default privileges are set so that a future table does not quietly re-grant it.
revoke all on schema glorieta from public, anon;
revoke all on all tables in schema glorieta from public, anon;
revoke all on all routines in schema glorieta from public, anon;
alter default privileges in schema glorieta revoke all on tables from public, anon;
alter default privileges in schema glorieta revoke all on routines from public, anon;
alter default privileges in schema glorieta revoke all on sequences from public, anon;

grant usage on schema glorieta to authenticated, service_role;
grant select, insert, update, delete on glorieta.profiles, glorieta.progress, glorieta.exam_results to authenticated;
grant select, insert, delete on glorieta.attempts to authenticated;
grant all on all tables in schema glorieta to service_role;
grant execute on function glorieta.delete_my_data() to authenticated;
grant execute on function glorieta.my_stats() to authenticated;
-- The per-question aggregate is for the owner (service role) only, not for signed-in users.
revoke all on glorieta.item_difficulty from public, anon, authenticated;
grant select on glorieta.item_difficulty to service_role;
