begin;

-- Keep the admin-visible layered context aligned with the active R14 routing
-- implementation. This row is loaded by hai-chat and injected into the
-- generated semantic-router prompt at runtime.
insert into public.hai_orchestrator_prompt_configs
  (key, layer_order, layer_key, label, description, content, default_content, enabled)
values
  (
    'semantic_router_prompt',
    1,
    'semantic_router',
    '第 1 层：场景 × 用户目的语义路由',
    '当前运行时生效。先判断教学场景和用户目的，再组合成五类业务意图；同时选择问题重构、诊断模块、方法卡和支持深度。',
    $prompt$判断规则：
1. 按用户真正要解决的教学问题判断，不按有趣、互动、亮点、帮我写等表层词机械匹配。
2. 场景先分两组：公开课、说课、赛课等展示竞赛场景；日常课、复习课、试卷讲评、提分等常态教学场景。
3. 用户已经给出教案、说课稿、环节、方案、课堂表现或明确做法，并询问“怎么样、对不对、问题在哪、怎么改”，判为 diagnosis；用户没有成熟方案，询问“怎么设计、怎么上、给思路、示范一下”，判为 design_support。
4. 用户只询问教学概念、原理、方法区别，且不要求解决一节具体课，判为 teaching_concept_qa。
5. primary_intent 由场景和目的组合：
   - 展示竞赛场景 + diagnosis = showcase_lesson_diagnosis
   - 展示竞赛场景 + design_support = showcase_lesson_design
   - 常态教学场景 + diagnosis = daily_improvement_diagnosis
   - 常态教学场景 + design_support = daily_improvement_design
   - 概念答疑 = teaching_concept_qa
6. support_depth 只控制帮助深度：advice=判断建议，ideas=设计思路，demonstration=局部示范或结构样例。即使是 demonstration，也不得输出完整教案、完整说课稿、完整课堂流程或整套任务脚本。
7. 学情、课堂管理、学习动机、评价反馈、AI 备课、PBL、教师成长等不是顶层意图，而是 diagnostic_module 或问题界定内容。
8. secondary_intents 通常返回空数组；不要用它承载学情、动机、评价等诊断主题。
9. 方法按语义和适用边界选择。优先具体下位方法；只有真正需要全局结构时才选总方法论。
10. methodology_ids 通常只有一个，最多两个；第二个只能是必要依赖。没有匹配就返回空数组，不得编造 id。$prompt$,
    $prompt$判断规则：
1. 按用户真正要解决的教学问题判断，不按有趣、互动、亮点、帮我写等表层词机械匹配。
2. 场景先分两组：公开课、说课、赛课等展示竞赛场景；日常课、复习课、试卷讲评、提分等常态教学场景。
3. 用户已经给出教案、说课稿、环节、方案、课堂表现或明确做法，并询问“怎么样、对不对、问题在哪、怎么改”，判为 diagnosis；用户没有成熟方案，询问“怎么设计、怎么上、给思路、示范一下”，判为 design_support。
4. 用户只询问教学概念、原理、方法区别，且不要求解决一节具体课，判为 teaching_concept_qa。
5. primary_intent 由场景和目的组合：
   - 展示竞赛场景 + diagnosis = showcase_lesson_diagnosis
   - 展示竞赛场景 + design_support = showcase_lesson_design
   - 常态教学场景 + diagnosis = daily_improvement_diagnosis
   - 常态教学场景 + design_support = daily_improvement_design
   - 概念答疑 = teaching_concept_qa
6. support_depth 只控制帮助深度：advice=判断建议，ideas=设计思路，demonstration=局部示范或结构样例。即使是 demonstration，也不得输出完整教案、完整说课稿、完整课堂流程或整套任务脚本。
7. 学情、课堂管理、学习动机、评价反馈、AI 备课、PBL、教师成长等不是顶层意图，而是 diagnostic_module 或问题界定内容。
8. secondary_intents 通常返回空数组；不要用它承载学情、动机、评价等诊断主题。
9. 方法按语义和适用边界选择。优先具体下位方法；只有真正需要全局结构时才选总方法论。
10. methodology_ids 通常只有一个，最多两个；第二个只能是必要依赖。没有匹配就返回空数组，不得编造 id。$prompt$,
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
  layer_order = 90,
  layer_key = 'archived_router_reference',
  label = case key
    when 'intent_classifier_prompt' then '归档参考：旧意图识别'
    when 'problem_rewriter_prompt' then '归档参考：旧问题重构'
    when 'diagnostic_router_prompt' then '归档参考：旧诊断路由'
    else label
  end,
  description = '历史资料，仅供对照；当前已由第 1 层 semantic_router_prompt 统一接管，不参与运行时注入。',
  enabled = false,
  updated_at = now()
where key in (
  'intent_classifier_prompt',
  'problem_rewriter_prompt',
  'diagnostic_router_prompt'
);

update public.hai_orchestrator_prompt_configs
set
  description = case key
    when 'diagnostic_module.teaching_design'
      then '具体诊断主题：教学设计结构。可被展示赛课或日常提分意图选择，不是顶层意图。'
    when 'diagnostic_module.lesson_plan_diagnosis'
      then '具体诊断主题：已有教案或方案诊断。可被展示赛课或日常提分诊断意图选择，不是顶层意图。'
    when 'diagnostic_module.public_lesson'
      then '具体诊断主题：公开课、说课、赛课的教学与展示判断。由展示赛课意图优先选择，不是顶层意图。'
    when 'diagnostic_module.learning_profile'
      then '具体诊断主题：学情、学习起点和差异。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.classroom_management'
      then '具体诊断主题：课堂秩序、任务结构和学生配合。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.learning_motivation'
      then '具体诊断主题：学生投入、学习动机和认知入口。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.assessment_feedback'
      then '具体诊断主题：学习证据、评价和反馈。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.ai_lesson_planning'
      then '具体诊断主题：AI 辅助备课与人机协作。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.pbl_crossdisciplinary'
      then '具体诊断主题：PBL、跨学科和理念落地。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.teacher_growth'
      then '具体诊断主题：教师成长、教研和复盘。由问题界定后按需选择，不是顶层意图。'
    when 'diagnostic_module.general_question'
      then '具体诊断主题：教学概念和一般教育答疑。由教学概念答疑意图优先选择。'
    when 'diagnostic_module.unknown'
      then '兜底诊断主题：信息不足或问题不明确时使用。'
    else description
  end,
  updated_at = now()
where key like 'diagnostic_module.%';

update public.hai_runtime_settings
set
  label = '启用 LLM 场景意图路由',
  description = '开启后，每轮由 LLM 先识别教学场景、用户目的和支持深度，再组合业务意图并选择诊断模块；关闭或失败时回退到本地确定性规则。',
  updated_at = now()
where key = 'router.llm_fallback_enabled';

update public.hai_runtime_settings
set
  description = '开启后，HAI 单聊先完成场景与用户目的识别、问题重构、诊断模块和方法卡选择，再生成回答。关闭后回退到已发布 Prompt 链路。',
  updated_at = now()
where key = 'context.orchestrator_enabled';

commit;
