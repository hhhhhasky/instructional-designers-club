-- Extend the existing owner/revision/lease protected workflow; old runs retain v1 semantics.
begin;
CREATE OR REPLACE FUNCTION public.hai_checkpoint_workflow(p_run_id uuid, p_lease_token uuid, p_attempt jsonb, p_result jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; f jsonb;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into strict r from public.hai_work_runs where id=p_run_id for update;
 f:=j.payload->'workflow';
 if r.status<>'running' or f is null or f->>'stage' not in ('focus','mode','plan') or p_lease_token is null or j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=now() then raise exception '阶段执行权已失效。'; end if;
 if f->>'stage'='focus' and (f->>'version'<>'2' or j.payload->'module'->>'slug'<>'subject-lesson-design') then raise exception '当前任务不支持教学重点确认。'; end if;
 if f->>'stage'='focus' and (jsonb_typeof(p_result->'options') is distinct from 'array' or jsonb_array_length(p_result->'options') not between 1 and 3) then raise exception '教学重点候选不完整。'; end if;
 if f->>'stage'='mode' and (jsonb_typeof(p_result->'options') is distinct from 'array' or jsonb_array_length(p_result->'options') not between 2 and 3) then raise exception '候选模式不完整。'; end if;
 if f->>'stage'='plan' and coalesce(p_result->>'markdown','')='' then raise exception '整体设计不完整。'; end if;
 if f->>'stage' in ('focus','mode') then
   if exists(select 1 from jsonb_array_elements(p_result->'options') o where
     jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string' or btrim(o->>'id')='' or
     jsonb_typeof(o->'title') is distinct from 'string' or btrim(o->>'title')='' or
     jsonb_typeof(o->'reason') is distinct from 'string' or btrim(o->>'reason')='' or
     jsonb_typeof(o->'approach') is distinct from 'string' or btrim(o->>'approach')='' or
     greatest(length(o->>'id'),length(o->>'title'),length(o->>'reason'),length(o->>'approach'))>4000)
     or (select count(distinct o->>'id') from jsonb_array_elements(p_result->'options') o)<>jsonb_array_length(p_result->'options') then raise exception '候选内容不完整或标识重复。'; end if;
   p_result:=jsonb_build_object('options',p_result->'options');
 end if;
 f := f || p_result || jsonb_build_object('attempts',coalesce(f->'attempts','[]')||jsonb_build_array(p_attempt));
 update public.hai_work_jobs set payload=jsonb_set(payload,'{workflow}',f),attempts='[]',phase='initial',lease_token=null,lease_until=null,next_dispatch_at='infinity' where run_id=p_run_id;
 update public.hai_work_runs set status='waiting_confirmation',execution_phase=f->>'stage',workflow_state=f-'attempts',updated_at=now() where id=p_run_id;
 -- Waiting for a teacher holds neither a worker nor a quota reservation.
 update public.hai_request_reservations set status='expired',expires_at=now() where request_id=r.client_request_id and user_id=r.user_id and status='active';
end; $function$;

CREATE OR REPLACE FUNCTION public.hai_act_workflow(p_run_id uuid, p_revision integer, p_action text, p_option_id text DEFAULT NULL::text, p_feedback text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if p_action='confirm' and f->>'stage' not in ('focus','mode','plan') then raise exception '当前阶段不能确认。'; end if;
 if p_action='confirm' and f->>'stage' in ('focus','mode') then
   select o into chosen from jsonb_array_elements(f->'options') o where o->>'id'=p_option_id;
   if chosen is null then raise exception '请选择当前候选项。'; end if;
   f:=f||jsonb_build_object(case when f->>'stage'='focus' then 'selected_focus' else 'selected_mode' end,chosen);
 end if;
 if f->>'version'='2' and j.payload->'module'->>'slug'='subject-lesson-design' then
   if f->>'stage' not in ('focus','mode','result') then raise exception '公开课阶段无效。'; end if;
   if f->>'stage' in ('mode','result') and f->'selected_focus' is null then raise exception '请先确认教学重点。'; end if;
   if f->>'stage'='result' and f->'selected_mode' is null then raise exception '请先确认教学模式。'; end if;
   if p_action='back' and f->>'stage'='focus' then raise exception '已经是教学重点阶段。'; end if;
   next_stage:=case when p_action='back' then case when f->>'stage'='mode' then 'focus' else 'mode' end
      when p_action='confirm' then case when f->>'stage'='focus' then 'mode' else 'result' end else f->>'stage' end;
 else
   next_stage:=case when p_action='back' then 'mode' when p_action='confirm' then case when f->>'stage'='mode' and j.payload->'module'->>'slug'<>'subject-lesson-design' then 'plan' else 'result' end else f->>'stage' end;
 end if;
 -- Release this run's previous reservation only inside the transaction; a denied action rolls back.
 update public.hai_request_reservations set status='expired',expires_at=now() where request_id=r.client_request_id and user_id=r.user_id and status='active';
 -- Reserve inside this transaction: an unsuccessful or stale action cannot leave quota held.
 quota:=public.hai_check_and_reserve_usage(r.client_request_id,'hai-work',coalesce((j.payload->>'estimatedInputTokens')::integer,0),coalesce((j.payload->'completionOptions'->>'maxTokens')::integer,4096),jsonb_build_object('model',j.payload->'completionOptions'->>'model','run_id',r.id,'tool_slug',j.payload->'module'->>'slug'));
 if not coalesce((quota->>'allowed')::boolean,false) then raise exception '%',coalesce(quota->>'reason','额度不足。'); end if;
 f:=f||jsonb_build_object('history',coalesce(f->'history','[]')||jsonb_build_array((f-'attempts'-'history')||jsonb_build_object('action',p_action,'confirmed_at',now(),'feedback',p_feedback)),'stage',next_stage,'revision',p_revision+1,'feedback',case when p_action='revise' then p_feedback else '' end);
 if p_action='back' then f:=(f-'selected_mode'-'markdown'-'lessons'-'options')||jsonb_build_object('attempts',coalesce(f->'attempts','[]')||j.attempts); end if;
 if f->>'version'='2' and j.payload->'module'->>'slug'='subject-lesson-design' then
   if p_action in ('confirm','revise','back') then f:=f-'options'; end if;
   if p_action in ('revise','back') then
     f:=f-'selected_mode';
     if next_stage='focus' then f:=f-'selected_focus'; end if;
   end if;
 end if;
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
end; $function$;

revoke all on function public.hai_checkpoint_workflow(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hai_checkpoint_workflow(uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function public.hai_act_workflow(uuid,integer,text,text,text) from public,anon;
grant execute on function public.hai_act_workflow(uuid,integer,text,text,text) to authenticated;
commit;
