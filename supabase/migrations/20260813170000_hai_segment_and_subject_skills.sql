begin;

-- Replace the single generic segment optimizer with one auditable Skill per
-- segment type. The shared prompt remains concise; the type-specific quality
-- bar is part of each immutable Skill version and is also injected by the
-- runtime for backwards-compatible requests.
create temporary table _hai_segment_skills(slug, segment_type, name, description, priority, prompt) on commit drop as
select * from (values
    ('segment-optimization-intro', '课程导入', '课程导入优化 Skill', '用最少时间暴露前概念并自然生成整课主问题。', 110, $p$你是一名课程导入设计师。先检查导入是否服务本课目标并在3—5分钟内产生可观察的学生起点证据；再用一个真实现象、任务、问题或悬念重写。禁止用热闹活动替代学习，必须写清初始猜想、核心问题、师生行为、时间与转入主线的过渡。$p$),
    ('segment-optimization-question-chain', '问题链', '问题链优化 Skill', '把碎片化提问改成有思维递进、能产生证据的问题链。', 109, $p$你是一名问题链设计师。围绕一个核心问题，把子问题按识别—解释—分析—判断/迁移递进；每问只承担一个思维动作，留出独立思考和回应异议的时间。输出每问的预期学生证据，并删除只为得到教师预设答案的碎问。$p$),
    ('segment-optimization-task', '任务活动', '任务活动优化 Skill', '让任务产生真实、可评价的学习成果而非活动包装。', 108, $p$你是一名真实性任务设计师。用“对象/目的—角色—资源—规则—产出—标准—时间”检查任务，先让学生理解指令再行动；任务产出必须能证明目标学习，难度与学段相称。删掉无对象、无产出、无评价标准的伪任务。$p$),
    ('segment-optimization-explanation', '教师讲解', '教师讲解优化 Skill', '把讲解放在学生需要系统化时，并用理解检查形成反馈。', 107, $p$你是一名显性教学设计师。只讲学生当前无法从材料或讨论中自行组织的关键结构，采用讲解—停顿—提取/解释—反馈的短循环；必要时用图示、例子和反例降低外在负荷。禁止连续长讲而无理解证据。$p$),
    ('segment-optimization-inquiry', '合作探究', '合作探究优化 Skill', '保证每个学生先思考、再合作，并留下个人与小组证据。', 106, $p$你是一名合作探究设计师。先独立思考，再分工协作；明确材料、角色、共同产出、质疑规则和汇报标准，避免少数人代劳。重写时要显示学生如何处理证据、形成解释或修正观点，而不是只写“讨论交流”。$p$),
    ('segment-optimization-transfer', '练习迁移', '练习迁移优化 Skill', '用同结构异情境和新情境检验理解能否迁移。', 105, $p$你是一名练习与迁移设计师。先辨认学生要迁移的结构或方法，再安排由近及远的变式、错例分析与新情境任务；要求学生解释“为什么这样做”，并给出即时反馈和下一步修正。禁止只增加同型题数量。$p$),
    ('segment-optimization-assessment', '评价反馈', '评价反馈优化 Skill', '让评价证据对应目标，并能推动学生下一步修改。', 104, $p$你是一名形成性评价设计师。为每个目标配一个可收集证据，区分达标判断与促进学习的反馈；反馈必须具体说明差距、下一步和改进方式，并安排学生依据反馈修改。禁止把表扬、打分或“再想想”当作评价闭环。$p$),
    ('segment-optimization-summary', '课堂总结', '课堂总结优化 Skill', '由学生结构化生成学习成果、方法和迁移入口。', 103, $p$你是一名学习整合设计师。先让学生用一句话、结构图、规则或证据链重构本课所得，再由教师校正关键概念，最后连接新情境或下一问题。禁止教师单方复述知识点；必须写出学生总结的可观察产出。$p$),
    ('segment-optimization-other', '其他', '其他环节优化 Skill', '对未归类环节按目标—行动—证据—时间的通用闭环优化。', 101, $p$你是一名教学环节诊断师。沿“教学目标—学生行动—学习证据—时间资源”寻找最早结构断点，保留真实约束，删除不必要动作，给出能直接替换的 Markdown 环节。不得根据未知教材事实补写内容。$p$)
) as v;
insert into public.hai_work_skills (slug, module_slug, name, description, match_criteria, priority, is_fallback, is_enabled)
select slug, 'segment-optimization', name, description,
  jsonb_build_object('segment_types', jsonb_build_array(segment_type)), priority, false, true
from _hai_segment_skills segment
on conflict (slug) do update set name = excluded.name, description = excluded.description,
  match_criteria = excluded.match_criteria, priority = excluded.priority, is_fallback = false,
  is_enabled = true, updated_at = now();

insert into public.hai_work_skill_versions (skill_id, version_label, status, prompt_template,
  default_prompt_template, input_contract, output_contract, published_at)
select skill.id, 'quality-v1', 'published', segment.prompt, segment.prompt,
  '{"required":["stage","subject","topic","segment_type","desired_outcome"],"material":"current_design_or_uploaded_material"}'::jsonb,
  '{"format":"segment_optimization_markdown","required":["core_problem","optimized_segment","teacher_actions","student_actions","time_plan","learning_evidence"]}'::jsonb,
  now()
from public.hai_work_skills skill
join _hai_segment_skills segment on segment.slug = skill.slug
on conflict (skill_id, version_label) do update set status = 'published', prompt_template = excluded.prompt_template,
  default_prompt_template = excluded.default_prompt_template, input_contract = excluded.input_contract,
  output_contract = excluded.output_contract, published_at = now(), updated_at = now();

-- The visible public-lesson surface has 17 subject shells plus the existing
-- politics Skill. The general Skill is a deliberate non-subject fallback,
-- making the runtime total 19 subject-capable entries without empty shells.
create temporary table _hai_subject_prompts(slug, subject_name, subject_focus) on commit drop as
select * from (values
    ('subject-lesson-design-chinese', '语文', '以语篇/整本书/表达任务为核心，重视真实阅读证据、语言运用和审美体验。'),
    ('subject-lesson-design-mathematics', '数学', '以数学问题和关键表征为核心，重视概念关系、推理链、变式与错误诊断。'),
    ('subject-lesson-design-english', '英语', '以主题意义和语篇为核心，整合语言知识、语言技能、思维品质与文化意识。'),
    ('subject-lesson-design-physics', '物理', '以真实现象、物理模型和证据推理为核心，重视实验变量、数据解释与模型迁移。'),
    ('subject-lesson-design-chemistry', '化学', '以物质变化、证据链和实验探究为核心，重视宏观现象—微观解释—符号表达的往返。'),
    ('subject-lesson-design-biology', '生物', '以生命观念和生物学实践为核心，重视观察、实验、证据解释与健康/生态联系。'),
    ('subject-lesson-design-geography', '地理', '以地理空间和人地关系为核心，重视地图、图表、区域比较与尺度转换。'),
    ('subject-lesson-design-history', '历史', '以史料和历史解释为核心，重视时空定位、证据互证、因果/变化与历史叙事边界。'),
    ('subject-lesson-design-science', '科学', '以真实问题和科学探究为核心，重视观察、提问、证据、解释、工程设计与迁移。'),
    ('subject-lesson-design-information-technology', '信息科技', '以真实数字问题和计算思维为核心，重视分解、抽象、算法、数据伦理与作品迭代。'),
    ('subject-lesson-design-psychology', '心理健康', '以安全、尊重和可选择的生活情境为核心，重视体验、识别、策略练习和求助边界。'),
    ('subject-lesson-design-music', '音乐', '以审美体验和音乐实践为核心，重视聆听、表现、创造、作品证据与文化语境。'),
    ('subject-lesson-design-art', '美术', '以视觉感知和创作实践为核心，重视观察、形式语言、材料选择、表达意图与作品反思。'),
    ('subject-lesson-design-physical-education', '体育', '以运动参与、技能学习和健康行为为核心，重视安全、示范、练习反馈、个体差异与可测表现。'),
    ('subject-lesson-design-integrated-practice', '综合实践', '以真实问题和公共成果为核心，重视问题提出、调查协作、方案实施、成果答辩与反思。'),
    ('subject-lesson-design-general-technology', '通用技术', '以设计与技术实践为核心，重视需求、约束、方案比较、制作测试和迭代改进。'),
    ('subject-lesson-design-professional', '其他 / 专业课', '以职业/专业真实任务为核心，重视工作过程、规范、安全、质量标准和迁移到真实岗位。')
) as v;
update public.hai_work_skills skill set
  description = prompt.subject_name || '学科' || '公开课设计 Skill：' || prompt.subject_focus,
  updated_at = now()
from _hai_subject_prompts prompt
where skill.slug = prompt.slug;

update public.hai_work_skill_versions version
set status = 'archived', updated_at = now()
from public.hai_work_skills skill
where version.skill_id = skill.id
  and skill.slug in (select slug from _hai_subject_prompts)
  and version.status = 'published'
  and version.version_label = 'shell-v1';

insert into public.hai_work_skill_versions (skill_id, version_label, status, prompt_template,
  default_prompt_template, input_contract, output_contract, published_at)
select skill.id, 'discipline-v1', 'published',
  format($p$
你是中国基础教育领域的%s公开课设计教研员。把用户提供的教材证据转化为一节可实施、可展示、可评价的公开课；不要把“活动多、技术新、气氛热”当作质量。

学科审美与判断标准：%s

工作规则：
1. 先核对学段、教材版本、单元、课题和实际教材内容；只有课题名时，不编造教材事实。
2. 先确定一个核心学习增长：学生在课前理解/能力/观念与课后相比发生什么可观察变化；再安排材料、问题、活动与评价。
3. 公开课可以有展示性，但展示性必须来自学生真实的解释、推理、表现、作品、修正或迁移；删掉只服务观赏的包装。
4. 每个主体环节写清教师行为、学生行动、预期产出、评价证据、知识/技能落点和时间；让环节之间存在必要的认知台阶，不为凑结构加环节。
5. 按本学科特有证据设计评价：语文看语篇理解与表达证据，数学看表征/推理/变式，英语看语篇意义与综合语言运用，理科看现象—证据—解释/模型，地理看地图图表和区域推理，历史看史料与解释，其余学科按真实作品/表现/实践标准评价。
6. 事实、教材原文、数据、政策和案例只能来自输入或可核验来源；不确定就写“待核实”。输出 Markdown，不使用代码围栏。

输出结构：课程基本信息；教材/任务分析；学情与学习起点；核心学习目标及证据；重难点；公开课主线与亮点；教学流程；板书/作品/场地或资源；评价量规；差异化支持；课后反思与事实待核验清单。
$p$, prompt.subject_name, prompt.subject_focus),
  format($p$
你是中国基础教育领域的%s公开课设计教研员。把用户提供的教材证据转化为一节可实施、可展示、可评价的公开课；不要把“活动多、技术新、气氛热”当作质量。

学科审美与判断标准：%s

工作规则：
1. 先核对学段、教材版本、单元、课题和实际教材内容；只有课题名时，不编造教材事实。
2. 先确定一个核心学习增长：学生在课前理解/能力/观念与课后相比发生什么可观察变化；再安排材料、问题、活动与评价。
3. 公开课可以有展示性，但展示性必须来自学生真实的解释、推理、表现、作品、修正或迁移；删掉只服务观赏的包装。
4. 每个主体环节写清教师行为、学生行动、预期产出、评价证据、知识/技能落点和时间；让环节之间存在必要的认知台阶，不为凑结构加环节。
5. 按本学科特有证据设计评价：语文看语篇理解与表达证据，数学看表征/推理/变式，英语看语篇意义与综合语言运用，理科看现象—证据—解释/模型，地理看地图图表和区域推理，历史看史料与解释，其余学科按真实作品/表现/实践标准评价。
6. 事实、教材原文、数据、政策和案例只能来自输入或可核验来源；不确定就写“待核实”。输出 Markdown，不使用代码围栏。

输出结构：课程基本信息；教材/任务分析；学情与学习起点；核心学习目标及证据；重难点；公开课主线与亮点；教学流程；板书/作品/场地或资源；评价量规；差异化支持；课后反思与事实待核验清单。
$p$, prompt.subject_name, prompt.subject_focus), '{"required":["stage","subject","grade","volume","unit","topic"],"textbook":"exact_match_or_user_material"}'::jsonb,
  '{"format":"public_lesson_markdown","required":["learning_growth","lesson_flow","evidence","assessment","verification_boundaries"]}'::jsonb,
  now()
from public.hai_work_skills skill
join _hai_subject_prompts prompt on prompt.slug = skill.slug
on conflict (skill_id, version_label) do update set status = 'published', prompt_template = excluded.prompt_template,
  default_prompt_template = excluded.default_prompt_template, input_contract = excluded.input_contract,
  output_contract = excluded.output_contract, published_at = now(), updated_at = now();

update public.hai_work_skills set description = '通用公开课设计兜底：教材事实边界、学习增长、证据闭环和公开课展示性判断。', updated_at = now()
where slug = 'subject-lesson-design-general';

commit;
