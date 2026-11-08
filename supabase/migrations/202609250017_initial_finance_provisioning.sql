-- Each gamer receives their calculated initial balance when their profile is
-- created, rather than only after their 19-player squad has been submitted.
-- The ledger key makes provisioning safe to run for historical profiles too.

create or replace function public.provision_initial_finance(p_gamer_id uuid)
returns numeric
language plpgsql
security definer set search_path = ''
as $$
declare
  v_average_value numeric;
  v_settled_matchdays integer;
  v_initial_budget numeric(14,2);
begin
  select avg(p.marketfoot_value)
  into v_average_value
  from public.players p
  where p.is_active;

  -- A budget cannot be calculated until an administrator has created an
  -- active player catalogue. The onboarding RPC retries provisioning later.
  if v_average_value is null then
    return null;
  end if;

  select count(*)::integer
  into v_settled_matchdays
  from public.matchdays m
  where m.status = 'settled';

  v_initial_budget := round(
    v_average_value * 19 * 0.8 + v_settled_matchdays * 0.02,
    2
  );

  insert into public.gamer_finances (gamer_id, budget, blocked_account)
  values (p_gamer_id, v_initial_budget, 0)
  on conflict (gamer_id) do nothing;

  insert into public.financial_ledger (
    gamer_id,
    event_type,
    budget_delta,
    locked_account_delta,
    idempotency_key,
    metadata
  )
  values (
    p_gamer_id,
    'initial_allocation',
    v_initial_budget,
    0,
    'initial-allocation:' || p_gamer_id,
    jsonb_build_object(
      'formula', 'AVG * 19 * 0.8 + settled_matchdays * 0.02',
      'averagePlayerValue', v_average_value,
      'settledMatchdays', v_settled_matchdays
    )
  )
  on conflict (idempotency_key) do nothing;

  return v_initial_budget;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'gamer-' || substring(new.id::text, 1, 8))
  );

  perform public.provision_initial_finance(new.id);
  return new;
end;
$$;

-- Reconcile users who registered before this provisioning behaviour existed.
select public.provision_initial_finance(p.id)
from public.profiles p
left join public.gamer_finances f on f.gamer_id = p.id
where f.gamer_id is null;

create or replace function public.create_initial_squad(
  p_gamer_id uuid,
  p_name text,
  p_members jsonb,
  p_budget numeric
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_squad uuid;
  v_cost numeric;
  v_active uuid;
  v_available_budget numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_gamer_id::text, 0));
  if exists (select 1 from public.squads where gamer_id = p_gamer_id) then
    raise exception 'SQUAD_ALREADY_EXISTS';
  end if;
  if jsonb_array_length(p_members) <> 19 then
    raise exception 'INVALID_SQUAD_SIZE';
  end if;
  if (select count(*) from public.players where is_active and id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x)) <> 19 then
    raise exception 'INVALID_PLAYERS';
  end if;
  if exists (select 1 from public.players where id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x) group by club_id having count(*) > 4) then
    raise exception 'CLUB_LIMIT';
  end if;
  if exists (select 1 from (values ('GK', 3), ('DF', 6), ('MF', 5), ('FW', 5)) expected(pos, n) where (select count(*) from public.players p where p.position::text = expected.pos and p.id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x)) <> expected.n) then
    raise exception 'INVALID_POSITIONS';
  end if;

  perform public.provision_initial_finance(p_gamer_id);
  select budget into v_available_budget from public.gamer_finances where gamer_id = p_gamer_id for update;
  if v_available_budget is null then
    raise exception 'INITIAL_BUDGET_UNAVAILABLE';
  end if;
  if abs(v_available_budget - p_budget) > 0.01 then
    raise exception 'INITIAL_BUDGET_MISMATCH';
  end if;

  select sum(marketfoot_value) into v_cost from public.players where id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x);
  if v_cost > v_available_budget then
    raise exception 'INSUFFICIENT_BUDGET';
  end if;
  select m.id into v_active from public.matchdays m join public.seasons s on s.id = m.season_id where s.is_current and m.status = 'open' and not exists (select 1 from public.matches f where f.matchday_id = m.id and f.kickoff_at - interval '2 hours' <= now()) order by m.number limit 1;

  insert into public.squads (gamer_id, name, activation_matchday_id) values (p_gamer_id, p_name, v_active) returning id into v_squad;
  insert into public.squad_members (squad_id, player_id, acquired_value) select v_squad, id, marketfoot_value from public.players where id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x);
  update public.gamer_finances set budget = budget - v_cost, updated_at = timezone('utc', now()) where gamer_id = p_gamer_id;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
  values (p_gamer_id, 'initial_squad', -v_cost, 0, 'initial-squad:' || v_squad, jsonb_build_object('squadId', v_squad));
  return v_squad;
end;
$$;

revoke all on function public.provision_initial_finance(uuid) from public;
revoke all on function public.create_initial_squad(uuid, text, jsonb, numeric) from public;
grant execute on function public.create_initial_squad(uuid, text, jsonb, numeric) to service_role;
