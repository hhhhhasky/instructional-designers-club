-- ============================================================
-- Club database optimization and ISD isolation
-- Created: 2026-06-17
--
-- Important boundary:
-- - public.isd_profiles / public.isd_usage_records belong to a separate
--   application that shares this Supabase project.
-- - This migration must not drop or reshape ISD tables or enums.
-- - We only harden shared functions/triggers so club users and ISD users stay
--   isolated by the existing @isd.local auth split.
-- ============================================================

begin;

-- ---------- 0. Backups for objects touched by this cleanup ----------
create schema if not exists maintenance_backups;
comment on schema maintenance_backups is
  'Private schema for one-off pre-cleanup table backups. Not exposed through Supabase Data API.';

revoke all on schema maintenance_backups from public, anon, authenticated;

create table if not exists maintenance_backups.club_opt_20260617_visitor_stats
as table public.visitor_stats with data;

create table if not exists maintenance_backups.club_opt_20260617_courses
as table public.courses with data;

create table if not exists maintenance_backups.club_opt_20260617_course_categories
as table public.course_categories with data;

revoke all on all tables in schema maintenance_backups from public, anon, authenticated;

-- ---------- 1. Remove obsolete club view/types/columns ----------
drop view if exists public.v_category_course_mapping;

drop type if exists public.log_action;
drop type if exists public.resource_type;

drop index if exists public.idx_courses_plus_structure;
drop index if exists public.idx_course_categories_scenarios;
drop index if exists public.idx_courses_level;
drop index if exists public.idx_profiles_phone;

update public.course_categories
set applicable_scenarios = coalesce(
  (
    select array_agg(distinct scenario_value order by scenario_value)
    from unnest(
      coalesce(applicable_scenarios, '{}'::text[])
      || coalesce(scenarios, '{}'::text[])
    ) as scenario_value
  ),
  '{}'::text[]
)
where coalesce(array_length(scenarios, 1), 0) > 0;

alter table public.course_categories
  drop column if exists scenarios;

alter table public.courses
  drop column if exists semester,
  drop column if exists plus_track_id,
  drop column if exists plus_module_id,
  drop column if exists plus_module_order;

comment on table public.isd_profiles is
  '[ISD separate app] User profile table for the lesson-plan diagnosis app. Do not couple club migrations to this table.';
comment on table public.isd_usage_records is
  '[ISD separate app] Usage records for the lesson-plan diagnosis app. Do not couple club migrations to this table.';

-- ---------- 2. Function hardening ----------
alter function public.increment_course_view_count(uuid) set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.record_visit(uuid) set search_path = public;
alter function public.isd_handle_new_user() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.admin_member_overview() set search_path = public;
alter function public.admin_course_rankings() set search_path = public;
alter function public.admin_student_list() set search_path = public;
alter function public.admin_inactive_students() set search_path = public;
alter function public.admin_student_leaderboard() set search_path = public;
alter function public.admin_course_list() set search_path = public;
alter function public.admin_update_user_access_level(uuid, text) set search_path = public;
alter function public.public_member_count() set search_path = public;

revoke execute on function public.admin_member_overview() from public, anon;
revoke execute on function public.admin_course_rankings() from public, anon;
revoke execute on function public.admin_student_list() from public, anon;
revoke execute on function public.admin_inactive_students() from public, anon;
revoke execute on function public.admin_student_leaderboard() from public, anon;
revoke execute on function public.admin_course_list() from public, anon;
revoke execute on function public.admin_update_user_access_level(uuid, text) from public, anon;

grant execute on function public.admin_member_overview() to authenticated;
grant execute on function public.admin_course_rankings() to authenticated;
grant execute on function public.admin_student_list() to authenticated;
grant execute on function public.admin_inactive_students() to authenticated;
grant execute on function public.admin_student_leaderboard() to authenticated;
grant execute on function public.admin_course_list() to authenticated;
grant execute on function public.admin_update_user_access_level(uuid, text) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.isd_handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_visit(uuid) from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

grant execute on function public.public_member_count() to anon, authenticated;
grant execute on function public.increment_course_view_count(uuid) to anon, authenticated;

-- ---------- 3. Visitor stats: keep historical data, remove public table writes ----------
drop policy if exists "Allow public insert visitor_stats" on public.visitor_stats;
drop policy if exists "Allow public read visitor_stats" on public.visitor_stats;
drop policy if exists "Allow public update visitor_stats" on public.visitor_stats;

revoke all on table public.visitor_stats from anon, authenticated;

-- ---------- 4. RLS policy optimization and duplicate SELECT cleanup ----------
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admin full access profiles" on public.profiles;

create policy "profiles select own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles update own or admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles insert admin"
  on public.profiles for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "profiles delete admin"
  on public.profiles for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Users can view own records" on public.learning_records;
drop policy if exists "Users can insert own records" on public.learning_records;
drop policy if exists "Users can update own records" on public.learning_records;
drop policy if exists "Admin can view all learning_records" on public.learning_records;

create policy "learning_records select own or admin"
  on public.learning_records for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "learning_records insert own"
  on public.learning_records for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "learning_records update own"
  on public.learning_records for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "ISD users can view own profile" on public.isd_profiles;
drop policy if exists "ISD users can update own profile" on public.isd_profiles;
drop policy if exists "ISD users can view own usage" on public.isd_usage_records;
drop policy if exists "ISD users can insert own usage" on public.isd_usage_records;

create policy "ISD users can view own profile"
  on public.isd_profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "ISD users can update own profile"
  on public.isd_profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "ISD users can view own usage"
  on public.isd_usage_records for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "ISD users can insert own usage"
  on public.isd_usage_records for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Admin can insert courses" on public.courses;
drop policy if exists "Admin can update courses" on public.courses;
drop policy if exists "Admin can delete courses" on public.courses;

create policy "Admin can insert courses"
  on public.courses for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update courses"
  on public.courses for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin can delete courses"
  on public.courses for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can insert course_categories" on public.course_categories;
drop policy if exists "Admin can update course_categories" on public.course_categories;

create policy "Admin can insert course_categories"
  on public.course_categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update course_categories"
  on public.course_categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Content tables: anon sees active rows, authenticated users see active rows,
-- admins see all rows. Admin writes are split by command to avoid duplicate
-- permissive SELECT policies.
drop policy if exists "public read member_profiles" on public.member_profiles;
drop policy if exists "admin write member_profiles" on public.member_profiles;
create policy "anon read active member_profiles"
  on public.member_profiles for select to anon
  using (is_active = true);
create policy "authenticated read member_profiles"
  on public.member_profiles for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert member_profiles"
  on public.member_profiles for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update member_profiles"
  on public.member_profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete member_profiles"
  on public.member_profiles for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read faqs" on public.faqs;
drop policy if exists "admin write faqs" on public.faqs;
create policy "anon read active faqs"
  on public.faqs for select to anon
  using (is_active = true);
create policy "authenticated read faqs"
  on public.faqs for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert faqs"
  on public.faqs for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update faqs"
  on public.faqs for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete faqs"
  on public.faqs for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read testimonials" on public.testimonials;
drop policy if exists "admin write testimonials" on public.testimonials;
create policy "anon read active testimonials"
  on public.testimonials for select to anon
  using (is_active = true);
create policy "authenticated read testimonials"
  on public.testimonials for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert testimonials"
  on public.testimonials for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update testimonials"
  on public.testimonials for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete testimonials"
  on public.testimonials for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read announcements" on public.announcements;
drop policy if exists "admin write announcements" on public.announcements;
create policy "anon read active announcements"
  on public.announcements for select to anon
  using (is_active = true);
create policy "authenticated read announcements"
  on public.announcements for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert announcements"
  on public.announcements for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update announcements"
  on public.announcements for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete announcements"
  on public.announcements for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read activities" on public.activities;
drop policy if exists "admin write activities" on public.activities;
create policy "anon read active activities"
  on public.activities for select to anon
  using (is_active = true);
create policy "authenticated read activities"
  on public.activities for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert activities"
  on public.activities for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update activities"
  on public.activities for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete activities"
  on public.activities for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read resources" on public.resources;
drop policy if exists "admin write resources" on public.resources;
create policy "anon read active resources"
  on public.resources for select to anon
  using (is_active = true);
create policy "authenticated read resources"
  on public.resources for select to authenticated
  using (is_active = true or (select public.is_admin()));
create policy "admin insert resources"
  on public.resources for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update resources"
  on public.resources for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete resources"
  on public.resources for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read site_content" on public.site_content;
drop policy if exists "admin write site_content" on public.site_content;
create policy "public read site_content"
  on public.site_content for select
  to anon, authenticated
  using (true);
create policy "admin insert site_content"
  on public.site_content for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update site_content"
  on public.site_content for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete site_content"
  on public.site_content for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read active plus_course_tracks" on public.plus_course_tracks;
create policy "anon read active plus_course_tracks"
  on public.plus_course_tracks for select to anon
  using (is_active = true);
create policy "authenticated read plus_course_tracks"
  on public.plus_course_tracks for select to authenticated
  using (is_active = true or (select public.is_admin()));

drop policy if exists "admin insert plus_course_tracks" on public.plus_course_tracks;
drop policy if exists "admin update plus_course_tracks" on public.plus_course_tracks;
drop policy if exists "admin delete plus_course_tracks" on public.plus_course_tracks;
create policy "admin insert plus_course_tracks"
  on public.plus_course_tracks for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update plus_course_tracks"
  on public.plus_course_tracks for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete plus_course_tracks"
  on public.plus_course_tracks for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "public read active plus_course_modules" on public.plus_course_modules;
create policy "anon read active plus_course_modules"
  on public.plus_course_modules for select to anon
  using (is_active = true);
create policy "authenticated read plus_course_modules"
  on public.plus_course_modules for select to authenticated
  using (is_active = true or (select public.is_admin()));

drop policy if exists "admin insert plus_course_modules" on public.plus_course_modules;
drop policy if exists "admin update plus_course_modules" on public.plus_course_modules;
drop policy if exists "admin delete plus_course_modules" on public.plus_course_modules;
create policy "admin insert plus_course_modules"
  on public.plus_course_modules for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update plus_course_modules"
  on public.plus_course_modules for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete plus_course_modules"
  on public.plus_course_modules for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Avatar bucket is publicly readable" on storage.objects;

notify pgrst, 'reload schema';

commit;
