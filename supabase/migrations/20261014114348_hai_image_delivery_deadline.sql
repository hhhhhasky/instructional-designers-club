begin;

alter table public.hai_image_generation_runs
  add column if not exists delivery_deadline_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_stage text,
  add column if not exists failure_detail jsonb not null default '{}'::jsonb;
-- Historical completed images remain readable; pending runs adopt the new deadline.
update public.hai_image_generation_runs
  set delivery_deadline_at = coalesce(started_at, created_at) + interval '150 seconds'
  where status in ('queued','running') and delivery_deadline_at is null;
create index if not exists idx_hai_image_delivery_pending_deadline
  on public.hai_image_generation_runs(delivery_deadline_at)
  where status in ('queued','running') and delivery_deadline_at is not null;

-- Internal close: the run lock serializes failure, acknowledgement and debit.
create or replace function public.hai_close_image_generation_failure(
  p_run_id uuid, p_code text, p_stage text, p_detail jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.hai_image_generation_runs%rowtype; v_res public.hai_request_reservations%rowtype;
begin
  select * into v_run from public.hai_image_generation_runs where id=p_run_id for update;
  if not found then raise exception 'Image run not found'; end if;
  if v_run.status in ('completed','failed') then return to_jsonb(v_run); end if;
  select * into v_res from public.hai_request_reservations
    where user_id=v_run.user_id and request_id=v_run.client_request_id for update;
  if found and v_res.status <> 'completed' then
    update public.hai_request_reservations set status='failed', completed_at=clock_timestamp(), expires_at=clock_timestamp()
      where id=v_res.id;
    insert into public.hai_usage_events(user_id,request_id,event_type,route,status,entity_type,entity_id,input_tokens,output_tokens,total_tokens,duration_ms,metadata)
      values(v_run.user_id,v_run.client_request_id,'hai.image_generation.finished','hai-image-generation','failed','hai_image_generation_task',v_run.task_id,0,0,0,
        least(2147483647,greatest(0,extract(epoch from (clock_timestamp()-coalesce(v_run.started_at,v_run.created_at)))*1000))::integer,
        jsonb_build_object('run_id',v_run.id,'failure_code',p_code,'failure_stage',p_stage,'failure_detail',p_detail));
  end if;
  update public.hai_image_generation_runs set status='failed', completed_at=clock_timestamp(),
    error_message='本次生成失败，本轮未扣积分，请再次尝试。',
    failure_code=p_code, failure_stage=p_stage, failure_detail=coalesce(p_detail,'{}'::jsonb)
    where id=v_run.id returning * into v_run;
  return to_jsonb(v_run);
end; $$;
revoke all on function public.hai_close_image_generation_failure(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.hai_fail_image_generation_run(
  p_run_id uuid, p_code text default 'delivery_timeout', p_stage text default 'delivery', p_detail jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.hai_image_generation_runs where id=p_run_id and user_id=auth.uid()) then
    raise exception 'Image run not found or unauthorized';
  end if;
  return public.hai_close_image_generation_failure(p_run_id,p_code,p_stage,p_detail);
end; $$;
revoke all on function public.hai_fail_image_generation_run(uuid,text,text,jsonb) from public,anon;
grant execute on function public.hai_fail_image_generation_run(uuid,text,text,jsonb) to authenticated;

create or replace function public.hai_finalize_image_generation(
  p_request_id text,
  p_status text,
  p_route text default 'hai-image-generation',
  p_entity_id uuid default null,
  p_duration_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.hai_request_reservations%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_fixed_tokens bigint;
  v_metadata jsonb;
begin
  if v_user_id is null then raise exception '请先登录。'; end if;
  select * into v_reservation from public.hai_request_reservations
  where request_id = p_request_id and user_id = v_user_id for update;
  if not found then raise exception '用量预留不存在或无权结算。'; end if;
  if v_reservation.status in ('completed', 'failed', 'expired') then return; end if;
  if p_status = 'completed' and exists (
    select 1 from public.hai_image_generation_runs r
    where r.user_id = v_user_id and r.client_request_id = p_request_id
      and r.delivery_deadline_at is not null
      and (r.delivered_at is null or r.delivered_at >= r.delivery_deadline_at or r.status <> 'running')
  ) then raise exception 'Image delivery has not been acknowledged'; end if;
  v_metadata := coalesce(v_reservation.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb);
  v_fixed_tokens := greatest(0, coalesce((v_reservation.metadata ->> 'fixed_charge_tokens')::bigint, 0));
  if p_status = 'completed' and v_reservation.metadata ->> 'quota_mode' = 'points' and v_fixed_tokens > 0 then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    if v_wallet.balance_tokens < v_fixed_tokens then raise exception '图片生成积分不足，无法结算。'; end if;
    update public.hai_point_wallets set
      balance_tokens = balance_tokens - v_fixed_tokens,
      total_consumed_tokens = total_consumed_tokens + v_fixed_tokens
    where user_id = v_user_id;
    insert into public.hai_point_transactions (
      user_id, transaction_type, token_delta, points_delta, tokens_per_point, request_id, reason, metadata
    ) values (
      v_user_id, 'usage', -v_fixed_tokens,
      -round(v_fixed_tokens::numeric / v_tokens_per_point, 2), v_tokens_per_point,
      p_request_id, 'HAI 图片生成', v_metadata
    );
  end if;
  update public.hai_request_reservations set
    status = case when p_status = 'completed' then 'completed' else 'failed' end,
    actual_input_tokens = 0, actual_output_tokens = 0,
    completed_at = now(), expires_at = now()
  where request_id = p_request_id and user_id = v_user_id;
  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status, entity_type, entity_id,
    input_tokens, output_tokens, total_tokens, duration_ms, metadata
  ) values (
    v_user_id, p_request_id, 'hai.image_generation.finished', p_route,
    case when p_status = 'completed' then 'completed' else 'failed' end,
    'hai_image_generation_task', p_entity_id, 0, 0, 0, p_duration_ms, v_metadata
  );
end;
$$;

create or replace function public.hai_complete_image_generation_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.hai_image_generation_runs%rowtype;
  v_reservation public.hai_request_reservations%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录。'; end if;
  select * into v_run from public.hai_image_generation_runs
    where id = p_run_id and user_id = auth.uid() for update;
  if not found then raise exception '图片记录不存在或无权访问。'; end if;
  if v_run.status = 'completed' then return to_jsonb(v_run); end if;
  if v_run.delivery_deadline_at is not null and
    (v_run.delivered_at is null or v_run.delivered_at >= v_run.delivery_deadline_at) then
    raise exception 'Image delivery has not been acknowledged';
  end if;
  if v_run.status <> 'running' or v_run.r2_key is null or v_run.image_url is null then
    raise exception '图片尚未保存完成。';
  end if;
  select * into v_reservation from public.hai_request_reservations
    where request_id = v_run.client_request_id and user_id = auth.uid() for update;
  if not found or v_reservation.route <> 'hai-image-generation'
    or v_reservation.metadata ->> 'run_id' is distinct from v_run.id::text
    or v_reservation.status = 'failed' then
    raise exception '图片用量预留不正确，无法结算。';
  end if;
  -- A closed browser may outlive the five-minute concurrency reservation.
  -- Restore only this saved, owner-verified run inside the settlement transaction.
  if v_reservation.status = 'expired' then
    update public.hai_request_reservations set status = 'active'
      where request_id = v_run.client_request_id and user_id = auth.uid();
  end if;
  perform 1 from public.hai_point_wallets where user_id = auth.uid() for update;
  perform public.hai_finalize_image_generation(
    v_run.client_request_id, 'completed', 'hai-image-generation', v_run.task_id,
    v_run.duration_ms, jsonb_build_object('run_id', v_run.id, 'provider_task_id', v_run.provider_task_id, 'r2_key', v_run.r2_key)
  );
  update public.hai_image_generation_runs
    set status = 'completed', completed_at = now(), error_message = null
    where id = v_run.id returning * into v_run;
  update public.hai_image_generation_tasks set updated_at = now() where id = v_run.task_id;
  return to_jsonb(v_run);
end;
$$;

revoke all on function public.hai_finalize_image_generation(text,text,text,uuid,integer,jsonb) from public,anon;
grant execute on function public.hai_finalize_image_generation(text,text,text,uuid,integer,jsonb) to authenticated;
revoke all on function public.hai_complete_image_generation_run(uuid) from public,anon;
grant execute on function public.hai_complete_image_generation_run(uuid) to authenticated;

create or replace function public.hai_acknowledge_image_delivery(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.hai_image_generation_runs%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_run from public.hai_image_generation_runs where id=p_run_id and user_id=auth.uid() for update;
  if not found then raise exception 'Image run not found or unauthorized'; end if;
  if v_run.status in ('completed','failed') then return to_jsonb(v_run); end if;
  if v_run.delivery_deadline_at is null or clock_timestamp() >= v_run.delivery_deadline_at then
    return public.hai_close_image_generation_failure(p_run_id,'delivery_ack_timeout','delivery_ack','{}'::jsonb);
  end if;
  if v_run.r2_key is null or v_run.image_url is null then raise exception 'Image is not ready'; end if;
  begin
    update public.hai_image_generation_runs set delivered_at=clock_timestamp(), duration_ms=greatest(0,extract(epoch from (clock_timestamp()-created_at))*1000)::integer where id=p_run_id;
    return public.hai_complete_image_generation_run(p_run_id);
  exception when others then
    return public.hai_close_image_generation_failure(p_run_id,'billing_failed','delivery_ack',jsonb_build_object('message',sqlerrm));
  end;
end; $$;
revoke all on function public.hai_acknowledge_image_delivery(uuid) from public,anon;
grant execute on function public.hai_acknowledge_image_delivery(uuid) to authenticated;

-- Database cleanup also closes tasks after a tab disappears or a worker is killed.
create or replace function public.hai_expire_image_delivery_runs()
returns integer language plpgsql security definer set search_path = public as $$
declare v_run record; v_count integer := 0;
begin
  for v_run in select id,metadata from public.hai_image_generation_runs
    where status in ('queued','running') and delivery_deadline_at <= clock_timestamp()
    for update skip locked loop
    perform public.hai_close_image_generation_failure(v_run.id,'delivery_timeout',coalesce(v_run.metadata->>'phase','delivery'),jsonb_build_object('closed_by','deadline_cleanup'));
    v_count := v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.hai_expire_image_delivery_runs() from public,anon,authenticated;
grant execute on function public.hai_expire_image_delivery_runs() to service_role;
select public.hai_expire_image_delivery_runs();
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hai-image-delivery-expiry','5 seconds','select public.hai_expire_image_delivery_runs();');
  end if;
end; $$;
commit;
