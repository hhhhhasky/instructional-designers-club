import fs from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.HAI_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const query=async(sql,params=[]) => (await db.query(sql,params)).rows;
const user='11111111-1111-4111-8111-111111111111';
const task='22222222-2222-4222-8222-222222222222';
async function fixture(seconds=150,status='active') {
 const id=crypto.randomUUID(),request='delivery-test-'+id;
 await query("insert into hai_image_generation_runs(id,task_id,user_id,client_request_id,status,r2_key,image_url,delivery_deadline_at) values($1,$2,$3,$4,'running','test-key','https://example.invalid/image',clock_timestamp()+$5*interval '1 second')",[id,task,user,request,seconds]);
 await query("insert into hai_request_reservations(request_id,user_id,route,status,metadata) values($1,$2,'hai-image-generation',$3,$4)",[request,user,status,{run_id:id,quota_mode:'points',fixed_charge_tokens:2000}]);
 return {id,request};
}
const call=async(name,id) => (await query(`select public.${name}($1) result`,[id]))[0].result;
const balance=async()=>Number((await query('select balance_tokens from hai_point_wallets where user_id=$1',[user]))[0].balance_tokens);
const ledger=async(request)=>Number((await query('select count(*) count from hai_point_transactions where request_id=$1',[request]))[0].count);
try {
 await db.exec(fs.readFileSync('supabase/tests/hai_image_delivery_local_fixture.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261014114348_hai_image_delivery_deadline.sql','utf8'));
 await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await query('insert into hai_image_generation_tasks(id,user_id,title) values($1,$2,$3)',[task,user,'local delivery test']);
 await query('insert into hai_point_wallets(user_id,balance_tokens) values($1,100000)',[user]);
 for(const status of ['active','expired']) {
  const f=await fixture(150,status),before=await balance();
  await assert.rejects(()=>call('hai_complete_image_generation_run',f.id));checks++;
  if(status==='active'){await assert.rejects(()=>query("select hai_finalize_image_generation($1,'completed')",[f.request]));checks++;}
  check(await balance(),before);check(await ledger(f.request),0);
  check((await call('hai_acknowledge_image_delivery',f.id)).status,'completed');
  check((await call('hai_acknowledge_image_delivery',f.id)).status,'completed');
  check(before-await balance(),2000);check(await ledger(f.request),1);
  check((await query("select hai_fail_image_generation_run($1,'client_delivery_failed','delivery') result",[f.id]))[0].result.status,'completed');
 }
 const expired=await fixture(-1),before=await balance();
 check((await query('select hai_expire_image_delivery_runs() count'))[0].count,1);
 check((await call('hai_acknowledge_image_delivery',expired.id)).status,'failed');
 check(await balance(),before);check(await ledger(expired.request),0);
 check((await query('select status from hai_request_reservations where request_id=$1',[expired.request]))[0].status,'failed');
 const historical=await fixture(-1);
 await query("update hai_image_generation_runs set created_at=clock_timestamp()-interval '40 days',started_at=clock_timestamp()-interval '40 days' where id=$1",[historical.id]);
 check((await query('select hai_expire_image_delivery_runs() count'))[0].count,1);
 check((await query('select status from hai_image_generation_runs where id=$1',[historical.id]))[0].status,'failed');
 check(Number((await query('select duration_ms from hai_usage_events where request_id=$1',[historical.request]))[0].duration_ms),2147483647);
 check(await ledger(historical.request),0);
 check(await balance(),before);
 const failed=await fixture();
 const closed=(await query("select hai_fail_image_generation_run($1,'r2_persistence_failed','r2_persistence',$2) result",[failed.id,{message:'storage transport error'}]))[0].result;
 check(closed.failure_code,'r2_persistence_failed');check(closed.failure_detail.message,'storage transport error');
 check((await call('hai_acknowledge_image_delivery',failed.id)).status,'failed');check(await ledger(failed.request),0);
 const poor=await fixture();await query('update hai_point_wallets set balance_tokens=0 where user_id=$1',[user]);
 const poorResult=await call('hai_acknowledge_image_delivery',poor.id);
 check(poorResult.status,'failed');check(poorResult.failure_code,'billing_failed');check(await ledger(poor.request),0);
 check(poorResult.delivered_at,null);
 await query("select set_config('request.jwt.claim.sub',$1,false)",[crypto.randomUUID()]);
 await assert.rejects(()=>call('hai_acknowledge_image_delivery',expired.id));checks++;
 await assert.rejects(()=>query("select hai_fail_image_generation_run($1)",[expired.id]));checks++;
 check((await query("select has_function_privilege('anon','hai_acknowledge_image_delivery(uuid)','execute') allowed"))[0].allowed,false);
 check((await query("select has_function_privilege('authenticated','hai_close_image_generation_failure(uuid,text,text,jsonb)','execute') allowed"))[0].allowed,false);
 check((await query("select has_function_privilege('authenticated','hai_expire_image_delivery_runs()','execute') allowed"))[0].allowed,false);
 check((await query("select has_function_privilege('anon','hai_complete_image_generation_run(uuid)','execute') allowed"))[0].allowed,false);
 check((await query("select has_function_privilege('anon','hai_finalize_image_generation(text,text,text,uuid,integer,jsonb)','execute') allowed"))[0].allowed,false);
 console.log(`PASS: ${checks} database assertions; acknowledgement-only debit, replay, failure finality, expiry cleanup, billing rollback, owner isolation and role grants`);
} finally { await db.close(); }
