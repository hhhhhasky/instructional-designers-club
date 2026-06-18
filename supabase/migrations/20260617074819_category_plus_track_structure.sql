-- Collapse Plus "module" structure into the existing course category layer.
-- New structure: plus_course_tracks -> course_categories -> courses.

alter table public.course_categories
  add column if not exists plus_track_id text;

comment on column public.course_categories.plus_track_id is
  'Plus 篇章归属。为空表示该分类不进入教学通识课 Plus 结构；非空时对应 plus_course_tracks.id。';

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'plus_course_tracks'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.course_categories'::regclass
      and conname = 'course_categories_plus_track_id_fkey'
  ) then
    alter table public.course_categories
      add constraint course_categories_plus_track_id_fkey
      foreign key (plus_track_id)
      references public.plus_course_tracks(id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists idx_course_categories_plus_track
  on public.course_categories (plus_track_id, sort_order, name);

insert into public.course_categories (name, description, sort_order, is_active, plus_track_id)
values
  ('日常课篇', '日常课设计与普通课备课场景。', 14, true, 'scenarios'),
  ('公开课篇', '公开课、赛课与展示课打磨场景。', 15, true, 'scenarios')
on conflict (name) do update
set
  plus_track_id = excluded.plus_track_id,
  is_active = true,
  description = coalesce(public.course_categories.description, excluded.description);

update public.course_categories
set plus_track_id = case
  when name in (
    '学习科学篇',
    '应用学习科学',
    '应用学习科学共读',
    '建构主义',
    '建构主义学习营',
    '认知负荷理论',
    '认知负荷理论共读',
    '罗森海因篇',
    '罗森海因共读',
    '教学幻象',
    '选修课'
  ) then 'theory'
  when name in (
    '教学原理篇',
    '教学设计',
    '教学设计101Course',
    '学情分析篇',
    '教学目标篇',
    '教学目标学习营',
    '任务情境篇',
    '真实任务设计',
    '真实任务设计实操营',
    'PBL项目式学习',
    '教学评价篇',
    '课堂管理',
    '概念教学篇',
    '讲授法篇',
    'AI 通识课'
  ) then 'design-principles'
  when name in (
    '日常课篇',
    '说课篇',
    '公开课篇',
    '课例分析',
    '复习课篇',
    '试卷讲评课篇',
    '家庭教育篇',
    '教育机构篇',
    '教育产品篇'
  ) then 'scenarios'
  else plus_track_id
end;

-- 说课 01-08 历史上部分仍挂在“教学原理篇”，这次统一回到旧分类“说课篇”。
update public.courses c
set
  category = '说课篇',
  category_id = cc.id,
  plus_track_id = null,
  plus_module_id = null,
  plus_module_order = null
from public.course_categories cc
where cc.name = '说课篇'
  and c.membership_type = 'plus'
  and regexp_replace(c.title, '\s+', '', 'g') ~ '^说课篇0[1-8]';

-- 从现在起，Plus 课程的篇章由 course_categories.plus_track_id 推导。
-- 清空旧的逐课模块字段，避免后台和前台继续维护两套结构。
update public.courses
set
  plus_track_id = null,
  plus_module_id = null,
  plus_module_order = null
where membership_type = 'plus';

notify pgrst, 'reload schema';
