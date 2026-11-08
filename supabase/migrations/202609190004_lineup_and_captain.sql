create table public.captain_assignments (
  squad_id uuid not null references public.squads(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  player_id uuid not null references public.players(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (squad_id, matchday_id)
);

alter table public.captain_assignments enable row level security;
create policy "Gamers can read captain assignments" on public.captain_assignments for select to authenticated using (true);

create or replace function public.update_squad_lineup(
  p_gamer_id uuid,
  p_starter_ids uuid[],
  p_captain_id uuid,
  p_matchday_id uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_squad_id uuid; v_season_id uuid;
begin
  select id into v_squad_id from public.squads where gamer_id = p_gamer_id;
  if v_squad_id is null then raise exception 'SQUAD_NOT_FOUND'; end if;
  if cardinality(p_starter_ids) <> 11 then raise exception 'STARTERS_MUST_EQUAL_11'; end if;
  if not p_captain_id = any(p_starter_ids) then raise exception 'CAPTAIN_MUST_START'; end if;
  if (select count(*) from public.squad_members where squad_id = v_squad_id and player_id = any(p_starter_ids)) <> 11 then raise exception 'INVALID_SQUAD_MEMBER'; end if;
  select season_id into v_season_id from public.matchdays where id = p_matchday_id;
  if (select count(*) from public.captain_assignments join public.matchdays on matchdays.id = captain_assignments.matchday_id where captain_assignments.squad_id = v_squad_id and captain_assignments.player_id = p_captain_id and matchdays.season_id = v_season_id) >= 6 then raise exception 'CAPTAIN_LIMIT_REACHED'; end if;
  update public.squad_members set is_starter = false, is_captain = false where squad_id = v_squad_id;
  update public.squad_members set is_starter = true where squad_id = v_squad_id and player_id = any(p_starter_ids);
  update public.squad_members set is_captain = true where squad_id = v_squad_id and player_id = p_captain_id;
  insert into public.captain_assignments (squad_id, matchday_id, player_id) values (v_squad_id, p_matchday_id, p_captain_id)
  on conflict (squad_id, matchday_id) do update set player_id = excluded.player_id, created_at = timezone('utc', now());
end;
$$;

revoke all on function public.update_squad_lineup(uuid, uuid[], uuid, uuid) from public;
