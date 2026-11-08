-- Prediction earnings (PRD §12). Amounts are computed in the TypeScript rules boundary
-- and committed atomically with the matchday settlement. Provisional policies: see rules/config.ts.
create table public.prediction_results (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.matchday_settlements(id),
  matchday_id uuid not null references public.matchdays(id),
  gamer_id uuid not null references public.profiles(id),
  eligible_matches integer not null check (eligible_matches > 0),
  correct_predictions integer not null check (correct_predictions >= 0 and correct_predictions <= eligible_matches),
  result_pct numeric(7,4) not null,
  average_pct numeric(7,4) not null,
  x numeric(8,4) not null,
  raw_g numeric(16,2) not null,
  earnings numeric(14,2) not null,
  budget_delta numeric(14,2) not null,
  locked_account_delta numeric(14,2) not null,
  reversed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (settlement_id, gamer_id),
  check (budget_delta + locked_account_delta = earnings)
);
alter table public.prediction_results enable row level security;
create policy "Read own prediction results" on public.prediction_results for select to authenticated using (gamer_id = auth.uid() or public.is_admin());

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
  if p_effects ? 'predictions' and jsonb_typeof(p_effects->'predictions') is distinct from 'array' then raise exception 'INVALID_PAYLOAD'; end if;
  if exists(select 1 from jsonb_array_elements(p_effects->'effects') e where not exists(select 1 from public.matchday_squad_snapshots s where s.id=(e->>'snapshotId')::uuid and s.matchday_id=v_settlement.matchday_id and s.player_id=(e->>'playerId')::uuid and s.gamer_id=(e->>'gamerId')::uuid)) then raise exception 'INVALID_SNAPSHOT'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_effects->'predictions','[]'::jsonb)) e where not exists(select 1 from public.matchday_squad_snapshots s where s.matchday_id=v_settlement.matchday_id and s.gamer_id=(e->>'gamerId')::uuid)) then raise exception 'INVALID_PREDICTION_GAMER'; end if;
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
  for x in select * from jsonb_array_elements(coalesce(p_effects->'predictions','[]'::jsonb)) order by value->>'gamerId' loop
    if (x->>'budgetDelta')::numeric+(x->>'lockedAccountDelta')::numeric<>(x->>'earnings')::numeric then raise exception 'UNBALANCED_PREDICTION'; end if;
    insert into public.prediction_results(settlement_id,matchday_id,gamer_id,eligible_matches,correct_predictions,result_pct,average_pct,x,raw_g,earnings,budget_delta,locked_account_delta)
    values(p_settlement_id,v_settlement.matchday_id,(x->>'gamerId')::uuid,(x->>'eligible')::integer,(x->>'correct')::integer,(x->>'resultPct')::numeric,(x->>'averagePct')::numeric,(x->>'x')::numeric,(x->>'rawG')::numeric,(x->>'earnings')::numeric,(x->>'budgetDelta')::numeric,(x->>'lockedAccountDelta')::numeric);
    update public.gamer_finances set budget=budget+(x->>'budgetDelta')::numeric,blocked_account=blocked_account+(x->>'lockedAccountDelta')::numeric,updated_at=now() where gamer_id=(x->>'gamerId')::uuid;
    if not found then raise exception 'FINANCES_NOT_FOUND'; end if;
    insert into public.financial_ledger(gamer_id,matchday_id,settlement_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values((x->>'gamerId')::uuid,v_settlement.matchday_id,p_settlement_id,'prediction_earnings',(x->>'budgetDelta')::numeric,(x->>'lockedAccountDelta')::numeric,'prediction:'||p_settlement_id||':'||(x->>'gamerId'),jsonb_build_object('correct',(x->>'correct')::integer,'eligible',(x->>'eligible')::integer,'resultPct',(x->>'resultPct')::numeric,'averagePct',(x->>'averagePct')::numeric));
  end loop;
  insert into public.ranking_snapshots(settlement_id,matchday_id,gamer_id,total_wealth,squad_value,budget,locked_account,general_rank,earnings_rank)
  select p_settlement_id,v_settlement.matchday_id,f.gamer_id,f.budget+f.blocked_account+coalesce(sv.value,0),coalesce(sv.value,0),f.budget,f.blocked_account,row_number() over(order by f.budget+f.blocked_account+coalesce(sv.value,0) desc,f.gamer_id),row_number() over(order by coalesce(e.value,0) desc,f.gamer_id)
  from public.gamer_finances f left join lateral(select sum(p.marketfoot_value) value from public.squads s join public.squad_members sm on sm.squad_id=s.id join public.players p on p.id=sm.player_id where s.gamer_id=f.gamer_id) sv on true left join lateral(select sum(gross_effect) value from public.settlement_gamer_effects where gamer_id=f.gamer_id and reversed_at is null) e on true;
  update public.matchday_settlements set status='completed',completed_at=now(),ledger_checkpoint=(select coalesce(max(ledger_position),0) from public.financial_ledger) where id=p_settlement_id;
  update public.matchdays set status='settled' where id=v_settlement.matchday_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor_id,'settlement.commit','settlement',p_settlement_id,jsonb_build_object('effects',jsonb_array_length(p_effects->'effects'),'predictions',jsonb_array_length(coalesce(p_effects->'predictions','[]'::jsonb))));
end; $$;

create or replace function public.rollback_matchday_settlement(p_actor_id uuid, p_settlement_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settlement public.matchday_settlements%rowtype; v_history record; v_ledger record;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_settlement from public.matchday_settlements where id = p_settlement_id for update;
  if v_settlement.status <> 'completed' then raise exception 'SETTLEMENT_NOT_COMPLETED'; end if;
  if exists (select 1 from public.settlement_reversals where settlement_id = p_settlement_id) then raise exception 'SETTLEMENT_ALREADY_REVERTED'; end if;
  for v_ledger in select * from public.financial_ledger where settlement_id = p_settlement_id and event_type in ('matchday_settlement','prediction_earnings') loop
    update public.gamer_finances set budget = budget - v_ledger.budget_delta, blocked_account = blocked_account - v_ledger.locked_account_delta, updated_at = timezone('utc', now()) where gamer_id = v_ledger.gamer_id;
    insert into public.financial_ledger (gamer_id, matchday_id, settlement_id, event_type, budget_delta, locked_account_delta, idempotency_key, metadata) values (v_ledger.gamer_id, v_ledger.matchday_id, p_settlement_id, 'settlement_reversal', -v_ledger.budget_delta, -v_ledger.locked_account_delta, case when v_ledger.event_type = 'prediction_earnings' then 'reversal-prediction:' else 'reversal:' end || p_settlement_id::text || ':' || v_ledger.gamer_id::text, jsonb_build_object('reason', p_reason, 'reversedEvent', v_ledger.event_type));
  end loop;
  for v_history in select distinct on (player_id) * from public.player_value_history where settlement_id = p_settlement_id and value_kind = 'real_value' order by player_id, created_at desc loop
    update public.players set real_value = v_history.previous_value, updated_at = timezone('utc', now()) where id = v_history.player_id;
    insert into public.player_value_history (player_id, matchday_id, settlement_id, value_kind, previous_value, next_value, reason) values (v_history.player_id, v_history.matchday_id, p_settlement_id, 'real_value', v_history.next_value, v_history.previous_value, 'settlement_reversal');
  end loop;
  update public.settlement_player_effects set reversed_at = timezone('utc', now()) where settlement_id = p_settlement_id;
  update public.settlement_gamer_effects set reversed_at = timezone('utc', now()) where settlement_id = p_settlement_id;
  update public.prediction_results set reversed_at = timezone('utc', now()) where settlement_id = p_settlement_id;
  insert into public.settlement_reversals (settlement_id, actor_id, reason) values (p_settlement_id, p_actor_id, p_reason);
  update public.matchday_settlements set status = 'reverted' where id = p_settlement_id;
  update public.matchdays set status = 'closed' where id = v_settlement.matchday_id;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, after_state) values (p_actor_id, 'settlement.rollback', 'settlement', p_settlement_id, jsonb_build_object('reason', p_reason));
end; $$;
revoke all on function public.commit_matchday_settlement(uuid,uuid,jsonb) from public;
revoke all on function public.rollback_matchday_settlement(uuid,uuid,text) from public;
grant execute on function public.commit_matchday_settlement(uuid,uuid,jsonb),public.rollback_matchday_settlement(uuid,uuid,text) to service_role;

-- Predictions ranking (PRD §15.1): total and latest prediction earnings per gamer.
create function public.read_prediction_rankings(p_season uuid,p_period text default 'all',p_day integer default 34,p_search text default '',p_page integer default 1)
returns table(gamer_id uuid,username text,rank bigint,total_predictions numeric,latest_predictions numeric,total_count bigint)
language sql stable security definer set search_path='' as $$
with days as (
 select id,number from public.matchdays where season_id=p_season and number<=case when p_period='first' then 17 else p_day end
), latest as (
 select s.id from public.matchday_settlements s join days d on d.id=s.matchday_id where s.status='completed' order by d.number desc,s.completed_at desc limit 1
), sums as (
 select r.gamer_id,sum(r.earnings) total,sum(r.earnings) filter(where r.settlement_id=(select id from latest)) latest
 from public.prediction_results r join public.matchday_settlements s on s.id=r.settlement_id join days d on d.id=s.matchday_id
 where r.reversed_at is null and s.status='completed' and (p_period<>'second' or d.number>=18) and (p_period<>'day' or d.number=p_day) group by r.gamer_id
), ranked as (
 select p.id gamer_id,p.username,coalesce(s.total,0) total,coalesce(s.latest,0) latest,row_number() over(order by coalesce(s.total,0) desc,p.id) rank
 from sums s join public.profiles p on p.id=s.gamer_id where auth.uid() is not null
)
select gamer_id,username,rank,total,latest,count(*) over() from ranked where username ilike '%'||left(p_search,80)||'%' order by rank limit 20 offset (greatest(1,least(p_page,100000))-1)*20;
$$;
revoke all on function public.read_prediction_rankings(uuid,text,integer,text,integer) from public;
grant execute on function public.read_prediction_rankings(uuid,text,integer,text,integer) to authenticated;
