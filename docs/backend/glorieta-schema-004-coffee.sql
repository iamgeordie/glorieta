-- Glorieta 004: "Buy me a coffee", one-time support, and its Café badge.
--
-- Apply AFTER glorieta-schema-003-billing.sql. Idempotent: safe to run twice.
--
-- WHY. Besides the recurring plan, a signed-in person can pay once ("Invítame a un café"). Each paid
-- coffee earns the Café badge for good. Stripe holds no entitlement for a one-time payment, so the
-- mirror records the paid coffees themselves.
--
-- DESIGN. Same rule as 003: only glorieta.billing_apply() writes. Its new `coffee` op inserts one row per
-- paid Checkout Session, keyed by the session id, so a replayed webhook adds nothing. A coffee row belongs
-- to a person through their billing row's customer, and goes with their profile when they delete their
-- data. The person reads their own rows; no client writes them.

create table if not exists glorieta.coffees (
  session_id text primary key check (session_id ~ '^cs_[A-Za-z0-9_]+$'),
  user_id    uuid not null references glorieta.profiles (user_id) on delete cascade,
  -- Euro cents, whole euros from 2 to 200 (the Worker refuses anything else before Checkout).
  amount     integer not null check (amount between 200 and 20000),
  currency   text not null check (currency ~ '^[a-z]{3}$'),
  paid_at    timestamptz not null default now()
);

create index if not exists coffees_user_id on glorieta.coffees (user_id);

comment on table glorieta.coffees is 'Paid one-time coffees ("Buy me a coffee"). Written only by glorieta.billing_apply().';

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

  when 'coffee' then
    -- A paid one-time coffee. Keyed by the Checkout Session id, so a replayed event adds nothing.
    select * into v_row from glorieta.billing where stripe_customer_id = v ->> 'customer_id';
    if not found then
      return jsonb_build_object('status', 'no_row');
    end if;
    insert into glorieta.coffees (session_id, user_id, amount, currency)
    values (v ->> 'session_id', v_row.user_id, (v ->> 'amount')::integer, v ->> 'currency')
    on conflict (session_id) do nothing;
    return jsonb_build_object('status', case when found then 'applied' else 'noop' end, 'user_id', v_row.user_id);

  when 'crm_reported' then
    update glorieta.billing set crm_reported = v ->> 'state'
     where user_id = (v ->> 'user_id')::uuid;
    return jsonb_build_object('status', case when found then 'ok' else 'no_row' end);

  else
    raise exception 'unknown_op: %', v ->> 'op';
  end case;
end $$;

comment on function glorieta.billing_apply(text, text) is 'The only writer of glorieta.billing and glorieta.coffees. Refuses any call not signed with the key in glorieta.billing_key.';

alter table glorieta.coffees enable row level security;

drop policy if exists coffees_select_own on glorieta.coffees;
create policy coffees_select_own on glorieta.coffees for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on glorieta.coffees from public, anon, authenticated, service_role;
grant select on glorieta.coffees to authenticated, service_role;

revoke all on function glorieta.billing_apply(text, text) from public, anon, authenticated, service_role;
grant execute on function glorieta.billing_apply(text, text) to anon;
