-- prediction_results (migration 019) had no table privileges: the service role (admin console, seeds) and signed-in
-- gamers reading their own rows (RLS policy "Read own prediction results") failed with "permission denied".
grant select, insert, update, delete on public.prediction_results to service_role;
grant select on public.prediction_results to authenticated;
