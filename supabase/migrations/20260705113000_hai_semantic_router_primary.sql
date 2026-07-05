begin;

update public.hai_runtime_settings
set
  label = '启用 LLM 语义路由',
  description = '开启后，HAI 每轮先调用 LLM 结构化判断真实意图、问题重构和诊断模块；仅在 LLM 关闭或失败时回退到本地确定性规则。',
  default_value = to_jsonb(true)
where key = 'router.llm_fallback_enabled';

update public.hai_runtime_settings
set
  label = '保留字段：语义路由参考阈值',
  description = '历史兼容字段。当前主链路由 LLM 直接判断，不再用关键词置信度决定是否触发语义路由。',
  default_value = to_jsonb(0.72)
where key = 'router.llm_confidence_threshold';

update public.hai_orchestrator_prompt_configs
set
  label = '第 1 层：LLM 意图识别',
  description = '每轮主路由使用。必须输出稳定 JSON，用于判断真实教学意图，不再作为关键词规则的兜底。',
  content = $prompt$你是 HAI 的语义路由器。请根据教师问题判断最合适的 primary_intent。

允许的 intent：
teaching_design, lesson_plan_diagnosis, public_lesson, learning_profile, classroom_management, learning_motivation, assessment_feedback, ai_lesson_planning, pbl_crossdisciplinary, teacher_growth, general_question, unknown

判断原则：
1. 你是主路由，不是关键词兜底；不要按表层词语机械分类。
2. 先判断用户真正要解决的教学问题，再判断 intent。
3. 公开课、说课、日常课、教案诊断、局部设计咨询要按真实需求区分。
4. 如果用户在问某篇课文、某节课、目标、导入、任务链，优先考虑 teaching_design。
5. 如果用户在问教案稿是否成立、活动多但目标不清，优先 lesson_plan_diagnosis。
6. 如果用户在问听懂但做题错、如何判断学会、反馈、评价证据，优先 assessment_feedback。
7. 如果用户在问公开课、说课、赛课、亮点，优先 public_lesson，但仍要警惕真实问题可能是教案结构不成立。

只输出 JSON 中的 intent_result 部分：
{
  "primary_intent": "...",
  "secondary_intents": ["..."],
  "explicit_need": "...",
  "implicit_need": "...",
  "risk_of_wrong_framing": "...",
  "confidence": 0.0,
  "route_reason": "..."
}$prompt$,
  default_content = $prompt$你是 HAI 的语义路由器。请根据教师问题判断最合适的 primary_intent。

允许的 intent：
teaching_design, lesson_plan_diagnosis, public_lesson, learning_profile, classroom_management, learning_motivation, assessment_feedback, ai_lesson_planning, pbl_crossdisciplinary, teacher_growth, general_question, unknown

判断原则：
1. 你是主路由，不是关键词兜底；不要按表层词语机械分类。
2. 先判断用户真正要解决的教学问题，再判断 intent。
3. 公开课、说课、日常课、教案诊断、局部设计咨询要按真实需求区分。
4. 如果用户在问某篇课文、某节课、目标、导入、任务链，优先考虑 teaching_design。
5. 如果用户在问教案稿是否成立、活动多但目标不清，优先 lesson_plan_diagnosis。
6. 如果用户在问听懂但做题错、如何判断学会、反馈、评价证据，优先 assessment_feedback。
7. 如果用户在问公开课、说课、赛课、亮点，优先 public_lesson，但仍要警惕真实问题可能是教案结构不成立。

只输出 JSON 中的 intent_result 部分：
{
  "primary_intent": "...",
  "secondary_intents": ["..."],
  "explicit_need": "...",
  "implicit_need": "...",
  "risk_of_wrong_framing": "...",
  "confidence": 0.0,
  "route_reason": "..."
}$prompt$
where key = 'intent_classifier_prompt';

update public.hai_orchestrator_prompt_configs
set
  description = '内部诊断层。由 LLM 主路由同步生成，把用户表层问题重构为更专业的教学问题。',
  content = $prompt$问题重构不是改写用户原话，而是识别真实教学问题。

输出时要区分：
1. surface_problem：用户自己以为的问题。
2. deeper_problem：更可能成立的教学结构问题。
3. wrong_attribution_risk：用户可能归因错在哪里。
4. hai_reframing：HAI 应如何重新定义这个问题。
5. recommended_answer_direction：最终回答应先纠偏、再解释、再给步骤。

这一步必须使用语义判断，不能只按关键词套模板。$prompt$,
  default_content = $prompt$问题重构不是改写用户原话，而是识别真实教学问题。

输出时要区分：
1. surface_problem：用户自己以为的问题。
2. deeper_problem：更可能成立的教学结构问题。
3. wrong_attribution_risk：用户可能归因错在哪里。
4. hai_reframing：HAI 应如何重新定义这个问题。
5. recommended_answer_direction：最终回答应先纠偏、再解释、再给步骤。

这一步必须使用语义判断，不能只按关键词套模板。$prompt$
where key = 'problem_rewriter_prompt';

update public.hai_orchestrator_prompt_configs
set
  label = '第 4 层：LLM 诊断模块路由原则',
  description = '由 LLM 主路由选择诊断模块。具体模块内容可在 diagnostic_module.* 中单独编辑。',
  content = $prompt$诊断路由由 LLM 语义判断主导，不按关键词直接匹配。

判断原则：
1. 先判断真实问题属于哪个教学诊断层，而不是看用户用了哪个词。
2. 用户说“公开课/亮点”，可能是 public_lesson，也可能是 lesson_plan_diagnosis。
3. 用户说“有趣/互动/导入”，可能是 learning_motivation，也可能是 teaching_design。
4. 用户说“听懂但不会做”，通常不是动机问题，而是 assessment_feedback 或 teaching_design。
5. 用户要求完整代写时，仍选择最接近的教学诊断模块，再由安全边界控制不代写。
6. 信息不足时用 unknown 或 general_question，并在问题重构中说明缺少哪些判断依据。

可选 diagnostic_module：
teaching_design, lesson_plan_diagnosis, public_lesson, learning_profile, classroom_management, learning_motivation, assessment_feedback, ai_lesson_planning, pbl_crossdisciplinary, teacher_growth, general_question, unknown$prompt$,
  default_content = $prompt$诊断路由由 LLM 语义判断主导，不按关键词直接匹配。

判断原则：
1. 先判断真实问题属于哪个教学诊断层，而不是看用户用了哪个词。
2. 用户说“公开课/亮点”，可能是 public_lesson，也可能是 lesson_plan_diagnosis。
3. 用户说“有趣/互动/导入”，可能是 learning_motivation，也可能是 teaching_design。
4. 用户说“听懂但不会做”，通常不是动机问题，而是 assessment_feedback 或 teaching_design。
5. 用户要求完整代写时，仍选择最接近的教学诊断模块，再由安全边界控制不代写。
6. 信息不足时用 unknown 或 general_question，并在问题重构中说明缺少哪些判断依据。

可选 diagnostic_module：
teaching_design, lesson_plan_diagnosis, public_lesson, learning_profile, classroom_management, learning_motivation, assessment_feedback, ai_lesson_planning, pbl_crossdisciplinary, teacher_growth, general_question, unknown$prompt$
where key = 'diagnostic_router_prompt';

commit;
