create function public.read_rankings(p_season uuid,p_metric text default 'general',p_period text default 'all',p_day integer default 34,p_search text default '',p_page integer default 1)
returns table(gamer_id uuid,username text,rank bigint,total_wealth numeric,squad_value numeric,budget numeric,locked_account numeric,earnings numeric,latest_earnings numeric,speculation numeric,transfer_count bigint,bench_value numeric,bench_earnings numeric,total_count bigint)
language sql stable security definer set search_path='' as $$
with days as (
 select id,number from public.matchdays where season_id=p_season and number<=case when p_period='first' then 17 else p_day end
), latest as (
 select s.id from public.matchday_settlements s join days d on d.id=s.matchday_id where s.status='completed' order by d.number desc,s.completed_at desc limit 1
), base as (
 select r.*,p.username from public.ranking_snapshots r join public.profiles p on p.id=r.gamer_id where r.settlement_id=(select id from latest) and auth.uid() is not null
), effects as (
 select e.gamer_id,
 sum(e.gamer_effect) filter(where sn.is_starter) earnings,
 sum(e.gamer_effect) filter(where sn.is_starter and s.id=(select id from latest)) latest_earnings,
 sum(e.gamer_effect) filter(where not sn.is_starter) bench_earnings
 from public.settlement_player_effects e join public.matchday_squad_snapshots sn on sn.id=e.snapshot_id join public.matchday_settlements s on s.id=e.settlement_id join days d on d.id=s.matchday_id
 where e.reversed_at is null and s.status='completed' and (p_period<>'second' or d.number>=18) and (p_period<>'day' or d.number=p_day) group by e.gamer_id
), sales as (
 select sq.gamer_id,t.sold_value-t.bought_value amount from public.direct_transfers t join public.squads sq on sq.id=t.squad_id join days d on d.id=t.matchday_id where t.status='completed' and (p_period<>'second' or d.number>=18) and (p_period<>'day' or d.number=p_day)
 union all select l.gamer_id,(l.metadata->>'soldValue')::numeric-(l.metadata->>'boughtValue')::numeric from public.financial_ledger l join days d on d.id=l.matchday_id where l.event_type='mercado_execution' and l.metadata?'soldValue' and (p_period<>'second' or d.number>=18) and (p_period<>'day' or d.number=p_day)
), report as (
 select b.gamer_id,b.username,b.total_wealth,b.squad_value,b.budget,b.locked_account,coalesce(e.earnings,0) earnings,coalesce(e.latest_earnings,0) latest_earnings,
 coalesce((select sum(amount) from sales where sales.gamer_id=b.gamer_id),0) speculation,(select count(*) from sales where sales.gamer_id=b.gamer_id) transfer_count,
 coalesce((select sum(sn.marketfoot_value) from public.matchday_squad_snapshots sn where sn.matchday_id=b.matchday_id and sn.gamer_id=b.gamer_id and not sn.is_starter),0) bench_value,coalesce(e.bench_earnings,0) bench_earnings
 from base b left join effects e on e.gamer_id=b.gamer_id
), ranked as (
 select *,row_number() over(order by case p_metric when 'gains' then earnings when 'squad' then squad_value when 'speculation' then speculation when 'bench' then bench_earnings else total_wealth end desc,gamer_id) rank from report
)
select gamer_id,username,rank,total_wealth,squad_value,budget,locked_account,earnings,latest_earnings,speculation,transfer_count,bench_value,bench_earnings,count(*) over() total_count from ranked where username ilike '%'||left(p_search,80)||'%' order by rank limit 20 offset (greatest(1,least(p_page,100000))-1)*20;
$$;
revoke all on function public.read_rankings(uuid,text,text,integer,text,integer) from public;
grant execute on function public.read_rankings(uuid,text,text,integer,text,integer) to authenticated;
