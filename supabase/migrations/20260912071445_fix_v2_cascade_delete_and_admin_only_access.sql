-- 修复删除 V2 Unit/Lesson 时，历史答案对试题的 RESTRICT 外键阻断级联删除；
-- 同时统一内测阶段的访问口径：仅 active admin 可以管理或学习 V2。

begin;

alter table public.v2_submission_answers
  drop constraint if exists v2_submission_answers_item_id_fkey;

alter table public.v2_submission_answers
  add constraint v2_submission_answers_item_id_fkey
  foreign key (item_id)
  references public.v2_assessment_items(id)
  on delete cascade;

create or replace function private.v2_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.status = 'active'
    );
$$;

create or replace function private.v2_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.status = 'active'
    );
$$;

revoke execute on function private.v2_can_manage() from public, anon;
revoke execute on function private.v2_user_has_access() from public, anon;
grant execute on function private.v2_can_manage() to authenticated;
grant execute on function private.v2_user_has_access() to authenticated;

commit;
