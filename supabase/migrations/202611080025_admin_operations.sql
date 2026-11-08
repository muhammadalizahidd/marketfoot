-- Admin operations: match-sheet status, Mercato stages + rollback, free-transfer cancel, site freeze, managers, bonus plays.

-- ── Matchday schedule and match sheets ────────────────────────────────────────────────────────────
alter table public.matchdays
  add column if not exists mercato_opens_at timestamptz,
  add column if not exists mercato_closes_at timestamptz,
  add column if not exists thaw_at timestamptz,
  add column if not exists mercato_stage text not null default 'idle' check (mercato_stage in ('idle', 'open', 'frozen', 'updated', 'thawed'));
update public.matchdays set mercato_stage = 'open' where status = 'mercado' and mercato_stage = 'idle';
update public.matchdays m set mercato_stage = 'thawed' where m.status in ('closed', 'settled') and exists (select 1 from public.mercado_runs r where r.matchday_id = m.id and r.status = 'completed') and m.mercato_stage = 'idle';

alter table public.matches add column if not exists sheet_status text not null default 'none' check (sheet_status in ('none', 'draft', 'validated'));
update public.matches set sheet_status = 'validated' where home_score is not null and away_score is not null and sheet_status = 'none';

create or replace function public.sync_mercato_stage() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'mercado' and old.status <> 'mercado' then new.mercato_stage := 'open'; if new.mercato_opens_at is null then new.mercato_opens_at := now(); end if; end if;
  if old.status = 'mercado' and new.status in ('closed', 'settled') then new.mercato_stage := 'thawed'; end if;
  return new;
end; $$;
drop trigger if exists matchdays_sync_mercato_stage on public.matchdays;
create trigger matchdays_sync_mercato_stage before update of status on public.matchdays for each row execute function public.sync_mercato_stage();

-- Orders can only be placed while the Mercato stage is "open".
create or replace function public.lock_mercado_day() returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.matchday_id::text, 42));
  if tg_op = 'INSERT' and exists (select 1 from public.mercado_runs where matchday_id = new.matchday_id and status <> 'pending') then raise exception 'MERCADO_ALREADY_EXECUTED'; end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.matchdays where id = new.matchday_id and mercato_stage = 'open') then raise exception 'MERCADO_NOT_OPEN'; end if;
  return new;
end; $$;

-- ── Site freeze ("Gel total") ─────────────────────────────────────────────────────────────────────
create table if not exists public.site_state (
  id boolean primary key default true check (id),
  frozen boolean not null default false,
  reason text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id)
);
insert into public.site_state (id) values (true) on conflict do nothing;
alter table public.site_state enable row level security;
drop policy if exists "Signed-in users read site state" on public.site_state;
create policy "Signed-in users read site state" on public.site_state for select to authenticated using (true);

-- ── Mercato rollback and free-transfer cancel need the replaced squad member ──────────────────────
alter table public.mercado_order_executions add column if not exists before_member jsonb;
alter table public.direct_transfers add column if not exists before_member jsonb, add column if not exists sale_applied boolean;

create or replace function public.commit_mercado_run(p_actor_id uuid,p_matchday_id uuid,p_orders jsonb,p_value_changes jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_run uuid; v_order record; v_member public.squad_members%rowtype; v_change jsonb; v_before numeric; v_after numeric; v_sold numeric; v_bought numeric; v_delta numeric; v_tax numeric;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_matchday_id::text,42));
  if not exists(select 1 from public.matchdays where id=p_matchday_id and status='mercado') then raise exception 'MATCHDAY_NOT_MERCADO'; end if;
  if exists(select 1 from public.mercado_runs where matchday_id=p_matchday_id and status='completed') then select id into v_run from public.mercado_runs where matchday_id=p_matchday_id; return v_run; end if;
  if (select count(*) from public.mercado_orders where matchday_id=p_matchday_id and status='pending')<>jsonb_array_length(p_orders) or exists(select 1 from public.mercado_orders o where o.matchday_id=p_matchday_id and o.status='pending' and not exists(select 1 from jsonb_array_elements(p_orders) x where (x->>'orderId')::uuid=o.id)) then raise exception 'STALE_REVIEW'; end if;
  perform 1 from public.squads where id in(select squad_id from public.mercado_orders where matchday_id=p_matchday_id and status='pending') order by id for update;
  perform 1 from public.players where id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_value_changes) x) order by id for update;
  insert into public.mercado_runs(matchday_id,status) values(p_matchday_id,'running') returning id into v_run;
  for v_change in select * from jsonb_array_elements(p_value_changes) loop
    select marketfoot_value into v_before from public.players where id=(v_change->>'playerId')::uuid;
    if v_before<>(v_change->>'beforeValue')::numeric then raise exception 'STALE_PLAYER_VALUE'; end if;
    v_after:=greatest(500000,v_before+(v_change->>'delta')::numeric);
    update public.players set marketfoot_value=v_after,updated_at=now() where id=(v_change->>'playerId')::uuid;
    insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values((v_change->>'playerId')::uuid,p_matchday_id,'marketfoot_value',v_before,v_after,'mercado_demand');
  end loop;
  for v_order in select o.*,s.gamer_id from public.mercado_orders o join public.squads s on s.id=o.squad_id where o.matchday_id=p_matchday_id and o.status='pending' order by o.created_at,o.id loop
    select * into v_member from public.squad_members where squad_id=v_order.squad_id and player_id=v_order.sold_player_id;
    if v_member.player_id is null then raise exception 'SOLD_PLAYER_NOT_OWNED'; end if;
    select marketfoot_value into v_sold from public.players where id=v_order.sold_player_id;
    select marketfoot_value into v_bought from public.players where id=v_order.bought_player_id;
    v_tax:=v_bought*v_order.submitted_tax/nullif(v_order.submitted_bought_value,0);
    if v_tax<>trunc(v_tax,2) then raise exception 'ROUNDING_POLICY_REQUIRED'; end if;
    v_delta:=v_sold-v_bought-v_tax-v_order.fixed_commission;
    delete from public.squad_members where squad_id=v_order.squad_id and player_id=v_order.sold_player_id;
    insert into public.squad_members(squad_id,player_id,acquired_value,is_starter,is_captain,is_initial) values(v_order.squad_id,v_order.bought_player_id,v_bought,v_member.is_starter,false,false);
    update public.gamer_finances set budget=budget+v_delta,updated_at=now() where gamer_id=v_order.gamer_id;
    update public.mercado_orders set status='executed',updated_at=now() where id=v_order.id;
    insert into public.mercado_order_executions(run_id,order_id,outcome,budget_delta,before_member) values(v_run,v_order.id,'executed',v_delta,to_jsonb(v_member));
    insert into public.financial_ledger(gamer_id,matchday_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values(v_order.gamer_id,p_matchday_id,'mercado_execution',v_delta,0,'mercado:'||v_run||':'||v_order.id,jsonb_build_object('orderId',v_order.id,'soldValue',v_sold,'boughtValue',v_bought,'tax',v_tax));
  end loop;
  update public.mercado_runs set status='completed',executed_by=p_actor_id,executed_at=now() where id=v_run;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor_id,'mercado.commit','mercado_run',v_run,jsonb_build_object('orders',jsonb_array_length(p_orders)));
  return v_run;
end; $$;
grant execute on function public.commit_mercado_run(uuid,uuid,jsonb,jsonb) to service_role;

-- "Annuler le mercato": undoes an executed run while the window is still the active Mercato matchday.
create or replace function public.admin_rollback_mercado_run(p_actor uuid, p_matchday uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_run uuid; v_exec record; v_change record; v_count integer := 0; v_current numeric;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_matchday::text, 42));
  select id into v_run from public.mercado_runs where matchday_id = p_matchday and status = 'completed';
  if v_run is null then raise exception 'NO_COMPLETED_RUN'; end if;
  if not exists (select 1 from public.matchdays where id = p_matchday and status = 'mercado') then raise exception 'MATCHDAY_NOT_MERCADO'; end if;
  if exists (select 1 from public.mercado_order_executions where run_id = v_run and outcome = 'executed' and before_member is null) then raise exception 'RUN_NOT_REVERSIBLE'; end if;
  for v_exec in
    select e.order_id, e.budget_delta, e.before_member, o.squad_id, o.bought_player_id, s.gamer_id
      from public.mercado_order_executions e join public.mercado_orders o on o.id = e.order_id join public.squads s on s.id = o.squad_id
     where e.run_id = v_run and e.outcome = 'executed' order by e.created_at
  loop
    delete from public.squad_members where squad_id = v_exec.squad_id and player_id = v_exec.bought_player_id;
    insert into public.squad_members select * from jsonb_populate_record(null::public.squad_members, v_exec.before_member);
    update public.gamer_finances set budget = budget - v_exec.budget_delta, updated_at = now() where gamer_id = v_exec.gamer_id;
    insert into public.financial_ledger (gamer_id, matchday_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
      values (v_exec.gamer_id, p_matchday, 'mercado_reversal', -v_exec.budget_delta, 0, 'mercado-reversal:' || v_run || ':' || v_exec.order_id, jsonb_build_object('orderId', v_exec.order_id));
    update public.mercado_orders set status = 'pending', updated_at = now() where id = v_exec.order_id;
    v_count := v_count + 1;
  end loop;
  for v_change in select distinct on (player_id) player_id, previous_value from public.player_value_history where matchday_id = p_matchday and value_kind = 'marketfoot_value' and reason = 'mercado_demand' order by player_id, created_at asc loop
    select marketfoot_value into v_current from public.players where id = v_change.player_id for update;
    update public.players set marketfoot_value = v_change.previous_value, updated_at = now() where id = v_change.player_id;
    insert into public.player_value_history (player_id, matchday_id, value_kind, previous_value, next_value, reason) values (v_change.player_id, p_matchday, 'marketfoot_value', v_current, v_change.previous_value, 'mercado_reversal');
  end loop;
  delete from public.mercado_order_executions where run_id = v_run;
  delete from public.mercado_runs where id = v_run;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, after_state) values (p_actor, 'mercado.rollback', 'matchday', p_matchday, jsonb_build_object('run', v_run, 'orders', v_count));
  return v_count;
end; $$;

create or replace function public.complete_direct_transfer(p_gamer_id uuid,p_matchday_id uuid,p_sold_player_id uuid,p_bought_player_id uuid,p_sold_value numeric,p_bought_value numeric,p_tax numeric,p_resulting_budget numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_squad uuid; v_id uuid; v_budget numeric; v_sold public.players%rowtype; v_bought public.players%rowtype; v_member public.squad_members%rowtype; v_next numeric;
begin
  select id into v_squad from public.squads where gamer_id=p_gamer_id for update;
  perform public.assert_transfer_allowed(v_squad,p_matchday_id,p_sold_player_id,p_bought_player_id,'open');
  perform 1 from public.players where id in(p_sold_player_id,p_bought_player_id) order by id for update;
  select * into v_sold from public.players where id=p_sold_player_id;
  select * into v_bought from public.players where id=p_bought_player_id;
  select budget into v_budget from public.gamer_finances where gamer_id=p_gamer_id for update;
  v_next:=v_budget+v_sold.marketfoot_value-v_bought.marketfoot_value-p_tax;
  if p_tax<0 or v_sold.marketfoot_value<>p_sold_value or v_bought.marketfoot_value<>p_bought_value or v_next<>p_resulting_budget then raise exception 'STALE_TRANSFER'; end if;
  if v_next<0 and (v_budget>=0 or v_next<=v_budget) then raise exception 'INSUFFICIENT_BUDGET'; end if;
  select * into v_member from public.squad_members where squad_id=v_squad and player_id=p_sold_player_id;
  delete from public.squad_members where squad_id=v_squad and player_id=p_sold_player_id;
  insert into public.squad_members(squad_id,player_id,acquired_value,is_starter,is_captain,is_initial) values(v_squad,p_bought_player_id,p_bought_value,v_member.is_starter,false,false);
  update public.gamer_finances set budget=v_next,updated_at=now() where gamer_id=p_gamer_id;
  insert into public.direct_transfers(squad_id,matchday_id,sold_player_id,bought_player_id,sold_value,bought_value,tax,before_member,sale_applied) values(v_squad,p_matchday_id,p_sold_player_id,p_bought_player_id,p_sold_value,p_bought_value,p_tax,to_jsonb(v_member),not v_member.is_initial) returning id into v_id;
  update public.players set marketfoot_value=marketfoot_value+20000,real_value=real_value+10000 where id=p_bought_player_id;
  insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values(p_bought_player_id,p_matchday_id,'marketfoot_value',v_bought.marketfoot_value,v_bought.marketfoot_value+20000,'direct_purchase'),(p_bought_player_id,p_matchday_id,'real_value',v_bought.real_value,v_bought.real_value+10000,'direct_purchase');
  if not v_member.is_initial then
    update public.players set marketfoot_value=greatest(500000,marketfoot_value-20000),real_value=greatest(0,real_value-10000) where id=p_sold_player_id;
    insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values(p_sold_player_id,p_matchday_id,'marketfoot_value',v_sold.marketfoot_value,greatest(500000,v_sold.marketfoot_value-20000),'direct_sale'),(p_sold_player_id,p_matchday_id,'real_value',v_sold.real_value,greatest(0,v_sold.real_value-10000),'direct_sale');
  end if;
  insert into public.financial_ledger(gamer_id,matchday_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values(p_gamer_id,p_matchday_id,'direct_transfer',v_next-v_budget,0,'direct:'||v_id,jsonb_build_object('transferId',v_id));
  return v_id;
end; $$;
grant execute on function public.complete_direct_transfer(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric) to service_role;

create or replace function public.admin_cancel_direct_transfer(p_actor uuid, p_transfer uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_t public.direct_transfers%rowtype; v_gamer uuid; v_bought public.squad_members%rowtype; v_delta numeric; v_budget numeric; v_value public.players%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_t from public.direct_transfers where id = p_transfer for update;
  if v_t.id is null then raise exception 'NOT_FOUND'; end if;
  if v_t.status <> 'completed' then raise exception 'ALREADY_CANCELLED'; end if;
  if exists (select 1 from public.matchdays where id = v_t.matchday_id and status in ('closed', 'settled')) then raise exception 'MATCHDAY_CLOSED'; end if;
  select gamer_id into v_gamer from public.squads where id = v_t.squad_id for update;
  select * into v_bought from public.squad_members where squad_id = v_t.squad_id and player_id = v_t.bought_player_id;
  if v_bought.player_id is null then raise exception 'BOUGHT_PLAYER_NOT_OWNED'; end if;
  if exists (select 1 from public.squad_members where squad_id = v_t.squad_id and player_id = v_t.sold_player_id) then raise exception 'SOLD_PLAYER_ALREADY_OWNED'; end if;
  v_delta := v_t.sold_value - v_t.bought_value - v_t.tax;
  select budget into v_budget from public.gamer_finances where gamer_id = v_gamer for update;
  if v_budget - v_delta < 0 then raise exception 'INSUFFICIENT_BUDGET_TO_REVERSE'; end if;
  delete from public.squad_members where squad_id = v_t.squad_id and player_id = v_t.bought_player_id;
  insert into public.squad_members (squad_id, player_id, acquired_value, is_starter, is_captain, is_initial)
    values (v_t.squad_id, v_t.sold_player_id, coalesce((v_t.before_member ->> 'acquired_value')::numeric, v_t.sold_value), v_bought.is_starter, v_bought.is_captain, coalesce((v_t.before_member ->> 'is_initial')::boolean, false));
  update public.gamer_finances set budget = budget - v_delta, updated_at = now() where gamer_id = v_gamer;
  select * into v_value from public.players where id = v_t.bought_player_id for update;
  update public.players set marketfoot_value = greatest(500000, marketfoot_value - 20000), real_value = greatest(0, real_value - 10000) where id = v_t.bought_player_id;
  insert into public.player_value_history (player_id, matchday_id, value_kind, previous_value, next_value, reason) values (v_t.bought_player_id, v_t.matchday_id, 'marketfoot_value', v_value.marketfoot_value, greatest(500000, v_value.marketfoot_value - 20000), 'direct_purchase_reversal');
  if coalesce(v_t.sale_applied, false) then
    select * into v_value from public.players where id = v_t.sold_player_id for update;
    update public.players set marketfoot_value = marketfoot_value + 20000, real_value = real_value + 10000 where id = v_t.sold_player_id;
    insert into public.player_value_history (player_id, matchday_id, value_kind, previous_value, next_value, reason) values (v_t.sold_player_id, v_t.matchday_id, 'marketfoot_value', v_value.marketfoot_value, v_value.marketfoot_value + 20000, 'direct_sale_reversal');
  end if;
  insert into public.financial_ledger (gamer_id, matchday_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
    values (v_gamer, v_t.matchday_id, 'direct_transfer_reversal', -v_delta, 0, 'direct-reversal:' || v_t.id, jsonb_build_object('transferId', v_t.id));
  update public.direct_transfers set status = 'cancelled' where id = v_t.id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state) values (p_actor, 'transfer.cancel', 'direct_transfer', v_t.id, to_jsonb(v_t));
end; $$;

-- ── Managers ──────────────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists reset_at timestamptz;

-- Hashed sign-in addresses (decision D3): used only to flag linked accounts; purged after 90 days.
create table if not exists public.profile_ip_events (
  id uuid primary key default gen_random_uuid(),
  gamer_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists profile_ip_events_hash on public.profile_ip_events (ip_hash);
create index if not exists profile_ip_events_gamer on public.profile_ip_events (gamer_id, created_at desc);
alter table public.profile_ip_events enable row level security;

create or replace function public.admin_managers(p_search text, p_status text, p_since date, p_limit integer, p_offset integer)
returns table (id uuid, username text, email text, status text, created_at timestamptz, last_sign_in_at timestamptz, last_seen_at timestamptz, linked integer, total bigint)
language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.username, u.email::text as email, p.created_at, u.last_sign_in_at, p.last_seen_at,
           case when p.banned_at is not null then 'banned'
                when coalesce(p.last_seen_at, u.last_sign_in_at, p.created_at) < now() - interval '30 days' then 'inactive'
                else 'active' end as status,
           (select count(distinct o.gamer_id)::integer from public.profile_ip_events e join public.profile_ip_events o on o.ip_hash = e.ip_hash and o.gamer_id <> e.gamer_id where e.gamer_id = p.id) as linked
      from public.profiles p join auth.users u on u.id = p.id
     where p.role = 'gamer'
       and (coalesce(p_search, '') = '' or p.username ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%')
       and (p_since is null or p.created_at::date >= p_since)
  ), filtered as (select * from base where coalesce(p_status, '') = '' or base.status = p_status)
  select f.id, f.username, f.email, f.status, f.created_at, f.last_sign_in_at, f.last_seen_at, f.linked, count(*) over () from filtered f
   order by f.created_at desc limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

create or replace function public.admin_manager_kpis()
returns table (total bigint, new_this_week bigint, online bigint) language sql stable security definer set search_path = '' as $$
  select count(*), count(*) filter (where created_at > now() - interval '7 days'), count(*) filter (where last_seen_at > now() - interval '10 minutes')
    from public.profiles where role = 'gamer';
$$;

create or replace function public.admin_adjust_finance(p_actor uuid, p_gamer uuid, p_budget_delta numeric, p_blocked_delta numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  update public.gamer_finances set budget = budget + p_budget_delta, blocked_account = blocked_account + p_blocked_delta, updated_at = now() where gamer_id = p_gamer;
  if not found then raise exception 'NO_FINANCE'; end if;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
    values (p_gamer, 'admin_correction', p_budget_delta, p_blocked_delta, 'admin:' || gen_random_uuid(), jsonb_build_object('reason', p_reason, 'actor', p_actor));
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, after_state) values (p_actor, 'finance.adjust', 'profile', p_gamer, jsonb_build_object('budget', p_budget_delta, 'blocked', p_blocked_delta, 'reason', p_reason));
end; $$;

-- The initial budget now follows the Barèmes coefficients (default 0.8 / 0.02).
create or replace function public.provision_initial_finance(p_gamer_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_average_value numeric; v_settled_matchdays integer; v_initial_budget numeric(14,2); v_ini numeric; v_step numeric;
begin
  select avg(p.marketfoot_value) into v_average_value from public.players p where p.is_active;
  if v_average_value is null then return null; end if;
  select count(*)::integer into v_settled_matchdays from public.matchdays m where m.status = 'settled';
  select coalesce((s.settings -> 'budget' ->> 'coefficientInitial')::numeric, 0.8), coalesce((s.settings -> 'budget' ->> 'coefficientMatchday')::numeric, 0.02)
    into v_ini, v_step from (select 1) d left join public.rules_settings s on s.is_active;
  v_ini := coalesce(v_ini, 0.8); v_step := coalesce(v_step, 0.02);
  v_initial_budget := round(v_average_value * 19 * v_ini + v_settled_matchdays * v_step, 2);
  insert into public.gamer_finances (gamer_id, budget, blocked_account) values (p_gamer_id, v_initial_budget, 0) on conflict (gamer_id) do nothing;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
    values (p_gamer_id, 'initial_allocation', v_initial_budget, 0, 'initial-allocation:' || p_gamer_id,
            jsonb_build_object('formula', 'AVG * 19 * COEFF_INI + settled_matchdays * COEFF_STEP', 'coefficientInitial', v_ini, 'coefficientMatchday', v_step, 'averagePlayerValue', v_average_value, 'settledMatchdays', v_settled_matchdays))
    on conflict (idempotency_key) do nothing;
  return v_initial_budget;
end; $$;

-- ── Bonus plays (PRD §6.4) ────────────────────────────────────────────────────────────────────────
create table if not exists public.bonus_plays (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id),
  season_id uuid not null references public.seasons(id),
  bonus_id text not null check (bonus_id in ('cholismo', 'turpin', 'clean-sheets', 'sorti-du-frigo', 'caviar-en-stock', 'fergie-time')),
  succeeded boolean,
  bonus_amount numeric(14,2),
  created_at timestamptz not null default timezone('utc', now()),
  unique (squad_id, matchday_id)
);
create index if not exists bonus_plays_squad_season on public.bonus_plays (squad_id, season_id, bonus_id);
alter table public.bonus_plays enable row level security;
drop policy if exists "Gamers read their bonus plays" on public.bonus_plays;
create policy "Gamers read their bonus plays" on public.bonus_plays for select to authenticated
  using (exists (select 1 from public.squads s where s.id = squad_id and s.gamer_id = auth.uid()) or public.is_admin());

create or replace function public.play_bonus(p_gamer uuid, p_matchday uuid, p_bonus text, p_max integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_squad uuid; v_season uuid; v_status public.matchday_status; v_first timestamptz; v_used integer;
begin
  select id into v_squad from public.squads where gamer_id = p_gamer for update;
  if v_squad is null then raise exception 'NO_SQUAD'; end if;
  select season_id, status into v_season, v_status from public.matchdays where id = p_matchday;
  if v_status is null or v_status not in ('open', 'mercado') then raise exception 'BONUS_CLOSED'; end if;
  select min(kickoff_at) into v_first from public.matches where matchday_id = p_matchday and not is_postponed;
  if v_first is not null and now() >= v_first - interval '2 hours' then raise exception 'BONUS_LOCKED'; end if;
  select count(*) into v_used from public.bonus_plays where squad_id = v_squad and season_id = v_season and bonus_id = p_bonus and matchday_id <> p_matchday;
  if v_used >= p_max then raise exception 'BONUS_EXHAUSTED'; end if;
  insert into public.bonus_plays (squad_id, matchday_id, season_id, bonus_id) values (v_squad, p_matchday, v_season, p_bonus)
    on conflict (squad_id, matchday_id) do update set bonus_id = excluded.bonus_id, created_at = now() where public.bonus_plays.succeeded is null;
end; $$;

create or replace function public.unplay_bonus(p_gamer uuid, p_matchday uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_first timestamptz;
begin
  select min(kickoff_at) into v_first from public.matches where matchday_id = p_matchday and not is_postponed;
  if v_first is not null and now() >= v_first - interval '2 hours' then raise exception 'BONUS_LOCKED'; end if;
  delete from public.bonus_plays where matchday_id = p_matchday and succeeded is null and squad_id = (select id from public.squads where gamer_id = p_gamer);
end; $$;

revoke all on function public.admin_rollback_mercado_run(uuid, uuid), public.admin_cancel_direct_transfer(uuid, uuid), public.admin_managers(text, text, date, integer, integer), public.admin_manager_kpis(), public.admin_adjust_finance(uuid, uuid, numeric, numeric, text), public.play_bonus(uuid, uuid, text, integer), public.unplay_bonus(uuid, uuid) from public;
grant execute on function public.admin_rollback_mercado_run(uuid, uuid), public.admin_cancel_direct_transfer(uuid, uuid), public.admin_managers(text, text, date, integer, integer), public.admin_manager_kpis(), public.admin_adjust_finance(uuid, uuid, numeric, numeric, text), public.play_bonus(uuid, uuid, text, integer), public.unplay_bonus(uuid, uuid) to service_role;
