-- Forward-only corrections. Existing balances require an audited reconciliation;
-- do not silently rewrite historical gamer finances when deploying this migration.
alter table public.squads add column if not exists activation_matchday_id uuid references public.matchdays(id);

create or replace function public.create_initial_squad(p_gamer_id uuid, p_name text, p_members jsonb, p_budget numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_squad uuid; v_cost numeric; v_active uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_gamer_id::text, 0));
  if exists(select 1 from public.squads where gamer_id=p_gamer_id) then raise exception 'SQUAD_ALREADY_EXISTS'; end if;
  if jsonb_array_length(p_members) <> 19 then raise exception 'INVALID_SQUAD_SIZE'; end if;
  perform 1 from public.players where id in (select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x) for share;
  if (select count(*) from public.players where is_active and id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x)) <> 19 then raise exception 'INVALID_PLAYERS'; end if;
  if exists(select 1 from public.players where id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x) group by club_id having count(*)>4) then raise exception 'CLUB_LIMIT'; end if;
  if exists(select 1 from (values ('GK',3),('DF',6),('MF',5),('FW',5)) expected(pos,n) where (select count(*) from public.players p where p.position::text=expected.pos and p.id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x))<>expected.n) then raise exception 'INVALID_POSITIONS'; end if;
  select sum(marketfoot_value) into v_cost from public.players where id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x);
  if v_cost>p_budget then raise exception 'INSUFFICIENT_BUDGET'; end if;
  select m.id into v_active from public.matchdays m join public.seasons s on s.id=m.season_id where s.is_current and m.status='open' and not exists(select 1 from public.matches f where f.matchday_id=m.id and f.kickoff_at-interval '2 hours'<=now()) order by m.number limit 1;
  insert into public.squads(gamer_id,name,activation_matchday_id) values(p_gamer_id,p_name,v_active) returning id into v_squad;
  insert into public.squad_members(squad_id,player_id,acquired_value) select v_squad,id,marketfoot_value from public.players where id in(select (x->>'playerId')::uuid from jsonb_array_elements(p_members) x);
  insert into public.gamer_finances(gamer_id,budget,blocked_account) values(p_gamer_id,p_budget-v_cost,0);
  insert into public.financial_ledger(gamer_id,event_type,budget_delta,locked_account_delta,idempotency_key,metadata) values(p_gamer_id,'initial_allocation',p_budget,0,'initial-allocation:'||v_squad,jsonb_build_object('squadId',v_squad)),(p_gamer_id,'initial_squad',-v_cost,0,'initial-squad:'||v_squad,jsonb_build_object('squadId',v_squad));
  return v_squad;
end; $$;

create or replace function public.update_squad_lineup(p_gamer_id uuid,p_starter_ids uuid[],p_captain_id uuid,p_matchday_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_squad uuid; v_season uuid;
begin
  select id into v_squad from public.squads where gamer_id=p_gamer_id for update;
  if v_squad is null then raise exception 'SQUAD_NOT_FOUND'; end if;
  select season_id into v_season from public.matchdays where id=p_matchday_id and status in('open','mercado') for share;
  if v_season is null then raise exception 'MATCHDAY_NOT_OPEN'; end if;
  if cardinality(p_starter_ids)<>11 or not p_captain_id=any(p_starter_ids) then raise exception 'INVALID_LINEUP'; end if;
  if (select count(*) from public.squad_members where squad_id=v_squad and player_id=any(p_starter_ids))<>11 then raise exception 'INVALID_MEMBERS'; end if;
  if exists(select 1 from (values('GK',1),('DF',4),('MF',3),('FW',3)) expected(pos,n) where (select count(*) from public.players p where p.id=any(p_starter_ids) and p.position::text=expected.pos)<>expected.n) then raise exception 'FORMATION_REQUIRED'; end if;
  if exists(select 1 from public.squad_members sm join public.players p on p.id=sm.player_id join public.matches m on p.club_id in(m.home_club_id,m.away_club_id) where sm.squad_id=v_squad and m.matchday_id=p_matchday_id and m.kickoff_at-interval '2 hours'<=now() and (sm.is_starter is distinct from (sm.player_id=any(p_starter_ids)) or sm.is_captain is distinct from (sm.player_id=p_captain_id))) then raise exception 'TEAM_FROZEN'; end if;
  if (select count(*) from public.captain_assignments a join public.matchdays m on m.id=a.matchday_id where a.squad_id=v_squad and a.player_id=p_captain_id and m.season_id=v_season and m.id<>p_matchday_id)>=6 then raise exception 'CAPTAIN_LIMIT'; end if;
  update public.squad_members set is_starter=player_id=any(p_starter_ids),is_captain=player_id=p_captain_id where squad_id=v_squad;
  insert into public.captain_assignments(squad_id,matchday_id,player_id) values(v_squad,p_matchday_id,p_captain_id) on conflict(squad_id,matchday_id) do update set player_id=excluded.player_id;
end; $$;

create table public.predictions(
  gamer_id uuid not null references public.profiles(id),
  match_id uuid not null references public.matches(id),
  choice text not null check(choice in('1','N','2')),
  updated_at timestamptz not null default now(),
  primary key(gamer_id,match_id)
);
alter table public.predictions enable row level security;
create policy "Read own predictions" on public.predictions for select to authenticated using(gamer_id=auth.uid() or public.is_admin());
create or replace function public.save_prediction(p_match_id uuid,p_choice text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_choice not in('1','N','2') then raise exception 'INVALID_CHOICE'; end if;
  select * into v_match from public.matches where id=p_match_id for share;
  if v_match.id is null or v_match.is_postponed or v_match.kickoff_at<=clock_timestamp() or v_match.home_score is not null or v_match.away_score is not null then raise exception 'PREDICTION_CLOSED'; end if;
  insert into public.predictions(gamer_id,match_id,choice) values(auth.uid(),p_match_id,p_choice) on conflict(gamer_id,match_id) do update set choice=excluded.choice,updated_at=now();
end; $$;
revoke all on function public.save_prediction(uuid,text) from public;
grant execute on function public.save_prediction(uuid,text) to authenticated;
revoke all on function public.create_initial_squad(uuid,text,jsonb,numeric) from public;
revoke all on function public.update_squad_lineup(uuid,uuid[],uuid,uuid) from public;
grant execute on function public.create_initial_squad(uuid,text,jsonb,numeric),public.update_squad_lineup(uuid,uuid[],uuid,uuid) to service_role;
