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
 await db.exec(readFileSync(new URL('../supabase/migrations/20261101144443_hai_trusted_usage_settlement.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261101144444_hai_revoke_client_usage_settlement.sql',import.meta.url),'utf8'));
 const settle=(f, owner=user, status='completed')=>query("select public.hai_finalize_usage_service($1,$2,$3,1000,100,'hai-work')",[owner,f.request,status]);
 await check('authenticated users cannot finalize their own active reservation',async()=>{
   const f=await make(); await db.exec('set role authenticated');
   await assert.rejects(finish(f,'failed'),/permission denied/i);
   await assert.rejects(settle(f),/permission denied/i);
   await db.exec('reset role');
   assert.equal((await query('select status from hai_request_reservations where request_id=$1',[f.request]))[0].status,'active');
 });
 await check('anonymous callers cannot invoke either settlement function',async()=>{
   const f=await make(); await db.exec('set role anon');
   await assert.rejects(finish(f,'failed'),/permission denied/i);
   await assert.rejects(settle(f),/permission denied/i);
   await db.exec('reset role');
   assert.equal((await query('select status from hai_request_reservations where request_id=$1',[f.request]))[0].status,'active');
 });
 await check('service settlement charges once and restores request identity',async()=>{
   const f=await make(); await db.exec('set role service_role');
   await query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
   await settle(f); await settle(f);
   assert.equal((await query("select current_setting('request.jwt.claim.sub') sub"))[0].sub,stranger);
   await db.exec('reset role');
   assert.equal((await charge(f)).length,1);
   assert.equal((await query('select status from hai_request_reservations where request_id=$1',[f.request]))[0].status,'completed');
 });
 await check('service rejects mismatched owner and route without settlement',async()=>{
   const f=await make(); await db.exec('set role service_role');
   await assert.rejects(settle(f,stranger),/不匹配/);
   await assert.rejects(query("select public.hai_finalize_usage_service($1,$2,'completed',1,1,'hai-chat')",[user,f.request]),/不匹配/);
   await db.exec('reset role');
   assert.equal((await charge(f)).length,0);
   assert.equal((await query('select status from hai_request_reservations where request_id=$1',[f.request]))[0].status,'active');
 });
 await check('service failure finalizes once without charging',async()=>{
   const f=await make(); await db.exec('set role service_role'); await settle(f,user,'failed'); await settle(f,user,'failed'); await db.exec('reset role');
   assert.equal((await charge(f)).length,0);
   assert.equal((await query('select status from hai_request_reservations where request_id=$1',[f.request]))[0].status,'failed');
 });
 console.log(`${passed} trusted settlement SQL checks passed`);
} finally { await db.close(); }
