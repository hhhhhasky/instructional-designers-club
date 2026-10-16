// Isolated database only. Uses the real migration and existing billing function.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.HAI_PGLITE_MODULE;
if (!modulePath) throw new Error('Set HAI_PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const checks = [];
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const user = crypto.randomUUID();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
async function check(name, fn) { await fn(); checks.push(name); }
const fnSql = (sql, name) => sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'))[0];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema net; create schema cron;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function public.is_admin() returns boolean language sql as $$select false$$;
  create function public.hai_has_access(uuid) returns boolean language sql as $$select true$$;
  create function public.hai_runtime_numeric(text,numeric) returns numeric language sql as $$select $2$$;
  create table profiles(id uuid primary key);
  create table hai_work_tasks(id uuid primary key,user_id uuid,title text,module_slug text,latest_artifact_id uuid,updated_at timestamptz default now());
  create table hai_work_runs(id uuid primary key default gen_random_uuid(),task_id uuid references hai_work_tasks,user_id uuid,client_request_id text,
    status text default 'queued',skill_version_id uuid,input_snapshot jsonb,skill_snapshot jsonb,revision_instruction text,parent_artifact_id uuid,input_tokens integer,output_tokens integer,duration_ms integer,
    started_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),completed_at timestamptz,error_message text,
    unique(user_id,client_request_id));
  create table hai_work_artifacts(id uuid primary key default gen_random_uuid(),task_id uuid,run_id uuid unique,user_id uuid,parent_artifact_id uuid,
    version_number integer,title text,content_json jsonb,content_markdown text,unique(task_id,version_number));
  create table hai_work_debug_traces(run_id uuid primary key,user_id uuid,debug_trace jsonb default '{"events":[],"model_attempts":[]}',updated_at timestamptz);
  create table hai_request_reservations(id uuid default gen_random_uuid(),request_id text primary key,user_id uuid,route text,status text default 'active',
    metadata jsonb default '{}',actual_input_tokens integer,actual_output_tokens integer,expires_at timestamptz default now()+interval '5 minutes',completed_at timestamptz);
  create table hai_point_wallets(user_id uuid primary key,balance_tokens bigint,total_consumed_tokens bigint default 0);
  create table hai_model_calls(request_id text,call_index integer,model text,status text,usage_status text,prompt_tokens bigint,completion_tokens bigint,total_tokens bigint,
    cache_hit_tokens bigint,cache_miss_tokens bigint,reasoning_tokens bigint,visible_output_tokens bigint,total_cost numeric,currency text,unique(request_id,call_index));
  create table hai_point_transactions(user_id uuid,transaction_type text,token_delta bigint,points_delta numeric,tokens_per_point integer,request_id text,reason text,metadata jsonb);
  create table hai_usage_events(user_id uuid,request_id text,event_type text,route text,status text,entity_type text,entity_id uuid,input_tokens integer,
    output_tokens integer,total_tokens integer,duration_ms integer,metadata jsonb,
    actual_prompt_tokens bigint,actual_cache_hit_tokens bigint,actual_cache_miss_tokens bigint,actual_completion_tokens bigint,
    actual_reasoning_tokens bigint,actual_visible_output_tokens bigint,actual_total_tokens bigint,actual_cost numeric,actual_currency text,actual_usage_status text);
  create table net.requests(body jsonb,headers jsonb);
  create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.requests values(body,headers); return 1; end$$;
  create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
  await db.exec(fnSql(read('20260829124258_hai_weighted_equivalent_token_billing.sql'), 'hai_finalize_usage'));
  await db.exec(read('20261016020951_hai_work_async_jobs.sql'));
  await query('insert into profiles values($1)', [user]);
  await query('insert into hai_point_wallets(user_id,balance_tokens) values($1,1000000)', [user]);
  await query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await query("insert into hai_work_scheduler_config values(true,'https://test.supabase.co/functions/v1/hai-work-worker',repeat('s',32),true)");

  const make = async ({ taskId = crypto.randomUUID(), legacy = false, requestId = crypto.randomUUID() } = {}) => {
    const runId = crypto.randomUUID();
    await query("insert into hai_work_tasks(id,user_id,title,module_slug) values($1,$2,'test','lesson-diagnosis') on conflict do nothing", [taskId,user]);
    await query("insert into hai_work_runs(id,task_id,user_id,client_request_id) values($1,$2,$3,$4)", [runId,taskId,user,requestId]);
    await query("insert into hai_work_debug_traces(run_id,user_id) values($1,$2)", [runId,user]);
    await query("insert into hai_request_reservations(request_id,user_id,route,metadata) values($1,$2,'hai-work','{\"quota_mode\":\"points\",\"model\":\"deepseek-v4-flash\"}')", [requestId,user]);
    if (!legacy) await query('select hai_enqueue_work_job($1,$2)', [runId,JSON.stringify({title:'test artifact',artifactKind:'diagnosis_report',estimatedInputTokens:10,module:{slug:'lesson-diagnosis'},completionOptions:{model:'deepseek-v4-flash'}})]);
    return {runId,taskId,requestId};
  };
  const claim = async (id) => (await query('select hai_claim_work_job($1) as job', [id]))[0].job;
  const checkpoint = (job, attempt) => query('select hai_checkpoint_work_job($1,$2,$3)', [job.run_id,job.lease_token,JSON.stringify(attempt)]);
  const finish = (job) => query('select hai_finish_work_job($1,$2)', [job.run_id,job.lease_token]);
  const good = {markdown:'# saved answer',raw_output:'# saved answer',estimated_output_tokens:20};

  await check('normal users cannot read worker secrets/prompts or invoke service RPCs', async () => {
    for (const role of ['anon','authenticated']) {
      for (const fn of ['hai_prepare_work_run(uuid,text,uuid,text,text,jsonb)','hai_claim_work_job(uuid)','hai_enqueue_work_job(uuid,jsonb)','hai_heartbeat_work_job(uuid,uuid)','hai_checkpoint_work_job(uuid,uuid,jsonb)','hai_finish_work_job(uuid,uuid)','hai_work_queue_ready()','hai_dispatch_work_jobs()']) {
        assert.equal((await query('select has_function_privilege($1,$2,\'execute\') as ok',[role,fn]))[0].ok,false);
      }
      for (const table of ['hai_work_jobs','hai_work_scheduler_config']) {
        assert.equal((await query('select has_table_privilege($1,$2,\'select\') as ok',[role,table]))[0].ok,false);
      }
    }
    assert.equal((await query("select relrowsecurity from pg_class where relname='hai_work_jobs'"))[0].relrowsecurity,true);
  });
  await check('repeated submission returns the same run and creates no orphan task', async () => {
    const id=crypto.randomUUID(); const before=(await query('select count(*)::int as n from hai_work_tasks'))[0].n;
    const params=[user,id,null,'test','lesson-diagnosis',JSON.stringify({input_snapshot:{},skill_snapshot:{}})];
    const first=(await query('select hai_prepare_work_run($1,$2,$3,$4,$5,$6) as run',params))[0].run;
    const second=(await query('select hai_prepare_work_run($1,$2,$3,$4,$5,$6) as run',params))[0].run;
    assert.equal(first.id,second.id); assert.equal(second.replayed,true);
    assert.equal((await query('select count(*)::int as n from hai_work_tasks'))[0].n,before+1);
  });
  await check('accepted job survives 3-minute cleanup, legacy stuck requests are still closed', async () => {
    const a = await make(); const legacy = await make({legacy:true});
    await query("update hai_work_runs set created_at=now()-interval '5 minutes' where id=any($1::uuid[])",[[a.runId,legacy.runId]]);
    assert.equal((await query('select hai_mark_stale_work_runs() as n'))[0].n,1);
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'queued');
  });
  await check('lease excludes a duplicate worker and heartbeat keeps long-lived work valid', async () => {
    const a=await make(); const j=await claim(a.runId);
    assert.equal(await claim(a.runId),null);
    await query("update hai_work_runs set started_at=now()-interval '8 minutes' where id=$1",[a.runId]);
    assert.equal((await query('select hai_heartbeat_work_job($1,$2) as ok',[a.runId,j.lease_token]))[0].ok,true);
    await query('select hai_mark_stale_work_runs()');
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'running');
    await checkpoint(j,good); const saved=await claim(a.runId); await finish(saved);
  });
  await check('empty initial response schedules a separate repair; each attempt is checkpointed', async () => {
    const a=await make(); await checkpoint(await claim(a.runId),{markdown:'',raw_output:''});
    const repair=await claim(a.runId); assert.equal(repair.phase,'repair');
    await checkpoint(repair,good); assert.equal((await claim(a.runId)).phase,'complete');
  });
  await check('expired model lease reports interruption and never reruns a paid call', async () => {
    const a=await make(); const old=await claim(a.runId);
    await query("update hai_work_jobs set lease_until=now()-interval '1 second' where run_id=$1",[a.runId]);
    const next=await claim(a.runId); assert.equal(next.phase,'complete');
    await assert.rejects(checkpoint(old,good),/执行权已失效/);
    await finish(next);
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'failed');
    assert.equal((await query('select count(*)::int as n from hai_point_transactions where request_id=$1',[a.requestId]))[0].n,0);
  });
  await check('saved result survives worker loss; completion is atomic and settles once', async () => {
    const a=await make(); await checkpoint(await claim(a.runId),good); const old=await claim(a.runId);
    await query("update hai_work_jobs set lease_until=now()-interval '1 second' where run_id=$1",[a.runId]);
    const next=await claim(a.runId); assert.equal(next.phase,'complete');
    await assert.rejects(finish(old),/执行权已失效/);
    await query("update hai_request_reservations set status='expired' where request_id=$1",[a.requestId]);
    await query("insert into hai_model_calls(request_id,call_index,model,status,usage_status,prompt_tokens,completion_tokens,total_tokens,cache_hit_tokens,cache_miss_tokens) values($1,1,'deepseek-v4-flash','completed','provider',10,20,30,0,10)",[a.requestId]);
    await finish(next); await finish(next);
    assert.equal((await query('select count(*)::int as n from hai_work_artifacts where run_id=$1',[a.runId]))[0].n,1);
    const tx=await query('select token_delta from hai_point_transactions where request_id=$1',[a.requestId]);
    assert.equal(tx.length,1); assert.equal(Number(tx[0].token_delta),-70);
    const usage=(await query("select actual_total_tokens,actual_usage_status from hai_usage_events where request_id=$1",[a.requestId]))[0];
    assert.equal(Number(usage.actual_total_tokens),30); assert.equal(usage.actual_usage_status,"actual");
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'completed');
  });
  await check('billing failure rolls back artifact, latest version and completed status, retry reuses output', async () => {
    const a=await make(); await checkpoint(await claim(a.runId),good); const job=await claim(a.runId);
    await db.exec(`create function fail_work_billing() returns trigger language plpgsql as $$begin raise exception 'injected ledger outage'; end$$;
      create trigger billing_outage before insert on hai_point_transactions for each row execute function fail_work_billing();`);
    await assert.rejects(finish(job),/injected ledger outage/);
    assert.equal((await query('select count(*)::int as n from hai_work_artifacts where run_id=$1',[a.runId]))[0].n,0);
    assert.equal((await query('select latest_artifact_id from hai_work_tasks where id=$1',[a.taskId]))[0].latest_artifact_id,null);
    await db.exec('drop trigger billing_outage on hai_point_transactions');
    await finish(job);
    assert.equal((await query('select count(*)::int as n from hai_point_transactions where request_id=$1',[a.requestId]))[0].n,1);
  });
  await check('same-task revisions receive distinct versions without replacing older artifacts', async () => {
    const taskId=crypto.randomUUID();
    for (let i=0;i<2;i++) { const a=await make({taskId}); await checkpoint(await claim(a.runId),good); await finish(await claim(a.runId)); }
    assert.deepEqual((await query('select version_number from hai_work_artifacts where task_id=$1 order by version_number',[taskId])).map(x=>x.version_number),[1,2]);
  });
  await check('cron redelivers a lost wakeup without losing the database job', async () => {
    const a=await make(); await query('select hai_dispatch_work_jobs()');
    assert.ok((await query('select body from net.requests')).some(x=>x.body.runId===a.runId));
    await query("update hai_work_jobs set next_dispatch_at=now()-interval '1 second' where run_id=$1",[a.runId]);
    await query('select hai_dispatch_work_jobs()');
    assert.equal((await query("select count(*)::int as n from net.requests where body->>'runId'=$1",[a.runId]))[0].n,2);
  });
  await check('a saved answer is recoverable after a long scheduler outage instead of being discarded as expired', async () => {
    const a=await make(); await checkpoint(await claim(a.runId),good);
    await query("update hai_work_jobs set created_at=now()-interval '40 minutes' where run_id=$1",[a.runId]);
    await query("update hai_request_reservations set status='expired' where request_id=$1",[a.requestId]);
    const job=await claim(a.runId); assert.equal(job.phase,'complete'); assert.equal(job.error_message,null);
    await finish(job);
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'completed');
  });
  await check('service-only completion works after the browser login expires and restores auth context', async () => {
    const a=await make(); await checkpoint(await claim(a.runId),good); const job=await claim(a.runId);
    await query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role service_role');
    await finish(job);
    assert.equal((await query("select current_setting('request.jwt.claim.sub') as sub"))[0].sub,'');
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'completed');
  });
  await check('expired queue is finalized as failure, not retained forever', async () => {
    const a=await make(); await query("update hai_work_jobs set created_at=now()-interval '31 minutes' where run_id=$1",[a.runId]);
    const j=await claim(a.runId); assert.equal(j.phase,'complete'); await finish(j);
    assert.equal((await query('select status from hai_work_runs where id=$1',[a.runId]))[0].status,'failed');
  });
  console.log(JSON.stringify({database:'isolated PostgreSQL (PGlite)',passed:checks.length,checks},null,2));
} finally { await db.close(); }
