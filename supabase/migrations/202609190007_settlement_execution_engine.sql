-- Immutable settlement inputs and append-only outputs. All game arithmetic is
-- calculated in the TypeScript rules boundary; this RPC only commits a reviewed payload atomically.
alter type public.settlement_status add value if not exists 'reverted';

alter table public.matchday_settlements add column if not exists attempt integer not null default 1;
alter table public.matchday_settlements drop constraint if exists matchday_settlements_matchday_id_rules_version_key;
alter table public.matchday_settlements add constraint matchday_settlements_matchday_rules_attempt_key unique (matchday_id, rules_version, attempt);
alter table public.gamer_finances drop constraint if exists gamer_finances_budget_check;
alter table public.players add column if not exists real_value numeric(14,2) not null default 0 check (real_value >= 0);
update public.players set real_value = marketfoot_value where real_value = 0;

create table public.matchday_squad_snapshots (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id),
  squad_id uuid not null references public.squads(id),
  gamer_id uuid not null references public.profiles(id),
  player_id uuid not null references public.players(id),
  club_id uuid not null references public.clubs(id),
  position public.player_position not null,
  acquired_value numeric(14,2) not null,
  marketfoot_value numeric(14,2) not null,
  real_value numeric(14,2) not null,
  is_starter boolean not null,
  is_captain boolean not null,
  frozen_at timestamptz not null default timezone('utc', now()),
  unique (matchday_id, squad_id, player_id)
);

create table public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  gamer_id uuid not null references public.profiles(id),
  matchday_id uuid references public.matchdays(id),
  settlement_id uuid references public.matchday_settlements(id),
  event_type text not null,
  budget_delta numeric(14,2) not null,
  locked_account_delta numeric(14,2) not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.player_value_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  matchday_id uuid references public.matchdays(id),
  settlement_id uuid references public.matchday_settlements(id),
  value_kind text not null check (value_kind in ('real_value', 'marketfoot_value')),
  previous_value numeric(14,2) not null,
  next_value numeric(14,2) not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.settlement_player_effects (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.matchday_settlements(id),
  snapshot_id uuid not null references public.matchday_squad_snapshots(id),
  player_id uuid not null references public.players(id),
  gamer_id uuid not null references public.profiles(id),
  normal_effect numeric(14,2) not null,
  captain_adjustment numeric(14,2) not null default 0,
  gamer_effect numeric(14,2) not null,
  calculation jsonb not null,
  reversed_at timestamptz,
  unique (settlement_id, snapshot_id)
);

create table public.settlement_gamer_effects (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.matchday_settlements(id),
  gamer_id uuid not null references public.profiles(id),
  gross_effect numeric(14,2) not null,
  budget_delta numeric(14,2) not null,
  locked_account_delta numeric(14,2) not null,
  reversed_at timestamptz,
  unique (settlement_id, gamer_id)
);

create table public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.matchday_settlements(id),
  matchday_id uuid not null references public.matchdays(id),
  gamer_id uuid not null references public.profiles(id),
  total_wealth numeric(14,2) not null,
  squad_value numeric(14,2) not null,
  budget numeric(14,2) not null,
  locked_account numeric(14,2) not null,
  general_rank integer not null,
  earnings_rank integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (settlement_id, gamer_id)
);

create table public.settlement_reversals (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null unique references public.matchday_settlements(id),
  actor_id uuid not null references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.matchday_squad_snapshots enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.player_value_history enable row level security;
alter table public.settlement_player_effects enable row level security;
alter table public.settlement_gamer_effects enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.settlement_reversals enable row level security;
create policy "Users can read settlement snapshots" on public.matchday_squad_snapshots for select to authenticated using (true);
create policy "Users can read own financial ledger" on public.financial_ledger for select to authenticated using (gamer_id = auth.uid() or public.is_admin());
create policy "Users can read value history" on public.player_value_history for select to authenticated using (true);
create policy "Users can read settlement effects" on public.settlement_player_effects for select to authenticated using (gamer_id = auth.uid() or public.is_admin());
create policy "Users can read own settlement totals" on public.settlement_gamer_effects for select to authenticated using (gamer_id = auth.uid() or public.is_admin());
create policy "Users can read ranking snapshots" on public.ranking_snapshots for select to authenticated using (true);
create policy "Admins can read settlement reversals" on public.settlement_reversals for select to authenticated using (public.is_admin());

create or replace function public.admin_transition_matchday(p_actor_id uuid, p_matchday_id uuid, p_next_status public.matchday_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_current public.matchday_status;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select to_jsonb(m), m.status into v_before, v_current from public.matchdays m where m.id = p_matchday_id;
  if v_current is null then raise exception 'MATCHDAY_NOT_FOUND'; end if;
  if not ((v_current = 'draft' and p_next_status = 'open') or (v_current = 'open' and p_next_status = 'mercado') or (v_current = 'mercado' and p_next_status = 'closed')) then raise exception 'INVALID_LIFECYCLE_TRANSITION'; end if;
  if p_next_status = 'closed' then
    insert into public.matchday_squad_snapshots (matchday_id, squad_id, gamer_id, player_id, club_id, position, acquired_value, marketfoot_value, real_value, is_starter, is_captain)
    select p_matchday_id, sm.squad_id, s.gamer_id, sm.player_id, p.club_id, p.position, sm.acquired_value, p.marketfoot_value, p.real_value, sm.is_starter, sm.is_captain
    from public.squad_members sm join public.squads s on s.id = sm.squad_id join public.players p on p.id = sm.player_id
    on conflict (matchday_id, squad_id, player_id) do nothing;
  end if;
  update public.matchdays set status = p_next_status where id = p_matchday_id;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, before_state, after_state) values (p_actor_id, 'matchday.transition', 'matchday', p_matchday_id, v_before, (select to_jsonb(m) from public.matchdays m where m.id = p_matchday_id));
end; $$;

create or replace function public.commit_matchday_settlement(p_actor_id uuid, p_settlement_id uuid, p_effects jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settlement public.matchday_settlements%rowtype; v_effect jsonb; v_gamer uuid; v_budget numeric; v_locked numeric; v_squad numeric; v_value numeric; v_rank integer := 0;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_settlement from public.matchday_settlements where id = p_settlement_id for update;
  if v_settlement.id is null then raise exception 'SETTLEMENT_NOT_FOUND'; end if;
  if v_settlement.status <> 'pending' then raise exception 'SETTLEMENT_NOT_PENDING'; end if;
  if not exists (select 1 from public.matchdays where id = v_settlement.matchday_id and status = 'closed') then raise exception 'MATCHDAY_NOT_CLOSED'; end if;
  update public.matchday_settlements set status = 'running', started_at = timezone('utc', now()) where id = p_settlement_id;
  for v_effect in select * from jsonb_array_elements(p_effects) loop
    insert into public.settlement_player_effects (settlement_id, snapshot_id, player_id, gamer_id, normal_effect, captain_adjustment, gamer_effect, calculation)
    values (p_settlement_id, (v_effect->>'snapshotId')::uuid, (v_effect->>'playerId')::uuid, (v_effect->>'gamerId')::uuid, (v_effect->>'normalEffect')::numeric, (v_effect->>'captainAdjustment')::numeric, (v_effect->>'gamerEffect')::numeric, v_effect->'calculation');
    select real_value into v_value from public.players where id = (v_effect->>'playerId')::uuid for update;
    update public.players set real_value = greatest(0, v_value + (v_effect->>'normalEffect')::numeric), updated_at = timezone('utc', now()) where id = (v_effect->>'playerId')::uuid;
    insert into public.player_value_history (player_id, matchday_id, settlement_id, value_kind, previous_value, next_value, reason) values ((v_effect->>'playerId')::uuid, v_settlement.matchday_id, p_settlement_id, 'real_value', v_value, greatest(0, v_value + (v_effect->>'normalEffect')::numeric), 'matchday_settlement');
  end loop;
  for v_gamer, v_budget, v_locked in select (x->>'gamerId')::uuid, sum((x->>'budgetDelta')::numeric), sum((x->>'lockedAccountDelta')::numeric) from jsonb_array_elements(p_effects) x group by (x->>'gamerId')::uuid loop
    insert into public.settlement_gamer_effects (settlement_id, gamer_id, gross_effect, budget_delta, locked_account_delta) values (p_settlement_id, v_gamer, v_budget + v_locked, v_budget, v_locked);
    update public.gamer_finances set budget = budget + v_budget, blocked_account = blocked_account + v_locked, updated_at = timezone('utc', now()) where gamer_id = v_gamer;
    insert into public.financial_ledger (gamer_id, matchday_id, settlement_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata) values (v_gamer, v_settlement.matchday_id, p_settlement_id, 'matchday_settlement', v_budget, v_locked, 'settlement:' || p_settlement_id::text || ':' || v_gamer::text, '{}'::jsonb);
  end loop;
  for v_gamer, v_budget, v_locked, v_squad in select gf.gamer_id, gf.budget, gf.blocked_account, coalesce(sum(p.marketfoot_value), 0) from public.gamer_finances gf left join public.squads s on s.gamer_id = gf.gamer_id left join public.squad_members sm on sm.squad_id = s.id left join public.players p on p.id = sm.player_id group by gf.gamer_id, gf.budget, gf.blocked_account order by (gf.budget + gf.blocked_account + coalesce(sum(p.marketfoot_value),0)) desc loop
    v_rank := v_rank + 1;
    insert into public.ranking_snapshots (settlement_id, matchday_id, gamer_id, total_wealth, squad_value, budget, locked_account, general_rank, earnings_rank) values (p_settlement_id, v_settlement.matchday_id, v_gamer, v_budget + v_locked + v_squad, v_squad, v_budget, v_locked, v_rank, v_rank);
  end loop;
  update public.matchday_settlements set status = 'completed', completed_at = timezone('utc', now()) where id = p_settlement_id;
  update public.matchdays set status = 'settled' where id = v_settlement.matchday_id;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, after_state) values (p_actor_id, 'settlement.commit', 'settlement', p_settlement_id, jsonb_build_object('effects', jsonb_array_length(p_effects)));
end; $$;

create or replace function public.rollback_matchday_settlement(p_actor_id uuid, p_settlement_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settlement public.matchday_settlements%rowtype; v_history record; v_ledger record;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_settlement from public.matchday_settlements where id = p_settlement_id for update;
  if v_settlement.status <> 'completed' then raise exception 'SETTLEMENT_NOT_COMPLETED'; end if;
  if exists (select 1 from public.settlement_reversals where settlement_id = p_settlement_id) then raise exception 'SETTLEMENT_ALREADY_REVERTED'; end if;
  for v_ledger in select * from public.financial_ledger where settlement_id = p_settlement_id and event_type = 'matchday_settlement' loop
    update public.gamer_finances set budget = budget - v_ledger.budget_delta, blocked_account = blocked_account - v_ledger.locked_account_delta, updated_at = timezone('utc', now()) where gamer_id = v_ledger.gamer_id;
    insert into public.financial_ledger (gamer_id, matchday_id, settlement_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata) values (v_ledger.gamer_id, v_ledger.matchday_id, p_settlement_id, 'settlement_reversal', -v_ledger.budget_delta, -v_ledger.locked_account_delta, 'reversal:' || p_settlement_id::text || ':' || v_ledger.gamer_id::text, jsonb_build_object('reason', p_reason));
  end loop;
  for v_history in select distinct on (player_id) * from public.player_value_history where settlement_id = p_settlement_id and value_kind = 'real_value' order by player_id, created_at desc loop
    update public.players set real_value = v_history.previous_value, updated_at = timezone('utc', now()) where id = v_history.player_id;
    insert into public.player_value_history (player_id, matchday_id, settlement_id, value_kind, previous_value, next_value, reason) values (v_history.player_id, v_history.matchday_id, p_settlement_id, 'real_value', v_history.next_value, v_history.previous_value, 'settlement_reversal');
  end loop;
  update public.settlement_player_effects set reversed_at = timezone('utc', now()) where settlement_id = p_settlement_id;
  update public.settlement_gamer_effects set reversed_at = timezone('utc', now()) where settlement_id = p_settlement_id;
  insert into public.settlement_reversals (settlement_id, actor_id, reason) values (p_settlement_id, p_actor_id, p_reason);
  update public.matchday_settlements set status = 'reverted' where id = p_settlement_id;
  update public.matchdays set status = 'closed' where id = v_settlement.matchday_id;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, after_state) values (p_actor_id, 'settlement.rollback', 'settlement', p_settlement_id, jsonb_build_object('reason', p_reason));
end; $$;
revoke all on function public.commit_matchday_settlement(uuid, uuid, jsonb) from public;
revoke all on function public.rollback_matchday_settlement(uuid, uuid, text) from public;
