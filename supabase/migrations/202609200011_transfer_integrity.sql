-- Serialize all transfers/orders for a squad; validate under current row locks.
alter table public.squad_members add column if not exists is_initial boolean not null default false;
update public.squad_members sm set is_initial=true where not exists(select 1 from public.direct_transfers t where t.squad_id=sm.squad_id and t.bought_player_id=sm.player_id) and not exists(select 1 from public.mercado_orders o where o.squad_id=sm.squad_id and o.bought_player_id=sm.player_id and o.status='executed');
create function public.mark_initial_member() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.gamer_finances f join public.squads s on s.gamer_id=f.gamer_id where s.id=new.squad_id) then new.is_initial:=true; end if;
  return new;
end; $$;
create trigger squad_member_origin before insert on public.squad_members for each row execute function public.mark_initial_member();

create or replace function public.assert_transfer_allowed(p_squad uuid,p_day uuid,p_sold uuid,p_bought uuid,p_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare v_sold public.players%rowtype; v_bought public.players%rowtype; v_count integer;
begin
  perform 1 from public.squads where id=p_squad for update;
  if not exists(select 1 from public.matchdays where id=p_day and status::text=p_mode) then raise exception 'PHASE_CLOSED'; end if;
  select * into v_sold from public.players where id=p_sold;
  select * into v_bought from public.players where id=p_bought;
  if v_sold.id is null or v_bought.id is null or not v_bought.is_active or v_sold.position<>v_bought.position then raise exception 'POSITION_MISMATCH'; end if;
  if not exists(select 1 from public.squad_members where squad_id=p_squad and player_id=p_sold) or exists(select 1 from public.squad_members where squad_id=p_squad and player_id=p_bought) then raise exception 'INVALID_OWNERSHIP'; end if;
  if exists(select 1 from public.matches where matchday_id=p_day and (home_club_id in(v_sold.club_id,v_bought.club_id) or away_club_id in(v_sold.club_id,v_bought.club_id)) and kickoff_at-interval '2 hours'<=now()) then raise exception 'TEAM_FROZEN'; end if;
  select (select count(*) from public.direct_transfers where squad_id=p_squad and matchday_id=p_day and status='completed')+(select count(*) from public.mercado_orders where squad_id=p_squad and matchday_id=p_day and status in('pending','executed')) into v_count;
  if v_count>=4 then raise exception 'TRANSFER_QUOTA'; end if;
  if exists(select 1 from public.mercado_orders where squad_id=p_squad and matchday_id=p_day and status='pending' and (sold_player_id=p_sold or bought_player_id=p_bought)) then raise exception 'DUPLICATE_ORDER'; end if;
  if (select count(*) from (
    select sm.player_id from public.squad_members sm where sm.squad_id=p_squad and sm.player_id<>p_sold and not exists(select 1 from public.mercado_orders o where o.squad_id=p_squad and o.matchday_id=p_day and o.status='pending' and o.sold_player_id=sm.player_id)
    union all select bought_player_id from public.mercado_orders where squad_id=p_squad and matchday_id=p_day and status='pending'
    union all select p_bought
  ) projected join public.players p on p.id=projected.player_id where p.club_id=v_bought.club_id)>4 then raise exception 'CLUB_LIMIT'; end if;
end; $$;
revoke all on function public.assert_transfer_allowed(uuid,uuid,uuid,uuid,text) from public;

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
  insert into public.direct_transfers(squad_id,matchday_id,sold_player_id,bought_player_id,sold_value,bought_value,tax) values(v_squad,p_matchday_id,p_sold_player_id,p_bought_player_id,p_sold_value,p_bought_value,p_tax) returning id into v_id;
  update public.players set marketfoot_value=marketfoot_value+20000,real_value=real_value+10000 where id=p_bought_player_id;
  insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values(p_bought_player_id,p_matchday_id,'marketfoot_value',v_bought.marketfoot_value,v_bought.marketfoot_value+20000,'direct_purchase'),(p_bought_player_id,p_matchday_id,'real_value',v_bought.real_value,v_bought.real_value+10000,'direct_purchase');
  if not v_member.is_initial then
    update public.players set marketfoot_value=greatest(500000,marketfoot_value-20000),real_value=greatest(0,real_value-10000) where id=p_sold_player_id;
    insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values(p_sold_player_id,p_matchday_id,'marketfoot_value',v_sold.marketfoot_value,greatest(500000,v_sold.marketfoot_value-20000),'direct_sale'),(p_sold_player_id,p_matchday_id,'real_value',v_sold.real_value,greatest(0,v_sold.real_value-10000),'direct_sale');
  end if;
  insert into public.financial_ledger(gamer_id,matchday_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values(p_gamer_id,p_matchday_id,'direct_transfer',v_next-v_budget,0,'direct:'||v_id,jsonb_build_object('transferId',v_id));
  return v_id;
end; $$;

create function public.submit_mercado_order(p_gamer uuid,p_day uuid,p_sold uuid,p_bought uuid,p_sold_value numeric,p_bought_value numeric,p_tax numeric,p_commission numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_squad uuid; v_budget numeric; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_day::text,42));
  select id into v_squad from public.squads where gamer_id=p_gamer for update;
  perform public.assert_transfer_allowed(v_squad,p_day,p_sold,p_bought,'mercado');
  perform 1 from public.players where id in(p_sold,p_bought) order by id for share;
  if p_tax<0 or p_commission<0 or not exists(select 1 from public.players where id=p_sold and marketfoot_value=p_sold_value) or not exists(select 1 from public.players where id=p_bought and marketfoot_value=p_bought_value) then raise exception 'STALE_ORDER'; end if;
  select budget into v_budget from public.gamer_finances where gamer_id=p_gamer for update;
  select v_budget+coalesce(sum(submitted_sold_value-submitted_bought_value-submitted_tax-fixed_commission),0) into v_budget from public.mercado_orders where squad_id=v_squad and matchday_id=p_day and status='pending';
  if v_budget+p_sold_value-p_bought_value-p_tax-p_commission<0 then raise exception 'MERCADO_BUDGET'; end if;
  insert into public.mercado_orders(squad_id,matchday_id,sold_player_id,bought_player_id,submitted_sold_value,submitted_bought_value,submitted_tax,fixed_commission) values(v_squad,p_day,p_sold,p_bought,p_sold_value,p_bought_value,p_tax,p_commission) returning id into v_id;
  return v_id;
end; $$;
create function public.cancel_mercado_order(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_squad uuid; v_day uuid;
begin
  select matchday_id into v_day from public.mercado_orders where id=p_order;
  perform pg_advisory_xact_lock(hashtextextended(v_day::text,42));
  select id into v_squad from public.squads where gamer_id=auth.uid() for update;
  update public.mercado_orders o set status='cancelled',updated_at=now() where o.id=p_order and o.squad_id=v_squad and o.status='pending' and exists(select 1 from public.matchdays m where m.id=o.matchday_id and m.status='mercado');
  if not found then raise exception 'ORDER_NOT_CANCELLABLE'; end if;
end; $$;
revoke all on function public.submit_mercado_order(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric),public.cancel_mercado_order(uuid) from public;
grant execute on function public.submit_mercado_order(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric),public.complete_direct_transfer(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric) to service_role;
grant execute on function public.cancel_mercado_order(uuid) to authenticated;
