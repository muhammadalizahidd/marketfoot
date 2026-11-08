create type public.settlement_status as enum ('pending', 'running', 'completed', 'failed');

create table public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id),
  started boolean not null default false,
  minutes_played integer not null default 0 check (minutes_played between 0 and 130),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  own_goals integer not null default 0 check (own_goals >= 0),
  yellow_cards integer not null default 0 check (yellow_cards >= 0),
  red_cards integer not null default 0 check (red_cards >= 0),
  penalties_scored integer not null default 0 check (penalties_scored >= 0),
  penalties_missed integer not null default 0 check (penalties_missed >= 0),
  penalties_saved integer not null default 0 check (penalties_saved >= 0),
  saves integer not null default 0 check (saves >= 0),
  substitutions_in integer not null default 0 check (substitutions_in >= 0),
  substitutions_out integer not null default 0 check (substitutions_out >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (match_id, player_id)
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.matchday_settlements (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id),
  rules_version text not null,
  status public.settlement_status not null default 'pending',
  requested_by uuid not null references public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  failure_message text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (matchday_id, rules_version)
);

alter table public.player_match_stats enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.matchday_settlements enable row level security;
create policy "Signed-in users can read match statistics" on public.player_match_stats for select to authenticated using (true);
create policy "Admins can read audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());
create policy "Admins can read settlements" on public.matchday_settlements for select to authenticated using (public.is_admin());

create or replace function public.admin_transition_matchday(p_actor_id uuid, p_matchday_id uuid, p_next_status public.matchday_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_current public.matchday_status;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'ADMIN_REQUIRED'; end if;
  select to_jsonb(matchdays), status into v_before, v_current from public.matchdays where id = p_matchday_id;
  if v_current is null then raise exception 'MATCHDAY_NOT_FOUND'; end if;
  if not ((v_current = 'draft' and p_next_status = 'open') or (v_current = 'open' and p_next_status = 'mercado') or (v_current = 'mercado' and p_next_status = 'closed') or (v_current = 'closed' and p_next_status = 'settled')) then raise exception 'INVALID_LIFECYCLE_TRANSITION'; end if;
  update public.matchdays set status = p_next_status where id = p_matchday_id;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, before_state, after_state) values (p_actor_id, 'matchday.transition', 'matchday', p_matchday_id, v_before, (select to_jsonb(matchdays) from public.matchdays where id = p_matchday_id));
end; $$;
revoke all on function public.admin_transition_matchday(uuid, uuid, public.matchday_status) from public;
