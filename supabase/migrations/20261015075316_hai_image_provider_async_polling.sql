begin;

-- New provider_async runs use a NULL delivery deadline: each HTTP operation
-- is bounded, but generation continues at ToAPIs between status requests.
-- Historical deadlines and their cleanup remain enforced. No failed run is revived.
-- Keep owner checks, row locks, acknowledgement-only debit and one settlement.
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
      and (r.delivery_deadline_at is not null or r.metadata ->> 'execution_mode' = 'provider_async')
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
  if (v_run.delivery_deadline_at is not null or v_run.metadata ->> 'execution_mode' = 'provider_async') and
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

create or replace function public.hai_acknowledge_image_delivery(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.hai_image_generation_runs%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_run from public.hai_image_generation_runs where id=p_run_id and user_id=auth.uid() for update;
  if not found then raise exception 'Image run not found or unauthorized'; end if;
  if v_run.status in ('completed','failed') then return to_jsonb(v_run); end if;
  if (v_run.delivery_deadline_at is null and v_run.metadata ->> 'execution_mode' is distinct from 'provider_async')
    or clock_timestamp() >= v_run.delivery_deadline_at then
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

revoke all on function public.hai_finalize_image_generation(text,text,text,uuid,integer,jsonb) from public, anon;
grant execute on function public.hai_finalize_image_generation(text,text,text,uuid,integer,jsonb) to authenticated;
revoke all on function public.hai_complete_image_generation_run(uuid) from public, anon;
grant execute on function public.hai_complete_image_generation_run(uuid) to authenticated;
revoke all on function public.hai_acknowledge_image_delivery(uuid) from public, anon;
grant execute on function public.hai_acknowledge_image_delivery(uuid) to authenticated;
commit;
