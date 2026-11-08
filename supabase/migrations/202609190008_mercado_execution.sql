create type public.mercado_run_status as enum ('pending', 'running', 'completed', 'reverted');
create table public.mercado_runs (
  id uuid primary key default gen_random_uuid(), matchday_id uuid not null unique references public.matchdays(id), status public.mercado_run_status not null default 'pending',
  executed_by uuid references public.profiles(id), executed_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);
create table public.mercado_order_executions (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.mercado_runs(id), order_id uuid not null unique references public.mercado_orders(id),
  outcome public.mercado_order_status not null check (outcome in ('executed','rejected')), rejection_reason text, budget_delta numeric(14,2) not null default 0, created_at timestamptz not null default timezone('utc', now())
);
alter table public.mercado_runs enable row level security;
alter table public.mercado_order_executions enable row level security;
create policy "Users can read Mercado runs" on public.mercado_runs for select to authenticated using (true);
create policy "Users can read Mercado executions" on public.mercado_order_executions for select to authenticated using (true);

create or replace function public.prevent_closing_unexecuted_mercado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'mercado' and new.status = 'closed' and exists (select 1 from public.mercado_orders where matchday_id = new.id and status = 'pending') then raise exception 'MERCADO_ORDERS_MUST_BE_EXECUTED'; end if;
  return new;
end; $$;
create trigger matchdays_require_mercado_execution before update of status on public.matchdays for each row execute function public.prevent_closing_unexecuted_mercado();

create or replace function public.commit_mercado_run(p_actor_id uuid, p_matchday_id uuid, p_orders jsonb, p_value_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_run_id uuid; v_order jsonb; v_change jsonb; v_order_row public.mercado_orders%rowtype; v_budget numeric; v_delta numeric; v_previous numeric;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.matchdays where id = p_matchday_id and status = 'mercado') then raise exception 'MATCHDAY_NOT_MERCADO'; end if;
  insert into public.mercado_runs(matchday_id,status) values(p_matchday_id,'running') on conflict(matchday_id) do update set status = 'running' where mercado_runs.status = 'pending' returning id into v_run_id;
  if v_run_id is null then raise exception 'MERCADO_ALREADY_EXECUTED'; end if;
  for v_order in select * from jsonb_array_elements(p_orders) loop
    select * into v_order_row from public.mercado_orders where id = (v_order->>'orderId')::uuid for update;
    if v_order_row.status <> 'pending' then raise exception 'ORDER_NOT_PENDING'; end if;
    if (v_order->>'outcome') = 'executed' then
      select budget into v_budget from public.gamer_finances gf join public.squads s on s.gamer_id = gf.gamer_id where s.id = v_order_row.squad_id for update;
      v_delta := v_order_row.submitted_sold_value - v_order_row.submitted_bought_value - v_order_row.submitted_tax - v_order_row.fixed_commission;
      delete from public.squad_members where squad_id = v_order_row.squad_id and player_id = v_order_row.sold_player_id;
      if not found then raise exception 'SOLD_PLAYER_NOT_OWNED'; end if;
      insert into public.squad_members(squad_id,player_id,acquired_value) values(v_order_row.squad_id,v_order_row.bought_player_id,v_order_row.submitted_bought_value);
      update public.gamer_finances set budget = budget + v_delta, updated_at = timezone('utc', now()) where gamer_id = (select gamer_id from public.squads where id = v_order_row.squad_id);
      update public.mercado_orders set status='executed', updated_at=timezone('utc',now()) where id=v_order_row.id;
      insert into public.mercado_order_executions(run_id,order_id,outcome,budget_delta) values(v_run_id,v_order_row.id,'executed',v_delta);
      insert into public.financial_ledger(gamer_id,matchday_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) select gamer_id,p_matchday_id,'mercado_execution',v_delta,0,'mercado:'||v_run_id::text||':'||v_order_row.id::text,jsonb_build_object('orderId',v_order_row.id) from public.squads where id=v_order_row.squad_id;
    else
      update public.mercado_orders set status='rejected', updated_at=timezone('utc',now()) where id=v_order_row.id;
      insert into public.mercado_order_executions(run_id,order_id,outcome,rejection_reason) values(v_run_id,v_order_row.id,'rejected',coalesce(v_order->>'reason','Ordre non exécutable'));
    end if;
  end loop;
  for v_change in select * from jsonb_array_elements(p_value_changes) loop
    select marketfoot_value into v_previous from public.players where id=(v_change->>'playerId')::uuid for update;
    update public.players set marketfoot_value=greatest(500000,v_previous+(v_change->>'delta')::numeric),updated_at=timezone('utc',now()) where id=(v_change->>'playerId')::uuid;
    insert into public.player_value_history(player_id,matchday_id,value_kind,previous_value,next_value,reason) values((v_change->>'playerId')::uuid,p_matchday_id,'marketfoot_value',v_previous,greatest(500000,v_previous+(v_change->>'delta')::numeric),'mercado_demand');
  end loop;
  update public.mercado_runs set status='completed',executed_by=p_actor_id,executed_at=timezone('utc',now()) where id=v_run_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor_id,'mercado.commit','mercado_run',v_run_id,jsonb_build_object('orders',jsonb_array_length(p_orders)));
  return v_run_id;
end; $$;
revoke all on function public.commit_mercado_run(uuid,uuid,jsonb,jsonb) from public;
