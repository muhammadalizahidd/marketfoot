create view public.player_catalogue with(security_invoker=true) as
select p.id,p.first_name,p.last_name,p.position,p.club_id,p.marketfoot_value,p.real_value,p.is_active,
  c.name club,c.short_name,
  coalesce((select h.previous_value from public.player_value_history h where h.player_id=p.id and h.value_kind='marketfoot_value' order by h.created_at,h.id limit 1),p.marketfoot_value) initial_value,
  (select count(*) from public.squad_members sm where sm.player_id=p.id) holders,
  coalesce((select sum(h.next_value-h.previous_value) from public.player_value_history h where h.player_id=p.id and h.value_kind='real_value' and h.reason in('matchday_settlement','settlement_reversal')),0) earnings,
  coalesce(st.goals,0) goals,coalesce(st.assists,0) assists,coalesce(st.penalties,0) penalties,coalesce(st.yellow,0) yellow,coalesce(st.red,0) red,coalesce(st.saves,0) saves,coalesce(st.matches,0) matches,coalesce(st.starters,0) starters,coalesce(st.clean_sheets,0) clean_sheets,
  coalesce((select sum(case when o.bought_player_id=p.id then 1 else 0 end-case when o.sold_player_id=p.id then 1 else 0 end) from public.mercado_orders o where o.status='executed' and o.matchday_id=(select r.matchday_id from public.mercado_runs r where r.status='completed' order by r.executed_at desc limit 1)),0) last_net_demand
from public.players p join public.clubs c on c.id=p.club_id
left join lateral(
  select sum(s.goals) goals,sum(s.assists) assists,sum(s.penalties_scored) penalties,sum(s.yellow_cards) yellow,sum(s.red_cards) red,sum(s.saves) saves,count(*) filter(where s.minutes_played>0) matches,count(*) filter(where s.started) starters,
  count(*) filter(where s.minutes_played>0 and case when p.club_id=m.home_club_id then m.away_score=0 else m.home_score=0 end) clean_sheets
  from public.player_match_stats s join public.matches m on m.id=s.match_id join public.matchdays d on d.id=m.matchday_id join public.seasons season on season.id=d.season_id
  where s.player_id=p.id and season.is_current and not m.is_postponed and m.home_score is not null and m.away_score is not null
) st on true;
revoke all on public.player_catalogue from anon;
grant select on public.player_catalogue to authenticated;
create index if not exists stats_player_idx on public.player_match_stats(player_id);
create index if not exists history_player_kind_date_idx on public.player_value_history(player_id,value_kind,created_at);
create index if not exists members_player_idx on public.squad_members(player_id);
