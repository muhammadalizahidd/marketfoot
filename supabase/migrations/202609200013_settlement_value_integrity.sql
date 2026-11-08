alter table public.matchday_settlements add column if not exists committed_inputs jsonb;
alter table public.financial_ledger add column ledger_position bigint generated always as identity;
alter table public.matchday_settlements add column ledger_checkpoint bigint;

create or replace function public.commit_matchday_settlement(p_actor_id uuid,p_settlement_id uuid,p_effects jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_settlement public.matchday_settlements%rowtype; x jsonb; v_before numeric; g record;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(713200);
  select * into v_settlement from public.matchday_settlements where id=p_settlement_id for update;
  if v_settlement.status='completed' then return; end if;
  if v_settlement.status is distinct from 'pending' then raise exception 'SETTLEMENT_NOT_PENDING'; end if;
  if not exists(select 1 from public.matchdays where id=v_settlement.matchday_id and status='closed') then raise exception 'MATCHDAY_NOT_CLOSED'; end if;
  if jsonb_typeof(p_effects->'effects') is distinct from 'array' or jsonb_typeof(p_effects->'playerValues') is distinct from 'array' then raise exception 'INVALID_PAYLOAD'; end if;
  if exists(select 1 from jsonb_array_elements(p_effects->'effects') e where not exists(select 1 from public.matchday_squad_snapshots s where s.id=(e->>'snapshotId')::uuid and s.matchday_id=v_settlement.matchday_id and s.player_id=(e->>'playerId')::uuid and s.gamer_id=(e->>'gamerId')::uuid)) then raise exception 'INVALID_SNAPSHOT'; end if;
  if exists(select 1 from jsonb_array_elements(p_effects->'playerValues') v group by v->>'playerId' having count(*)>1) then raise exception 'DUPLICATE_PLAYER_VALUE'; end if;
  update public.matchday_settlements set status='running',started_at=now(),committed_inputs=p_effects where id=p_settlement_id;
  for x in select * from jsonb_array_elements(p_effects->'effects') loop
    if (x->>'budgetDelta')::numeric+(x->>'lockedAccountDelta')::numeric<>(x->>'gamerEffect')::numeric then raise exception 'UNBALANCED_EFFECT'; end if;
    insert into public.settlement_player_effects(settlement_id,snapshot_id,player_id,gamer_id,normal_effect,captain_adjustment,gamer_effect,calculation) values(p_settlement_id,(x->>'snapshotId')::uuid,(x->>'playerId')::uuid,(x->>'gamerId')::uuid,(x->>'normalEffect')::numeric,(x->>'captainAdjustment')::numeric,(x->>'gamerEffect')::numeric,x->'calculation');
  end loop;
  for x in select * from jsonb_array_elements(p_effects->'playerValues') order by value->>'playerId' loop
    select real_value into v_before from public.players where id=(x->>'playerId')::uuid for update;
    update public.players set real_value=greatest(0,v_before+(x->>'normalEffect')::numeric),updated_at=now() where id=(x->>'playerId')::uuid;
    insert into public.player_value_history(player_id,matchday_id,settlement_id,value_kind,previous_value,next_value,reason) values((x->>'playerId')::uuid,v_settlement.matchday_id,p_settlement_id,'real_value',v_before,greatest(0,v_before+(x->>'normalEffect')::numeric),'matchday_settlement');
  end loop;
  for g in select (e->>'gamerId')::uuid id,sum((e->>'budgetDelta')::numeric) budget,sum((e->>'lockedAccountDelta')::numeric) locked from jsonb_array_elements(p_effects->'effects') e group by e->>'gamerId' order by e->>'gamerId' loop
    update public.gamer_finances set budget=budget+g.budget,blocked_account=blocked_account+g.locked,updated_at=now() where gamer_id=g.id;
    if not found then raise exception 'FINANCES_NOT_FOUND'; end if;
    insert into public.settlement_gamer_effects(settlement_id,gamer_id,gross_effect,budget_delta,locked_account_delta) values(p_settlement_id,g.id,g.budget+g.locked,g.budget,g.locked);
    insert into public.financial_ledger(gamer_id,matchday_id,settlement_id,event_type,budget_delta,locked_account_delta,idempotency_key) values(g.id,v_settlement.matchday_id,p_settlement_id,'matchday_settlement',g.budget,g.locked,'settlement:'||p_settlement_id||':'||g.id);
  end loop;
  insert into public.ranking_snapshots(settlement_id,matchday_id,gamer_id,total_wealth,squad_value,budget,locked_account,general_rank,earnings_rank)
  select p_settlement_id,v_settlement.matchday_id,f.gamer_id,f.budget+f.blocked_account+coalesce(sv.value,0),coalesce(sv.value,0),f.budget,f.blocked_account,row_number() over(order by f.budget+f.blocked_account+coalesce(sv.value,0) desc,f.gamer_id),row_number() over(order by coalesce(e.value,0) desc,f.gamer_id)
  from public.gamer_finances f left join lateral(select sum(p.marketfoot_value) value from public.squads s join public.squad_members sm on sm.squad_id=s.id join public.players p on p.id=sm.player_id where s.gamer_id=f.gamer_id) sv on true left join lateral(select sum(gross_effect) value from public.settlement_gamer_effects where gamer_id=f.gamer_id and reversed_at is null) e on true;
  update public.matchday_settlements set status='completed',completed_at=now(),ledger_checkpoint=(select coalesce(max(ledger_position),0) from public.financial_ledger) where id=p_settlement_id;
  update public.matchdays set status='settled' where id=v_settlement.matchday_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor_id,'settlement.commit','settlement',p_settlement_id,jsonb_build_object('effects',jsonb_array_length(p_effects->'effects')));
end; $$;

-- Reject unsafe isolated rollback when subsequent economic activity depends on it.
create function public.guard_settlement_rollback() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='reverted' and old.status='completed' and exists(select 1 from public.financial_ledger l where (old.ledger_checkpoint is null or l.ledger_position>old.ledger_checkpoint) and l.settlement_id is distinct from old.id and l.event_type not in('settlement_reversal')) then raise exception 'DEPENDENT_ACTIVITY_REQUIRES_REPLAY'; end if;
  return new;
end; $$;
create trigger settlement_rollback_guard before update of status on public.matchday_settlements for each row execute function public.guard_settlement_rollback();

create or replace view public.ranking_leaderboard with(security_barrier=true,security_invoker=false) as
select rs.settlement_id,rs.gamer_id,rs.general_rank,rs.total_wealth,rs.squad_value,rs.budget,rs.locked_account,rs.created_at,coalesce((select sum(sge.gross_effect) from public.settlement_gamer_effects sge where sge.gamer_id=rs.gamer_id and sge.reversed_at is null),0)::numeric(14,2) cumulative_earnings
from public.ranking_snapshots rs join public.matchday_settlements s on s.id=rs.settlement_id where s.status='completed';
revoke all on public.ranking_leaderboard from anon;
grant select on public.ranking_leaderboard to authenticated;
grant execute on function public.commit_matchday_settlement(uuid,uuid,jsonb),public.rollback_matchday_settlement(uuid,uuid,text) to service_role;
