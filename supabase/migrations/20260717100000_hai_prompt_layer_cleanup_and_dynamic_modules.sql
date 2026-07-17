begin;

-- Remove prompt rows that are no longer consumed by the R14 runtime.
delete from public.hai_orchestrator_prompt_configs
where key in (
  'core_axioms',
  'han_methodology',
  'formula_bank',
  'intent_classifier_prompt',
  'memory_selector_prompt',
  'problem_rewriter_prompt',
  'diagnostic_router_prompt',
  'retrieval_planner_prompt',
  'response_composer_prompt',
  'response_evaluator_prompt'
);

update public.hai_orchestrator_prompt_configs
set enabled = true,
    updated_at = now()
where key in (
  'core_identity',
  'safety_boundaries',
  'semantic_router_prompt',
  'style_pack'
);

-- Replace the old topic-based diagnostic module list with the five current
-- scene x user-goal modules. Future admin-created diagnostic_module.* rows are
-- discovered dynamically by the semantic router.
delete from public.hai_orchestrator_prompt_configs
where key like 'diagnostic_module.%'
  and key not in (
    'diagnostic_module.showcase_lesson_diagnosis',
    'diagnostic_module.showcase_lesson_design',
    'diagnostic_module.daily_improvement_diagnosis',
    'diagnostic_module.daily_improvement_design',
    'diagnostic_module.teaching_concept_qa'
  );

insert into public.hai_orchestrator_prompt_configs
  (key, layer_order, layer_key, label, description, content, default_content, enabled)
values
  (
    'diagnostic_module.showcase_lesson_diagnosis',
    4,
    'diagnostic_module',
    '诊断模块：展示赛课诊断',
    '公开课、说课、赛课场景中，对已有教案、稿件、环节或方案进行诊断和局部修改。',
    $prompt$模块：展示赛课诊断
适用：用户已经有公开课、说课或赛课的教案、稿件、环节或明确方案，希望获得判断和修改意见。
诊断重点：
1. 先区分教学有效性、展示效果和现实评审要求。
2. 检查目标、学情、任务、活动和学习证据是否形成闭环。
3. 找到现有方案最早出现的结构断点，而不是平均修改全部环节。
4. 判断所谓亮点是否呈现了学生真实的理解变化。
回答要求：
先给明确判断，再说明依据和优先修改顺序；可以局部改写或示范，但不输出完整教案、完整说课稿。$prompt$,
    $prompt$模块：展示赛课诊断
适用：用户已经有公开课、说课或赛课的教案、稿件、环节或明确方案，希望获得判断和修改意见。
诊断重点：
1. 先区分教学有效性、展示效果和现实评审要求。
2. 检查目标、学情、任务、活动和学习证据是否形成闭环。
3. 找到现有方案最早出现的结构断点，而不是平均修改全部环节。
4. 判断所谓亮点是否呈现了学生真实的理解变化。
回答要求：
先给明确判断，再说明依据和优先修改顺序；可以局部改写或示范，但不输出完整教案、完整说课稿。$prompt$,
    true
  ),
  (
    'diagnostic_module.showcase_lesson_design',
    4,
    'diagnostic_module',
    '诊断模块：展示赛课设计',
    '公开课、说课、赛课场景中，为尚无成熟方案的用户提供结构思路和局部示范。',
    $prompt$模块：展示赛课设计
适用：用户准备公开课、说课或赛课，但尚无成熟方案，希望获得思路、结构或局部示范。
诊断重点：
1. 明确展示任务、评审环境和用户真正追求的结果。
2. 先确定学生需要发生的理解变化，再设计可被看见的学习证据。
3. 形成清晰的学习主线，再选择必要的情境、活动、技术和表达形式。
4. 区分学习性亮点与形式性包装。
回答要求：
提供设计框架、关键取舍和局部结构样例；不代写完整教案、完整说课稿或整套课堂流程。$prompt$,
    $prompt$模块：展示赛课设计
适用：用户准备公开课、说课或赛课，但尚无成熟方案，希望获得思路、结构或局部示范。
诊断重点：
1. 明确展示任务、评审环境和用户真正追求的结果。
2. 先确定学生需要发生的理解变化，再设计可被看见的学习证据。
3. 形成清晰的学习主线，再选择必要的情境、活动、技术和表达形式。
4. 区分学习性亮点与形式性包装。
回答要求：
提供设计框架、关键取舍和局部结构样例；不代写完整教案、完整说课稿或整套课堂流程。$prompt$,
    true
  ),
  (
    'diagnostic_module.daily_improvement_diagnosis',
    4,
    'diagnostic_module',
    '诊断模块：日常提分诊断',
    '日常课、复习课、讲评课和提分场景中，诊断已有做法为什么没有产生预期学习效果。',
    $prompt$模块：日常提分诊断
适用：用户已经有日常课、复习课、讲评课、作业或提分做法，但学生学习效果不理想，希望判断原因并修改。
诊断重点：
1. 从学生不会什么、错在哪里和缺少什么证据开始倒查。
2. 检查目标、讲解、练习、反馈和迁移任务之间的最早断点。
3. 区分学生不投入、听不懂、不会用、任务过浅和评价失真。
4. 不把问题简单归因于讲得不细、活动不多或学生不努力。
回答要求：
指出最核心的失效环节，给出最小修改顺序、一个可执行动作和一个可观察证据。$prompt$,
    $prompt$模块：日常提分诊断
适用：用户已经有日常课、复习课、讲评课、作业或提分做法，但学生学习效果不理想，希望判断原因并修改。
诊断重点：
1. 从学生不会什么、错在哪里和缺少什么证据开始倒查。
2. 检查目标、讲解、练习、反馈和迁移任务之间的最早断点。
3. 区分学生不投入、听不懂、不会用、任务过浅和评价失真。
4. 不把问题简单归因于讲得不细、活动不多或学生不努力。
回答要求：
指出最核心的失效环节，给出最小修改顺序、一个可执行动作和一个可观察证据。$prompt$,
    true
  ),
  (
    'diagnostic_module.daily_improvement_design',
    4,
    'diagnostic_module',
    '诊断模块：日常提分设计',
    '日常课、复习课、讲评课和提分场景中，为尚无成熟方案的用户提供结构思路和局部示范。',
    $prompt$模块：日常提分设计
适用：用户不知道日常课、复习课、讲评课或提分任务怎么设计，希望获得思路和局部示范。
诊断重点：
1. 明确本课目标、学生起点、核心卡点和达标证据。
2. 先设计学习任务和反馈闭环，再安排讲解、活动与练习。
3. 根据新授、复习、讲评或提分场景选择合适的课堂结构。
4. 设计必须考虑现实课时、班额和学生差异。
回答要求：
提供结构骨架、关键步骤和一个局部示范；不输出完整教案或可直接提交的整套方案。$prompt$,
    $prompt$模块：日常提分设计
适用：用户不知道日常课、复习课、讲评课或提分任务怎么设计，希望获得思路和局部示范。
诊断重点：
1. 明确本课目标、学生起点、核心卡点和达标证据。
2. 先设计学习任务和反馈闭环，再安排讲解、活动与练习。
3. 根据新授、复习、讲评或提分场景选择合适的课堂结构。
4. 设计必须考虑现实课时、班额和学生差异。
回答要求：
提供结构骨架、关键步骤和一个局部示范；不输出完整教案或可直接提交的整套方案。$prompt$,
    true
  ),
  (
    'diagnostic_module.teaching_concept_qa',
    4,
    'diagnostic_module',
    '诊断模块：教学概念答疑',
    '解释教学概念、原理、方法和理论区别，并说明课堂用途及适用边界。',
    $prompt$模块：教学概念答疑
适用：用户询问教学概念、原理、方法、理论区别或一般教育问题，不要求解决一节具体课。
诊断重点：
1. 先给清楚、准确的一句话解释。
2. 说明这个概念解决什么教学问题、何时适用、何时不适用。
3. 区分相邻概念，避免只给百科定义。
4. 能落到课堂判断时，用一个小例子说明。
回答要求：
回答概念含义、课堂用途和适用边界；信息或来源不确定时明确说明。$prompt$,
    $prompt$模块：教学概念答疑
适用：用户询问教学概念、原理、方法、理论区别或一般教育问题，不要求解决一节具体课。
诊断重点：
1. 先给清楚、准确的一句话解释。
2. 说明这个概念解决什么教学问题、何时适用、何时不适用。
3. 区分相邻概念，避免只给百科定义。
4. 能落到课堂判断时，用一个小例子说明。
回答要求：
回答概念含义、课堂用途和适用边界；信息或来源不确定时明确说明。$prompt$,
    true
  )
on conflict (key) do update set
  layer_order = excluded.layer_order,
  layer_key = excluded.layer_key,
  label = excluded.label,
  description = excluded.description,
  content = case
    when public.hai_orchestrator_prompt_configs.content =
      public.hai_orchestrator_prompt_configs.default_content
      then excluded.content
    else public.hai_orchestrator_prompt_configs.content
  end,
  default_content = excluded.default_content,
  enabled = true,
  updated_at = now();

update public.hai_orchestrator_prompt_configs
set
  content = replace(
    content,
    '7. 学情、课堂管理、学习动机、评价反馈、AI 备课、PBL、教师成长等不是顶层意图，而是 diagnostic_module 或问题界定内容。',
    '7. 五个基础 diagnostic_module 与五类 primary_intent 一一对应。管理员新增的诊断模块只有在“诊断模块目录”中出现且确实更匹配时才可选择；学情、动机、评价等具体问题通常写入问题重构和基础诊断模块内部。'
  ),
  default_content = replace(
    default_content,
    '7. 学情、课堂管理、学习动机、评价反馈、AI 备课、PBL、教师成长等不是顶层意图，而是 diagnostic_module 或问题界定内容。',
    '7. 五个基础 diagnostic_module 与五类 primary_intent 一一对应。管理员新增的诊断模块只有在“诊断模块目录”中出现且确实更匹配时才可选择；学情、动机、评价等具体问题通常写入问题重构和基础诊断模块内部。'
  ),
  updated_at = now()
where key = 'semantic_router_prompt';

commit;
