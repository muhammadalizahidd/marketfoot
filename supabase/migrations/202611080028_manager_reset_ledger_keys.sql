-- Fix: rebuilding a reset squad collided with the initial-squad ledger key of the previous squad.
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
  -- The squad row is re-used for the rebuild, so the old per-squad ledger keys are archived to keep new entries unique.
  update public.financial_ledger set idempotency_key = idempotency_key || ':before-reset:' || extract(epoch from now())::bigint where gamer_id = p_gamer and idempotency_key = 'initial-squad:' || v_squad;
  update public.gamer_finances set budget = v_budget, updated_at = now() where gamer_id = p_gamer;
  update public.profiles set reset_at = now() where id = p_gamer;
  insert into public.financial_ledger (gamer_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata)
    values (p_gamer, 'admin_reset', v_budget - coalesce((v_before ->> 'budget')::numeric, 0), 0, 'admin-reset:' || gen_random_uuid(), jsonb_build_object('actor', p_actor, 'previous', v_before));
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state) values (p_actor, 'manager.reset', 'profile', p_gamer, v_before, jsonb_build_object('budget', v_budget));
end; $$;
