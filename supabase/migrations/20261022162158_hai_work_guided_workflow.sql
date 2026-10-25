begin;
alter table public.hai_work_runs drop constraint if exists hai_work_runs_status_check;
alter table public.hai_work_runs add constraint hai_work_runs_status_check check(status in ('queued','running','waiting_confirmation','completed','failed'));
alter table public.hai_work_runs add column workflow_state jsonb;
-- The public state contains only teacher-facing choices; full prompts remain in hai_work_jobs.
-- Existing column-level grants are preserved. Only the new read column is granted.
grant select(workflow_state) on public.hai_work_runs to authenticated;

create function public.hai_checkpoint_workflow(p_run_id uuid,p_lease_token uuid,p_attempt jsonb,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; f jsonb;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into strict r from public.hai_work_runs where id=p_run_id for update;
 f:=j.payload->'workflow';
 if r.status<>'running' or f is null or f->>'stage' not in ('mode','plan') or p_lease_token is null or j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=now() then raise exception '阶段执行权已失效。'; end if;
 if f->>'stage'='mode' and (jsonb_typeof(p_result->'options') is distinct from 'array' or jsonb_array_length(p_result->'options') not between 2 and 3) then raise exception '候选模式不完整。'; end if;
 if f->>'stage'='plan' and coalesce(p_result->>'markdown','')='' then raise exception '整体设计不完整。'; end if;
 f := f || p_result || jsonb_build_object('attempts',coalesce(f->'attempts','[]')||jsonb_build_array(p_attempt));
 update public.hai_work_jobs set payload=jsonb_set(payload,'{workflow}',f),attempts='[]',phase='initial',lease_token=null,lease_until=null,next_dispatch_at='infinity' where run_id=p_run_id;
 update public.hai_work_runs set status='waiting_confirmation',execution_phase=f->>'stage',workflow_state=f-'attempts',updated_at=now() where id=p_run_id;
 -- Waiting for a teacher holds neither a worker nor a quota reservation.
 update public.hai_request_reservations set status='expired',expires_at=now() where request_id=r.client_request_id and user_id=r.user_id and status='active';
end; $$;
revoke all on function public.hai_checkpoint_workflow(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hai_checkpoint_workflow(uuid,uuid,jsonb,jsonb) to service_role;

create function public.hai_act_workflow(p_run_id uuid,p_revision integer,p_action text,p_option_id text default null,p_feedback text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; f jsonb; chosen jsonb; quota jsonb; next_stage text; seed jsonb;
begin
 if auth.uid() is null then raise exception '请先登录。'; end if;
 -- Same lock order as workers: job, run. Ownership checked before any mutation.
 select * into j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into r from public.hai_work_runs where id=p_run_id and user_id=auth.uid() for update;
 if not found or j.run_id is null then raise exception '任务不存在或无权访问。'; end if;
 if not public.hai_has_access(r.user_id) then raise exception '当前账号不可用。'; end if;
 if not exists(select 1 from public.hai_work_tasks where id=r.task_id and status='active') then raise exception '已归档任务不能继续。'; end if;
 f:=j.payload->'workflow';
 if f is null or (f->>'revision')::integer is distinct from p_revision then raise exception '方案已更新，请查看最新版。'; end if;
 if p_action is null or p_action not in ('confirm','revise','back','retry','cancel') then raise exception '未知操作。'; end if;
 if p_action='back' and f->>'selection_source'='form' then raise exception '道法模式已在表单选择，请停止本轮后从新建入口重新选择。'; end if;
 if length(coalesce(p_feedback,''))>12000 then raise exception '修改要求过长。'; end if;
 if r.status='completed' then raise exception '完整成果请通过版本追改。'; end if;
 if p_action='cancel' then
   if r.status not in ('queued','running','waiting_confirmation') then raise exception '任务已结束。'; end if;
   update public.hai_work_jobs set phase='complete',error_message='教师已停止本轮生成。',lease_token=null,lease_until=null,next_dispatch_at=now(),created_at=now() where run_id=p_run_id;
   update public.hai_work_runs set status='queued',workflow_state=jsonb_set(f-'attempts','{revision}',to_jsonb(p_revision+1)) where id=p_run_id;
   update public.hai_work_jobs set payload=jsonb_set(payload,'{workflow,revision}',to_jsonb(p_revision+1)) where run_id=p_run_id;
   return jsonb_build_object('runId',r.id,'taskId',r.task_id,'status','queued');
 end if;
 if (p_action='retry' and r.status<>'failed') or (p_action not in ('retry','back') and r.status<>'waiting_confirmation') or (p_action='back' and r.status not in ('queued','running','waiting_confirmation','failed')) then raise exception '当前阶段不能执行这个操作。'; end if;
 if p_action='revise' and btrim(coalesce(p_feedback,''))='' then raise exception '请填写修改要求。'; end if;
 if p_action='confirm' and f->>'stage'='mode' then
   select o into chosen from jsonb_array_elements(f->'options') o where o->>'id'=p_option_id;
   if chosen is null then raise exception '请选择当前候选项。'; end if;
   f:=f||jsonb_build_object('selected_mode',chosen);
 end if;
 next_stage:=case when p_action='back' then 'mode' when p_action='confirm' then case when f->>'stage'='mode' and j.payload->'module'->>'slug'<>'subject-lesson-design' then 'plan' else 'result' end else f->>'stage' end;
 -- Release this run's previous reservation only inside the transaction; a denied action rolls back.
 update public.hai_request_reservations set status='expired',expires_at=now() where request_id=r.client_request_id and user_id=r.user_id and status='active';
 -- Reserve inside this transaction: an unsuccessful or stale action cannot leave quota held.
 quota:=public.hai_check_and_reserve_usage(r.client_request_id,'hai-work',coalesce((j.payload->>'estimatedInputTokens')::integer,0),coalesce((j.payload->'completionOptions'->>'maxTokens')::integer,4096),jsonb_build_object('model',j.payload->'completionOptions'->>'model','run_id',r.id,'tool_slug',j.payload->'module'->>'slug'));
 if not coalesce((quota->>'allowed')::boolean,false) then raise exception '%',coalesce(quota->>'reason','额度不足。'); end if;
 f:=f||jsonb_build_object('history',coalesce(f->'history','[]')||jsonb_build_array((f-'attempts'-'history')||jsonb_build_object('action',p_action,'confirmed_at',now(),'feedback',p_feedback)),'stage',next_stage,'revision',p_revision+1,'feedback',case when p_action='revise' then p_feedback else '' end);
 if p_action='back' then f:=(f-'selected_mode'-'markdown'-'lessons'-'options')||jsonb_build_object('attempts',coalesce(f->'attempts','[]')||j.attempts); end if;
 if p_action='confirm' and next_stage='plan' then f:=f-'markdown'-'lessons'; end if;
 seed:='[]'::jsonb;
 if next_stage='result' and j.payload->'module'->>'slug'='unit-learning-design' then
   seed:=jsonb_build_array(jsonb_build_object('attempt',1,'purpose','confirmed_plan','markdown',f->>'markdown','estimated_input_tokens',0,'estimated_output_tokens',0,'unit_plan',jsonb_build_object('markdown',f->>'markdown','lessons',f->'lessons'),'file',jsonb_build_object('kind','unit','filename','00_单元整体设计.md','title','单元整体设计','markdown',f->>'markdown')));
 end if;
 if p_action='retry' then
   f:=f||jsonb_build_object('attempts',coalesce(f->'attempts','[]')||coalesce((select jsonb_agg(a) from jsonb_array_elements(j.attempts) a where coalesce(a->>'error','')<>'' or coalesce(a->>'markdown','')=''),'[]'::jsonb));
 end if;
 -- Retain successful lesson checkpoints when explicitly retrying final generation.
 if p_action='retry' and next_stage='result' then
   select coalesce(jsonb_agg(a order by n),'[]') into seed from jsonb_array_elements(j.attempts) with ordinality t(a,n) where coalesce(a->>'error','')='' and coalesce(a->>'markdown','')<>'';
 end if;
 update public.hai_work_jobs set payload=jsonb_set(payload,'{workflow}',f),attempts=seed,phase=case when next_stage='result' and jsonb_array_length(seed)>0 and (j.payload->'module'->>'slug'<>'unit-learning-design' or jsonb_array_length(seed)=jsonb_array_length(seed->0->'unit_plan'->'lessons')+1) then 'complete' else 'initial' end,error_message=null,lease_token=null,lease_until=null,next_dispatch_at=now(),created_at=now() where run_id=p_run_id;
 update public.hai_work_runs set status='queued',workflow_state=f-'attempts',execution_phase=next_stage,error_message=null,completed_at=null,updated_at=now() where id=p_run_id;
 update public.hai_request_reservations set expires_at=now()+interval '35 minutes' where request_id=r.client_request_id and user_id=r.user_id;
 return jsonb_build_object('runId',r.id,'taskId',r.task_id,'status','queued');
end; $$;
revoke all on function public.hai_act_workflow(uuid,integer,text,text,text) from public,anon;
grant execute on function public.hai_act_workflow(uuid,integer,text,text,text) to authenticated;

create function public.hai_finish_guided_work_job(p_run_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; result jsonb; extra_input integer; extra_output integer; total_input integer; total_output integer; last_index integer;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 if j.payload->'workflow' is null then raise exception '不是分步任务。'; end if;
 if exists(select 1 from public.hai_work_runs where id=p_run_id and status in ('completed','failed')) then
   select to_jsonb(r) into result from public.hai_work_runs r where id=p_run_id;
   return result;
 end if;
 select coalesce(sum(coalesce((a->>'call_input_tokens')::integer,(a->>'estimated_input_tokens')::integer,0)),0),
   coalesce(sum(coalesce((a->>'call_output_tokens')::integer,(a->>'estimated_output_tokens')::integer,0)),0)
   into extra_input,extra_output from jsonb_array_elements(coalesce(j.payload->'workflow'->'attempts','[]')) a where a->>'purpose' is distinct from 'confirmed_plan';
 if j.payload->'module'->>'slug'='unit-learning-design' and j.payload->'workflow'->>'stage'='result' then
   if j.attempts->0->>'purpose'='confirmed_plan' then
     update public.hai_work_jobs set attempts=jsonb_set(attempts,'{0}',(attempts->0)||jsonb_build_object('estimated_input_tokens',extra_input,'estimated_output_tokens',extra_output)) where run_id=p_run_id;
   end if;
   result:=public.hai_finish_unit_work_job(p_run_id,p_lease_token);
 else
   select extra_input+coalesce(sum(coalesce((a->>'call_input_tokens')::integer,(a->>'estimated_input_tokens')::integer,0)),0),
     extra_output+coalesce(sum(coalesce((a->>'call_output_tokens')::integer,(a->>'estimated_output_tokens')::integer,0)),0)
     into total_input,total_output from jsonb_array_elements(j.attempts) a;
   last_index:=jsonb_array_length(j.attempts)-1;
   if last_index>=0 then
     update public.hai_work_jobs set payload=jsonb_set(payload,'{estimatedInputTokens}',to_jsonb(total_input)),
       attempts=jsonb_set(attempts,array[last_index::text,'estimated_output_tokens'],to_jsonb(total_output)) where run_id=p_run_id;
   end if;
   result:=public.hai_finish_work_job(p_run_id,p_lease_token);
 end if;
 if result->>'status'='completed' then
   update public.hai_work_artifacts set content_json=content_json||jsonb_build_object('workflow',(j.payload->'workflow')-'attempts') where run_id=p_run_id;
 end if;
 return result;
end; $$;
revoke all on function public.hai_finish_guided_work_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hai_finish_guided_work_job(uuid,uuid) to service_role;
create or replace function public.hai_enqueue_work_job(p_run_id uuid, p_payload jsonb) returns void
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
  update public.hai_work_runs set execution_mode='async',execution_phase='queued',workflow_state=p_payload->'workflow' where id=p_run_id;
  -- Protect the accepted request's original quota reservation during queueing.
  -- A bounded 30-minute job lifetime still releases abandoned work.
  update public.hai_request_reservations set expires_at=now()+interval '35 minutes'
    where request_id=v_run.client_request_id and user_id=v_run.user_id;
end;
$$;

commit;
