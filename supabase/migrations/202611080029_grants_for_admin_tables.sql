-- The admin tables created in migrations 023–027 had no table privileges, so the service role (which the admin console uses)
-- and RLS-governed reads from signed-in users failed with "permission denied". Writes stay service-role only.
grant select, insert, update, delete on public.rules_settings, public.season_clubs, public.season_players, public.site_state, public.profile_ip_events, public.bonus_plays to service_role;
grant select on public.rules_settings, public.season_clubs, public.season_players, public.site_state, public.bonus_plays to authenticated;
