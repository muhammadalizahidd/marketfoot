-- The admin server actions invoke this security-definer lifecycle RPC through
-- the service-role client.  The later replacement of the function did not
-- restore its execute grant, which made every draft/open/Mercado/closed
-- transition fail before any lifecycle validation could run.
grant execute on function public.admin_transition_matchday(uuid, uuid, public.matchday_status) to service_role;
