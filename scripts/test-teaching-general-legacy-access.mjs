import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.COURSE_PGLITE_MODULE;
if (!modulePath) throw new Error('Set COURSE_PGLITE_MODULE to @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const readMigration = (file) => readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
const ids = Object.fromEntries(
  ['admin', 'legacy', 'standard', 'member', 'v1', 'v2', 'teacherAi', 'draft', 'trial'].map(
    (key, index) => [key, '10000000-0000-0000-0000-00000000000' + (index + 1)],
  ),
);
const login = async (id) => {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
};
const access = async (key) =>
  (await db.query('select public.can_access_course($1) as allowed', [ids[key]])).rows[0].allowed;
const grant = (userId, code, enabled) =>
  db.query('select public.admin_set_user_course_access($1, $2, $3)', [userId, code, enabled]);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema private;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create type public.access_level as enum ('free', 'plus2025', 'plus', 'pro');
    create table public.profiles (
      id uuid primary key, access_level public.access_level not null,
      status text not null default 'active', role text not null default 'member',
      nickname text not null default '测试学员', phone text not null default ''
    );
    create table public.courses (
      id uuid primary key, membership_type public.access_level not null,
      status text not null default 'published', is_trial boolean not null default false
    );
    create function public.is_admin() returns boolean language sql stable security definer set search_path = ''
      as $$ select exists (select 1 from public.profiles
                            where id = auth.uid() and role = 'admin' and status = 'active') $$;
  `);
  // Apply the course-permission portion of the original migration, before the
  // unrelated catalogue and HAI declarations, then apply the new migration.
  const base = readMigration('20260921083014_decouple_course_entitlements_and_hai_points.sql');
  await db.exec(base.split('create or replace function private.course_metadata_json')[0] + 'commit;');
  await db.exec(readMigration('20261117094227_teaching_general_legacy_access.sql'));
  await db.exec(`
    insert into public.profiles (id, access_level, role) values
      ('${ids.admin}', 'free', 'admin'), ('${ids.legacy}', 'free', 'member'),
      ('${ids.standard}', 'free', 'member'), ('${ids.member}', 'plus2025', 'member');
    insert into public.courses (id, membership_type, access_product_code, status, is_trial) values
      ('${ids.v1}', 'plus', 'teaching-general-v1', 'published', false),
      ('${ids.v2}', 'plus', 'teaching-general-v2', 'published', false),
      ('${ids.teacherAi}', 'pro', 'teacher-ai', 'published', false),
      ('${ids.draft}', 'plus', 'teaching-general-v1', 'draft', false),
      ('${ids.trial}', 'plus', 'teaching-general-v1', 'published', true);
  `);
  await login(ids.admin);
  assert.deepEqual(
    (await db.query("select name from public.course_access_products where code = 'teaching-general-legacy' and is_grantable")).rows,
    [{ name: '教学通识课旧版' }],
  );
  await grant(ids.legacy, 'teaching-general-legacy', true);
  await grant(ids.standard, 'teaching-general-v1', true);
  await login(ids.legacy);
  assert.equal(await access('v1'), true);
  for (const key of ['v2', 'teacherAi', 'draft']) assert.equal(await access(key), false, key);
  assert.deepEqual((await db.query('select product_code from public.user_course_entitlements')).rows,
    [{ product_code: 'teaching-general-legacy' }]);
  await assert.rejects(grant(ids.legacy, 'teaching-general-v1', true), /admin only/);
  await login(ids.standard);
  assert.equal(await access('v1'), true);
  assert.equal(await access('v2'), false);
  await login(ids.member);
  assert.equal(await access('v1'), true);

  await db.exec(`reset role; update public.profiles set status = 'banned' where id = '${ids.legacy}';`);
  await login(ids.legacy);
  assert.equal(await access('v1'), false);
  await db.exec(`reset role;
    update public.profiles set status = 'active' where id = '${ids.legacy}';
    update public.user_course_entitlements
    set starts_at = now() - interval '2 days', expires_at = now() - interval '1 day'
    where user_id = '${ids.legacy}';`);
  await login(ids.legacy);
  assert.equal(await access('v1'), false);

  await login(ids.admin);
  await grant(ids.legacy, 'teaching-general-legacy', true);
  await grant(ids.legacy, 'teaching-general-legacy', false);
  await login(ids.legacy);
  assert.equal(await access('v1'), false);
  assert.equal(await access('trial'), true);
  await db.exec('reset role; set role anon');
  await assert.rejects(access('v1'), /permission denied/);

  await db.exec(`
    reset role;
    alter table public.profiles enable row level security;
    grant select on public.profiles to authenticated;
    create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
    update public.profiles set access_level = 'pro' where id = '${ids.member}';
    create table public.hai_point_wallets (user_id uuid, balance_tokens bigint);
    create function public.hai_runtime_numeric(text, numeric) returns numeric language sql as $$ select $2 $$;
  `);
  await db.exec(readMigration('20260927083006_daofa_lesson_media.sql'));
  // Before this migration, "revoked" removed a direct grant without overriding Pro.
  await login(ids.admin);
  await grant(ids.member, 'teacher-ai', false);
  await db.exec('reset role');
  await db.exec(readMigration('20261117100618_admin_revoke_inherited_course_access.sql'));
  await login(ids.member);
  assert.equal(await access('teacherAi'), true, 'keep inherited access for old revoke rows');
  assert.equal(await access('v1'), true);
  await assert.rejects(grant(ids.member, 'teacher-ai', false), /admin only/);
  await assert.rejects(
    db.exec(`update public.user_course_entitlements set status = 'active' where user_id = '${ids.member}'`),
    /permission denied/,
  );

  await login(ids.admin);
  await grant(ids.member, 'teaching-general-v1', false);
  await grant(ids.member, 'teacher-ai', false);
  await grant(ids.member, 'daofa-textbook', true);
  const pointsAudience = async () =>
    (await db.query("select public.hai_admin_course_point_users('teacher-ai') as users")).rows[0].users;
  assert.deepEqual(await pointsAudience(), []);
  await login(ids.member);
  assert.equal(await access('v1'), false, 'deny inherited teaching general access');
  assert.equal(await access('teacherAi'), false, 'deny inherited teacher AI access');
  assert.equal(await access('trial'), true);
  assert.equal((await db.query('select lesson_id from public.daofa_lesson_media')).rows.length, 5);

  await login(ids.admin);
  await grant(ids.member, 'teacher-ai', true);
  await grant(ids.member, 'daofa-textbook', false);
  await grant(ids.member, 'teaching-general-legacy', true);
  assert.deepEqual((await pointsAudience()).map(({id}) => id), [ids.member]);
  await login(ids.member);
  assert.equal(await access('teacherAi'), true);
  assert.equal(await access('v1'), true, 'independent 2025 grant still applies');
  assert.deepEqual((await db.query('select lesson_id from public.daofa_lesson_media')).rows, []);

  await login(ids.admin);
  await grant(ids.member, 'teaching-general-legacy', false);
  await login(ids.member);
  assert.equal(await access('v1'), false);
  await login(ids.admin);
  await grant(ids.member, 'teaching-general-v1', true);
  await login(ids.member);
  assert.equal(await access('v1'), true);

  await db.exec(`reset role; update public.profiles set status = 'banned' where id = '${ids.admin}';`);
  await login(ids.admin);
  await assert.rejects(grant(ids.member, 'teacher-ai', false), /admin only/);
  console.log('Course entitlement checks passed: current and preview editions, grants and revocation, banned and expired accounts, trial and anonymous access.');
} finally {
  await db.close();
}
