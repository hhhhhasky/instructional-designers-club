import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.HAI_PGLITE_MODULE).href);
const db = new PGlite();
const id = '10000000-0000-0000-0000-000000000001';
const lease = '20000000-0000-0000-0000-000000000001';
const sql = readFileSync(new URL('../supabase/migrations/20261025115642_hai_lesson_case_retrieval.sql', import.meta.url), 'utf8');
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`ok ${name}`); };
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table hai_work_skills(slug text unique,module_slug text,name text,description text,match_criteria jsonb,priority integer,is_fallback boolean,is_enabled boolean);
    create table hai_work_jobs(run_id uuid primary key,payload jsonb,phase text,error_message text,lease_token uuid,lease_until timestamptz,next_dispatch_at timestamptz);
    create table hai_work_runs(id uuid primary key,status text,execution_phase text,updated_at timestamptz);
    create table hai_work_debug_traces(run_id uuid primary key,debug_trace jsonb,updated_at timestamptz);`);
  await db.exec(sql);
  const reset = async () => {
    await db.exec('truncate hai_work_jobs,hai_work_runs,hai_work_debug_traces');
    await db.query("insert into hai_work_runs(id,status) values($1,'running')", [id]);
    await db.query("insert into hai_work_debug_traces values($1,'{}',now())", [id]);
    await db.query("insert into hai_work_jobs(run_id,payload,phase,lease_token,lease_until) values($1,$2,'initial',$3,now()+interval '90 seconds')", [id, JSON.stringify({ module: { slug: 'subject-lesson-design' }, workflow: { version: 2, stage: 'result' }, caseRetrieval: { searches: 2, pages: 3 } }), lease]);
  };
  const state = { phase: 'search', searches: 1, reads: 0 };
  const save = (s, release = true, token = lease, attempt = null, error = null) => db.query('select hai_checkpoint_case_retrieval($1,$2,$3,$4,$5,$6)', [id, token, JSON.stringify(s), attempt && JSON.stringify(attempt), release, error]);
  const job = async () => (await db.query('select * from hai_work_jobs where run_id=$1', [id])).rows[0];
  await check('辅助Skill默认禁用，避免未部署时启用', async () => assert.equal((await db.query("select is_enabled from hai_work_skills where slug='retrieve-teaching-cases'")).rows[0].is_enabled, false));
  await check('预存用量保留租约，完成后释放并调度下一步', async () => {
    await reset(); await save(state, false); assert.equal((await job()).lease_token, lease);
    await save({ ...state, phase: 'read' }); const j = await job();
    assert.equal(j.lease_token, null); assert.equal(j.payload.caseState.searches, 1);
  });
  await check('拒绝失效租约且状态不变', async () => {
    await reset(); await assert.rejects(save(state, true, '30000000-0000-0000-0000-000000000001'));
    assert.equal((await job()).payload.caseState, undefined);
    await db.exec("update hai_work_jobs set lease_until=now()-interval '1 second'"); await assert.rejects(save(state));
  });
  await check('不能突破或回退任务预算', async () => {
    await reset(); await save(state, false); await assert.rejects(save({ ...state, searches: 3 }));
    await assert.rejects(save({ ...state, searches: 0 })); await assert.rejects(save({ ...state, reads: 4 }));
    assert.equal((await job()).payload.caseState.searches, 1);
  });
  await check('只允许四步公开课的最终生成阶段执行', async () => {
    await reset(); await db.exec("update hai_work_jobs set payload=payload-'workflow'"); await assert.rejects(save(state));
    await reset(); await db.exec("update hai_work_jobs set payload=jsonb_set(payload,'{workflow,stage}','\"mode\"')"); await assert.rejects(save(state));
  });
  await check('模型用量进入既有阶段账本，失败保留证据和错误', async () => {
    await reset(); await save(state, true, lease, { purpose: 'case_plan', call_input_tokens: 321, call_output_tokens: 45 }, '搜索中断');
    const j = await job(); assert.equal(j.phase, 'complete'); assert.equal(j.error_message, '搜索中断');
    assert.equal(j.payload.workflow.attempts[0].call_input_tokens, 321); assert.equal(j.payload.caseState.searches, 1);
  });
  await check('普通登录用户与匿名用户不能调用服务端保存函数', async () => {
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(save(state)); await db.exec('reset role');
    }
  });
  console.log(`${passed} SQL checks passed`);
} finally { await db.close(); }
