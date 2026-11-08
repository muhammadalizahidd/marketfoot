create type public.player_position as enum ('GK', 'DF', 'MF', 'FW');
create type public.matchday_status as enum ('draft', 'open', 'mercado', 'closed', 'settled');

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_on >= starts_on)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null unique,
  crest_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  first_name text not null,
  last_name text not null,
  position public.player_position not null,
  is_active boolean not null default true,
  is_new_pro boolean not null default false,
  vm_value numeric(14,2) not null check (vm_value >= 0),
  marketfoot_value numeric(14,2) not null check (marketfoot_value >= 500000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.matchdays (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  number integer not null check (number > 0),
  status public.matchday_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (season_id, number)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  home_club_id uuid not null references public.clubs(id),
  away_club_id uuid not null references public.clubs(id),
  kickoff_at timestamptz not null,
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  is_postponed boolean not null default false,
  check (home_club_id <> away_club_id)
);

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  gamer_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 48),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.squad_members (
  squad_id uuid not null references public.squads(id) on delete cascade,
  player_id uuid not null references public.players(id),
  acquired_value numeric(14,2) not null check (acquired_value >= 0),
  is_starter boolean not null default false,
  is_captain boolean not null default false,
  acquired_at timestamptz not null default timezone('utc', now()),
  primary key (squad_id, player_id)
);

create table public.gamer_finances (
  gamer_id uuid primary key references public.profiles(id) on delete cascade,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  blocked_account numeric(14,2) not null default 0 check (blocked_account >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.seasons enable row level security;
alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.matchdays enable row level security;
alter table public.matches enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.gamer_finances enable row level security;

create policy "Signed-in users can read competition data" on public.seasons for select to authenticated using (true);
create policy "Signed-in users can read clubs" on public.clubs for select to authenticated using (true);
create policy "Signed-in users can read players" on public.players for select to authenticated using (true);
create policy "Signed-in users can read matchdays" on public.matchdays for select to authenticated using (true);
create policy "Signed-in users can read matches" on public.matches for select to authenticated using (true);
create policy "Gamers can read squads" on public.squads for select to authenticated using (true);
create policy "Gamers can read squad members" on public.squad_members for select to authenticated using (true);
create policy "Gamers can read their finances" on public.gamer_finances for select to authenticated using (gamer_id = auth.uid());

create policy "Admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage clubs" on public.clubs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage players" on public.players for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage matchdays" on public.matchdays for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage matches" on public.matches for all to authenticated using (public.is_admin()) with check (public.is_admin());
