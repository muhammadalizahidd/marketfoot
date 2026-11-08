create function public.admin_edit_resource(p_actor uuid,p_resource text,p_id uuid,p_before jsonb,p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_after jsonb; v_allowed text[]; v_set text;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED'; end if;
  v_allowed:=case p_resource when 'seasons' then array['name','starts_on','ends_on','is_current'] when 'clubs' then array['name','short_name'] when 'players' then array['first_name','last_name','club_id','position','vm_value','marketfoot_value','is_active'] when 'matchdays' then array['number','opens_at','closes_at'] when 'matches' then array['kickoff_at'] else null end;
  if v_allowed is null or exists(select 1 from jsonb_object_keys(p_changes) k where not k=any(v_allowed)) then raise exception 'INVALID_FIELDS'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_resource) into v_before using p_id;
  if v_before is null or v_before<>p_before then raise exception 'STALE_RECORD'; end if;
  if p_resource='seasons' and (p_changes->>'is_current')::boolean then perform pg_advisory_xact_lock(713201); if exists(select 1 from public.seasons where is_current and id<>p_id) then raise exception 'OTHER_CURRENT_SEASON'; end if; end if;
  if p_resource='players' and (p_changes->>'position'<>v_before->>'position' or p_changes->>'club_id'<>v_before->>'club_id') and exists(select 1 from public.squad_members where player_id=p_id) then raise exception 'OWNED_PLAYER_REASSIGNMENT_REQUIRES_REVIEW'; end if;
  if p_resource='matches' and exists(select 1 from public.matches m join public.matchday_squad_snapshots s on s.matchday_id=m.matchday_id where m.id=p_id) then raise exception 'FROZEN_SCHEDULE'; end if;
  select string_agg(format('%I = patch.%I',k,k),',') into v_set from jsonb_object_keys(p_changes) k;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) patch where t.id=$2',p_resource,v_set,p_resource) using p_changes,p_id;
  execute format('select to_jsonb(t) from public.%I t where id=$1',p_resource) into v_after using p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state) values(p_actor,'resource.update',p_resource,p_id,v_before,v_after);
end; $$;
create function public.admin_delete_resource(p_actor uuid,p_resource text,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if p_resource not in('seasons','clubs','players','matchdays','matches') then raise exception 'INVALID_RESOURCE'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_resource) into v_before using p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;
  if p_resource='matches' and (exists(select 1 from public.player_match_stats where match_id=p_id) or exists(select 1 from public.matches m join public.matchday_squad_snapshots s on s.matchday_id=m.matchday_id where m.id=p_id)) then raise exception 'HISTORY_EXISTS'; end if;
  if p_resource='matchdays' and (exists(select 1 from public.matches where matchday_id=p_id) or exists(select 1 from public.captain_assignments where matchday_id=p_id)) then raise exception 'HISTORY_EXISTS'; end if;
  execute format('delete from public.%I where id=$1',p_resource) using p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,before_state) values(p_actor,'resource.delete',p_resource,p_id,v_before);
end; $$;
revoke all on function public.admin_edit_resource(uuid,text,uuid,jsonb,jsonb),public.admin_delete_resource(uuid,text,uuid) from public;
grant execute on function public.admin_edit_resource(uuid,text,uuid,jsonb,jsonb),public.admin_delete_resource(uuid,text,uuid) to service_role;
