-- Glorieta 003: the support plan's entitlement mirror.
--
-- Apply AFTER glorieta-schema-002-course-progress.sql. Idempotent: safe to run twice.
--
-- WHY. A signed-in person can pay for an optional support plan through Stripe. Stripe is the source
-- of truth. This schema keeps a one-way mirror of the person's active Stripe entitlement keys, so the
-- app can show a supporter badge. Nothing in the study experience reads it.
--
-- DESIGN. The mirror is written by one function, glorieta.billing_apply(), and by nothing else. The
-- Glorieta Worker calls it through the API as `anon`, with the public publishable key, after it has
-- verified a Stripe webhook. The function refuses any call whose body is not signed with the HMAC key
-- held in glorieta.billing_key, which only the function's owner can read. The Worker holds the same
-- key. So the credential the Worker uses reaches this one function and nothing else in the database:
-- no service-role key, no extra Postgres role, nothing outside the `glorieta` schema.
--
-- This is the schema's first SECURITY DEFINER function and its first grant to `anon`: USAGE on the
-- schema and EXECUTE on billing_apply(). anon still holds no table privilege here.
--
-- The HMAC key itself is not in this file. Insert it once, from 1Password:
--   insert into glorieta.billing_key (secret) values ('<64+ hex chars>')
--   on conflict (id) do update set secret = excluded.secret;

-- True when every key is one of Glorieta's entitlement lookup keys.
create or replace function glorieta.only_glorieta_keys(keys text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(k like 'glorieta\_%'), true) from unnest(keys) as k
$$;

-- One row per person who has a Stripe customer. Written only by billing_apply().
create table if not exists glorieta.billing (
  user_id            uuid primary key references glorieta.profiles (user_id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  -- Active Stripe entitlement lookup keys, sorted. Only Glorieta's own.
  entitlements       text[] not null default '{}' check (glorieta.only_glorieta_keys(entitlements)),
  -- The last Stripe event applied: a replayed delivery of it changes nothing.
  last_event_id      text check (last_event_id is null or last_event_id ~ '^evt_[A-Za-z0-9]+$'),
  -- The last 50 transitions: [{ event_id, ts, from, to }].
  history            jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(history) = 'array' and jsonb_array_length(history) <= 50),
  -- The supporter state Podograph last accepted for this person; null means never sent.
  crm_reported       text check (crm_reported in ('supporter', 'none')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table glorieta.billing is 'Support plan: one-way mirror of Stripe entitlements. Written only by glorieta.billing_apply().';

drop trigger if exists billing_touch_updated_at on glorieta.billing;
create trigger billing_touch_updated_at
  before update on glorieta.billing
  for each row execute function glorieta.touch_updated_at();

-- The HMAC key shared with the Glorieta Worker. One row. No role but the owner can read it.
create table if not exists glorieta.billing_key (
  id     boolean primary key default true check (id),
  secret text not null check (char_length(secret) >= 64)
);

comment on table glorieta.billing_key is 'HMAC key for glorieta.billing_apply(). Readable by the table owner only.';

-- The only writer of glorieta.billing. p_body is the exact JSON text the Worker signed (text, not
-- jsonb, because a jsonb round trip would change the bytes); p_sig is its HMAC-SHA256 in hex.
create or replace function glorieta.billing_apply(p_body text, p_sig text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_secret  text;
  v         jsonb;
  v_issued  timestamptz;
  v_user    uuid;
  v_cust    text;
  v_event   text;
  v_keys    text[];
  v_hist    jsonb;
  v_row     glorieta.billing%rowtype;
  v_profile glorieta.profiles%rowtype;
  v_status  text;
begin
  select secret into v_secret from glorieta.billing_key where id;
  if v_secret is null then
    raise exception 'billing_key_missing';
  end if;
  if p_body is null or p_sig is null
     or encode(extensions.hmac(p_body, v_secret, 'sha256'), 'hex') <> lower(p_sig) then
    raise exception 'bad_signature' using errcode = '42501';
  end if;

  v := p_body::jsonb;
  v_issued := (v ->> 'issued_at')::timestamptz;
  if v_issued is null or abs(extract(epoch from (now() - v_issued))) > 300 then
    raise exception 'stale_call' using errcode = '42501';
  end if;

  case v ->> 'op'

  when 'link_customer' then
    v_user := (v ->> 'user_id')::uuid;
    v_cust := v ->> 'customer_id';
    if not exists (select 1 from glorieta.profiles where user_id = v_user) then
      return jsonb_build_object('status', 'no_profile');
    end if;
    insert into glorieta.billing (user_id, stripe_customer_id) values (v_user, v_cust)
    on conflict (user_id) do nothing;
    select stripe_customer_id into v_cust from glorieta.billing where user_id = v_user;
    return jsonb_build_object('status', 'linked', 'customer_id', v_cust);

  when 'entitlements' then
    v_cust := v ->> 'customer_id';
    v_event := v ->> 'event_id';
    select * into v_row from glorieta.billing where stripe_customer_id = v_cust for update;
    if not found then
      return jsonb_build_object('status', 'no_row');
    end if;
    if v_row.last_event_id is not distinct from v_event then
      v_status := 'noop';
    else
      select coalesce(array_agg(distinct e.k order by e.k), '{}') into v_keys
      from jsonb_array_elements_text(coalesce(v -> 'entitlements', '[]'::jsonb)) as e(k)
      where e.k like 'glorieta\_%';
      v_hist := v_row.history || jsonb_build_array(jsonb_build_object(
        'event_id', v_event, 'ts', now(), 'from', to_jsonb(v_row.entitlements), 'to', to_jsonb(v_keys)));
      if jsonb_array_length(v_hist) > 50 then
        select jsonb_agg(h.e order by h.i) into v_hist
        from jsonb_array_elements(v_hist) with ordinality as h(e, i)
        where h.i > jsonb_array_length(v_hist) - 50;
      end if;
      update glorieta.billing
         set entitlements = v_keys, last_event_id = v_event, history = v_hist
       where user_id = v_row.user_id
      returning * into v_row;
      v_status := 'applied';
    end if;
    select * into v_profile from glorieta.profiles where user_id = v_row.user_id;
    return jsonb_build_object(
      'status', v_status,
      'user_id', v_row.user_id,
      'supporter', 'glorieta_supporter' = any (v_row.entitlements),
      'marketing_opt_in', v_profile.marketing_opt_in,
      'crm_synced', v_profile.crm_synced_at is not null,
      'crm_reported', v_row.crm_reported);

  when 'clear' then
    update glorieta.billing set entitlements = '{}'
     where user_id = (v ->> 'user_id')::uuid and stripe_customer_id = v ->> 'customer_id';
    return jsonb_build_object('status', case when found then 'cleared' else 'no_row' end);

  when 'crm_reported' then
    update glorieta.billing set crm_reported = v ->> 'state'
     where user_id = (v ->> 'user_id')::uuid;
    return jsonb_build_object('status', case when found then 'ok' else 'no_row' end);

  else
    raise exception 'unknown_op: %', v ->> 'op';
  end case;
end $$;

comment on function glorieta.billing_apply(text, text) is 'The only writer of glorieta.billing. Refuses any call not signed with the key in glorieta.billing_key.';

-- "Delete my Glorieta data" now refuses while the person holds an active support plan: the app must
-- first call /api/billing/erase, which deletes the Stripe customer and clears the mirror. Still
-- SECURITY INVOKER: it can only remove the caller's own rows. The billing row goes with the profile
-- through its foreign key. The login itself is left alone; it is shared with other apps.
create or replace function glorieta.delete_my_data() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from glorieta.billing
             where user_id = (select auth.uid()) and 'glorieta_supporter' = any (entitlements)) then
    raise exception 'active_support_plan' using errcode = 'P0001',
      hint = 'Call /api/billing/erase first.';
  end if;
  delete from glorieta.attempts        where user_id = (select auth.uid());
  delete from glorieta.exam_results    where user_id = (select auth.uid());
  delete from glorieta.progress        where user_id = (select auth.uid());
  delete from glorieta.lesson_progress where user_id = (select auth.uid());
  delete from glorieta.quiz_progress   where user_id = (select auth.uid());
  delete from glorieta.profiles        where user_id = (select auth.uid());
end $$;

-- Row level security: a person reads only their own billing row. No policy lets any client write it.
alter table glorieta.billing     enable row level security;
alter table glorieta.billing_key enable row level security;

drop policy if exists billing_select_own on glorieta.billing;
create policy billing_select_own on glorieta.billing for select to authenticated
  using (user_id = (select auth.uid()));

-- Privileges.
revoke all on glorieta.billing, glorieta.billing_key from public, anon, authenticated, service_role;
grant select on glorieta.billing to authenticated, service_role;

revoke all on function glorieta.only_glorieta_keys(text[]) from public, anon, authenticated;
revoke all on function glorieta.billing_apply(text, text) from public, anon, authenticated, service_role;
grant usage on schema glorieta to anon;
grant execute on function glorieta.billing_apply(text, text) to anon;
grant execute on function glorieta.delete_my_data() to authenticated;
