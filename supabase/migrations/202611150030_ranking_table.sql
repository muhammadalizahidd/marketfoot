-- Classements (PRD v1.3 §15.1 / §20.5): one ranking read for the six gamer rankings
-- (Général, Primes, Pronostics, Spéculation, Banc de touche, Palmarès) with the fields each ranking requires,
-- the rank evolution, column sorting, friends filter and page size. Additive: read_rankings / read_prediction_rankings stay.

create or replace function public.ranking_core(p_season uuid, p_metric text, p_period text, p_day integer)
returns table(
  gamer_id uuid, username text, avatar_url text, club_name text, rank bigint,
  total_wealth numeric, squad_value numeric, budget numeric, locked_account numeric,
  primes numeric, latest_primes numeric, speculation numeric, transfer_count bigint,
  bench_primes numeric, latest_bench numeric, predictions numeric, latest_predictions numeric,
  honours_points numeric, best_rank integer, top10 bigint, top20 bigint, top30 bigint
)
language sql stable security definer set search_path = '' as $$
with days as (
  select id, number from public.matchdays where season_id = p_season and number <= case when p_period = 'first' then 17 else p_day end
), latest as (
  select s.id from public.matchday_settlements s join days d on d.id = s.matchday_id
  where s.status = 'completed' order by d.number desc, s.completed_at desc limit 1
), base as (
  select r.gamer_id, r.total_wealth, r.squad_value, r.budget, r.locked_account
  from public.ranking_snapshots r where r.settlement_id = (select id from latest)
), effects as (
  select e.gamer_id,
    sum(e.gamer_effect) filter (where sn.is_starter) primes,
    sum(e.gamer_effect) filter (where sn.is_starter and s.id = (select id from latest)) latest_primes,
    sum(e.gamer_effect) filter (where not sn.is_starter) bench,
    sum(e.gamer_effect) filter (where not sn.is_starter and s.id = (select id from latest)) latest_bench
  from public.settlement_player_effects e
  join public.matchday_squad_snapshots sn on sn.id = e.snapshot_id
  join public.matchday_settlements s on s.id = e.settlement_id
  join days d on d.id = s.matchday_id
  where e.reversed_at is null and s.status = 'completed' and (p_period <> 'second' or d.number >= 18) and (p_period <> 'day' or d.number = p_day)
  group by e.gamer_id
), sales as (
  select sq.gamer_id, t.sold_value - t.bought_value amount
  from public.direct_transfers t join public.squads sq on sq.id = t.squad_id join days d on d.id = t.matchday_id
  where t.status = 'completed' and (p_period <> 'second' or d.number >= 18) and (p_period <> 'day' or d.number = p_day)
  union all
  select l.gamer_id, (l.metadata->>'soldValue')::numeric - (l.metadata->>'boughtValue')::numeric
  from public.financial_ledger l join days d on d.id = l.matchday_id
  where l.event_type = 'mercado_execution' and l.metadata ? 'soldValue' and (p_period <> 'second' or d.number >= 18) and (p_period <> 'day' or d.number = p_day)
), sales_sum as (
  select gamer_id, sum(amount) amount, count(*) n from sales group by gamer_id
), preds as (
  select r.gamer_id, sum(r.earnings) total, sum(r.earnings) filter (where r.settlement_id = (select id from latest)) latest
  from public.prediction_results r join public.matchday_settlements s on s.id = r.settlement_id join days d on d.id = s.matchday_id
  where r.reversed_at is null and s.status = 'completed' and (p_period <> 'second' or d.number >= 18) and (p_period <> 'day' or d.number = p_day)
  group by r.gamer_id
), hon as (
  select h.gamer_id, sum(h.points) pts,
    min(h.rank) filter (where h.category = 'overall') best,
    count(*) filter (where h.category = 'overall' and h.rank <= 10) t10,
    count(*) filter (where h.category = 'overall' and h.rank <= 20) t20,
    count(*) filter (where h.category = 'overall' and h.rank <= 30) t30
  from public.gamer_honours h group by h.gamer_id
), report as (
  select p.id gamer_id, p.username, p.avatar_url, c.name club_name,
    coalesce(b.total_wealth, 0) total_wealth, coalesce(b.squad_value, 0) squad_value, coalesce(b.budget, 0) budget, coalesce(b.locked_account, 0) locked_account,
    coalesce(e.primes, 0) primes, coalesce(e.latest_primes, 0) latest_primes,
    coalesce(ss.amount, 0) speculation, coalesce(ss.n, 0) transfer_count,
    coalesce(e.bench, 0) bench_primes, coalesce(e.latest_bench, 0) latest_bench,
    coalesce(pr.total, 0) predictions, coalesce(pr.latest, 0) latest_predictions,
    coalesce(h.pts, 0) honours_points, h.best::integer best_rank, coalesce(h.t10, 0) top10, coalesce(h.t20, 0) top20, coalesce(h.t30, 0) top30,
    case p_metric
      when 'primes' then coalesce(e.primes, 0)
      when 'predictions' then coalesce(pr.total, 0)
      when 'speculation' then coalesce(ss.amount, 0)
      when 'bench' then coalesce(e.bench, 0)
      when 'honours' then coalesce(h.pts, 0)
      else coalesce(b.total_wealth, 0)
    end score
  from public.profiles p
  left join public.clubs c on c.id = p.favorite_club_id
  left join base b on b.gamer_id = p.id
  left join effects e on e.gamer_id = p.id
  left join sales_sum ss on ss.gamer_id = p.id
  left join preds pr on pr.gamer_id = p.id
  left join hon h on h.gamer_id = p.id
  where auth.uid() is not null and p.banned_at is null
    and (case when p_metric = 'honours' then h.gamer_id is not null else b.gamer_id is not null end)
)
select gamer_id, username, avatar_url, club_name,
  row_number() over (order by score desc, gamer_id) rank,
  total_wealth, squad_value, budget, locked_account, primes, latest_primes, speculation, transfer_count,
  bench_primes, latest_bench, predictions, latest_predictions, honours_points, best_rank, top10, top20, top30
from report;
$$;
revoke all on function public.ranking_core(uuid, text, text, integer) from public;

create or replace function public.read_ranking_table(
  p_season uuid, p_metric text default 'general', p_period text default 'all', p_day integer default 34,
  p_search text default '', p_page integer default 1, p_page_size integer default 10,
  p_sort text default 'rank', p_dir text default 'asc', p_friends_only boolean default false
)
returns table(
  gamer_id uuid, username text, avatar_url text, club_name text, rank bigint, prev_rank bigint,
  total_wealth numeric, squad_value numeric, budget numeric, locked_account numeric,
  primes numeric, latest_primes numeric, speculation numeric, transfer_count bigint,
  bench_primes numeric, latest_bench numeric, predictions numeric, latest_predictions numeric,
  honours_points numeric, best_rank integer, top10 bigint, top20 bigint, top30 bigint, total_count bigint
)
language sql stable security definer set search_path = '' as $$
with now_rows as (
  select * from public.ranking_core(p_season, p_metric, p_period, p_day)
), before_rows as (
  select * from public.ranking_core(p_season, p_metric, p_period, p_day - 1) where p_metric <> 'honours'
), picked as (
  select n.*, b.rank prev_rank
  from now_rows n left join before_rows b on b.gamer_id = n.gamer_id
  where n.username ilike '%' || left(p_search, 80) || '%'
    and (not p_friends_only or n.gamer_id = auth.uid()
         or exists (select 1 from public.friendships f where f.follower_id = auth.uid() and f.followed_id = n.gamer_id))
)
select gamer_id, username, avatar_url, club_name, rank, prev_rank,
  total_wealth, squad_value, budget, locked_account, primes, latest_primes, speculation, transfer_count,
  bench_primes, latest_bench, predictions, latest_predictions, honours_points, best_rank, top10, top20, top30,
  count(*) over () total_count
from picked
order by
  case when p_sort = 'username' and p_dir <> 'desc' then lower(username) end asc,
  case when p_sort = 'username' and p_dir = 'desc' then lower(username) end desc,
  case when p_sort = 'club' and p_dir <> 'desc' then lower(coalesce(club_name, '')) end asc,
  case when p_sort = 'club' and p_dir = 'desc' then lower(coalesce(club_name, '')) end desc,
  (case p_sort
     when 'squad_value' then squad_value when 'budget' then budget when 'total_wealth' then total_wealth
     when 'primes' then primes when 'latest_primes' then latest_primes
     when 'speculation' then speculation when 'transfer_count' then transfer_count::numeric
     when 'bench_primes' then bench_primes when 'latest_bench' then latest_bench
     when 'predictions' then predictions when 'latest_predictions' then latest_predictions
     when 'honours_points' then honours_points when 'best_rank' then coalesce(best_rank, 1000000)::numeric
     when 'top10' then top10::numeric when 'top20' then top20::numeric when 'top30' then top30::numeric
     else rank::numeric end)
  * (case when p_dir = 'desc' then -1 else 1 end) asc,
  rank asc
limit greatest(1, least(p_page_size, 50))
offset (greatest(1, least(p_page, 100000)) - 1) * greatest(1, least(p_page_size, 50));
$$;
revoke all on function public.read_ranking_table(uuid, text, text, integer, text, integer, integer, text, text, boolean) from public;
grant execute on function public.read_ranking_table(uuid, text, text, integer, text, integer, integer, text, text, boolean) to authenticated;
