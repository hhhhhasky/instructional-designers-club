-- 新增方法卡：公开课亮点（学习性优先）
-- 来源：docs/HAI语料/03-公开课与展示课.md + _shared/hai_orchestrator/modules/public_lesson.md
-- 用途：展示赛课诊断/设计在"逻辑链"之外的另一根柱——"亮点"维度。
--      关键词没命中方法卡时，作为 showcase_lesson_diagnosis / showcase_lesson_design
--      的诊断模块默认兜底卡之一（与 design-logic-chain 配对）。
-- 只增不改；ON CONFLICT 保幂等。应用需用户授权。

begin;

insert into public.hai_method_card_configs (
  id, name, aliases, course, kind, ownership, priority,
  summary, use_when, avoid_when, core_judgement, moves, answer_focus,
  query_terms, intents, related, source_refs, enabled, is_deleted
) values (
  'public-lesson-highlight',
  '公开课亮点（学习性优先）',
  array['学习性亮点', '公开课创新', '亮点与形式', '有看头有讲头'],
  '公开课与展示课',
  'strategy',
  'han_course',
  98,
  '公开课的亮点不是用了什么新技术或形式，而是学生在这节课上真实发生、能被所有人看见的理解变化；形式只有在服务目标和学情时才成为亮点，否则是包装。',
  array[
    '被要求有亮点或创新但担心牺牲真实学习',
    '把亮点等同于热闹活动、AI、闯关、小组合作或炫酷PPT',
    '公开课活动太多、形式太重，分不清哪个是必需的',
    '选课题纠结熟悉的还是出彩的'
  ],
  array[
    '还没确认评审环境和用户目标（拿奖或本心）就谈亮点',
    '教学目标和学习主线还没建立，谈亮点为时过早',
    '日常常态课（非展示赛课），亮点不是核心目标'
  ],
  '真正的亮点是学生从“原来以为…”到“现在明白了…”的、能被证明的理解变化；形式（AI/技术/合作/情境）本身不是亮点，只有当它推动了这个变化、且传统手段做不到时才成为亮点。',
  array[
    '先确认评审环境和用户目标，判断形式是否必须、必须到什么程度',
    '不从形式里找亮点，先问学生从原来以为什么变成现在明白了什么',
    '设计一个误解暴露或认知转折环节作为亮点核心',
    '逐个活动追问它让学生发生了什么能被证明的理解变化，答不出就删或改',
    '形式只在解决传统做不了或做不好时才加，且紧扣目标与学情'
  ],
  '先帮用户重定义亮点（学习性还是形式性），再检查他最想展示的活动是否对应一个能被证明的理解变化；不替用户堆形式清单，也不否定他对评审现实的顾虑。',
  array['亮点', '创新', '出彩', '有看头', 'AI赋能', '闯关', '小组合作', '情境', '学习性亮点', '形式亮点', '显得落后'],
  array['public_lesson', 'teaching_design', 'lesson_plan_diagnosis'],
  array['design-logic-chain', 'core-growth-evidence', 'backward-design', 'task-motivation-hook'],
  array['docs/HAI语料/03-公开课与展示课.md', 'supabase/functions/_shared/hai_orchestrator/modules/public_lesson.md'],
  true,
  false
)
on conflict (id) do nothing;

commit;
