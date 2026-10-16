begin;

-- Existing runs/artifacts remain the public read model. Prompts and worker
-- credentials live in service-only tables, never in browser request tokens.
alter table public.hai_work_runs add column execution_mode text not null default 'request';
alter table public.hai_work_runs add column execution_phase text;
create table public.hai_work_jobs (
  run_id uuid primary key references public.hai_work_runs(id) on delete cascade,
  payload jsonb not null,
  phase text not null default 'initial' check (phase in ('initial','repair','complete')),
  attempts jsonb not null default '[]',
  error_message text,
  lease_token uuid,
  lease_until timestamptz,
  next_dispatch_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index hai_work_jobs_dispatch_idx on public.hai_work_jobs(next_dispatch_at);
alter table public.hai_work_jobs enable row level security;
revoke all on public.hai_work_jobs from public, anon, authenticated;
grant all on public.hai_work_jobs to service_role;

create table public.hai_work_scheduler_config (
  singleton boolean primary key default true check (singleton),
  endpoint_url text not null check (endpoint_url ~ '^https://[^/]+/functions/v1/hai-work-worker$'),
  auth_secret text not null check (length(auth_secret) >= 32),
  enabled boolean not null default false
);
alter table public.hai_work_scheduler_config enable row level security;
revoke all on public.hai_work_scheduler_config from public, anon, authenticated;
grant all on public.hai_work_scheduler_config to service_role;

create function public.hai_work_queue_ready() returns boolean
language sql security definer set search_path = '' as $$
  select exists(select 1 from public.hai_work_scheduler_config where singleton and enabled);
$$;

-- A duplicate request rolls back its speculative task row inside this
-- subtransaction; the existing (user_id,client_request_id) unique key arbitrates.
create function public.hai_prepare_work_run(p_user_id uuid,p_client_request_id text,p_task_id uuid,
  p_task_title text,p_module_slug text,p_run jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_task_id uuid:=p_task_id; v_run public.hai_work_runs%rowtype;
begin
  begin
    if v_task_id is null then
      insert into public.hai_work_tasks(id,user_id,module_slug,title)
        values(gen_random_uuid(),p_user_id,p_module_slug,p_task_title) returning id into v_task_id;
    else
      perform 1 from public.hai_work_tasks where id=v_task_id and user_id=p_user_id and module_slug=p_module_slug;
      if not found then raise exception '任务不存在或无权访问。'; end if;
    end if;
    insert into public.hai_work_runs(task_id,user_id,client_request_id,skill_version_id,parent_artifact_id,
      status,input_snapshot,skill_snapshot,revision_instruction)
      values(v_task_id,p_user_id,p_client_request_id,(p_run->>'skill_version_id')::uuid,
        (p_run->>'parent_artifact_id')::uuid,'queued',p_run->'input_snapshot',p_run->'skill_snapshot',p_run->>'revision_instruction')
      returning * into v_run;
    return to_jsonb(v_run)||jsonb_build_object('replayed',false);
  exception when unique_violation then
    select * into v_run from public.hai_work_runs where user_id=p_user_id and client_request_id=p_client_request_id;
    if not found then raise; end if;
    return to_jsonb(v_run)||jsonb_build_object('replayed',true);
  end;
end;
$$;

create function public.hai_enqueue_work_job(p_run_id uuid, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_run public.hai_work_runs%rowtype;
begin
  if not public.hai_work_queue_ready() then raise exception 'HAI Work 后台执行器未配置。'; end if;
  select * into strict v_run from public.hai_work_runs where id=p_run_id for update;
  if v_run.status <> 'queued' then raise exception '任务状态不允许入队。'; end if;
  perform 1 from public.hai_request_reservations where request_id=v_run.client_request_id
    and user_id=v_run.user_id and route='hai-work' and status='active' for update;
  if not found then raise exception '任务用量未预留。'; end if;
  insert into public.hai_work_jobs(run_id,payload) values(p_run_id,p_payload) on conflict do nothing;
  update public.hai_work_runs set execution_mode='async',execution_phase='queued' where id=p_run_id;
  -- Protect the accepted request's original quota reservation during queueing.
  -- A bounded 30-minute job lifetime still releases abandoned work.
  update public.hai_request_reservations set expires_at=now()+interval '35 minutes'
    where request_id=v_run.client_request_id and user_id=v_run.user_id;
end;
$$;

create function public.hai_claim_work_job(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_job public.hai_work_jobs%rowtype; v_run public.hai_work_runs%rowtype;
begin
  select * into v_job from public.hai_work_jobs where run_id=p_run_id for update skip locked;
  if not found or v_job.lease_until > now() then return null; end if;
  select * into strict v_run from public.hai_work_runs where id=p_run_id for update;
  if v_run.status not in ('queued','running') then return null; end if;
  -- Do not silently repeat a paid model call after losing its worker. A saved
  -- output can always be finalized without another model call.
  if v_job.lease_token is not null and v_job.phase <> 'complete' then
    v_job.error_message := '后台执行中断，本轮未完成，请重试。';
    v_job.phase := 'complete';
  end if;
  if v_job.created_at < now()-interval '30 minutes' and v_job.phase <> 'complete' then
    v_job.error_message := coalesce(v_job.error_message,'后台任务等待过久，请重试。');
    v_job.phase := 'complete';
  end if;
  if not public.hai_has_access(v_run.user_id) and v_job.phase <> 'complete' then
    v_job.error_message := '当前账号不可用，任务已停止。'; v_job.phase := 'complete';
  end if;
  v_job.lease_token := gen_random_uuid(); v_job.lease_until := now()+interval '90 seconds';
  update public.hai_work_jobs set phase=v_job.phase,error_message=v_job.error_message,
    lease_token=v_job.lease_token,lease_until=v_job.lease_until where run_id=p_run_id;
  update public.hai_work_runs set status='running',started_at=coalesce(started_at,now()),
    execution_phase=case v_job.phase when 'initial' then 'generating' when 'repair' then 'repairing' else 'saving' end,
    updated_at=now() where id=p_run_id;
  update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{events}',
    coalesce(debug_trace->'events','[]')||jsonb_build_array(jsonb_build_object('stage','worker_claimed','phase',v_job.phase,'at',now()))),
    updated_at=now() where run_id=p_run_id;
  return to_jsonb(v_job) || jsonb_build_object('user_id',v_run.user_id,'task_id',v_run.task_id,'client_request_id',v_run.client_request_id);
end;
$$;

create function public.hai_heartbeat_work_job(p_run_id uuid,p_lease_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.hai_work_jobs set lease_until=now()+interval '90 seconds'
    where run_id=p_run_id and lease_token=p_lease_token and lease_until>now()
      and created_at>now()-interval '30 minutes';
  return found;
end;
$$;

create function public.hai_checkpoint_work_job(p_run_id uuid,p_lease_token uuid,p_attempt jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job public.hai_work_jobs%rowtype; v_phase text;
begin
  select * into strict v_job from public.hai_work_jobs where run_id=p_run_id for update;
  if p_lease_token is null or v_job.lease_token is distinct from p_lease_token or v_job.lease_until is null or v_job.lease_until<=now() then
    raise exception '后台任务执行权已失效。';
  end if;
  if v_job.phase='complete' then raise exception '模型阶段已完成。'; end if;
  v_phase := case when v_job.phase='initial' and coalesce(p_attempt->>'error','')=''
    and coalesce(p_attempt->>'markdown','')='' then 'repair' else 'complete' end;
  update public.hai_work_jobs set attempts=attempts||jsonb_build_array(p_attempt),phase=v_phase,
    error_message=case when coalesce(p_attempt->>'error','')<>'' then p_attempt->>'error'
      when v_phase='complete' and coalesce(p_attempt->>'markdown','')='' then 'AI 未返回任何内容，请重试。' end,
    lease_token=null,lease_until=null,next_dispatch_at=now() where run_id=p_run_id;
  update public.hai_work_runs set execution_phase=case when v_phase='repair' then 'repairing' else 'saving' end,
    updated_at=now() where id=p_run_id;
  update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{model_attempts}',
    coalesce(debug_trace->'model_attempts','[]')||jsonb_build_array(p_attempt)),updated_at=now() where run_id=p_run_id;
end;
$$;

create function public.hai_finish_work_job(p_run_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.hai_work_jobs%rowtype; v_run public.hai_work_runs%rowtype;
  v_artifact public.hai_work_artifacts%rowtype; v_attempt jsonb; v_version integer;
  v_input integer; v_output integer; v_duration integer; v_status text; v_reservation_status text;
  v_sub text := current_setting('request.jwt.claim.sub',true);
  v_claims text := current_setting('request.jwt.claims',true);
begin
  select * into strict v_job from public.hai_work_jobs where run_id=p_run_id for update;
  select * into strict v_run from public.hai_work_runs where id=p_run_id for update;
  if v_run.status in ('completed','failed') then return to_jsonb(v_run); end if;
  if v_job.phase<>'complete' or p_lease_token is null or v_job.lease_token is distinct from p_lease_token or v_job.lease_until is null or v_job.lease_until<=now() then
    raise exception '后台任务执行权已失效。';
  end if;
  v_attempt := v_job.attempts->-1;
  v_input := coalesce((v_job.payload->>'estimatedInputTokens')::integer,0);
  v_output := coalesce((v_attempt->>'estimated_output_tokens')::integer,0);
  v_duration := least(2147483647,greatest(0,extract(epoch from (now()-coalesce(v_run.started_at,v_run.created_at)))*1000))::integer;
  select status into v_reservation_status from public.hai_request_reservations
    where request_id=v_run.client_request_id and user_id=v_run.user_id and route='hai-work' for update;
  if not found then raise exception '任务用量预留不存在。'; end if;
  if v_reservation_status not in ('active','expired') then
    v_job.error_message := '任务用量预留已结束，任务未交付，请重试。';
  end if;
  v_status := case when v_job.error_message is null and coalesce(v_attempt->>'markdown','')<>'' then 'completed' else 'failed' end;
  if v_status='completed' then
    -- Serialize version allocation with the task row, including concurrent revisions.
    perform 1 from public.hai_work_tasks where id=v_run.task_id for update;
    select coalesce(max(version_number),0)+1 into v_version from public.hai_work_artifacts where task_id=v_run.task_id;
    insert into public.hai_work_artifacts(task_id,run_id,user_id,parent_artifact_id,version_number,title,content_json,content_markdown)
    values(v_run.task_id,v_run.id,v_run.user_id,v_run.parent_artifact_id,v_version,v_job.payload->>'title',
      jsonb_build_object('format','markdown','artifact_kind',v_job.payload->>'artifactKind'),v_attempt->>'markdown')
    returning * into v_artifact;
    update public.hai_work_tasks set latest_artifact_id=v_artifact.id,updated_at=now() where id=v_run.task_id;
  end if;
  -- This service-only wrapper derives ownership from the locked run. No stored
  -- user JWT and no client-controlled identity is used for background settlement.
  perform set_config('request.jwt.claim.sub',v_run.user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_run.user_id,'role','authenticated')::text,true);
  perform 1 from public.hai_request_reservations where request_id=v_run.client_request_id
    and user_id=v_run.user_id and route='hai-work' for update;
  if not found then raise exception '任务用量预留不存在。'; end if;
  update public.hai_request_reservations set status='active' where request_id=v_run.client_request_id
    and user_id=v_run.user_id and status='expired';
  perform public.hai_finalize_usage(v_run.client_request_id,v_status,v_input,v_output,'hai-work','work_task',v_run.task_id,
    v_duration,jsonb_build_object('run_id',v_run.id,'artifact_id',v_artifact.id,'execution_mode','async',
      'tool_slug',v_job.payload->'module'->>'slug','model',v_job.payload->'completionOptions'->>'model',
      'model_provider_id',v_job.payload->'module'->'model_provider_id',
      'skill_slug',v_run.skill_snapshot->>'slug','skill_version',v_run.skill_snapshot->>'version',
      'skill_snapshot_hash',v_run.skill_snapshot->>'snapshot_hash','fallback_skill',v_run.skill_snapshot->'fallback',
      'teaching_mode',v_run.input_snapshot->>'teaching_mode','revision',v_run.parent_artifact_id is not null,
      'artifact_version',v_artifact.version_number,'error',v_job.error_message));
  -- Preserve the previous actual-usage dashboard fields in the same completion
  -- transaction, rather than relying on an after-response analytics write.
  update public.hai_usage_events e set
    actual_prompt_tokens=a.prompt_tokens,actual_cache_hit_tokens=a.cache_hit_tokens,
    actual_cache_miss_tokens=a.cache_miss_tokens,actual_completion_tokens=a.completion_tokens,
    actual_reasoning_tokens=a.reasoning_tokens,actual_visible_output_tokens=a.visible_output_tokens,
    actual_total_tokens=a.total_tokens,actual_cost=a.total_cost,actual_currency=a.currency,
    actual_usage_status=case when a.all_provider then 'actual' when a.any_provider then 'partial' else 'missing' end
  from (select count(*) as n,coalesce(sum(prompt_tokens),0) as prompt_tokens,
    coalesce(sum(cache_hit_tokens),0) as cache_hit_tokens,coalesce(sum(cache_miss_tokens),0) as cache_miss_tokens,
    coalesce(sum(completion_tokens),0) as completion_tokens,coalesce(sum(reasoning_tokens),0) as reasoning_tokens,
    coalesce(sum(visible_output_tokens),0) as visible_output_tokens,coalesce(sum(total_tokens),0) as total_tokens,
    case when count(total_cost)=count(*) then sum(total_cost) end as total_cost,
    coalesce(max(currency),'CNY') as currency,bool_and(usage_status='provider') as all_provider,
    bool_or(usage_status in ('provider','provider_partial')) as any_provider
    from public.hai_model_calls where request_id=v_run.client_request_id) a
  where a.n>0 and e.request_id=v_run.client_request_id and e.status<>'started';
  perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  update public.hai_request_reservations set expires_at=now() where request_id=v_run.client_request_id and user_id=v_run.user_id;
  update public.hai_work_runs set status=v_status,execution_phase=v_status,
    error_message=case when v_status='failed' then coalesce(v_job.error_message,'任务执行失败。') end,
    input_tokens=v_input,output_tokens=v_output,duration_ms=v_duration,completed_at=now(),updated_at=now()
    where id=p_run_id returning * into v_run;
  update public.hai_work_jobs set lease_token=null,lease_until=null,next_dispatch_at='infinity'::timestamptz where run_id=p_run_id;
  update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{events}',
    coalesce(debug_trace->'events','[]')||jsonb_build_array(jsonb_build_object('stage',case when v_status='completed' then 'artifact_persisted' else 'run_failed' end,
      'at',now(),'status',v_status,'artifact_id',v_artifact.id,'error',v_run.error_message))),updated_at=now() where run_id=p_run_id;
  return to_jsonb(v_run);
end;
$$;

-- pg_net is only a wake-up transport: queued jobs remain durable if an HTTP
-- request is lost or the database restarts. Cron dispatches them again.
create function public.hai_dispatch_work_jobs() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_config public.hai_work_scheduler_config%rowtype; v_job record; v_count integer:=0;
begin
  select * into v_config from public.hai_work_scheduler_config where singleton and enabled;
  if not found then return 0; end if;
  for v_job in select j.run_id from public.hai_work_jobs j join public.hai_work_runs r on r.id=j.run_id
    where r.status in ('queued','running') and (j.lease_until is null or j.lease_until<=now())
      and j.next_dispatch_at<=now() order by j.created_at limit 4 for update of j skip locked
  loop
    perform net.http_post(url:=v_config.endpoint_url,
      headers:=jsonb_build_object('content-type','application/json','x-hai-work-secret',v_config.auth_secret),
      body:=jsonb_build_object('runId',v_job.run_id),timeout_milliseconds:=145000);
    update public.hai_work_jobs set next_dispatch_at=now()+interval '30 seconds' where run_id=v_job.run_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

-- Preserve legacy safety while replacing elapsed-age failure for async work.
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
      and execution_mode = 'request'
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

revoke all on function public.hai_prepare_work_run(uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.hai_work_queue_ready() from public,anon,authenticated;
revoke all on function public.hai_enqueue_work_job(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.hai_claim_work_job(uuid) from public,anon,authenticated;
revoke all on function public.hai_heartbeat_work_job(uuid,uuid) from public,anon,authenticated;
revoke all on function public.hai_checkpoint_work_job(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.hai_finish_work_job(uuid,uuid) from public,anon,authenticated;
revoke all on function public.hai_dispatch_work_jobs() from public,anon,authenticated;
grant execute on function public.hai_prepare_work_run(uuid,text,uuid,text,text,jsonb),public.hai_work_queue_ready(),public.hai_enqueue_work_job(uuid,jsonb),
  public.hai_claim_work_job(uuid),public.hai_heartbeat_work_job(uuid,uuid),
  public.hai_checkpoint_work_job(uuid,uuid,jsonb),public.hai_finish_work_job(uuid,uuid),
  public.hai_dispatch_work_jobs() to service_role;
revoke all on function public.hai_mark_stale_work_runs(uuid) from public,anon;
grant execute on function public.hai_mark_stale_work_runs(uuid) to authenticated;

select cron.schedule('hai-work-async-dispatch','10 seconds','select public.hai_dispatch_work_jobs();');
commit;
