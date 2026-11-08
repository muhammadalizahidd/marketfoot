-- Lock a matchday before changing its order book, including admin execution.
create function public.lock_mercado_day() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.matchday_id::text,42));
  if tg_op='INSERT' and exists(select 1 from public.mercado_runs where matchday_id=new.matchday_id and status<>'pending') then raise exception 'MERCADO_ALREADY_EXECUTED'; end if;
  return new;
end; $$;
create trigger mercado_day_lock before insert or update on public.mercado_orders for each row execute function public.lock_mercado_day();

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
    insert into public.mercado_order_executions(run_id,order_id,outcome,budget_delta) values(v_run,v_order.id,'executed',v_delta);
    insert into public.financial_ledger(gamer_id,matchday_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values(v_order.gamer_id,p_matchday_id,'mercado_execution',v_delta,0,'mercado:'||v_run||':'||v_order.id,jsonb_build_object('orderId',v_order.id,'soldValue',v_sold,'boughtValue',v_bought,'tax',v_tax));
  end loop;
  update public.mercado_runs set status='completed',executed_by=p_actor_id,executed_at=now() where id=v_run;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor_id,'mercado.commit','mercado_run',v_run,jsonb_build_object('orders',jsonb_array_length(p_orders)));
  return v_run;
end; $$;
grant execute on function public.commit_mercado_run(uuid,uuid,jsonb,jsonb) to service_role;
