-- 让用户在浏览器端直接管理自己的 Work 任务:重命名与硬删除。
-- 现有 RLS policy "hai work tasks owner or admin" 已是 for all + owner 条件,
-- 放行了 owner 的 update/delete;这里补齐 Postgres GRANT 权限层
-- (privilege_hardening 仅 grant 了 select 与 update(status, archived_at))。
-- 删除任务时,runs / artifacts / task_materials 经外键 ON DELETE CASCADE 自动清理。
begin;
  grant update (title) on public.hai_work_tasks to authenticated;
  grant delete on public.hai_work_tasks to authenticated;
commit;
