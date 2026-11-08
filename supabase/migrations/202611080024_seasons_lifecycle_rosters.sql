-- Admin → Saison: season lifecycle (draft → pending validation → active → finished) and per-season rosters (decision D1).
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'season_status') then
    create type public.season_status as enum ('draft', 'pending_validation', 'active', 'finished');
  end if;
end $$;

alter table public.seasons add column if not exists status public.season_status not null default 'draft';
update public.seasons set status = case when is_current then 'active'::public.season_status when ends_on < current_date then 'finished'::public.season_status else 'draft'::public.season_status end;

create table if not exists public.season_clubs (
  season_id uuid not null references public.seasons(id) on delete cascade,
  club_id uuid not null references public.clubs(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (season_id, club_id)
);
create table if not exists public.season_players (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id),
  club_id uuid not null references public.clubs(id),
  start_value numeric(14,2) not null check (start_value >= 0),
  end_value numeric(14,2) check (end_value is null or end_value >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (season_id, player_id)
);
create index if not exists season_players_club on public.season_players (season_id, club_id);
alter table public.season_clubs enable row level security;
alter table public.season_players enable row level security;
drop policy if exists "Admins read season clubs" on public.season_clubs;
drop policy if exists "Admins read season players" on public.season_players;
create policy "Admins read season clubs" on public.season_clubs for select to authenticated using (public.is_admin());
create policy "Admins read season players" on public.season_players for select to authenticated using (public.is_admin());

-- Existing live data becomes the roster of the current season.
insert into public.season_clubs (season_id, club_id) select s.id, c.id from public.seasons s cross join public.clubs c where s.is_current on conflict do nothing;
insert into public.season_players (season_id, player_id, club_id, start_value)
  select s.id, p.id, p.club_id, p.marketfoot_value from public.seasons s cross join public.players p where s.is_current and p.is_active on conflict do nothing;

insert into storage.buckets (id, name, public) values ('crests', 'crests', true) on conflict (id) do nothing;

create or replace function public.admin_season_stats()
returns table (season_id uuid, teams integer, users integer) language sql stable security definer set search_path = '' as $$
  select s.id,
         (select count(*)::integer from public.season_clubs c where c.season_id = s.id),
         case when s.status = 'active' then (select count(*)::integer from public.squads)
              else (select count(distinct sn.gamer_id)::integer from public.matchday_squad_snapshots sn join public.matchdays d on d.id = sn.matchday_id where d.season_id = s.id) end
  from public.seasons s;
$$;

-- "Valider": the season becomes the active one and its roster is applied to the live catalogue.
create or replace function public.admin_activate_season(p_actor uuid, p_season uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_status public.season_status; v_clubs integer; v_roster integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(713201);
  select to_jsonb(s), s.status into v_before, v_status from public.seasons s where s.id = p_season for update;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'pending_validation' then raise exception 'INVALID_SEASON_STATE'; end if;
  if exists (select 1 from public.seasons where status = 'active' and id <> p_season) then raise exception 'OTHER_ACTIVE_SEASON'; end if;
  select count(*) into v_clubs from public.season_clubs where season_id = p_season;
  if v_clubs < 2 then raise exception 'SEASON_NEEDS_TEAMS'; end if;
  select count(*) into v_roster from public.season_players where season_id = p_season;
  if v_roster > 0 then
    update public.players p set club_id = sp.club_id, marketfoot_value = greatest(500000, sp.start_value), is_active = true, updated_at = now()
      from public.season_players sp where sp.season_id = p_season and sp.player_id = p.id;
    update public.players p set is_active = false, updated_at = now()
      where p.is_active and not exists (select 1 from public.season_players sp where sp.season_id = p_season and sp.player_id = p.id);
  end if;
  update public.seasons set status = 'active', is_current = true where id = p_season;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state)
    values (p_actor, 'season.activate', 'season', p_season, v_before, jsonb_build_object('clubs', v_clubs, 'rosterPlayers', v_roster));
end; $$;

-- "Terminer la saison": end values are recorded, honours are awarded, the season is closed.
create or replace function public.admin_finish_season(p_actor uuid, p_season uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_status public.season_status; v_honours integer := 0;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(713201);
  select to_jsonb(s), s.status into v_before, v_status from public.seasons s where s.id = p_season for update;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'active' then raise exception 'INVALID_SEASON_STATE'; end if;
  update public.season_players sp set end_value = p.marketfoot_value from public.players p where sp.season_id = p_season and sp.player_id = p.id;
  select public.award_season_honours(p_season) into v_honours;
  update public.seasons set status = 'finished', is_current = false where id = p_season;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state)
    values (p_actor, 'season.finish', 'season', p_season, v_before, jsonb_build_object('honoursAwarded', v_honours));
  return v_honours;
end; $$;

revoke all on function public.admin_season_stats(), public.admin_activate_season(uuid, uuid), public.admin_finish_season(uuid, uuid) from public;
grant execute on function public.admin_season_stats(), public.admin_activate_season(uuid, uuid), public.admin_finish_season(uuid, uuid) to service_role;
