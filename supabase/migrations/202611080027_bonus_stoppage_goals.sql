-- "Fergie Time" bonus (PRD §6.4) needs to know which goals were scored in stoppage time. Entered on the match sheet.
alter table public.player_match_stats add column if not exists stoppage_time_goals integer not null default 0 check (stoppage_time_goals >= 0);
