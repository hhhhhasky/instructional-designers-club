begin;

-- Production evidence on 2026-08-31 showed hai-work being terminated with
-- WallClockTime at about 150 seconds.  Keep the database recovery threshold
-- close to that real boundary so a hard-killed request cannot look active for
-- the historical ten-minute window.
create or replace function public.hai_mark_stale_work_runs(p_task_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  v_run record;
  v_duration_ms integer;
begin
  if v_user_id is null then
    raise exception '请先登录。';
  end if;

  for v_run in
    select id, task_id, client_request_id, input_tokens, output_tokens, started_at, created_at
    from public.hai_work_runs
    where user_id = v_user_id
      and status in ('queued', 'running')
      and coalesce(started_at, created_at) < now() - interval '3 minutes'
      and (p_task_id is null or task_id = p_task_id)
    for update
  loop
    v_duration_ms := least(
      2147483647,
      greatest(0, floor(extract(epoch from (now() - coalesce(v_run.started_at, v_run.created_at))) * 1000)::bigint)
    )::integer;

    update public.hai_work_runs
    set
      status = 'failed',
      error_message = '生成已超过平台执行时限，任务已停止，可以安全重试。',
      duration_ms = v_duration_ms,
      completed_at = now(),
      updated_at = now()
    where id = v_run.id;

    perform public.hai_finalize_usage(
      v_run.client_request_id,
      'failed',
      coalesce(v_run.input_tokens, 0),
      coalesce(v_run.output_tokens, 0),
      'hai-work',
      'work_task',
      v_run.task_id,
      v_duration_ms,
      jsonb_build_object('run_id', v_run.id, 'error', 'wall_clock_timeout')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.hai_mark_stale_work_runs(uuid) from public, anon;
grant execute on function public.hai_mark_stale_work_runs(uuid) to authenticated;

commit;
