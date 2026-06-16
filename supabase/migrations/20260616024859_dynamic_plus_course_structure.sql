-- ============================================================
-- Plus 课程结构动态配置
-- 目标：篇章 / 模块由 Supabase 数据维护，前端读取后自动渲染。
-- 说明：
-- - courses.plus_track_id / plus_module_id 仍保存单课归属。
-- - plus_course_tracks / plus_course_modules 保存可展示的篇章和模块定义。
-- - 前端会优先读取这两张表；若某课程写入了新 module id 但未建模块定义，
--   前端仍会按课程字段自动合成一个临时模块，避免课程不可见。
-- ============================================================

-- 旧约束只允许三个固定篇章，不适合后台动态扩展。
alter table public.courses
  drop constraint if exists courses_plus_track_id_check;

create table if not exists public.plus_course_tracks (
  id text primary key,
  title text not null,
  short_title text not null default '',
  subtitle text not null default '',
  description text not null default '',
  audience text not null default '',
  icon_key text not null default 'book-open',
  accent text not null default 'from-[#2a7a6e] to-[#c45d3e]',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plus_course_tracks is 'Plus 课程篇章定义。前端课程地图和篇章页从这里读取，不再写死在代码中。';
comment on column public.plus_course_tracks.id is '篇章 ID，对应 courses.plus_track_id，例如 theory / design-principles / scenarios';
comment on column public.plus_course_tracks.icon_key is '前端图标 key；未知值会回退到 book-open';
comment on column public.plus_course_tracks.accent is '前端 Tailwind 渐变 class，例如 from-[#2a7a6e] to-[#c45d3e]';

create table if not exists public.plus_course_modules (
  id text not null,
  track_id text not null references public.plus_course_tracks(id) on delete cascade,
  title text not null,
  short_title text,
  description text not null default '',
  sort_order integer not null default 0,
  category_names text[] not null default '{}'::text[],
  representative_titles text[] not null default '{}'::text[],
  icon_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (track_id, id)
);

comment on table public.plus_course_modules is 'Plus 课程模块定义。新增模块只需插入这里并让课程写入对应 plus_module_id。';
comment on column public.plus_course_modules.id is '模块 ID，对应 courses.plus_module_id，例如 learning-science / goals / shuoke';
comment on column public.plus_course_modules.track_id is '所属篇章 ID，对应 plus_course_tracks.id';
comment on column public.plus_course_modules.category_names is '旧分类自动归属 / 跨场景复用用的分类名称列表';
comment on column public.plus_course_modules.representative_titles is '首页代表课程标题匹配列表';
comment on column public.plus_course_modules.icon_key is '可选前端图标 key；空值按模块 ID 默认映射';

create index if not exists idx_plus_course_tracks_active_order
  on public.plus_course_tracks (is_active, sort_order, id);

create index if not exists idx_plus_course_modules_track_active_order
  on public.plus_course_modules (track_id, is_active, sort_order, id);

alter table public.plus_course_tracks enable row level security;
alter table public.plus_course_modules enable row level security;

drop policy if exists "public read active plus_course_tracks" on public.plus_course_tracks;
create policy "public read active plus_course_tracks"
  on public.plus_course_tracks for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "admin manage plus_course_tracks" on public.plus_course_tracks;
drop policy if exists "admin insert plus_course_tracks" on public.plus_course_tracks;
create policy "admin insert plus_course_tracks"
  on public.plus_course_tracks for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update plus_course_tracks" on public.plus_course_tracks;
create policy "admin update plus_course_tracks"
  on public.plus_course_tracks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete plus_course_tracks" on public.plus_course_tracks;
create policy "admin delete plus_course_tracks"
  on public.plus_course_tracks for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "public read active plus_course_modules" on public.plus_course_modules;
create policy "public read active plus_course_modules"
  on public.plus_course_modules for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "admin manage plus_course_modules" on public.plus_course_modules;
drop policy if exists "admin insert plus_course_modules" on public.plus_course_modules;
create policy "admin insert plus_course_modules"
  on public.plus_course_modules for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update plus_course_modules" on public.plus_course_modules;
create policy "admin update plus_course_modules"
  on public.plus_course_modules for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete plus_course_modules" on public.plus_course_modules;
create policy "admin delete plus_course_modules"
  on public.plus_course_modules for delete
  to authenticated
  using (public.is_admin());

grant select on table public.plus_course_tracks, public.plus_course_modules to anon, authenticated;
grant insert, update, delete on table public.plus_course_tracks, public.plus_course_modules to authenticated;
grant all on table public.plus_course_tracks, public.plus_course_modules to service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_plus_course_tracks_updated_at on public.plus_course_tracks;
create trigger trg_plus_course_tracks_updated_at
  before update on public.plus_course_tracks
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_plus_course_modules_updated_at on public.plus_course_modules;
create trigger trg_plus_course_modules_updated_at
  before update on public.plus_course_modules
  for each row execute function public.touch_updated_at();

insert into public.plus_course_tracks
  (id, title, short_title, subtitle, description, audience, icon_key, accent, sort_order, is_active)
values
  ('theory', '理论篇', '理论基石', '理解学习、教学和认知的底层规律', '回答“学习如何发生、教学为什么有效、哪些方法有研究依据”。适合作为长期复盘和专业进阶的理论库。', '想把教学设计做深、做稳的老师', 'brain', 'from-[#8b5a2b] to-[#c45d3e]', 10, true),
  ('design-principles', '教学设计原理篇', '设计原理', '把理论转化为可操作的备课方法', '围绕教材、学情、目标、任务、讲授和评价形成一节课的设计闭环。', '想系统提升教学设计能力的一线老师', 'target', 'from-[#2a7a6e] to-[#c45d3e]', 20, true),
  ('scenarios', '场景篇', '场景应用', '把教学设计原理用到真实任务里', '不按知识点拆课，而按老师正在完成的任务组织内容：日常备课、说课、公开课和未来场景。', '马上要备课、说课或打磨公开课的老师', 'compass', 'from-[#b8860b] to-[#2a7a6e]', 30, true)
on conflict (id) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  audience = excluded.audience,
  icon_key = excluded.icon_key,
  accent = excluded.accent,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.plus_course_modules
  (track_id, id, title, short_title, description, sort_order, category_names, representative_titles, icon_key, is_active)
values
  ('theory', 'learning-science', '学习科学', null, '建立对学习科学、教学科学和评估科学的基础认识。', 10, array['学习科学篇', '应用学习科学', '应用学习科学共读'], array['学习科学导论', '初识学习科学', '初识教学科学'], 'graduation-cap', true),
  ('theory', 'constructivism', '建构主义', null, '理解知识观、学习观、教学观，以及它们如何影响教学设计。', 20, array['建构主义', '建构主义学习营'], array['建构主义的知识观', '建构主义的学习观', '建构主义的教学设计'], 'lightbulb', true),
  ('theory', 'cognitive-load', '认知负荷理论', null, '用工作记忆和负荷管理解释知识呈现、任务安排与练习设计。', 30, array['认知负荷理论', '认知负荷理论共读'], array['初识认知负荷理论', '认知负荷理论基本原理', '优化内部认知负荷的教学策略'], 'brain', true),
  ('theory', 'rosenshine', '罗森海因教学原理', '罗森海因', '把有效教学研究转化为清晰讲解、提问、复习和练习策略。', 40, array['罗森海因篇', '罗森海因共读'], array['初识罗森海因教学原理', '教学原理01：调扶放', '教学原理03：勤复习'], 'list-checks', true),
  ('theory', 'teaching-illusion', '教学幻象', null, '从常见教学误区切入，辨析课堂中“看似有效”的幻象。', 50, array['教学幻象', '选修课'], array['教学幻象'], 'sparkles', true),
  ('design-principles', 'design-foundation', '设计总论', null, '建立教学设计的整体框架，理解一节课从问题到方案的基本逻辑。', 5, array['教学原理篇', '教学设计', '教学设计101Course'], array['教学设计', '教学原理', '整体结构'], 'layers', true),
  ('design-principles', 'student-insight', '学情分析', null, '从用户洞察、质量光谱和工具箱入手，判断学生真实学习起点。', 10, array['学情分析篇'], array['为什么需要用户洞察？', '洞察三维度', '用户洞察工具箱'], 'compass', true),
  ('design-principles', 'goals', '教学目标', null, '用布鲁姆、马扎诺和 SOLO 等框架，把课标和教材转成可执行目标。', 20, array['教学目标篇', '教学目标学习营'], array['初识布鲁姆教育目标分类学框架', '教学目标设计三步法', '分析12个优质课教案的教学目标'], 'target', true),
  ('design-principles', 'task-context', '任务情境', null, '从真实任务、KMR、任务脚本到任务串，设计有驱动力的学习活动。', 30, array['任务情境篇', '真实任务设计', '真实任务设计实操营', 'PBL项目式学习'], array['AI时代为什么需要任务教学？', 'KMR设计法：如何改造课后习题？', '任务脚本：如何从0到1原创任务？'], 'layers', true),
  ('design-principles', 'assessment', '教学评价', null, '用逆向设计、提问互动、评价量规和课堂小结形成评价闭环。', 40, array['教学评价篇', '课堂管理'], array['为什么现在这么看重评价？', '评价方法1：逆向设计', '评价方法3：评价量规'], 'clipboard-check', true),
  ('design-principles', 'concept-teaching', '概念教学', null, '从“教教材”转向“教概念”，掌握归纳和演绎两类核心策略。', 50, array['概念教学篇'], array['为什么你需要掌握概念教学？', '重新理解概念', '如何教概念：归纳策略'], 'book-open', true),
  ('design-principles', 'lecture-method', '讲授法', null, '重新认识讲授，设计纯讲授、互动讲授和讲授形式。', 60, array['讲授法篇'], array['重新认识讲授法', '如何设计60分钟纯粹讲授？', '如何设计互动讲授？'], 'message-square', true),
  ('design-principles', 'toolbox', 'AI 与工具箱', null, 'AI 通识、图片/PPT 生成、NotebookLM 等工具内容，适合作为学习过程中的辅助资源。', 100, array['AI 通识课', 'AI工具', 'AI工具应用', '教育技术', 'ClaudeCode教程', 'AI科普'], array['AI 通识课', 'NotebookLM', 'Gemini'], 'sparkles', false),
  ('scenarios', 'daily-lesson', '日常课篇', null, '用最小闭环快速完成普通课设计：教材、学情、目标、活动、评价。', 10, array['日常课篇', '讲授法篇', '罗森海因篇'], array['单课任务驱动：任务串与子任务拆解', '如何设计互动讲授？', '教学原理03：勤复习'], 'file-text', true),
  ('scenarios', 'shuoke', '说课篇', null, '完整保留说课 01-08，解决说课结构、表达和评委沟通问题。', 20, array['说课篇'], array['说课篇01：整体结构', '说课篇02：教材分析', '说课篇07：教学过程'], 'message-square', true),
  ('scenarios', 'open-class', '公开课篇', null, '从选题、教材深挖、任务情境、主问题到磨课和材料包。', 30, array['公开课篇', '课例分析'], array['公开课任务情境导入', '初中思政同课异构《历久弥新的思想理念》', '公开课案例拆解'], 'presentation', true),
  ('scenarios', 'future-scenarios', '未来场景', null, '复习课、试卷讲评课、家庭教育、教育机构和教育产品等后续扩展方向。', 90, array['复习课篇', '试卷讲评课篇', '家庭教育篇', '教育机构篇', '教育产品篇'], array[]::text[], 'refresh-ccw', true)
on conflict (track_id, id) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  category_names = excluded.category_names,
  representative_titles = excluded.representative_titles,
  icon_key = excluded.icon_key,
  is_active = excluded.is_active;
