-- The ranking screen is public to authenticated gamers. Keep raw settlement effects
-- private while exposing only the aggregate needed to order the Gains leaderboard.
create or replace view public.ranking_leaderboard
with (security_barrier = true, security_invoker = false) as
select
  rs.settlement_id,
  rs.gamer_id,
  rs.general_rank,
  rs.total_wealth,
  rs.squad_value,
  rs.budget,
  rs.locked_account,
  rs.created_at,
  coalesce((
    select sum(sge.gross_effect)
    from public.settlement_gamer_effects sge
    where sge.gamer_id = rs.gamer_id
      and sge.reversed_at is null
  ), 0)::numeric(14,2) as cumulative_earnings
from public.ranking_snapshots rs;

grant select on public.ranking_leaderboard to authenticated;
