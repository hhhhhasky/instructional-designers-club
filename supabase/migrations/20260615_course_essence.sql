-- 课程精华（可选 Markdown：思维导图图片 / 要点等看课参考材料，详情页为空不显示该板块）
-- 需手动在 Supabase SQL 编辑器执行（项目不做自动迁移）
--
-- 新列可空、默认空，现有课程零影响。
-- courses 表已有「公开读激活项、管理员读写」RLS，新列继承表级策略，无需改 policy。

alter table public.courses
  add column if not exists essence text;

comment on column public.courses.essence is '课程精华，Markdown 格式，为空则详情页不显示该板块';
