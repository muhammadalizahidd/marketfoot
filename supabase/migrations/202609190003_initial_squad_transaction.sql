create or replace function public.create_initial_squad(
  p_gamer_id uuid,
  p_name text,
  p_members jsonb,
  p_budget numeric
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_squad_id uuid;
begin
  if exists (select 1 from public.squads where gamer_id = p_gamer_id) then
    raise exception 'SQUAD_ALREADY_EXISTS';
  end if;

  insert into public.squads (gamer_id, name) values (p_gamer_id, p_name) returning id into v_squad_id;
  insert into public.squad_members (squad_id, player_id, acquired_value)
  select v_squad_id, (member ->> 'playerId')::uuid, (member ->> 'acquiredValue')::numeric
  from jsonb_array_elements(p_members) as member;
  insert into public.gamer_finances (gamer_id, budget, blocked_account)
  values (p_gamer_id, p_budget, 0)
  on conflict (gamer_id) do update set budget = excluded.budget, updated_at = timezone('utc', now());
  return v_squad_id;
end;
$$;

revoke all on function public.create_initial_squad(uuid, text, jsonb, numeric) from public;
