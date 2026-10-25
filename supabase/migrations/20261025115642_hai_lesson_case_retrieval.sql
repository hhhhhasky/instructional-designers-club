begin;

-- Internal helper, never an alternative lesson-design Skill. Publish the
-- separately generated bundle and enable explicitly after deployment/testing.
insert into public.hai_work_skills(slug,module_slug,name,description,match_criteria,priority,is_fallback,is_enabled)
values('retrieve-teaching-cases','subject-lesson-design','教学案例检索','内部调用：按教学重点与学情检索、核查案例，不独立生成教案。','{"internal_only":true}',-100,false,false)
on conflict(slug) do nothing;

create function public.hai_checkpoint_case_retrieval(
 p_run_id uuid,p_lease_token uuid,p_state jsonb,p_attempt jsonb default null,
 p_release boolean default true,p_error text default null
) returns void language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; f jsonb;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into strict r from public.hai_work_runs where id=p_run_id for update;
 f:=j.payload->'workflow';
 if r.status<>'running' or j.phase='complete' or j.payload->'caseRetrieval' is null
   or j.payload->'module'->>'slug' is distinct from 'subject-lesson-design' or f->>'version' is distinct from '2' or f->>'stage' is distinct from 'result'
   or p_lease_token is null or j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=now()
 then raise exception '案例检索执行权已失效。'; end if;
 if jsonb_typeof(p_state) is distinct from 'object' or coalesce(p_state->>'phase','') not in ('plan','search','read','review','done','failed')
   or coalesce((p_state->>'searches')::integer,-1) not between 0 and (j.payload->'caseRetrieval'->>'searches')::integer
   or coalesce((p_state->>'reads')::integer,-1) not between 0 and (j.payload->'caseRetrieval'->>'pages')::integer
 then raise exception '案例检索状态或用量不正确。'; end if;
 if coalesce((p_state->>'searches')::integer,0)<coalesce((j.payload->'caseState'->>'searches')::integer,0)
   or coalesce((p_state->>'reads')::integer,0)<coalesce((j.payload->'caseState'->>'reads')::integer,0)
 then raise exception '检索用量不能回退。'; end if;
 if p_attempt is not null then
   f:=f||jsonb_build_object('attempts',coalesce(f->'attempts','[]')||jsonb_build_array(p_attempt));
 end if;
 update public.hai_work_jobs set payload=jsonb_set(jsonb_set(payload,'{caseState}',p_state),'{workflow}',f),
   phase=case when p_error is not null then 'complete' else phase end,
   error_message=p_error,
   lease_token=case when p_release then null else lease_token end,
   lease_until=case when p_release then null else lease_until end,
   next_dispatch_at=case when p_release then now() else next_dispatch_at end
 where run_id=p_run_id;
 update public.hai_work_runs set execution_phase=case when p_error is not null then 'saving' else 'case_'||(p_state->>'phase') end,updated_at=now() where id=p_run_id;
 update public.hai_work_debug_traces set debug_trace=jsonb_set(debug_trace,'{case_retrieval}',p_state),updated_at=now() where run_id=p_run_id;
end; $$;
revoke all on function public.hai_checkpoint_case_retrieval(uuid,uuid,jsonb,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.hai_checkpoint_case_retrieval(uuid,uuid,jsonb,jsonb,boolean,text) to service_role;

commit;
