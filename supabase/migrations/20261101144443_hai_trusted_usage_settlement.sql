-- Install the trusted entry point first. Existing callers remain operational
-- until all deployed Edge Functions have switched to this entry point.
create or replace function public.hai_finalize_usage_service(
  p_user_id uuid,
  p_request_id text,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_route text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_duration_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_route text;
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if p_user_id is null then raise exception '缺少结算用户。'; end if;
  select user_id, route into v_user_id, v_route
  from public.hai_request_reservations where request_id=p_request_id for update;
  if not found then raise exception '用量预留不存在。'; end if;
  if v_user_id is distinct from p_user_id or v_route is distinct from p_route then
    raise exception '结算用户或请求来源不匹配。';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',p_user_id,'role','authenticated')::text, true);
  perform public.hai_finalize_usage(p_request_id,p_status,p_input_tokens,p_output_tokens,p_route,p_entity_type,p_entity_id,p_duration_ms,p_metadata);
  perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
end;
$$;
revoke all on function public.hai_finalize_usage_service(uuid,text,text,integer,integer,text,text,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.hai_finalize_usage_service(uuid,text,text,integer,integer,text,text,uuid,integer,jsonb) to service_role;
notify pgrst, 'reload schema';
