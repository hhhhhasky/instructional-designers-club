-- 课程多载体内容支持（视频 / 音频 / 长文 / 图集）
-- 需手动在 Supabase SQL 编辑器执行（项目不做自动迁移）
--
-- 新列均可空、默认空，现有课程与纯视频课程零影响。
-- courses 表已有「公开读激活项、管理员读写」RLS，新列继承表级策略，无需改 policy。

alter table public.courses
  add column if not exists audio_url text,             -- 音频讲解文件 URL（R2）
  add column if not exists body text,                  -- 长文正文（Markdown）
  add column if not exists images text[] default '{}'; -- 图片集 URL 数组

comment on column public.courses.audio_url is '音频讲解文件 URL（R2 上传后填入）';
comment on column public.courses.body is '长文正文，Markdown 格式';
comment on column public.courses.images is '图片集 URL 数组';
