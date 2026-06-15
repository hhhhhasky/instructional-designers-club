-- Plus 课程结构：篇章 -> 模块 -> 单课
-- 只给 courses 增加可空字段，并只回填 membership_type = 'plus' 的课程。
-- Pro / Free 课程保持旧分类结构，后台保存时也会清空这些 Plus 字段。

alter table public.courses
  add column if not exists plus_track_id text,
  add column if not exists plus_module_id text,
  add column if not exists plus_module_order integer,
  add column if not exists plus_lesson_order integer,
  add column if not exists plus_representative boolean default false;

comment on column public.courses.plus_track_id is 'Plus 课程篇章：theory / design-principles / scenarios';
comment on column public.courses.plus_module_id is 'Plus 课程模块 ID，例如 learning-science / goals / shuoke';
comment on column public.courses.plus_module_order is 'Plus 模块排序，空值时前端使用模块配置排序';
comment on column public.courses.plus_lesson_order is 'Plus 模块内单课排序，空值时前端使用 sort_order';
comment on column public.courses.plus_representative is '是否作为 Plus 首页代表课程候选';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_plus_track_id_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_plus_track_id_check
      check (
        plus_track_id is null
        or plus_track_id in ('theory', 'design-principles', 'scenarios')
      );
  end if;
end $$;

create index if not exists idx_courses_plus_structure
  on public.courses (plus_track_id, plus_module_order, plus_module_id, plus_lesson_order)
  where membership_type = 'plus';

create index if not exists idx_courses_plus_representative
  on public.courses (plus_representative)
  where membership_type = 'plus';

update public.courses
set
  plus_track_id = coalesce(plus_track_id, 'theory'),
  plus_module_id = coalesce(
    plus_module_id,
    case
      when category in ('学习科学篇', '应用学习科学', '应用学习科学共读') then 'learning-science'
      when category in ('建构主义', '建构主义学习营') then 'constructivism'
      when category in ('认知负荷理论', '认知负荷理论共读') then 'cognitive-load'
      when category in ('罗森海因篇', '罗森海因共读') then 'rosenshine'
      when category in ('教学幻象', '选修课') then 'teaching-illusion'
      else plus_module_id
    end
  ),
  plus_module_order = coalesce(
    plus_module_order,
    case
      when category in ('学习科学篇', '应用学习科学', '应用学习科学共读') then 10
      when category in ('建构主义', '建构主义学习营') then 20
      when category in ('认知负荷理论', '认知负荷理论共读') then 30
      when category in ('罗森海因篇', '罗森海因共读') then 40
      when category in ('教学幻象', '选修课') then 50
      else plus_module_order
    end
  ),
  plus_lesson_order = coalesce(plus_lesson_order, sort_order)
where membership_type = 'plus'
  and category in (
    '学习科学篇', '应用学习科学', '应用学习科学共读',
    '建构主义', '建构主义学习营',
    '认知负荷理论', '认知负荷理论共读',
    '罗森海因篇', '罗森海因共读',
    '教学幻象', '选修课'
  );

update public.courses
set
  plus_track_id = coalesce(plus_track_id, 'design-principles'),
  plus_module_id = coalesce(
    plus_module_id,
    case
      when category in ('教学原理篇', '教学设计', '教学设计101Course') then 'design-foundation'
      when category = '学情分析篇' then 'student-insight'
      when category in ('教学目标篇', '教学目标学习营') then 'goals'
      when category in ('任务情境篇', '真实任务设计', '真实任务设计实操营', 'PBL项目式学习') then 'task-context'
      when category in ('教学评价篇', '课堂管理') then 'assessment'
      when category = '概念教学篇' then 'concept-teaching'
      when category = '讲授法篇' then 'lecture-method'
      when category in ('AI 通识课', 'AI工具', 'AI工具应用', '教育技术', 'ClaudeCode教程', 'AI科普') then 'toolbox'
      else plus_module_id
    end
  ),
  plus_module_order = coalesce(
    plus_module_order,
    case
      when category in ('教学原理篇', '教学设计', '教学设计101Course') then 5
      when category = '学情分析篇' then 10
      when category in ('教学目标篇', '教学目标学习营') then 20
      when category in ('任务情境篇', '真实任务设计', '真实任务设计实操营', 'PBL项目式学习') then 30
      when category in ('教学评价篇', '课堂管理') then 40
      when category = '概念教学篇' then 50
      when category = '讲授法篇' then 60
      when category in ('AI 通识课', 'AI工具', 'AI工具应用', '教育技术', 'ClaudeCode教程', 'AI科普') then 100
      else plus_module_order
    end
  ),
  plus_lesson_order = coalesce(plus_lesson_order, sort_order)
where membership_type = 'plus'
  and category in (
    '教学原理篇', '教学设计', '教学设计101Course',
    '学情分析篇',
    '教学目标篇', '教学目标学习营',
    '任务情境篇', '真实任务设计', '真实任务设计实操营', 'PBL项目式学习',
    '教学评价篇', '课堂管理',
    '概念教学篇',
    '讲授法篇',
    'AI 通识课', 'AI工具', 'AI工具应用', '教育技术', 'ClaudeCode教程', 'AI科普'
  );

update public.courses
set
  plus_track_id = coalesce(plus_track_id, 'scenarios'),
  plus_module_id = coalesce(
    plus_module_id,
    case
      when category = '日常课篇' then 'daily-lesson'
      when category = '说课篇' then 'shuoke'
      when category in ('公开课篇', '课例分析') then 'open-class'
      when category in ('复习课篇', '试卷讲评课篇', '家庭教育篇', '教育机构篇', '教育产品篇') then 'future-scenarios'
      else plus_module_id
    end
  ),
  plus_module_order = coalesce(
    plus_module_order,
    case
      when category = '日常课篇' then 10
      when category = '说课篇' then 20
      when category in ('公开课篇', '课例分析') then 30
      when category in ('复习课篇', '试卷讲评课篇', '家庭教育篇', '教育机构篇', '教育产品篇') then 90
      else plus_module_order
    end
  ),
  plus_lesson_order = coalesce(plus_lesson_order, sort_order)
where membership_type = 'plus'
  and category in (
    '日常课篇',
    '说课篇',
    '公开课篇', '课例分析',
    '复习课篇', '试卷讲评课篇', '家庭教育篇', '教育机构篇', '教育产品篇'
  );

-- 说课 01-08 的旧分类是「教学原理篇」，但课程目的本身是解决说课任务，
-- 因此优先放入「场景篇 / 说课篇」。
update public.courses
set
  plus_track_id = 'scenarios',
  plus_module_id = 'shuoke',
  plus_module_order = 20,
  plus_lesson_order = coalesce(sort_order, plus_lesson_order),
  plus_representative = case
    when title like '%说课篇01%' or title like '%说课篇02%' or title like '%说课篇07%' then true
    else plus_representative
  end
where membership_type = 'plus'
  and title ~ '说课篇0[1-8]';

update public.courses
set plus_representative = true
where membership_type = 'plus'
  and (
    title in (
      '学习科学导论',
      '初识认知负荷理论',
      '初识罗森海因教学原理',
      '教学目标设计三步法',
      '用户洞察工具箱',
      '任务脚本：如何从0到1原创任务？',
      '说课篇01：整体结构',
      '公开课任务情境导入',
      '单课任务驱动：任务串与子任务拆解'
    )
    or title like '%教学目标设计三步法%'
    or title like '%用户洞察工具箱%'
    or title like '%说课篇01%'
    or title like '%公开课任务情境导入%'
    or title like '%单课任务驱动%'
  );
