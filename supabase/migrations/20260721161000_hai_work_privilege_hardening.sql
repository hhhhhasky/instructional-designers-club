begin;

-- Supabase projects may have broad default privileges for newly created
-- public tables. Make the HAI Work browser contract explicit: Skill data is
-- admin-managed through RLS, while execution records are service-role writes.
revoke all privileges on
  public.hai_work_skills,
  public.hai_work_skill_versions,
  public.hai_work_tasks,
  public.hai_work_runs,
  public.hai_work_artifacts,
  public.hai_work_task_materials
from anon, authenticated;

grant select, insert, update, delete on
  public.hai_work_skills,
  public.hai_work_skill_versions
to authenticated;

grant select on
  public.hai_work_tasks,
  public.hai_work_runs,
  public.hai_work_artifacts,
  public.hai_work_task_materials
to authenticated;

grant update (status, archived_at) on public.hai_work_tasks to authenticated;

commit;
