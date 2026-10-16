-- Carnet: accounts, progress and exam results.
--
-- WHERE THIS RUNS. Not from this repo. The Applied Relevance database is shared and its
-- migrations are written only in the appliedrelevance monorepo (supabase/migrations/).
-- A session rooted there should copy this file in under a new timestamped name.
-- See docs/backend/README.md for the full handoff, the checks to run, and what not to do.
--
-- DESIGN.
--   * One schema, `carnet`, that only signed-in users can reach, and only for their own rows.
--   * `anon` gets nothing. `authenticated` is limited by row level security to user_id = auth.uid().
--   * No trigger on auth.users: that table is shared with every other app on the project, and a
--     trigger would create a Carnet profile for all of their users. The app creates the profile
--     itself on first sign-in.
--   * Nothing here writes to the podograph schema. Leads reach the CRM through api.podograph.com.

create schema if not exists carnet;

-- One row per person who signs in to Carnet.
create table carnet.profiles (
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
create table carnet.progress (
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null check (char_length(item_id) between 1 and 120),
  card        jsonb not null check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4096),
  seen        integer not null default 0 check (seen >= 0),
  right_count integer not null default 0 check (right_count >= 0 and right_count <= seen),
  updated_at  timestamptz not null,
  primary key (user_id, item_id)
);

-- Mock exam results. Immutable events: inserted once, keyed by when they were taken.
create table carnet.exam_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  taken_at   timestamptz not null,
  total      integer not null check (total > 0),
  errors     integer not null check (errors >= 0 and errors <= total),
  unanswered integer not null check (unanswered >= 0 and unanswered <= total),
  passed     boolean not null,
  unique (user_id, taken_at)
);
create index exam_results_user_taken_idx on carnet.exam_results (user_id, taken_at desc);

comment on schema carnet is 'Carnet (Spanish driving theory study app): per-user progress. Reached only by signed-in users, only for their own rows.';
comment on column carnet.profiles.marketing_opt_in is 'Explicit, unticked-by-default consent to be added to the Podograph CRM.';
comment on column carnet.profiles.crm_synced_at is 'When Podograph accepted this person as a lead; null means not sent.';

create function carnet.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch_updated_at
  before update on carnet.profiles
  for each row execute function carnet.touch_updated_at();

-- Row level security: a person sees and changes only their own rows.
alter table carnet.profiles     enable row level security;
alter table carnet.progress     enable row level security;
alter table carnet.exam_results enable row level security;

create policy profiles_select_own on carnet.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_insert_own on carnet.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_own on carnet.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on carnet.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy progress_select_own on carnet.progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy progress_insert_own on carnet.progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy progress_update_own on carnet.progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy progress_delete_own on carnet.progress for delete to authenticated
  using (user_id = (select auth.uid()));

create policy exam_results_select_own on carnet.exam_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy exam_results_insert_own on carnet.exam_results for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exam_results_delete_own on carnet.exam_results for delete to authenticated
  using (user_id = (select auth.uid()));

-- "Delete my Carnet data". SECURITY INVOKER, so it can only ever remove the caller's own rows
-- (row level security applies). It leaves the login itself alone, which is shared with other apps.
create function carnet.delete_my_data() returns void
language sql security invoker set search_path = '' as $$
  delete from carnet.exam_results where user_id = (select auth.uid());
  delete from carnet.progress     where user_id = (select auth.uid());
  delete from carnet.profiles     where user_id = (select auth.uid());
$$;

-- Privileges: the second lock, behind row level security. anon holds nothing in this schema,
-- and default privileges are set so that a future table does not quietly re-grant it.
revoke all on schema carnet from public, anon;
revoke all on all tables in schema carnet from public, anon;
revoke all on all routines in schema carnet from public, anon;
alter default privileges in schema carnet revoke all on tables from public, anon;
alter default privileges in schema carnet revoke all on routines from public, anon;
alter default privileges in schema carnet revoke all on sequences from public, anon;

grant usage on schema carnet to authenticated, service_role;
grant select, insert, update, delete on carnet.profiles, carnet.progress, carnet.exam_results to authenticated;
grant all on all tables in schema carnet to service_role;
grant execute on function carnet.delete_my_data() to authenticated;
