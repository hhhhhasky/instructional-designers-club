import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.ACCOUNT_PGLITE_MODULE;
if (!modulePath) throw new Error('Set ACCOUNT_PGLITE_MODULE to @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
  await db.exec(await readFile('supabase/migrations/20261103122207_account_email_auth.sql', 'utf8'));
  await db.exec('set role anon');
  await assert.rejects(db.query("select public.reserve_phone_login_attempt('13900000000')"));
  await db.exec('reset role; set role service_role');
  for (let i = 0; i < 15; i++) assert.equal((await db.query("select public.reserve_phone_login_attempt('13900000000') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select public.reserve_phone_login_attempt('13900000000') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select public.reserve_phone_login_attempt('bad') as allowed")).rows[0].allowed, false);
  await db.exec("select public.clear_phone_login_attempts('13900000000')");
  assert.equal((await db.query("select public.reserve_phone_login_attempt('13900000000') as allowed")).rows[0].allowed, true);
  await db.exec("reset role; insert into auth.users values ('11111111-1111-4111-8111-111111111111'); set role service_role");
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal((await db.query('select public.start_legacy_email_binding($1,$2,$3) as allowed', [id, 'a@example.com', 'digest'])).rows[0].allowed, true);
  assert.equal((await db.query('select public.start_legacy_email_binding($1,$2,$3) as allowed', [id, 'b@example.com', 'new'])).rows[0].allowed, false);
  assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'wrong'])).rows[0].email, null);
  assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'digest'])).rows[0].email, 'a@example.com');
  assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'digest'])).rows[0].email, null);
  await db.exec("reset role; update private.email_binding_challenges set created_at = now() - interval '11 minutes'; set role service_role");
  assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'digest'])).rows[0].email, null);
  assert.equal((await db.query('select public.start_legacy_email_binding($1,$2,$3) as allowed', [id, 'a@example.com', 'digest2'])).rows[0].allowed, true);
  for (let i = 0; i < 5; i++) assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'wrong'])).rows[0].email, null);
  assert.equal((await db.query('select public.consume_legacy_email_binding($1,$2) as email', [id, 'digest2'])).rows[0].email, null);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select public.consume_legacy_email_binding($1,$2)', [id, 'digest2']));
  console.log('phone login and email verification permissions, expiry, retries and replay checks passed');
} finally { await db.close(); }
