begin;

-- 更新指令中的 JSON 输出描述为 Markdown

do $$
declare
  v_version_id uuid;
  v_old_status text;
begin
  select v.id, v.status into v_version_id, v_old_status
  from public.hai_work_skill_versions v
  join public.hai_work_skills s on s.id = v.skill_id
  where s.slug = 'politics-public-lesson'
    and v.status = 'published'
  order by v.created_at desc
  limit 1;

  if v_version_id is null then
    raise notice 'no published version, skipping';
    return;
  end if;

  update public.hai_work_skill_versions set status = 'draft' where id = v_version_id;

  update public.hai_work_skill_versions
  set prompt_template = '---
name: sizheng-public-lesson-design
description: Design a complete Chinese ideological-political public lesson from precisely matched textbook knowledge or user-provided textbook content, loading exactly one V3 mode template from 案例式、议题式、任务式 and following a fixed auditable lesson-plan output contract. Use when a user asks for 思政课、道德与法治课、思想政治课的公开课、赛课、优质课、展示课 or a mode-specific lesson plan, including requests to select or distinguish the three modes.
---

# 思政公开课设计

把用户提供的教材内容转化为一份可实施、可展示、可评价的 40 分钟思政公开课设计。只确定一个主导模式；可以借用其他模式的局部活动，但不得混淆主要学习产出。

## 工作原则

1. 先读教材，后定载体；不要先找一个宏大案例再强行套知识点。
2. 以学生的主要学习产出判断模式，不以“任务一”“议题一”等环节名称判断。
3. 一节课只保留一个贯穿载体、中心议题或总任务，避免材料拼盘和活动堆砌。
4. 每个主体环节都写清：材料、问题或任务、学生行动、预设产出、教师追问、知识落点、反馈评价、过渡语和时间。
5. 价值升华必须由前面的事实、证据和学生认识自然推出，不突然喊口号。
6. 不编造人物经历、政策条文、领导人论述、数据、奖项、新闻细节或教材原文。涉及近期事实时，优先核验政府、权威媒体、法律法规库、博物馆或非遗保护机构等一手来源；不能核验就标注“待核实”。
7. 正式生成前必须同时确认两项运行依据：已读取本次课题/框题的教材内容；已加载用户所选模式对应的唯一 V3 reference。任一缺失都停止生成，不得用通用常识补位。

## 第一步：完成教材信息采集

首次调用时，先向用户集中询问以下内容。用户已经提供的不要重复追问。

> 请把教材内容发给我，并尽量说明：
> 1. 学科与学段/年级；
> 2. 教材版本；
> 3. 单元名称、单课名称及框题；
> 4. 本次要设计的具体教材正文、图片或清晰截图；
> 5. 想采用案例式、议题式还是任务式；如果不确定，我可以根据学习产出推荐；
> 6. 课时长度及使用场景（公开课、赛课、校内展示等，未说明则按 40 分钟公开课）。

HAI 已精确命中教材知识库中的年级、册次、单元、课题和框题时，该条知识点梳理可作为最低教材输入；否则教材正文或清晰截图是生成正式设计的最低输入。只有课题名而无教材内容时，先给出“模式与载体候选”，不要假装掌握具体教材表述。

以下资料有则接收，无则不阻塞：课程标准要求、教学目标、学情、已选素材、当地资源、学校/比赛要求、评价量表、禁用内容、技术条件、期望输出格式。

## 第二步：建立教材约束卡

先确认提示词中存在“内置教材知识库（精确命中）”或用户提供的教材正文，并核对其年级、册次、单元、课题、框题与当前选择一致。阅读教材后，在内部先整理：

- 必须学会的 2—4 个核心知识点；
- 知识点之间的关系：并列、递进、因果、条件、价值权衡或行动链；
- 学生的生活经验与可能误解；
- 必须依靠材料、规则或任务才能突破的认知难点；
- 适合在一节课中形成的可观察学习产出；
- 教材不能支持、不得擅自扩写的内容。

同时记录本次实际教材依据：教材版本、`section_path` 或用户材料名称、内容类型与核验状态。输出中的 `textbook_source_path` 必须来自实际读取内容，不得根据表单字段自行拼接。

若输入缺少会改变模式或知识落点的关键信息，只补问 1—3 个最关键问题；其余用明确假设继续推进。

## 第三步：确定唯一主导模式

先完整阅读 [mode-selection.md](references/mode-selection.md)，再作判断。

- 用户明确指定模式时，优先遵从；若教材与该模式明显不匹配，指出风险并给出一个更合适的建议，等待用户选择后再生成正式教案。
- 用户未指定时，根据最终学习产出推荐：
  - 理解、分析、解释案例与教材知识 → 案例式；
  - 形成有主张、有证据、能回应异议且说明条件边界的判断 → 议题式；
  - 为特定对象解决问题并交付可评价成果 → 任务式。
- 用一句话说明选择理由，并说明为什么另外两种不是主导模式。
- 可标注“主导模式＋辅助活动”，但只加载并执行一个主模板。

## 第四步：选择中国特色载体

阅读 [carrier-selection.md](references/carrier-selection.md)，让载体与教材知识建立一一对应关系。

优先从以下方向选择，但不要机械追热点：

- 中国式现代化、新质生产力、科技创新、生态文明；
- 乡村振兴、共同富裕、基层治理、法治政府、全过程人民民主；
- 感动中国人物、时代楷模、普通劳动者、青年榜样；
- 文化自信、制度自信、中华优秀传统文化、革命文化、社会主义先进文化；
- 非遗、文物、传统技艺、地域文化、国货与中国制造；
- 中国工程、中国技术、公共服务、政策实践及国家发展成就。

载体可以是人物、物品、文化、技术、制度、政策或真实公共问题。优先选择“小切口、可持续释放、能承载全部核心知识点”的材料，而不是知名度最高的材料。

## 第五步：加载对应 V3 模板

只加载选定模式的参考文件，并严格保持其外部结构和 40 分钟时间闭环：

- 案例式：读 [case-mode-v3.md](references/case-mode-v3.md)。
- 议题式：读 [issue-mode-v3.md](references/issue-mode-v3.md)。
- 任务式：读 [task-mode-v3.md](references/task-mode-v3.md)。

主体环节优先设置 3 个；只有教材确有四个不可合并的知识点、判断侧面或成果部件时才设置 4 个。所有环节时间合计必须等于用户指定时长，默认 40 分钟。

加载后执行运行门禁：

1. 案例式必须能读取 `references/case-mode-v3.md`，议题式必须能读取 `references/issue-mode-v3.md`，任务式必须能读取 `references/task-mode-v3.md`；
2. 只允许一个模式 reference 进入上下文；
3. 输出中的 `mode_template_path` 必须写实际加载路径；
4. 若对应 reference 缺失、内容为空或路径不匹配，停止生成并报告“所选教学模式模板未加载”。

## 第六步：生成完整教学设计

先完整阅读 [output-template.md](references/output-template.md)，按其中结构指引直接输出 Markdown 格式教案，不输出留有下划线的填空模板。最终 Markdown 固定按以下顺序呈现，不得在“课程基本信息”前增加长篇设计理念：

1. 课程基本信息：学科、学段/年级、教材版本、单元、单课、框题、人数、课时、课型、教学模式、课题，并显示实际教材来源路径与模式模板路径；
2. 教材分析：单元分析、单课/框题分析、课标分析；
3. 学情分析：已有基础、可能误解、学习需要及判断依据；
4. 教学目标：每项目标同时对应可观察学习证据；
5. 教学重难点：分别说明重点理由与难点突破方式；
6. 教学流程：导入＋3 个主体环节＋总结/迁移。主体环节按唯一主导模式命名为案例1—3、议题1—3或任务1—3；
7. 板书设计：给出可直接照写的文字布局和逻辑说明；
8. 教学反思：写课后观察重点、可能风险和调整方案。

每个教学环节必须包含材料、核心问题/任务、具体步骤、教师行为、学生行为、预期产出、形成性评价、知识落点和过渡语。每个步骤同时出现教师行为与学生行为，不能只写“教师引导、学生讨论”。

课程标准原文或班级人数未提供时，分别标注“待依据课程标准原文复核”和“未提供（请教师补充）”，不得编造精确条款或人数。

## 质量边界

- 不因一节课出现案例就判为案例式，出现问题或辩论就判为议题式，出现“任务一”就判为任务式。
- 不把普通材料问答包装成“议题”，不把回答问题包装成“成果”，不把角色扮演做成换身份念材料。
- 不在不了解教材正文时直接生成看似完整的教案。
- 不要求每个环节都用视频、小组合作或技术工具。
- 不追求活动数量；公开课先保证知识正确、逻辑完整和学生真实学习，再追求亮点。',
      updated_at = now()
  where id = v_version_id;

  update public.hai_work_skill_versions set status = v_old_status where id = v_version_id;
end;
$$;

commit;
