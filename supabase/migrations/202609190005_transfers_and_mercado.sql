create type public.transfer_status as enum ('completed', 'cancelled');
create type public.mercado_order_status as enum ('pending', 'cancelled', 'executed', 'rejected');

create table public.direct_transfers (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id),
  matchday_id uuid not null references public.matchdays(id),
  sold_player_id uuid not null references public.players(id),
  bought_player_id uuid not null references public.players(id),
  sold_value numeric(14,2) not null check (sold_value >= 0),
  bought_value numeric(14,2) not null check (bought_value >= 0),
  tax numeric(14,2) not null check (tax >= 0),
  status public.transfer_status not null default 'completed',
  created_at timestamptz not null default timezone('utc', now()),
  check (sold_player_id <> bought_player_id)
);

create table public.mercado_orders (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id),
  matchday_id uuid not null references public.matchdays(id),
  sold_player_id uuid not null references public.players(id),
  bought_player_id uuid not null references public.players(id),
  submitted_sold_value numeric(14,2) not null check (submitted_sold_value >= 0),
  submitted_bought_value numeric(14,2) not null check (submitted_bought_value >= 0),
  submitted_tax numeric(14,2) not null check (submitted_tax >= 0),
  fixed_commission numeric(14,2) not null check (fixed_commission >= 0),
  status public.mercado_order_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (sold_player_id <> bought_player_id)
);

alter table public.direct_transfers enable row level security;
alter table public.mercado_orders enable row level security;
create policy "Gamers can read direct transfers" on public.direct_transfers for select to authenticated using (true);
create policy "Gamers can read Mercado orders" on public.mercado_orders for select to authenticated using (true);

create or replace function public.complete_direct_transfer(
  p_gamer_id uuid, p_matchday_id uuid, p_sold_player_id uuid, p_bought_player_id uuid,
  p_sold_value numeric, p_bought_value numeric, p_tax numeric, p_resulting_budget numeric
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_squad_id uuid; v_transfer_id uuid;
begin
  select id into v_squad_id from public.squads where gamer_id = p_gamer_id;
  if v_squad_id is null then raise exception 'SQUAD_NOT_FOUND'; end if;
  if not exists (select 1 from public.squad_members where squad_id = v_squad_id and player_id = p_sold_player_id) then raise exception 'SOLD_PLAYER_NOT_OWNED'; end if;
  if exists (select 1 from public.squad_members where squad_id = v_squad_id and player_id = p_bought_player_id) then raise exception 'BOUGHT_PLAYER_ALREADY_OWNED'; end if;
  if (select count(*) from public.direct_transfers where squad_id = v_squad_id and matchday_id = p_matchday_id and status = 'completed') >= 4 then raise exception 'TRANSFER_QUOTA_REACHED'; end if;
  delete from public.squad_members where squad_id = v_squad_id and player_id = p_sold_player_id;
  insert into public.squad_members (squad_id, player_id, acquired_value) values (v_squad_id, p_bought_player_id, p_bought_value);
  update public.gamer_finances set budget = p_resulting_budget, updated_at = timezone('utc', now()) where gamer_id = p_gamer_id;
  insert into public.direct_transfers (squad_id, matchday_id, sold_player_id, bought_player_id, sold_value, bought_value, tax)
  values (v_squad_id, p_matchday_id, p_sold_player_id, p_bought_player_id, p_sold_value, p_bought_value, p_tax) returning id into v_transfer_id;
  return v_transfer_id;
end;
$$;

revoke all on function public.complete_direct_transfer(uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric) from public;
