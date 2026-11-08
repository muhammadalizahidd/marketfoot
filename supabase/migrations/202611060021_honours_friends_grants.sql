-- Follow-up to 202611060020: table privileges for the new tables, and an award function that no longer
-- requires the prediction tables (migration 202610010019) to exist yet.

grant select, insert, update, delete on public.gamer_honours to service_role;
grant select on public.gamer_honours to authenticated;
grant select, insert, update, delete on public.friendships to service_role;
grant select, insert, delete on public.friendships to authenticated;

create or replace function public.award_season_honours(p_season uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0; v_last uuid; v_half uuid;
begin
  select s.id into v_last from public.matchday_settlements s join public.matchdays d on d.id = s.matchday_id where d.season_id = p_season and s.status = 'completed' order by d.number desc, s.completed_at desc limit 1;
  select s.id into v_half from public.matchday_settlements s join public.matchdays d on d.id = s.matchday_id where d.season_id = p_season and d.number <= 17 and s.status = 'completed' order by d.number desc, s.completed_at desc limit 1;
  if v_last is null then return 0; end if;

  insert into public.gamer_honours (gamer_id, season_id, category, rank, points)
  select r.gamer_id, p_season, 'overall', r.general_rank, public.honours_points('overall', r.general_rank) from public.ranking_snapshots r where r.settlement_id = v_last and public.honours_points('overall', r.general_rank) > 0
  on conflict do nothing;
  get diagnostics v_count = row_count;

  insert into public.gamer_honours (gamer_id, season_id, category, rank, points)
  select r.gamer_id, p_season, 'primes', r.earnings_rank, public.honours_points('primes', r.earnings_rank) from public.ranking_snapshots r where r.settlement_id = v_last and public.honours_points('primes', r.earnings_rank) > 0
  on conflict do nothing;

  if v_half is not null then
    insert into public.gamer_honours (gamer_id, season_id, category, rank, points)
    select r.gamer_id, p_season, 'first_half', r.general_rank, public.honours_points('first_half', r.general_rank) from public.ranking_snapshots r where r.settlement_id = v_half and public.honours_points('first_half', r.general_rank) > 0
    on conflict do nothing;
  end if;

  insert into public.gamer_honours (gamer_id, season_id, category, rank, points, matchday_id)
  select x.gamer_id, p_season, 'matchday_primes', x.rk, public.honours_points('matchday_primes', x.rk), x.matchday_id
  from (select e.gamer_id, s.matchday_id, rank() over (partition by s.matchday_id order by e.gross_effect desc)::integer rk
        from public.settlement_gamer_effects e join public.matchday_settlements s on s.id = e.settlement_id join public.matchdays d on d.id = s.matchday_id
        where d.season_id = p_season and s.status = 'completed' and e.reversed_at is null) x
  where public.honours_points('matchday_primes', x.rk) > 0
  on conflict do nothing;

  -- Prediction honours exist only once the prediction settlement tables are deployed.
  if to_regclass('public.prediction_results') is not null then
    execute $q$
      insert into public.gamer_honours (gamer_id, season_id, category, rank, points)
      select y.gamer_id, $1, 'predictions', y.rk, public.honours_points('predictions', y.rk)
      from (select pr.gamer_id, rank() over (order by sum(pr.earnings) desc)::integer rk
            from public.prediction_results pr join public.matchdays d on d.id = pr.matchday_id where d.season_id = $1 group by pr.gamer_id) y
      where public.honours_points('predictions', y.rk) > 0
      on conflict do nothing$q$ using p_season;
    execute $q$
      insert into public.gamer_honours (gamer_id, season_id, category, rank, points, matchday_id)
      select z.gamer_id, $1, 'matchday_predictions', 1, 5, z.matchday_id
      from (select pr.gamer_id, pr.matchday_id, rank() over (partition by pr.matchday_id order by pr.earnings desc) rk from public.prediction_results pr join public.matchdays d on d.id = pr.matchday_id where d.season_id = $1) z
      where z.rk = 1
      on conflict do nothing$q$ using p_season;
  end if;
  return v_count;
end $$;
revoke all on function public.award_season_honours(uuid) from public;
grant execute on function public.award_season_honours(uuid) to service_role;
