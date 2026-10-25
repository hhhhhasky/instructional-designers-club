import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.HAI_PGLITE_MODULE).href);
const db = new PGlite(); let passed=0;
const user=crypto.randomUUID(), stranger=crypto.randomUUID();
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const check=async(name,fn) => { await fn(); passed++; console.log('ok '+name); };
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'')='yes'$$;
 create table profiles(id uuid primary key);
 create table hai_runtime_settings(key text primary key,label text,description text,category text,value jsonb,default_value jsonb,value_type text,min_value numeric,max_value numeric,step numeric,unit text,enabled boolean default true,updated_at timestamptz default now());
 insert into hai_runtime_settings(key,value) values('points.cny_per_point','0.1'),('points.tokens_per_point','1000');
 create function public.hai_runtime_numeric(k text,f numeric) returns numeric language sql as $$select coalesce((select (value#>>'{}')::numeric from public.hai_runtime_settings where key=k and enabled),f)$$;
 create table hai_work_runs(id uuid primary key,user_id uuid,client_request_id text,status text);
 create table hai_work_jobs(run_id uuid primary key,payload jsonb,phase text,lease_token uuid,lease_until timestamptz);
 create table hai_request_reservations(id uuid default gen_random_uuid(),request_id text primary key,user_id uuid,status text,route text,metadata jsonb,expires_at timestamptz,completed_at timestamptz,actual_input_tokens integer,actual_output_tokens integer);
 create table hai_point_wallets(user_id uuid primary key,balance_tokens bigint,total_consumed_tokens bigint default 0);
 create table hai_point_transactions(user_id uuid,transaction_type text,token_delta bigint,points_delta numeric,tokens_per_point integer,request_id text,reason text,metadata jsonb);
 create table hai_model_calls(request_id text,model text,status text,usage_status text,prompt_tokens bigint,completion_tokens bigint,total_tokens bigint,cache_hit_tokens bigint,cache_miss_tokens bigint);
 create table hai_usage_events(user_id uuid,request_id text,event_type text,route text,status text,entity_type text,entity_id uuid,input_tokens integer,output_tokens integer,total_tokens integer,duration_ms integer,metadata jsonb);`);
 await query('insert into profiles values($1),($2)',[user,stranger]);
 await query('insert into hai_point_wallets(user_id,balance_tokens) values($1,1000000)',[user]);
 await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025152622_hai_web_tool_billing.sql',import.meta.url),'utf8'));
 async function make() {
  const id=crypto.randomUUID(), lease=crypto.randomUUID(), request=crypto.randomUUID();
  await query("insert into hai_work_runs values($1,$2,$3,'running')",[id,user,request]);
  await query("insert into hai_work_jobs values($1,$2,'initial',$3,now()+interval '90 seconds')",[id,JSON.stringify({caseRetrieval:{billing_version:1,searches:2,pages:3},caseState:{searches:1,reads:1}}),lease]);
  await query("insert into hai_request_reservations(request_id,user_id,status,route,metadata,expires_at) values($1,$2,'active','hai-work','{\"quota_mode\":\"points\",\"points_reserved_equivalent_tokens\":100}',now()+interval '10 minutes')",[request,user]);
  return {id,lease,request};
 }
 const prepare=f=>query('select hai_prepare_web_tool_billing($1,$2)',[f.id,f.lease]);
 const receipt=(f,kind,n=1)=>query('select hai_record_web_tool_success($1,$2,$3,$4)',[f.id,f.lease,kind,n]);
 const finish=(f,status='completed',input=0,output=0)=>query("select hai_finalize_usage($1,$2,$3,$4,'hai-work')",[f.request,status,input,output]);
 const charge=f=>query('select * from hai_point_transactions where request_id=$1',[f.request]);
 await check('按1积分0.01元，检索与抓取各5元/1000次',async()=>{
  assert.equal((await query("select (value#>>'{}')::numeric amount from hai_runtime_settings where key='points.cny_per_point'"))[0].amount,'0.01');
  const f=await make(); await prepare(f); await receipt(f,'search'); await receipt(f,'fetch'); await finish(f);
  const tx=(await charge(f))[0]; assert.equal(Number(tx.points_delta),-1); assert.equal(Number(tx.token_delta),-1000);
  assert.equal(Number(tx.metadata.web_search_successes),1); assert.equal(Number(tx.metadata.web_fetch_successes),1); assert.equal(Number(tx.metadata.web_tool_cost_cny),0.01);
 });
 await check('成功按次计量并去重，结算重试也只扣一次',async()=>{
  const f=await make(); await prepare(f); await receipt(f,'search'); await receipt(f,'search'); await finish(f); await finish(f);
  assert.equal((await charge(f)).length,1); assert.equal(Number((await charge(f))[0].points_delta),-0.5);
 });
 await check('没有成功回执的尝试、失败与无结果不扣服务费',async()=>{
  const f=await make(); await prepare(f); await finish(f);
  assert.equal(Number((await charge(f))[0].token_delta),0);
 });
 await check('即使服务成功，整体任务失败仍按既有政策不扣费',async()=>{
  const f=await make(); await prepare(f); await receipt(f,'fetch'); await finish(f,'failed');
  assert.equal((await charge(f)).length,0);
 });
 await check('外部服务费用与原模型费用统一相加',async()=>{
  const f=await make(); await prepare(f); await receipt(f,'search'); await receipt(f,'fetch'); await finish(f,'completed',1000,100);
  assert.equal(Number((await charge(f))[0].token_delta),-2300);
 });
 await check('价格变更不追改在途任务，新任务使用新价格',async()=>{
  const f=await make(); await prepare(f);
  await query("update hai_runtime_settings set value='10' where key='points.web_search_cny_per_1000'");
  await receipt(f,'search'); await finish(f); assert.equal(Number((await charge(f))[0].points_delta),-0.5);
  const next=await make(); await prepare(next); await receipt(next,'search'); await finish(next); assert.equal(Number((await charge(next))[0].points_delta),-1);
  await query("update hai_runtime_settings set value='5' where key='points.web_search_cny_per_1000'");
 });
 await check('为最大检索预算预留积分，重复准备不叠加预留',async()=>{
  const f=await make(); await prepare(f); await prepare(f);
  const res=(await query('select metadata from hai_request_reservations where request_id=$1',[f.request]))[0];
  assert.equal(Number(res.metadata.web_tool_reserved_tokens),2500); assert.equal(Number(res.metadata.points_reserved_equivalent_tokens),2600);
 });
 await check('余额不足时拒绝检索，事务不留下价格快照或费用',async()=>{
  const f=await make(); const previous=(await query('select balance_tokens from hai_point_wallets where user_id=$1',[user]))[0].balance_tokens;
  await query('update hai_point_wallets set balance_tokens=1 where user_id=$1',[user]); await assert.rejects(prepare(f),/积分不足/);
  assert.equal((await query('select payload from hai_work_jobs where run_id=$1',[f.id]))[0].payload.caseBilling,undefined);
  await query('update hai_point_wallets set balance_tokens=$2 where user_id=$1',[user,previous]);
 });
 await check('内部积分计量缩放后，预留与实际服务积分保持不变',async()=>{
  const f=await make(); await prepare(f);
  await query("update hai_runtime_settings set value='2000' where key='points.tokens_per_point'");
  await query("update hai_request_reservations set metadata=jsonb_set(metadata,'{points_reserved_equivalent_tokens}','5200') where request_id=$1",[f.request]);
  await prepare(f);
  assert.equal(Number((await query('select metadata from hai_request_reservations where request_id=$1',[f.request]))[0].metadata.points_reserved_equivalent_tokens),5200);
  await receipt(f,'search'); await finish(f);
  assert.equal(Number((await charge(f))[0].points_delta),-0.5); assert.equal(Number((await charge(f))[0].token_delta),-1000);
  await query("update hai_runtime_settings set value='1000' where key='points.tokens_per_point'");
 });
 await check('普通用户不能写成功记录、不能改价；管理员改价原子校验',async()=>{
  const f=await make(); await prepare(f);
  await db.exec('set role authenticated'); await assert.rejects(receipt(f,'search')); await assert.rejects(query('select hai_update_web_tool_prices(3,4)')); await db.exec('reset role');
  await query("select set_config('test.admin','yes',false)");
  await assert.rejects(query('select hai_update_web_tool_prices(3,-1)')); assert.equal(Number((await query("select value from hai_runtime_settings where key='points.web_search_cny_per_1000'"))[0].value),5);
  await query('select hai_update_web_tool_prices(3,4)'); await query('select hai_update_web_tool_prices(5,5)'); await query("select set_config('test.admin','no',false)");
 });
 await check('旧任务不能补记费用，越界请求编号与过期租约被拒绝',async()=>{
  const f=await make(); await prepare(f); await assert.rejects(receipt(f,'search',2));
  await query("update hai_work_jobs set lease_until=now()-interval '1 second' where run_id=$1",[f.id]); await assert.rejects(receipt(f,'search'));
  const legacy=await make(); await query("update hai_work_jobs set payload=jsonb_set(payload,'{caseRetrieval}','{}') where run_id=$1",[legacy.id]); await assert.rejects(prepare(legacy));
 });
 await check('用户仅能读取自己的成功记录',async()=>{
  const f=await make(); await prepare(f); await receipt(f,'search');
  await query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]); await db.exec('set role authenticated');
  assert.equal((await query('select * from hai_web_tool_calls')).length,0);
  await db.exec('reset role'); await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 });
 console.log(`${passed} billing SQL checks passed`);
} finally { await db.close(); }
