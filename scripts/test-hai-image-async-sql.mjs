// Run against isolated PostgreSQL WASM, never a Supabase project.
// npm install --prefix /tmp/hai-async-sql-validation --no-save @electric-sql/pglite@0.3.14
// HAI_PGLITE_MODULE=/tmp/hai-async-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-hai-image-async-sql.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.HAI_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const tables = (sql, names) => names.map((name) => sql.match(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`))[0]).join('\n');
const deadlineSql = read('20261014114348_hai_image_delivery_deadline.sql');
const functionSql = (sql, name) => sql.slice(sql.indexOf(`create or replace function public.${name}(`)).split('$$;')[0] + '$$;';
const user = '11111111-1111-4111-8111-111111111111';
const task = '22222222-2222-4222-8222-222222222222';
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
async function rpc(sql, params = []) {
  await db.exec('set role authenticated');
  try { return await db.query(sql, params); }
  finally { await db.exec('reset role'); }
}
async function fixture(key, {metadata = {execution_mode: 'provider_async'}, deadline = null, status = 'running', reservation = 'active', ready = true} = {}) {
  const id = crypto.randomUUID();
  await db.query(`insert into hai_image_generation_runs(id, task_id, user_id, client_request_id, status, prompt, composed_prompt, image_size, art_style, image_type, metadata, delivery_deadline_at, r2_key, image_url, created_at)
    values($1,$2,$3,$4,$5,'test','test','16:9','test','test',$6,$7,$8,$9, now()-interval '10 minutes')`,
  [id, task, user, key, status, JSON.stringify(metadata), deadline, ready ? `images/${id}.png` : null, ready ? 'https://image.example/image.png' : null]);
  await db.query(`insert into hai_request_reservations(user_id, request_id, route, status, metadata)
    values($1,$2,'hai-image-generation',$3,$4)`, [user, key, reservation, JSON.stringify({run_id: id, quota_mode: 'points', fixed_charge_tokens: 2000})]);
  return id;
}
async function acknowledge(id) { return (await rpc('select hai_acknowledge_image_delivery($1) as run', [id])).rows[0].run; }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table profiles(id uuid primary key);`);
  await db.exec(tables(read('20260907040414_hai_image_generation.sql'), ['hai_image_generation_tasks', 'hai_image_generation_runs']));
  await db.exec(tables(read('20260703090000_hai_workspace.sql'), ['hai_request_reservations', 'hai_usage_events']));
  await db.exec(tables(read('20260829045719_hai_points_wallet.sql'), ['hai_point_wallets', 'hai_point_transactions']));
  await db.exec(deadlineSql.slice(deadlineSql.indexOf('alter table'), deadlineSql.indexOf('-- Internal close')));
  await db.exec(`create function hai_runtime_numeric(text,numeric) returns numeric language sql as $$select $2$$;
    create function hai_ensure_points_wallet(uuid) returns hai_point_wallets language sql as $$select * from hai_point_wallets where user_id=$1$$;`);
  await db.exec(functionSql(deadlineSql, 'hai_close_image_generation_failure'));
  await db.exec(functionSql(deadlineSql, 'hai_expire_image_delivery_runs'));
  await db.exec(read('20261015075316_hai_image_provider_async_polling.sql'));
  await db.query('insert into profiles values($1)', [user]);
  await db.query('insert into hai_image_generation_tasks(id,user_id,title) values($1,$2,\'test\')', [task, user]);
  await db.query('insert into hai_point_wallets(user_id,balance_tokens) values($1,10000)', [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  const active = await fixture('async');
  await check('new async tasks survive the historical deadline cleanup', async () => {
    assert.equal((await db.query('select hai_expire_image_delivery_runs() as count')).rows[0].count, 0);
  });
  await check('completion and direct settlement both require delivery acknowledgement', async () => {
    await assert.rejects(rpc('select hai_complete_image_generation_run($1)', [active]), /not been acknowledged/);
    await assert.rejects(rpc("select hai_finalize_image_generation('async','completed')"), /not been acknowledged/);
  });
  await check('acknowledgement after ten minutes succeeds and repeated acknowledgements debit exactly once', async () => {
    assert.equal((await acknowledge(active)).status, 'completed');
    assert.equal((await acknowledge(active)).status, 'completed');
    assert.equal(Number((await db.query('select balance_tokens from hai_point_wallets')).rows[0].balance_tokens), 8000);
    assert.equal((await db.query("select count(*)::int as n from hai_point_transactions where request_id='async'")).rows[0].n, 1);
  });
  await check('expired concurrency reservations settle once when the saved result is acknowledged', async () => {
    const id = await fixture('expired-reservation', {reservation: 'expired'});
    assert.equal((await acknowledge(id)).status, 'completed');
    assert.equal((await acknowledge(id)).status, 'completed');
    assert.equal((await db.query("select count(*)::int as n from hai_point_transactions where request_id='expired-reservation'")).rows[0].n, 1);
  });
  await check('another user cannot acknowledge or complete the task', async () => {
    const id = await fixture('foreign');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [crypto.randomUUID()]);
    await assert.rejects(acknowledge(id), /unauthorized/);
    await assert.rejects(rpc('select hai_complete_image_generation_run($1)', [id]), /无权访问/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  });
  await check('unfinished images cannot be acknowledged', async () => {
    const id = await fixture('not-ready', {ready: false});
    await assert.rejects(acknowledge(id), /not ready/);
  });
  await check('legacy deadlines and failed runs remain final', async () => {
    const legacy = await fixture('legacy', {metadata: {}, deadline: new Date(Date.now()-1000).toISOString()});
    assert.equal((await acknowledge(legacy)).status, 'failed');
    assert.equal((await acknowledge(legacy)).status, 'failed');
    const unmarked = await fixture('unmarked', {metadata: {}});
    assert.equal((await acknowledge(unmarked)).status, 'failed');
  });
  await check('insufficient points roll back delivery and create no debit', async () => {
    const id = await fixture('insufficient');
    await db.query('update hai_point_wallets set balance_tokens=0');
    assert.equal((await acknowledge(id)).status, 'failed');
    assert.equal((await db.query("select count(*)::int as n from hai_point_transactions where request_id='insufficient'")).rows[0].n, 0);
  });
  await check('anonymous users cannot execute billing RPCs', async () => {
    for (const fn of ['hai_acknowledge_image_delivery(uuid)', 'hai_complete_image_generation_run(uuid)', 'hai_finalize_image_generation(text,text,text,uuid,integer,jsonb)']) {
      assert.equal((await db.query('select has_function_privilege(\'anon\',$1,\'execute\') as allowed', [fn])).rows[0].allowed, false);
    }
  });
  console.log(JSON.stringify({database: 'isolated PostgreSQL (PGlite)', passed: checks.length, checks}, null, 2));
} finally { await db.close(); }
