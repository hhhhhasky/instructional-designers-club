begin;

-- HAI Work 新增「教学设计」工具大类（teaching-design），承载多种成熟教学方法的设计 skill。
-- 首个 skill：单元逆向设计规划（backwards-design，中国中小学版，输出中文 Markdown）。
-- 复用既有 work 链路：loadModule / loadSelectedSkill / buildWorkPrompt / Markdown 直出。

insert into public.hai_feature_modules (
  slug,
  name,
  short_label,
  description,
  icon_key,
  category,
  input_schema,
  default_model,
  default_temperature,
  default_max_output_tokens,
  thinking_enabled,
  sort_order,
  is_enabled,
  surface_mode
)
values (
  'teaching-design',
  '教学设计',
  '教学设计',
  '依据学段、学科与预期成果，用成熟教学方法（逆向设计等）生成完整单元规划，对齐中国课程标准与核心素养。',
  'layout-template',
  'HAI Work',
  '[
    {"name":"stage","label":"学段","type":"text","required":true},
    {"name":"subject","label":"学科","type":"text","required":true},
    {"name":"grade","label":"年级","type":"text","required":false},
    {"name":"design_type","label":"设计类型","type":"text","required":true,"default":"backwards-design","readonly":true},
    {"name":"desired_outcomes","label":"预期成果","type":"textarea","required":true},
    {"name":"unit_duration","label":"课时数","type":"text","required":true}
  ]'::jsonb,
  'deepseek-v4-flash',
  0.30,
  10000,
  false,
  40,
  true,
  'work'
)
on conflict (slug) do update set
  name = excluded.name,
  short_label = excluded.short_label,
  description = excluded.description,
  icon_key = excluded.icon_key,
  category = excluded.category,
  input_schema = excluded.input_schema,
  default_model = excluded.default_model,
  default_temperature = excluded.default_temperature,
  default_max_output_tokens = excluded.default_max_output_tokens,
  thinking_enabled = excluded.thinking_enabled,
  surface_mode = excluded.surface_mode,
  sort_order = excluded.sort_order,
  is_enabled = true,
  updated_at = now();

insert into public.hai_work_skills (
  slug,
  module_slug,
  name,
  description,
  match_criteria,
  priority,
  is_fallback,
  is_enabled
)
values (
  'backwards-unit-planner',
  'teaching-design',
  '单元逆向设计规划',
  '用逆向设计方法规划教学单元：先定预期结果，再定评估证据，最后排学习活动，落实大概念与教-学-评一致性。面向中国中小学，输出中文。',
  '{"design_types":["backwards-design"]}'::jsonb,
  0,
  true,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  match_criteria = excluded.match_criteria,
  priority = excluded.priority,
  is_fallback = excluded.is_fallback,
  is_enabled = excluded.is_enabled,
  updated_at = now();

insert into public.hai_work_skill_versions (
  skill_id,
  version_label,
  status,
  prompt_template,
  input_contract,
  output_contract,
  published_at
)
select
  id,
  'v1',
  'published',
  $prompt$
你是一名资深教研员与课程设计专家，精通“逆向设计（Backward Design）”单元规划方法，熟悉《义务教育课程标准（2022 年版）》与《普通高中课程标准》中的核心素养、学科核心素养与学业质量要求，理解崔允漷“大概念教学”与“教-学-评一致性”。你面向中国中小学一线教师，用专业但直白的语言产出可直接使用的单元规划。

你的任务：依据“## 任务输入”中提供的学段、学科、年级、预期成果、课时数，设计一份完整的“阶段一 预期结果 → 阶段二 评估证据 → 阶段三 学习计划”单元规划，并做对齐检查。任务输入以 JSON 给出，其中字段可能缺失；缺失时按常理合理设定并在文中简要说明，不得编造教材中不存在的事实。

请遵循以下原则：

1. 阶段一 预期结果
   - 先识别统领全单元的“大概念”（可迁移的核心观念），再用它统整目标。
   - 持久理解：写 2-3 条“学生将理解……”的可迁移理解，指向学科核心素养，而非零散事实。
   - 核心问题：写 2-3 个真正开放、能贯穿全单元、引发持续探究的问题，避免只有唯一标准答案的题。
   - 学生将知道：本单元的关键事实、概念、术语。
   - 学生将能做：本单元要培养的具体能力/技能，对接核心素养表现。

2. 阶段二 评估证据（务必先于教学设计）
   - 这是逆向设计的核心：先想清楚“学到什么程度才算成功”。
   - 表现性任务：设计一个真实情境下的任务，要求学生迁移应用所学（不只是回忆），并给出该任务评估哪些阶段一目标、以及简要的成功标准。体现教-学-评一致性与表现性评价。
   - 其他证据：随堂检测、关键问题（hinge question）、课堂观察、作业等过程性评价，用表格对应到具体的阶段一目标。
   - 阶段一的每一条持久理解与核心问题，都必须能在阶段二找到评估证据。

3. 阶段三 学习计划
   - 按课时（或阶段）排出序列，每课时写清：学生做什么、指向哪个阶段一目标、如何为阶段二评估做准备。
   - 用中国教师熟悉的课堂环节组织（如：情境导入 → 探究建构 → 归纳总结 → 迁移应用 → 评价反馈），逻辑上先搭建知识再应用、先扶后放。
   - 课时长度按学段实际：小学一般 40 分钟，初中、高中一般 45 分钟。
   - 每个活动都应能回答“它如何帮助学生达成被评估的目标”；与评估无关的活动要质疑其必要性。

4. 对齐检查
   - 用表格核验：每条阶段一目标，在阶段二是否被评估、在阶段三是否教学，标注是否对齐。
   - 明确指出任何脱节：写了却没评的、评了却没教的。

表达要求：全文用中文，专业但直白，面向一线教师；避免空话套话（如“激发兴趣”“培养能力”而无具体做法）。只输出 Markdown，不使用代码围栏包裹全文。

输出严格采用以下结构（标题与层级保持一致，内容用中文填充）：

## 单元规划：[单元标题]

**学段 / 年级：** [stage] · [grade]
**学科：** [subject]
**课时：** [unit_duration]
**大概念：** [统领全单元的可迁移核心观念]

### 阶段一　预期结果

**持久理解**
[2-3 条“学生将理解……”的可迁移理解]

**核心问题**
[2-3 个开放式、贯穿单元的探究问题]

**学生将知道：**
[关键事实、概念、术语]

**学生将能做：**
[对接核心素养的具体能力]

### 阶段二　评估证据

**表现性任务**
[真实情境任务：情境 + 学生要产出的成果 + 评估哪些阶段一目标 + 简要成功标准]

**其他证据**
| 课时 | 评价方式 | 对应的阶段一目标 |
|------|----------|------------------|

### 阶段三　学习计划

[逐课时序列，例如：
**第 1 课时 — [主题]**
- 学生活动：……
- 指向目标：……
- 对接评估：……]

### 对齐检查

| 阶段一目标 | 阶段二是否评估 | 阶段三是否教学 | 是否对齐 |
|------------|----------------|----------------|----------|

[若发现脱节，在此明确说明]

输出前自检：(a) 持久理解是可迁移的大概念而非零散事实；(b) 核心问题真正开放且贯穿单元；(c) 表现性任务要求迁移应用而非单纯回忆；(d) 评估在逻辑上先于教学设计；(e) 每条阶段一目标都既有评估又有教学；(f) 学习计划层层递进、最终支撑表现性任务。
$prompt$,
  '{"format":"backwards_unit_plan_v1","required":["stage","subject","design_type","desired_outcomes","unit_duration"],"optional":["grade","topic","textbook","student_profiles","constraints"]}'::jsonb,
  '{"format":"backwards_unit_plan_v1","output":"markdown","sections":["阶段一 预期结果","阶段二 评估证据","阶段三 学习计划","对齐检查"]}'::jsonb,
  now()
from public.hai_work_skills
where slug = 'backwards-unit-planner'
on conflict (skill_id, version_label) do nothing;

update public.hai_work_skill_versions
set default_prompt_template = prompt_template
where default_prompt_template = ''
  and skill_id = (select id from public.hai_work_skills where slug = 'backwards-unit-planner');

notify pgrst, 'reload schema';

commit;
