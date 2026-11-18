import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { makeLegacyRecoveryHandler } from '../supabase/functions/legacy-account-recovery/handler.ts';

const modulePath = process.env.ACCOUNT_PGLITE_MODULE;
if (!modulePath) throw new Error('Set ACCOUNT_PGLITE_MODULE to @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const adminId = '00000000-0000-4000-8000-000000000001';
const memberId = '00000000-0000-4000-8000-000000000002';
const phone = '13900000002';
const email = 'teacher@example.com';
const sql = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
let nextToken = 0;
const mail = [];
let updates = 0;
const rpc = async (name, params) => (await db.query(`select public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) as value`, params)).rows[0].value;
const request = (body, auth = '') => new Request('https://example.test', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify(body) });
const handler = makeLegacyRecoveryHandler({
  digest: (s) => Promise.resolve(`protected:${s}`),
  token: () => (++nextToken).toString(16).padStart(64, '0'),
  submit: (phone, email, note) => rpc('submit_legacy_account_recovery', [phone, email, note]),
  administrator: (auth) => Promise.resolve(auth === 'Bearer admin' ? adminId : null),
  prepare: (id, admin, digest) => rpc('prepare_legacy_account_recovery', [id, admin, digest]),
  claim: (id, digest) => rpc('claim_legacy_account_recovery', [id, digest]),
  finish: async (id, digest, success) => { await rpc('finish_legacy_account_recovery', [id, digest, success]); },
  send: (target, id, token) => { mail.push({ ...target, id, token }); return Promise.resolve(); },
  // This adapter simulates the single Auth admin call; it does not test live GoTrue or SMTP delivery.
  update: async (target, password) => {
    updates++;
    await db.query('update auth.users set email = $1, password = $2, email_confirmed_at = now() where id = $3', [target.email, password, target.user_id]);
    return true;
  },
});
async function submit(address = email) {
  assert.equal((await handler(request({ action: 'submit', phone, email: address, note: '老会员' }))).status, 200);
  return (await db.query('select id from public.password_reset_requests order by created_at desc, id desc limit 1')).rows[0].id;
}
async function age(id) {
  await db.query("update private.legacy_recovery_links set created_at = now() - interval '2 minutes' where request_id = $1", [id]);
}
async function complete(link, password = 'new-password') {
  return handler(request({ action: 'complete', request_id: link.id, token: link.token, password }));
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
    create schema auth;
    create table auth.users(id uuid primary key, email text unique, password text, email_confirmed_at timestamptz, banned_until timestamptz,
      phone_confirmed_at timestamptz, raw_user_meta_data jsonb, raw_app_meta_data jsonb default '{"provider":"email"}');
    create type public.user_role as enum ('member', 'admin');
    create type public.user_status as enum ('active', 'banned');
    create table public.profiles(id uuid primary key references auth.users, phone varchar(20) unique not null, nickname varchar(50) not null,
      role public.user_role default 'member', status public.user_status default 'active', credits int default 0, updated_at timestamptz default now());
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.jwt.claim.sub', true), '') = '${adminId}' $$;
  `);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now()),($3,$4,now())', [adminId, 'admin@example.com', memberId, `${phone}@phone.local`]);
  await db.query("insert into public.profiles(id,phone,nickname,role,credits) values ($1,'13900000001','管理员','admin',0),($2,$3,'老会员','member',80)", [adminId, memberId, phone]);
  await db.exec(sql('20261116190000_complete_verified_registration_and_restore_member_status.sql'));
  await db.exec(sql('20260705230000_password_reset_requests.sql'));
  await db.exec(sql('20261103122207_account_email_auth.sql'));
  await db.exec('grant all on public.password_reset_requests to anon,authenticated; grant usage on schema public to anon,authenticated,service_role');
  await db.exec(sql('20261118093725_legacy_account_email_recovery.sql'));

  // Public access cannot forge approval, supply a victim user ID, read links, or call service RPCs.
  await db.exec('set role anon');
  await assert.rejects(db.query("insert into public.password_reset_requests(phone,user_id,status) values ($1,$2,'approved')", [phone, adminId]), { code: '42501' });
  await assert.rejects(rpc('prepare_legacy_account_recovery', [crypto.randomUUID(), adminId, 'fake']), { code: '42501' });
  await assert.rejects(db.query('select * from private.legacy_recovery_links'), { code: '42501' });
  await db.query("insert into public.password_reset_requests(phone,note) values ('13900000009','旧页面兼容')");
  await db.exec('reset role');

  // Even a service RPC cannot turn a member into an approving administrator.
  assert.ok((await rpc('prepare_legacy_account_recovery', [crypto.randomUUID(), memberId, 'fake'])).error);
  // Prevent approval for banned users, administrators, or an email already owned by another account.
  const checks = await submit('admin@example.com');
  assert.equal((await handler(request({ action: 'approve', request_id: checks }, 'Bearer admin'))).status, 409);
  await db.query('delete from public.password_reset_requests where id = $1', [checks]);
  const bannedRequest = await submit();
  await db.query("update public.profiles set status='banned' where id=$1", [memberId]);
  assert.equal((await handler(request({ action: 'approve', request_id: bannedRequest }, 'Bearer admin'))).status, 409);
  await db.query("update public.profiles set status='active' where id=$1", [memberId]);
  await db.query('delete from public.password_reset_requests where id = $1', [bannedRequest]);

  const id = await submit();
  assert.equal((await complete({ id, token: '0'.repeat(64) })).status, 400);
  assert.equal(updates, 0);
  assert.equal((await handler(request({ action: 'approve', request_id: id }, 'Bearer member'))).status, 403);
  assert.equal((await handler(request({ action: 'approve', request_id: id }, 'Bearer admin'))).status, 200);
  const first = mail.at(-1);
  await db.query("update public.profiles set status='banned' where id=$1", [memberId]);
  assert.equal((await complete(first)).status, 400);
  await db.query("update public.profiles set status='active' where id=$1", [memberId]);

  assert.equal((await db.query('select email from auth.users where id=$1', [memberId])).rows[0].email, `${phone}@phone.local`);
  assert.equal((await complete({ ...first, token: 'f'.repeat(64) })).status, 400);
  await age(id);
  assert.equal((await handler(request({ action: 'resend', request_id: id }, 'Bearer admin'))).status, 200);
  assert.equal((await complete(first)).status, 400);
  const expired = mail.at(-1);
  await db.query("update private.legacy_recovery_links set created_at = now() - interval '31 minutes' where request_id=$1", [id]);
  assert.equal((await complete(expired)).status, 400);

  // A different approved application for the same account replaces the previous link and email.
  const secondId = await submit('updated@example.com');
  assert.equal((await handler(request({ action: 'approve', request_id: secondId }, 'Bearer admin'))).status, 200);
  assert.equal((await complete(expired)).status, 400);
  const latest = mail.at(-1);
  // Claim is atomic: only one concurrent submission reaches the Auth adapter.
  const results = await Promise.all([complete(latest), complete(latest)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(updates, 1);
  assert.equal((await complete(latest, 'changed-again')).status, 400);
  const user = (await db.query('select id,email,password,email_confirmed_at from auth.users where id=$1', [memberId])).rows[0];
  assert.equal(user.id, memberId); assert.equal(user.email, 'updated@example.com'); assert.equal(user.password, 'new-password'); assert.ok(user.email_confirmed_at);
  assert.equal((await db.query('select credits,nickname from public.profiles where id=$1', [memberId])).rows[0].credits, 80);
  assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n, 2);
  assert.ok((await db.query('select recovery_completed_at from public.password_reset_requests where id=$1', [secondId])).rows[0].recovery_completed_at);

  const thirdId = await submit('another@example.com');
  assert.equal((await handler(request({ action: 'approve', request_id: thirdId }, 'Bearer admin'))).status, 409);
  assert.equal((await handler(request({ action: 'submit', phone, email, note: '' }))).status, 429);
  assert.equal(await rpc('submit_legacy_account_recovery', ['13900000008', 'free@example.com', '']), true);
  const missing = (await db.query("select id from public.password_reset_requests where phone='13900000008'")).rows[0].id;
  assert.equal((await handler(request({ action: 'approve', request_id: missing }, 'Bearer admin'))).status, 409);
  // A failed send/update credential stays invalid; a fresh administrator resend can proceed.
  await db.query('update auth.users set email=$1 where id=$2', [`${phone}@phone.local`, memberId]);
  await db.query("update public.password_reset_requests set created_at=now()-interval '2 hours' where phone=$1", [phone]);
  const failedId = await submit('failure@example.com');
  const protectedToken = 'protected:test';
  assert.equal((await rpc('prepare_legacy_account_recovery', [failedId, adminId, protectedToken])).user_id, memberId);
  await rpc('finish_legacy_account_recovery', [failedId, protectedToken, false]);
  assert.equal(await rpc('claim_legacy_account_recovery', [failedId, protectedToken]), null);
  await age(failedId);
  assert.equal((await handler(request({ action: 'resend', request_id: failedId }, 'Bearer admin'))).status, 200);
  const retry = mail.at(-1);
  await db.query("update public.password_reset_requests set status='rejected' where id=$1", [failedId]);
  assert.equal((await complete(retry)).status, 400);
  console.log('PASS: request permissions, administrator review, delivery without mutation, expiry, resend invalidation, competing requests, concurrent/replayed link, same-account email/password update and retained profile. Auth/SMTP simulated.');
} finally { await db.close(); }
