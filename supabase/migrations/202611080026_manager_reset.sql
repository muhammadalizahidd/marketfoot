-- Account reset (PRD §18): the squad is emptied and must be rebuilt; the Blocked Account (incl. prediction earnings) is kept.
-- The squad row and all history stay in place, so create_initial_squad now re-uses an empty squad instead of failing.
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
  if exists (select 1 from public.squads s where s.gamer_id = p_gamer_id and exists (select 1 from public.squad_members sm where sm.squad_id = s.id)) then
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

  select id into v_squad from public.squads where gamer_id = p_gamer_id;
  if v_squad is null then
    insert into public.squads (gamer_id, name, activation_matchday_id) values (p_gamer_id, p_name, v_active) returning id into v_squad;
  else
    update public.squads set name = p_name, activation_matchday_id = v_active, updated_at = now() where id = v_squad;
  end if;
  insert into public.squad_members (squad_id, player_id, acquired_value) select v_squad, id, marketfoot_value from public.players where id in (select (x ->> 'playerId')::uuid from jsonb_array_elements(p_members) x);
  update public.gamer_finances set budget = budget - v_cost, updated_at = timezone('utc', now()) where gamer_id = p_gamer_id;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
  values (p_gamer_id, 'initial_squad', -v_cost, 0, 'initial-squad:' || v_squad, jsonb_build_object('squadId', v_squad));
  return v_squad;
end;
$$;
revoke all on function public.create_initial_squad(uuid, text, jsonb, numeric) from public;
grant execute on function public.create_initial_squad(uuid, text, jsonb, numeric) to service_role;

create or replace function public.initial_budget_value() returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v_avg numeric; v_days integer; v_ini numeric; v_step numeric;
begin
  select avg(marketfoot_value) into v_avg from public.players where is_active;
  if v_avg is null then return null; end if;
  select count(*)::integer into v_days from public.matchdays where status = 'settled';
  select coalesce((s.settings -> 'budget' ->> 'coefficientInitial')::numeric, 0.8), coalesce((s.settings -> 'budget' ->> 'coefficientMatchday')::numeric, 0.02)
    into v_ini, v_step from (select 1) d left join public.rules_settings s on s.is_active;
  return round(v_avg * 19 * coalesce(v_ini, 0.8) + v_days * coalesce(v_step, 0.02), 2);
end; $$;

create or replace function public.admin_reset_manager(p_actor uuid, p_gamer uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_squad uuid; v_budget numeric; v_before jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if exists (select 1 from public.profiles where id = p_gamer and role = 'admin') then raise exception 'CANNOT_RESET_ADMIN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_gamer::text, 0));
  select id into v_squad from public.squads where gamer_id = p_gamer for update;
  if v_squad is null then raise exception 'NO_SQUAD'; end if;
  v_budget := public.initial_budget_value();
  if v_budget is null then raise exception 'INITIAL_BUDGET_UNAVAILABLE'; end if;
  select to_jsonb(f) into v_before from public.gamer_finances f where f.gamer_id = p_gamer;
  update public.mercado_orders set status = 'cancelled', updated_at = now() where squad_id = v_squad and status = 'pending';
  delete from public.captain_assignments where squad_id = v_squad;
  delete from public.bonus_plays where squad_id = v_squad and succeeded is null;
  delete from public.squad_members where squad_id = v_squad;
  update public.gamer_finances set budget = v_budget, updated_at = now() where gamer_id = p_gamer;
  update public.profiles set reset_at = now() where id = p_gamer;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
    values (p_gamer, 'admin_reset', v_budget - coalesce((v_before ->> 'budget')::numeric, 0), 0, 'admin-reset:' || gen_random_uuid(), jsonb_build_object('actor', p_actor, 'previous', v_before));
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state) values (p_actor, 'manager.reset', 'profile', p_gamer, v_before, jsonb_build_object('budget', v_budget));
end; $$;
revoke all on function public.initial_budget_value(), public.admin_reset_manager(uuid, uuid) from public;
grant execute on function public.initial_budget_value(), public.admin_reset_manager(uuid, uuid) to service_role;
