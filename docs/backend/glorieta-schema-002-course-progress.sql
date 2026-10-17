-- Glorieta 002: Learn course progress.
--
-- Apply AFTER glorieta-schema.sql. Idempotent and additive: it creates two tables and replaces
-- one function, and changes nothing that exists. Safe to run twice.
--
-- WHY. Question progress (progress, attempts, exam_results) already syncs. This adds the rest of
-- what a person accomplishes in the course, so that signing in on another device shows the same
-- course map: which lessons are finished and where they stopped, and each module's quiz result.
--
-- DESIGN. Same rules as the rest of the schema: row level security so a person reaches only their own
-- rows, nothing for anon, no trigger on auth.users, no SECURITY DEFINER. Everything lives in the
-- `glorieta` schema, so the whole app can be moved to its own Supabase project by moving this schema.

-- One row per lesson a person has opened. lesson_key is '<module id>/<lesson id>'.
create table if not exists glorieta.lesson_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lesson_key text not null check (char_length(lesson_key) between 3 and 120),
  done       boolean not null default false,
  -- Where they stopped: 0 is the intro, 1..n the steps, n + 1 the recap.
  step       integer not null default 0 check (step between 0 and 30),
  -- The first answer given to each inline check: { "<check id>": { "sel": 0..2, "ok": true|false } }.
  answered   jsonb not null default '{}'::jsonb
             check (jsonb_typeof(answered) = 'object' and pg_column_size(answered) < 16384),
  updated_at timestamptz not null,
  primary key (user_id, lesson_key)
);

-- One row per module quiz a person has taken: the best and the latest result, in percent.
create table if not exists glorieta.quiz_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  module_id  text not null check (char_length(module_id) between 1 and 60),
  best       integer not null check (best between 0 and 100),
  last       integer not null check (last between 0 and 100),
  attempts   integer not null default 1 check (attempts >= 1),
  updated_at timestamptz not null,
  primary key (user_id, module_id),
  check (last <= best)
);

comment on table glorieta.lesson_progress is 'Learn course: per-lesson state (finished, where they stopped, first answer to each check). Merged newest-wins by the app.';
comment on table glorieta.quiz_progress is 'Learn course: per-module quiz result (best and latest percent, number of attempts).';

alter table glorieta.lesson_progress enable row level security;
alter table glorieta.quiz_progress   enable row level security;

drop policy if exists lesson_progress_select_own on glorieta.lesson_progress;
drop policy if exists lesson_progress_insert_own on glorieta.lesson_progress;
drop policy if exists lesson_progress_update_own on glorieta.lesson_progress;
drop policy if exists lesson_progress_delete_own on glorieta.lesson_progress;
create policy lesson_progress_select_own on glorieta.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy lesson_progress_insert_own on glorieta.lesson_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lesson_progress_update_own on glorieta.lesson_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lesson_progress_delete_own on glorieta.lesson_progress for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists quiz_progress_select_own on glorieta.quiz_progress;
drop policy if exists quiz_progress_insert_own on glorieta.quiz_progress;
drop policy if exists quiz_progress_update_own on glorieta.quiz_progress;
drop policy if exists quiz_progress_delete_own on glorieta.quiz_progress;
create policy quiz_progress_select_own on glorieta.quiz_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy quiz_progress_insert_own on glorieta.quiz_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy quiz_progress_update_own on glorieta.quiz_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy quiz_progress_delete_own on glorieta.quiz_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- Privileges: the second lock. anon holds nothing; signed-in users may change only (by policy) their own rows.
revoke all on glorieta.lesson_progress, glorieta.quiz_progress from public, anon;
grant select, insert, update, delete on glorieta.lesson_progress, glorieta.quiz_progress to authenticated;
grant all on glorieta.lesson_progress, glorieta.quiz_progress to service_role;

-- "Delete my Glorieta data" now covers the course as well. Still SECURITY INVOKER: it can only remove
-- the caller's own rows. It leaves the login itself alone, which is shared with other apps.
create or replace function glorieta.delete_my_data() returns void
language sql security invoker set search_path = '' as $$
  delete from glorieta.attempts        where user_id = (select auth.uid());
  delete from glorieta.exam_results    where user_id = (select auth.uid());
  delete from glorieta.progress        where user_id = (select auth.uid());
  delete from glorieta.lesson_progress where user_id = (select auth.uid());
  delete from glorieta.quiz_progress   where user_id = (select auth.uid());
  delete from glorieta.profiles        where user_id = (select auth.uid());
$$;
grant execute on function glorieta.delete_my_data() to authenticated;
