begin;

-- The R2 upload precedes this transaction. Lock the run and reservation so
-- concurrent polls (or a lost response followed by a retry) settle only once.
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
revoke all on function public.hai_complete_image_generation_run(uuid) from public, anon;
grant execute on function public.hai_complete_image_generation_run(uuid) to authenticated;
commit;
