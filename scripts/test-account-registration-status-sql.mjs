import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { makeClubSignupHandler } from '../supabase/functions/club-email-signup/handler.ts';

const modulePath = process.env.ACCOUNT_PGLITE_MODULE;
if (!modulePath) throw new Error('Set ACCOUNT_PGLITE_MODULE to @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = readFileSync(new URL(
  '../supabase/migrations/20261116190000_complete_verified_registration_and_restore_member_status.sql',
  import.meta.url,
), 'utf8');
const signupMigration = readFileSync(new URL(
  '../supabase/migrations/20261116190100_club_email_signup_attempts.sql',
  import.meta.url,
), 'utf8');

const admin = '00000000-0000-4000-8000-000000000001';
const otherAdmin = '00000000-0000-4000-8000-000000000002';
const member = '00000000-0000-4000-8000-000000000003';
const duplicate = '00000000-0000-4000-8000-000000000004';
const legacy = '00000000-0000-4000-8000-000000000005';
const isd = '00000000-0000-4000-8000-000000000006';
const pending = '00000000-0000-4000-8000-000000000007';

async function insertAuthUser(id, email, phone, confirmed = false) {
  await db.query(`
    insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    values ($1, $2, $3, case when $4::boolean then now() end)
  `, [id, email, JSON.stringify({ phone, nickname: '学员' }), confirmed]);
}

async function confirm(id) {
  return db.query('update auth.users set email_confirmed_at = now() where id = $1', [id]);
}

async function profile(id) {
  return (await db.query('select phone, nickname, status, credits from public.profiles where id = $1', [id])).rows[0];
}

async function actor(id) {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}

async function setStatus(id, status) {
  return (await db.query('select public.admin_update_user_status($1, $2) as result', [id, status])).rows[0].result;
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role supabase_auth_admin;
    create role service_role;
    create schema auth;
    grant usage on schema auth to supabase_auth_admin;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users(
      id uuid primary key, email text unique, raw_user_meta_data jsonb,
      raw_app_meta_data jsonb default '{"provider":"email"}',
      email_confirmed_at timestamptz, phone_confirmed_at timestamptz, banned_until timestamptz
    );
    grant select, insert, update on auth.users to supabase_auth_admin;
    create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users);
    create type public.user_status as enum ('active', 'banned');
    create type public.user_role as enum ('member', 'admin');
    create table public.profiles(
      id uuid primary key references auth.users, phone varchar(20) not null unique, nickname varchar(50) not null,
      role public.user_role not null default 'member', status public.user_status not null default 'active',
      updated_at timestamptz default now(), credits integer not null default 0
    );
  `);
  await insertAuthUser(legacy, '13900000005@phone.local', '13900000005', true);
  await db.query("insert into public.profiles(id, phone, nickname, credits) values ($1, '13900000005', '老会员', 30)", [legacy]);
  await insertAuthUser(pending, 'pending@example.com', '13900000007');
  await db.exec(migration);

  await db.exec('set role supabase_auth_admin');
  await insertAuthUser(member, 'member@example.com', '13900000003');
  await insertAuthUser(duplicate, 'other@example.com', '13900000003');
  await db.exec('reset role');
  assert.equal(await profile(member), undefined);
  assert.equal(await profile(duplicate), undefined);
  assert.equal(await profile(pending), undefined);

  await db.exec('set role supabase_auth_admin');
  await confirm(member);
  await confirm(pending);
  await assert.rejects(confirm(duplicate), { code: '23505' });
  await insertAuthUser(admin, 'admin@example.com', '13900000001', true);
  await insertAuthUser(otherAdmin, 'other-admin@example.com', '13900000002', true);
  await insertAuthUser(isd, 'teacher@isd.local', '13900000006', true);
  await db.exec('reset role');
  assert.deepEqual(await profile(member), { phone: '13900000003', nickname: '学员', status: 'active', credits: 0 });
  assert.equal((await profile(pending)).status, 'active');
  assert.equal((await db.query('select email_confirmed_at from auth.users where id = $1', [duplicate])).rows[0].email_confirmed_at, null);
  assert.equal(await profile(duplicate), undefined);
  assert.equal(await profile(isd), undefined);
  await db.query("update auth.users set email = 'legacy@example.com', email_confirmed_at = now() where id = $1", [legacy]);
  assert.equal((await profile(legacy)).credits, 30);
  assert.equal((await profile(legacy)).nickname, '老会员');

  await db.query("update public.profiles set role = 'admin' where id in ($1, $2)", [admin, otherAdmin]);
  await db.query('update public.profiles set credits = 15 where id = $1', [member]);
  await db.query('insert into auth.sessions(user_id) values ($1), ($1), ($2)', [member, otherAdmin]);
  await db.exec('set role anon');
  await assert.rejects(setStatus(member, 'banned'), { code: '42501' });
  await actor(member);
  await assert.rejects(setStatus(legacy, 'banned'), { code: '42501' });
  await actor(admin);
  await assert.rejects(setStatus(admin, 'banned'), { code: '42501' });
  await assert.rejects(setStatus(otherAdmin, 'banned'), { code: '42501' });
  await assert.rejects(setStatus(member, null), { code: '22023' });
  assert.equal((await setStatus(member, 'banned')).status, 'banned');
  assert.equal((await setStatus(member, 'banned')).status, 'banned');
  await db.exec('reset role');
  assert.equal((await profile(member)).status, 'banned');
  assert.equal((await profile(member)).credits, 15);
  assert.equal((await db.query('select banned_until > now() as banned from auth.users where id = $1', [member])).rows[0].banned, true);
  assert.deepEqual((await db.query('select user_id from auth.sessions')).rows, [{ user_id: otherAdmin }]);

  await actor(admin);
  assert.equal((await setStatus(member, 'active')).status, 'active');
  await db.exec('reset role');
  assert.equal((await profile(member)).status, 'active');
  assert.equal((await db.query('select banned_until from auth.users where id = $1', [member])).rows[0].banned_until, null);
  await db.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [member]);
  await actor(admin);
  await setStatus(member, 'banned');
  await setStatus(member, 'active');
  await db.exec('reset role');
  assert.equal((await db.query('select banned_until > now() as banned from auth.users where id = $1', [member])).rows[0].banned, true);

  await db.exec(signupMigration);
  const messages = [];
  const createdAccounts = [];
  const retiredId = crypto.randomUUID();
  await insertAuthUser(retiredId, 'change@example.com', '13800000017');

  async function invokeRpc(query, params) {
    return (await db.query(query, params)).rows[0]?.result;
  }
  const signup = makeClubSignupHandler({
    digest: async (input) => {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Buffer.from(bytes).toString('hex');
    },
    code: () => String(10000000 + messages.length),
    start: ({ addressKey, id, digest }, { email, phone }) => invokeRpc(
      'select public.start_club_email_signup($1, $2, $3, $4, $5) as result', [addressKey, id, digest, email, phone],
    ),
    claim: ({ addressKey, id, digest }) => invokeRpc(
      'select public.claim_club_email_signup($1, $2, $3) as result', [addressKey, id, digest],
    ),
    clear: ({ addressKey, id }, retry) => invokeRpc(
      'select public.clear_club_email_signup($1, $2, $3) as result', [addressKey, id, retry],
    ),
    send: async (details, code) => { messages.push({ ...details, code }); },
    create: async (details, password) => {
      const id = crypto.randomUUID();
      await db.query(`
        insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
        values ($1, $2, $3, now())
      `, [id, details.email, JSON.stringify({ phone: details.phone, nickname: details.nickname })]);
      createdAccounts.push({ id, password });
      return 'created';
    },
  });

  async function post(body) {
    const response = await signup(new Request('https://local.test/functions/v1/club-email-signup', {
      method: 'POST', body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  }

  const oldDetails = { email: 'Change@example.com', phone: '13800000017', nickname: '第一轮' };
  const newDetails = { email: 'change@example.com', phone: '13800000012', nickname: '第二轮' };
  const oldAttempt = (await post({ action: 'start', ...oldDetails })).body.attemptId;
  const newAttempt = (await post({ action: 'start', ...newDetails })).body.attemptId;
  assert.notEqual(oldAttempt, newAttempt);
  assert.deepEqual(messages.map(({ email, phone }) => ({ email, phone })), [
    { email: newDetails.email, phone: oldDetails.phone },
    { email: newDetails.email, phone: newDetails.phone },
  ]);
  assert.equal(await invokeRpc('select count(*)::int as result from auth.users where email = $1', [newDetails.email]), 0);
  assert.equal(await invokeRpc('select count(*)::int as result from public.profiles where phone in ($1, $2)', [oldDetails.phone, newDetails.phone]), 0);

  const confirmation = { action: 'confirm', ...newDetails, attemptId: newAttempt, code: messages[1].code, password: 'new-password' };
  assert.equal((await post({ ...confirmation, ...oldDetails, attemptId: oldAttempt, code: messages[0].code })).status, 400);
  assert.equal((await post({ ...confirmation, code: messages[0].code })).status, 400);
  assert.equal((await post({ ...confirmation, phone: oldDetails.phone })).status, 400);
  assert.equal((await post(confirmation)).body.registered, true);
  assert.equal((await post(confirmation)).status, 400);
  assert.deepEqual(await profile(createdAccounts[0].id), { phone: newDetails.phone, nickname: newDetails.nickname, status: 'active', credits: 0 });
  assert.equal(createdAccounts[0].password, 'new-password');
  assert.equal(await profile(retiredId), undefined);
  assert.equal(await invokeRpc('select count(*)::int as result from private.club_signup_attempts', []), 0);

  const otherDetails = { email: 'another@example.com', phone: '13800000099', nickname: '独立账号' };
  const separate = (await post({ action: 'start', ...otherDetails })).body.attemptId;
  assert.equal((await post({ ...otherDetails, action: 'confirm', attemptId: separate, code: messages[2].code, password: 'different-password' })).body.registered, true);
  assert.equal((await profile(createdAccounts[1].id)).phone, otherDetails.phone);
  assert.equal((await post({ action: 'start', ...newDetails, phone: '13800000055' })).status, 200);
  assert.equal(messages.length, 3);
  assert.equal((await profile(createdAccounts[0].id)).phone, newDetails.phone);

  const capped = { action: 'start', email: 'capped@example.com', phone: '13800000400', nickname: '重试测试' };
  for (let i = 0; i < 5; i++) assert.equal((await post(capped)).status, 200);
  assert.equal((await post(capped)).status, 429);
  await db.exec('set role authenticated');
  await assert.rejects(invokeRpc("select public.claim_club_email_signup('x', $1, 'x') as result", [newAttempt]), { code: '42501' });
  await db.exec('reset role');

  console.log('Passed: latest signup, code replay, independent signup, legacy accounts, rate limits, RPC permissions, suspension and restoration');
} finally {
  await db.close();
}
