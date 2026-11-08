-- Gamer area: profile settings (My Space), honours/trophies (Palmarès) and friends (Amis).
-- Additive only. Honours points follow Game Rules v2 §15; policies still open in PRD §24 stay provisional.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists favorite_club_id uuid references public.clubs(id) on delete set null,
  add column if not exists bio text check (bio is null or char_length(bio) <= 80),
  add column if not exists country text check (country is null or char_length(country) <= 80),
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark', 'auto')),
  add column if not exists displayed_trophy text,
  add column if not exists deletion_requested_at timestamptz;

-- Public avatar bucket (files are written by the server with the service role).
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create table if not exists public.gamer_honours (
  id uuid primary key default gen_random_uuid(),
  gamer_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id),
  category text not null check (category in ('overall', 'first_half', 'primes', 'predictions', 'matchday_primes', 'matchday_predictions')),
  rank integer not null check (rank > 0),
  points integer not null check (points >= 0),
  matchday_id uuid references public.matchdays(id),
  awarded_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists gamer_honours_unique on public.gamer_honours (gamer_id, season_id, category, coalesce(matchday_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists gamer_honours_gamer_idx on public.gamer_honours (gamer_id, season_id);
alter table public.gamer_honours enable row level security;
create policy "Honours are visible to signed-in users" on public.gamer_honours for select to authenticated using (true);

create table if not exists public.friendships (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists friendships_followed_idx on public.friendships (followed_id);
alter table public.friendships enable row level security;
-- Friend lists are private: only their owner can read or change them.
create policy "Read own friendships" on public.friendships for select to authenticated using (follower_id = auth.uid());
create policy "Add own friendships" on public.friendships for insert to authenticated with check (follower_id = auth.uid());
create policy "Remove own friendships" on public.friendships for delete to authenticated using (follower_id = auth.uid());

-- Game Rules v2 §15 honours table.
create or replace function public.honours_points(p_category text, p_rank integer)
returns integer language sql immutable as $$
  select case p_category
    when 'overall' then case when p_rank = 1 then 300 when p_rank = 2 then 250 when p_rank = 3 then 200 when p_rank <= 10 then 150 when p_rank <= 20 then 100 when p_rank <= 30 then 75 when p_rank <= 50 then 50 when p_rank <= 100 then 25 else 0 end
    when 'first_half' then case when p_rank = 1 then 15 when p_rank = 2 then 10 when p_rank = 3 then 5 else 0 end
    when 'primes' then case when p_rank = 1 then 70 when p_rank = 2 then 60 when p_rank = 3 then 50 when p_rank <= 10 then 30 when p_rank <= 20 then 25 when p_rank <= 30 then 20 when p_rank <= 50 then 10 when p_rank <= 100 then 6 else 0 end
    when 'predictions' then case when p_rank = 1 then 35 when p_rank = 2 then 30 when p_rank = 3 then 25 when p_rank <= 10 then 15 when p_rank <= 20 then 10 when p_rank <= 30 then 8 when p_rank <= 50 then 6 when p_rank <= 100 then 4 else 0 end
    when 'matchday_primes' then case when p_rank = 1 then 15 when p_rank = 2 then 12 when p_rank = 3 then 10 when p_rank <= 10 then 5 when p_rank <= 20 then 4 when p_rank <= 30 then 3 when p_rank <= 50 then 2 when p_rank <= 100 then 1 else 0 end
    when 'matchday_predictions' then case when p_rank = 1 then 5 else 0 end
    else 0 end
$$;

-- Awards the end-of-period honours of a season from the recorded rankings. Idempotent: existing awards are kept.
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

  insert into public.gamer_honours (gamer_id, season_id, category, rank, points)
  select y.gamer_id, p_season, 'predictions', y.rk, public.honours_points('predictions', y.rk)
  from (select pr.gamer_id, rank() over (order by sum(pr.earnings) desc)::integer rk
        from public.prediction_results pr join public.matchdays d on d.id = pr.matchday_id where d.season_id = p_season group by pr.gamer_id) y
  where public.honours_points('predictions', y.rk) > 0
  on conflict do nothing;

  insert into public.gamer_honours (gamer_id, season_id, category, rank, points, matchday_id)
  select z.gamer_id, p_season, 'matchday_predictions', 1, 5, z.matchday_id
  from (select pr.gamer_id, pr.matchday_id, rank() over (partition by pr.matchday_id order by pr.earnings desc) rk from public.prediction_results pr join public.matchdays d on d.id = pr.matchday_id where d.season_id = p_season) z
  where z.rk = 1
  on conflict do nothing;
  return v_count;
end $$;
revoke all on function public.award_season_honours(uuid) from public;
grant execute on function public.award_season_honours(uuid) to service_role;
