-- Barèmes: versioned, admin-editable rules settings (PRD v1.3 §23 "Current constants and rule status").
-- Exactly one version is active. The application falls back to its built-in PRD reference values when no row exists.
create table if not exists public.rules_settings (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  settings jsonb not null,
  note text,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists rules_settings_one_active on public.rules_settings (is_active) where is_active;
alter table public.rules_settings enable row level security;
drop policy if exists "Admins read rules settings" on public.rules_settings;
create policy "Admins read rules settings" on public.rules_settings for select to authenticated using (public.is_admin());

-- Honours points now follow the active settings (Barèmes → Palmarès); the previous table stays as the fallback.
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'honours_points_default') then
    alter function public.honours_points(text, integer) rename to honours_points_default;
  end if;
end $$;

create or replace function public.honours_points(p_category text, p_rank integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (s.settings -> 'honours' -> p_category ->> (b.band::text))::integer
       from public.rules_settings s,
            lateral (select min(x) as band from unnest(array[1, 2, 3, 10, 20, 30, 50, 100]) as x where p_rank <= x) b
      where s.is_active),
    public.honours_points_default(p_category, p_rank));
$$;
