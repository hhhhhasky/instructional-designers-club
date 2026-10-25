begin;

-- Keep the existing lease/access/expiry rules and expose the active document.
create or replace function public.hai_claim_work_job(p_run_id uuid) returns jsonb
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
    execution_phase=case when v_job.payload->'module'->>'slug'='unit-learning-design' and v_job.phase<>'complete'
      then case when jsonb_array_length(v_job.attempts)=0 then 'unit_overall'
        else 'unit_lesson_'||jsonb_array_length(v_job.attempts)::text||'_'||jsonb_array_length(v_job.attempts->0->'unit_plan'->'lessons')::text end
      else case v_job.phase when 'initial' then 'generating' when 'repair' then 'repairing' else 'saving' end end,
    updated_at=now() where id=p_run_id;
  update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{events}',
    coalesce(debug_trace->'events','[]')||jsonb_build_array(jsonb_build_object('stage','worker_claimed','phase',v_job.phase,'at',now()))),
    updated_at=now() where run_id=p_run_id;
  return to_jsonb(v_job) || jsonb_build_object('user_id',v_run.user_id,'task_id',v_run.task_id,'client_request_id',v_run.client_request_id);
end;
$$;

-- One durable checkpoint per file; existing Work jobs keep their current path.
create function public.hai_checkpoint_unit_work_job(p_run_id uuid,p_lease_token uuid,p_attempt jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job public.hai_work_jobs%rowtype; v_count integer; v_total integer; v_error text;
begin
  select * into strict v_job from public.hai_work_jobs where run_id=p_run_id for update;
  if v_job.payload->'module'->>'slug'<>'unit-learning-design' or v_job.phase='complete'
    or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_until is null or v_job.lease_until<=now() then
    raise exception '后台任务执行权已失效。';
  end if;
  v_count := jsonb_array_length(v_job.attempts);
  v_error := nullif(p_attempt->>'error','');
  if (p_attempt->>'attempt')::integer is distinct from v_count+1 then raise exception '课时执行顺序不正确。'; end if;
  v_total := case when v_count=0 then jsonb_array_length(p_attempt->'unit_plan'->'lessons')
    else jsonb_array_length(v_job.attempts->0->'unit_plan'->'lessons') end;
  if v_error is null and (coalesce(v_total,0)<1 or coalesce(p_attempt->'file'->>'markdown','')='' or
    (v_count=0 and p_attempt->'file'->>'kind' is distinct from 'unit') or
    (v_count>0 and p_attempt->'file'->>'kind' is distinct from 'lesson')) then
    v_error := '大单元教学文件不完整，请重试。';
  end if;
  update public.hai_work_jobs set attempts=attempts||jsonb_build_array(p_attempt),
    phase=case when v_error is not null or v_count>=v_total then 'complete' else 'initial' end,
    error_message=v_error, lease_token=null,lease_until=null,next_dispatch_at=now()
    where run_id=p_run_id;
  update public.hai_work_runs set execution_phase=case when v_error is not null or v_count>=v_total
    then 'saving' else 'unit_lesson_'||(v_count+1)::text||'_'||v_total::text end,updated_at=now() where id=p_run_id;
  update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{model_attempts}',
    coalesce(debug_trace->'model_attempts','[]')||jsonb_build_array(p_attempt)),updated_at=now() where run_id=p_run_id;
end;
$$;

-- Reuse the existing transactional artifact/version/usage settlement. Package
-- files are attached in the same transaction, so a partial set is never complete.
create function public.hai_finish_unit_work_job(p_run_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_job public.hai_work_jobs%rowtype; v_result jsonb; v_files jsonb; v_markdown text;
  v_total integer; v_input integer; v_output integer; v_last integer;
begin
  select * into strict v_job from public.hai_work_jobs where run_id=p_run_id for update;
  if v_job.payload->'module'->>'slug'<>'unit-learning-design' then raise exception '任务类型不正确。'; end if;
  if exists(select 1 from public.hai_work_runs where id=p_run_id and status in ('completed','failed')) then
    return public.hai_finish_work_job(p_run_id,p_lease_token);
  end if;
  if v_job.phase<>'complete' or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_until is null or v_job.lease_until<=now() then raise exception '后台任务执行权已失效。'; end if;
  v_total := jsonb_array_length(v_job.attempts->0->'unit_plan'->'lessons');
  select jsonb_agg(a->'file' order by n),string_agg(a->'file'->>'markdown',E'\n\n---\n\n' order by n),
    coalesce(sum((a->>'estimated_input_tokens')::integer),0),coalesce(sum((a->>'estimated_output_tokens')::integer),0)
    into v_files,v_markdown,v_input,v_output from jsonb_array_elements(v_job.attempts) with ordinality t(a,n);
  if v_job.error_message is null and (coalesce(v_total,0)<1 or jsonb_array_length(v_job.attempts)<>v_total+1
    or exists(select 1 from jsonb_array_elements(v_job.attempts) a where coalesce(a->'file'->>'markdown','')='' or nullif(a->>'error','') is not null)) then
    update public.hai_work_jobs set error_message='课时文件尚未全部完成，请重试。' where run_id=p_run_id;
  end if;
  v_last := jsonb_array_length(v_job.attempts)-1;
  if v_last>=0 then
    update public.hai_work_jobs set payload=jsonb_set(payload,'{estimatedInputTokens}',to_jsonb(v_input)),
      attempts=jsonb_set(attempts,array[v_last::text],(attempts->v_last)||jsonb_build_object('markdown',coalesce(v_markdown,''),'estimated_output_tokens',v_output))
      where run_id=p_run_id;
  end if;
  v_result := public.hai_finish_work_job(p_run_id,p_lease_token);
  if v_result->>'status'='completed' then
    update public.hai_work_artifacts set content_json=jsonb_build_object('format','unit_learning_package',
      'artifact_kind','unit_learning_package','files',v_files,'lesson_count',v_total) where run_id=p_run_id;
  end if;
  return v_result;
end;
$$;

revoke all on function public.hai_checkpoint_unit_work_job(uuid,uuid,jsonb),public.hai_finish_unit_work_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hai_checkpoint_unit_work_job(uuid,uuid,jsonb),public.hai_finish_unit_work_job(uuid,uuid) to service_role;

-- The skill snapshot is imported separately from its source bundle. Enable only
-- when the matching hai-work and worker implementation has been deployed.
insert into public.hai_feature_modules(slug,name,short_label,description,icon_key,category,surface_mode,
  default_model,default_temperature,default_max_output_tokens,thinking_enabled,sort_order,is_enabled)
values('unit-learning-design','大单元教学','大单元','三种重构范围，交付一份整体设计与逐课独立教案。','book-open-check','HAI Work','work',
  'deepseek-v4-flash',0.25,12000,false,45,false) on conflict(slug) do nothing;
insert into public.hai_work_skills(slug,module_slug,name,description,match_criteria,priority,is_fallback,is_enabled)
values('design-learning-units','unit-learning-design','大单元教学设计','所有学科学段共用模型与模板；单元内、教材内、跨教材三种重构。','{}',100,false,false)
on conflict(slug) do nothing;
commit;
