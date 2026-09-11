-- 教学通识课 V2：第一单元“课标分析”七个 Lesson。
-- 课程正文、知识卡、前后测与 Lesson 5 学科分支数据一并写入现有 V2 课程模型。

begin;

insert into public.v2_course_modules (
  id, slug, title, description_markdown, sort_order, status, is_active
) values (
  '9a110000-0000-4000-8000-000000000001',
  'teaching-literacy-v2',
  '教学通识课 V2',
  '从真实备课问题出发，建立可复用、可评价的教学设计判断方法。',
  10,
  'published',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  sort_order = excluded.sort_order,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.v2_course_units (
  id, module_id, slug, title, description_markdown, unit_type_id, sort_order, status, is_active
) values (
  '9a110000-0000-4000-8000-000000000010',
  '9a110000-0000-4000-8000-000000000001',
  'standard-analysis',
  '单元 1｜课标分析：定位准确，解读精准',
  '先抓准单元对标对象，再从课程目标、课程内容和学业质量中定位依据，用四个维度精准解读，最终形成可回溯的单元课标分析报告。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'unit_type' and items.key = 'foundation' limit 1),
  10,
  'published',
  true
)
on conflict (id) do update set
  module_id = excluded.module_id,
  slug = excluded.slug,
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  unit_type_id = excluded.unit_type_id,
  sort_order = excluded.sort_order,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.v2_course_lessons (
  id, unit_id, slug, title, subtitle, description, lesson_type_id, duration_minutes, credits,
  sort_order, membership_type, is_trial, status, published_at, challenge_title, challenge_markdown,
  objectives, success_criteria_markdown, takeaway_markdown, body_markdown
) values
(
  '9a110000-0000-4000-8001-000000000001', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-01',
  '课标是什么：先分清三种文件', '课标给尺度，教材给载体，教案作安排',
  '建立课标、教材与教案的基本关系，避免把课标当作开场引用或逐课索引。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'concept' limit 1),
  10, 1, 10, 'plus', true, 'published', now(),
  '你能分清课标、教材和教案分别解决什么问题吗？',
  '判断三段常见备课表述分别属于哪一层，并说出判断依据。',
  '[{"id":"l1-o1","text":"用自己的话解释课程标准的性质与适用范围"},{"id":"l1-o2","text":"区分课标、教材和教案的功能"},{"id":"l1-o3","text":"说明为什么不能把课标原文直接复制成教学设计"}]'::jsonb,
  '- 说清“方向与要求—内容载体—具体安排”三层关系\n- 不把教材出现的内容自动判定为单元重点\n- 能提出一个由课标约束教材解读的问题',
  '课标规定基本方向、内容范围和质量要求；教材组织具体载体；教案结合学生和课时作行动安排。',
  $l1$## 从备课中的三个问题进入

教师备课时常同时面对三个问题：这门课程为什么教、具体用什么内容教、这一课怎样教。它们分别对应课标、教材和教案，但三者不能相互替代。

## 建立三层关系

- **课标**是国家对某学段、某学科课程作出的纲领性规定，回答方向、范围和应达到的大致程度。
- **教材**依据课标组织课文、例题、实验、图表、问题和练习，是落实课标的重要载体。
- **教案**是教师面向具体学生、具体课时作出的教学安排。

可以把三者理解为：**课标提供尺度，教材提供载体，教案作出行动选择。**

## 专家思考

> “我看到教材有很多内容时，不马上问每一页怎么教，而先问：国家课程为什么把这类内容放在这个学段，学生最终要形成什么表现？课标先帮我建立判断尺度，教材再告诉我这些要求由哪些内容承载。”

## 正反例

准备七年级英语 Animal Friends 单元时，先提炼“获取动物信息、表达喜好理由、理解动物的重要性、提出关爱行动”等核心要素，再进入对应级别的课程目标、课程内容和学业质量，这是把课标当作判断尺度。

“课标强调核心素养，所以本单元要落实全部核心素养”则只有口号，没有学段表现、内容落点和学生行为，不能帮助教师判断教材重点。

## 一句话收束

课标不是教案的开场引用，而是教师判断“为什么教、重点在哪里、应达到什么程度”的上位标准。$l1$
),
(
  '9a110000-0000-4000-8001-000000000002', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-02',
  '为什么要分析课标：用好两把尺子', '用上位标准校准目标，也重新看见教材重点',
  '理解课标分析对制定目标和解读教材的两项直接作用，并识别越界推断。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'concept' limit 1),
  10, 1, 20, 'plus', false, 'published', now(),
  '一条课标依据，真的改变了你的备课判断吗？',
  '审查一份“看起来引用了课标”的说明，找出能改变目标深度或教材重点的有效依据。',
  '[{"id":"l2-o1","text":"说明课标分析对制定目标和解读教材的两项作用"},{"id":"l2-o2","text":"判断一条依据是否真正改变单元终点或教材重点"},{"id":"l2-o3","text":"避免把课标要求越界推断成固定教学流程"}]'::jsonb,
  '- 准确解释“两把尺子”\n- 会用删减测试判断依据价值\n- 能指出至少一种课标分析越界',
  '第一把尺子校准目标的方向、范围和程度；第二把尺子帮助识别教材中的核心、支撑材料和呈现方式。',
  $l2$## 第一把尺子：校准目标的上位方向

课标帮助教师判断一个单元最终指向什么、内容范围有多大、学生大体应达到什么程度。“区分观点与材料”和“解释观点与材料的联系”并不是同一学习深度。没有先读清课标，目标容易定偏、定浅或定得过大。

## 第二把尺子：重新看教材的组织

教材中的概念、语篇、例题、实验和练习不是平铺的材料。课标帮助教师判断哪些是核心要求，哪些是理解核心所需的材料，哪些只是呈现方式。

以“全等三角形”为例，结合课标中的“验证、逻辑、证明、推理”，教师会看到单元要发展的几何判断与说理经验，而不只是记住若干判定结论。

## 专家思考

> “我用第一把尺子检查方向和深度，用第二把尺子重新看教材组织。只要某条课标既不能改变单元终点，也不能改变我对教材核心的判断，我就不会把它当成主要依据。”

## 两条边界

- 课标出现“认识、理解、分析”等要求，不代表指定了某一种教学流程。
- 课标强调某项学段能力，不代表一个单元、更不代表一节课要独自完成全部学段要求。

**删减测试**：删掉这条课标后，我对单元终点或教材核心的判断会改变吗？若完全不变，它大概率只能作为背景或应被删除。$l2$
),
(
  '9a110000-0000-4000-8001-000000000003', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-03',
  '定位准确：解决“读没读到”', '先抓单元对象，再完成三部分定位',
  '掌握从单元主题和核心要素出发，按课程目标、课程内容和学业质量查找课标依据的方法。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'method' limit 1),
  18, 1.5, 30, 'plus', false, 'published', now(),
  '怎样从一整份课标中，找到真正属于这个单元的依据？',
  '为一个真实教材单元制作“定位路线”，并用四次核对排除误定位。',
  '[{"id":"l3-o1","text":"把教材单元压缩为主题与核心要素"},{"id":"l3-o2","text":"按课程目标、课程内容、学业质量完成三部分定位"},{"id":"l3-o3","text":"顺着不同学科的目录结构查找并记录可回溯出处"}]'::jsonb,
  '- 单元主题与核心要素具体可用\n- 三部分定位功能不混淆\n- 路径符合本学科真实目录\n- 版本、学段和出处完整可回溯',
  '课程目标找素养终点，课程内容找教什么，学业质量校准综合表现；最后核对版本、学段、目录位置、相关性和出处。',
  $l3$## 先压缩单元，而不是先搜课题名

阅读教材目录、单元导语和主要任务，回答：单元讨论什么主题或大概念？学生主要要认识、理解或处理什么问题？哪些核心概念、关键能力、典型任务或价值议题反复出现？

把结果压缩为“主题＋核心要素”。例如：议论性文章中的观点与材料；规则意识与法治观念；全等三角形的判定与推理。它们是判断相关性的线索，不是必须逐字命中的搜索词。

## 三部分定位

1. **课程目标**：先把核心素养名称当作目录，再继续读子维度和对应学段表现，用单元内容检验是否能实质承载。
2. **课程内容**：先看目录。道德与法治按学段与教育主题，数学按学段与内容领域，语文按任务群与学段，英语按级别与六个要素，历史和生物学等按内容板块或学习主题查找。
3. **学业质量**：寻找与单元相近的情境、行为、内容和程度，用学段远景校准单元方向，不能直接把它变成单课测试题。

## 合成两句话

> 这个单元在本学段主要指向________。围绕这一方向，单元主要通过________内容，帮助学生逐步形成________表现。

## 四次核对

1. 版本、学科和学段是否正确；
2. 章节位置与适用范围是否正确；
3. 是否与单元核心要素直接相关，而非只有词语相似；
4. 是否记录章节路径或页码，别人能否回到同一处原文。$l3$
),
(
  '9a110000-0000-4000-8001-000000000004', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-04',
  '精准解读：解决“读没读好”', '用四维镜头读出行为、对象、条件和程度',
  '从四个维度解读课标，并依据不同课标部分的功能选择分析重点。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'method' limit 1),
  14, 1.5, 40, 'plus', false, 'published', now(),
  '定位到正确条目后，你能读出学生真正要做什么、做到什么程度吗？',
  '拆解一句真实课标表述，区分原文信息、有依据的解释与不能添加的推断。',
  '[{"id":"l4-o1","text":"从认知动词、知识名词、应用条件、学习程度四维解读课标"},{"id":"l4-o2","text":"根据课标部分功能选择重点维度"},{"id":"l4-o3","text":"识别机械填满与凭空添加要求的误读"}]'::jsonb,
  '- 动词与知识对象正确配对\n- 条件和程度均有原文依据\n- 按功能选择重点，不强求四项齐全\n- 不把高阶行为降格或无限拔高',
  '动词看做什么，名词看对什么做，条件看在哪里或借助什么做，程度看做到什么水平；原文没有的不硬填。',
  $l4$## 四个解读维度

- **认知动词**：学生要做什么，如识别、描述、解释、运用、分析、判断、设计。
- **知识名词**：这些行为作用于什么概念、事实、关系、原理、方法或问题。
- **应用条件**：在什么材料、情境、工具、视角或支持下完成。
- **学习程度**：做到什么水平，如初步、简单、准确、有依据、综合、独立。

## 不同部分，重点不同

核心素养及学段表现重点看认知动词和学习程度；内容要求、学业要求重点看认知动词和知识名词；教学提示重点看应用条件，不能抄成固定流程；学业质量重点看综合表现的应用条件与学习程度。

原则是：**该分析的分析，原文没有的不硬填。**

## 单句 Think Aloud

课标原文：“运用植物光合作用、呼吸作用、蒸腾作用等方面的知识，解释生产生活中的相关现象。”

> “我先圈出‘运用’和‘解释’，所以要求不是背诵。知识对象既包括三种生理过程，也包括它们与现象的联系。‘生产生活中’限定了应用情境。学生要调用知识作解释，高于说出概念；但原句没有要求复杂产业研究，我不额外拔高。”

解读得到的重点线索是：学生要运用植物生理知识解释真实现象。$l4$
),
(
  '9a110000-0000-4000-8001-000000000005', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-05',
  '分类示范：不同学科，怎样走对目录', '目录路径可以不同，判断逻辑始终不变',
  '通过五类学科案例迁移“目标—内容—质量—取舍”的共同判断逻辑。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'case' limit 1),
  20, 2, 50, 'plus', false, 'published', now(),
  '换一个学科，课标分析的方法还能成立吗？',
  '选择一个熟悉学科阅读完整案例，再换一个陌生学科，仅凭目录结构说出查找路线和取舍依据。',
  '[{"id":"l5-o1","text":"识别五类代表性课标结构及查找入口"},{"id":"l5-o2","text":"选择与自己学科最接近的查找路径"},{"id":"l5-o3","text":"用三道筛子区分强、中、低相关并说明取舍"}]'::jsonb,
  '- 说对所选学科的主要目录索引轴\n- 三部分能够相互印证\n- 单元方向能由依据推出\n- 能排除一个看似相关但不能实质承载的内容',
  '课程目标找终点，课程内容找载体和要求，学业质量校准综合表现，再用“直接相关—改变方向—能够承载”做减法。',
  $l5$## 共同判断动作

无论课标目录怎样变化，都做四件事：用课程目标找到对应学段终点；沿本学科目录结构找到课程内容；用学业质量校准综合表现；最后做减法，只留下能改变单元方向的依据。

## 选择一个学科分支

请在下方学科卡片中选择数学、语文、英语、生物学或道德与法治。每个分支都呈现“目录路径—专家聚焦—单元方向—单课贡献—没读透的信号”。先学习与你最接近的学科，再换一个陌生学科迁移。

## 做减法的三道筛子

1. 是否与单元核心要素直接相关？
2. 删除后是否会改变单元方向判断？
3. 本单元是否真的能够持续、实质承载？

强相关进入报告；中相关必要时简要保留并注明范围；低相关删除。

> “路径随学科变化，判断逻辑保持稳定。我不是为了把课标填满，而是为了留下能约束这个单元的证据。”$l5$
),
(
  '9a110000-0000-4000-8001-000000000006', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-06',
  '操作工具：撰写课标分析报告', '把分散依据写成可保存、可复核的结论',
  '完成单元课标分析报告主表，并写出有证据链的综合分析结论。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'practice' limit 1),
  18, 2, 60, 'plus', false, 'published', now(),
  '怎样把分散依据写成一份能复核、能用于备课讨论的报告？',
  '使用自己的真实教材单元，完成基本信息、主表和综合结论的最小可用稿。',
  '[{"id":"l6-o1","text":"完成报告基本信息与定位—精准解读主表"},{"id":"l6-o2","text":"按课标部分功能选择四维解读重点"},{"id":"l6-o3","text":"从主表证据综合写出单元方向和教学重点线索"}]'::jsonb,
  '- 版本、学段、路径和原文真实可回溯\n- 三类课标依据完整且强相关\n- 四维解读按需填写\n- 综合结论可从主表逐项推出',
  '基本信息定对象，主表左侧证明找得准，右侧证明读得透，再写综合结论并从结论反查证据。',
  $l6$## 第一步：登记基本信息

写明课标名称及版本、学科/学段/年级、教材版本与单元名称、单元主题、单元核心要素。这一步防止后续摘录跨版本、跨学段或对象漂移。

## 第二步：填主表左侧，证明“找得准”

按课标部分记录章节路径或页码和相关原文。纵向包含：核心素养及子素养、相关学段表现、内容要求、教学提示、课标设有时的学业要求、学业质量标准。只把通过三道筛子的内容放入主表。

## 第三步：填主表右侧，证明“读得透”

在认知动词、知识名词、应用条件和学习程度四列中按需填写。原文没有的信息留空；某课标未单列“学业要求”，就如实注明。

## 第四步：写综合分析结论

先概括核心素养及学段表现、主要知识要求、关键应用条件和预期学习程度，再合成为：

> **单元方向**：本单元在本学段主要指向________，围绕________内容，帮助学生在________条件下达到________程度的表现。

> **教学重点线索**：综合认知动词、知识名词、应用条件和学习程度，本单元应重点处理________。

## 第五步：反向审查证据链

从结论中的每个关键词反向追问：它来自哪条原文？经过哪项解读？教材单元如何承载？找不到的内容应删除、降级或标为待核验。$l6$
),
(
  '9a110000-0000-4000-8001-000000000007', '9a110000-0000-4000-8000-000000000010', 'standard-analysis-07',
  '核心小结：把课标分析走成闭环', '对象—定位—解读—取舍—结论',
  '复述课标分析完整工作流，并用关键判断审查自己的报告。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = 'concept' limit 1),
  8, 1, 70, 'plus', false, 'published', now(),
  '离开示例后，你还能独立走完课标分析闭环吗？',
  '不查看前课正文，补全五步闭环，并快速审查自己的分析报告。',
  '[{"id":"l7-o1","text":"复述课标分析的完整工作流"},{"id":"l7-o2","text":"用九条关键判断检查自己的报告"},{"id":"l7-o3","text":"明确形成单元方向和重点线索的产出边界"}]'::jsonb,
  '- 五步顺序正确\n- 能说明三个课标部分与四个维度的功能\n- 能指出至少一个越界判断\n- 能用一句话概括自己的单元方向',
  '抓准单元对象 → 三部分定位 → 四维解读 → 三道筛子取舍 → 综合形成单元方向和教学重点线索。',
  $l7$## 一条完整路径

> 单元主题与核心要素 → 课程目标/课程内容/学业质量 → 四维精准解读 → 强中低相关取舍 → 单元方向与教学重点线索 → 判断各单课对整体的贡献。

## 九条关键判断

1. 课标是国家规定的课程基本要求，不是教材或逐课教案索引。
2. 课标为目标和教材提供两把判断尺子。
3. 通常以单元为基本对标单位，先抓主题和核心要素。
4. 课程目标看素养终点，课程内容看教什么，学业质量看综合表现。
5. 从素养名称继续读到对应学段表现。
6. 顺着不同学科自己的目录结构定位课程内容。
7. 用四个维度解读，但不机械填满。
8. 把分散信息整合为单元方向和教学重点线索。
9. 显化判断过程：为什么走这条路径、为什么保留这条、证据怎样支持结论。

## 明确边界

本单元止步于形成单元课标分析结论。课标可以约束目标、教材重点与学习程度，但不能直接指定某种教学流程，也不能替代后续的教材分析、学情分析、目标撰写、活动与评价设计。$l7$
)
on conflict (id) do update set
  unit_id = excluded.unit_id,
  slug = excluded.slug,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  lesson_type_id = excluded.lesson_type_id,
  duration_minutes = excluded.duration_minutes,
  credits = excluded.credits,
  sort_order = excluded.sort_order,
  membership_type = excluded.membership_type,
  is_trial = excluded.is_trial,
  status = excluded.status,
  published_at = coalesce(public.v2_course_lessons.published_at, excluded.published_at),
  challenge_title = excluded.challenge_title,
  challenge_markdown = excluded.challenge_markdown,
  objectives = excluded.objectives,
  success_criteria_markdown = excluded.success_criteria_markdown,
  takeaway_markdown = excluded.takeaway_markdown,
  body_markdown = excluded.body_markdown,
  updated_at = now();

insert into public.v2_lesson_knowledge_cards (
  id, lesson_id, card_type_id, title, content_markdown, sort_order, is_active
) values
  ('9a110000-0000-4000-8002-000000000001', '9a110000-0000-4000-8001-000000000001', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'concept' limit 1), '课标—教材—教案三层关系', '课标规定课程基本方向、内容范围和质量要求；教材依据课标组织具体内容；教案结合学生与课时作教学安排。判断顺序是“先用课标定尺度，再看教材承载，最后作教案决策”。', 10, true),
  ('9a110000-0000-4000-8002-000000000002', '9a110000-0000-4000-8001-000000000002', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'principle' limit 1), '课标分析的两把尺子', '第一把尺子校准单元目标的方向、范围与程度；第二把尺子帮助识别教材中的核心、支撑材料与呈现方式。不能由课标行为词直接推出固定教学流程。', 20, true),
  ('9a110000-0000-4000-8002-000000000003', '9a110000-0000-4000-8001-000000000003', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'method' limit 1), '三部分定位法', '先用“主题＋核心要素”抓准对象；课程目标找素养终点，课程内容找教什么和必要经历，学业质量校准综合表现。最后核对版本、学段、目录位置、相关性与出处。', 30, true),
  ('9a110000-0000-4000-8002-000000000004', '9a110000-0000-4000-8001-000000000004', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'method' limit 1), '精准解读四维镜头', '动词看“做什么”，名词看“对什么做”，条件看“在哪里、借助什么做”，程度看“做到什么水平”。按课标部分功能选择重点维度，不机械填满，不凭空添加。', 40, true),
  ('9a110000-0000-4000-8002-000000000005', '9a110000-0000-4000-8001-000000000005', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'checklist' limit 1), '目录不同，判断逻辑不变', '课程目标找终点，课程内容找载体和要求，学业质量校准综合表现，再用“直接相关—改变方向—能够承载”三道筛子做减法。', 50, true),
  ('9a110000-0000-4000-8002-000000000006', '9a110000-0000-4000-8001-000000000006', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'checklist' limit 1), '课标分析报告写作顺序', '基本信息定对象 → 主表左侧记录路径与原文，证明找得准 → 主表右侧按功能解读，证明读得透 → 综合写出单元方向与重点 → 从结论反查每条证据。', 60, true),
  ('9a110000-0000-4000-8002-000000000007', '9a110000-0000-4000-8001-000000000007', (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'method' limit 1), '课标分析五步闭环', '抓准单元对象 → 三部分定位 → 四维解读 → 三道筛子取舍 → 综合形成单元方向和教学重点线索。先单元、后单课；结论必须可回溯。', 70, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  card_type_id = excluded.card_type_id,
  title = excluded.title,
  content_markdown = excluded.content_markdown,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.v2_lesson_resources (
  id, lesson_id, resource_type_id, usage_type_id, title, description, sort_order, is_active, metadata
) values (
  '9a110000-0000-4000-8003-000000000005',
  '9a110000-0000-4000-8001-000000000005',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_type' and items.key = 'document' limit 1),
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_usage' and items.key = 'primary' limit 1),
  '五类学科课标结构案例',
  '供前端按学科分支呈现的结构化课程内容。',
  10,
  true,
  $subjects${
    "component":"subject_example_explorer",
    "subjects":[
      {"id":"biology","label":"生物学","structure":"类型一","example":"七年级下册第三单元《植物的生活》","route":"课程目标中的生命观念、科学思维和探究实践 → 课程内容‘植物的生活’主题下的内容要求、学业要求与教学提示 → 学业质量描述。","focus":"把‘认识、识别、描述、解释、阐明、设计、探究’与植物生命周期、主要生理过程、物质与能量及真实生产生活情境相互连接。","direction":"围绕植物生命周期和主要生理过程，从物质与能量角度理解生命活动，运用相关原理解释生产生活现象，并初步形成以证据探究影响因素的能力。","contribution":"‘种子萌发’主要建立条件与单一变量探究；‘光合作用’主要理解制造有机物和储存能量，不由任何一课独自承担整个单元方向。","pitfall":"只摘种子萌发、蒸腾、光合作用等知识名词，把单元变成知识点集合。"},
      {"id":"math","label":"数学","structure":"类型二","example":"八年级上册第十四章《全等三角形》","route":"第四学段课程目标 → 初中‘图形与几何—图形的性质—三角形’ → 第四学段学业质量。","focus":"内容要求列出判定事实，学业要求和教学提示反复强调验证、逻辑、证明与推理，因此核心是理解条件怎样支持结论并有依据地表达。","direction":"围绕三角形条件与全等结论的关系，经历发现、验证和运用判定依据的过程，发展有依据的几何判断和初步证明能力。","contribution":"SAS 的学习帮助学生认识‘两边及其夹角’这一充分条件，并辨析‘夹角’限定，为后续判定与证明提供一种依据。","pitfall":"摘出 SAS、ASA、SSS 后，把重点定为背会三种判定口诀。"},
      {"id":"civics","label":"道德与法治","structure":"类型三","example":"八年级上册第二单元《维护社会秩序》","route":"道德修养、法治观念、责任意识的第四学段表现 → 第四学段‘道德教育＋法治教育’ → 第四学段学业质量。","focus":"带着‘秩序—规则—道德—法律—行动’进入课标，只保留教材三课持续承载的学段表现、内容与真实公共生活条件。","direction":"在公共生活和典型案例中理解社会秩序为什么需要规则，认识道德、纪律和法律的作用，形成自觉遵守规则、文明诚信交往和依法办事的意识与初步判断能力。","contribution":"第四课建立秩序与规则关系，第五课推进道德自觉，第六课理解法律规范作用，三课共同支撑单元方向。","pitfall":"只写‘落实法治观念’，或把第四学段全部道德教育、法治教育内容压入本单元。"},
      {"id":"chinese","label":"语文","structure":"类型四","example":"九年级上册第五单元《思辨与创造》","route":"课程目标第四学段 → 发展型学习任务群‘思辨性阅读与表达’第四学段 → 学业质量第四学段。","focus":"把课程目标、任务群和学业质量交叉验证，读出‘区分观点与材料—解释二者联系—依据证据判断与表达’的能力进阶。","direction":"在简单议论性文本中区分观点与材料，解释材料怎样支持观点，并能依据证据作出初步判断和表达。","contribution":"不同课文分别承担辨析观点、梳理论证、比较审视等贡献，写作‘论证要合理’把阅读中的证据和逻辑意识用于表达。","pitfall":"只按‘议论文’三个字搜索，摘到一条体裁要求便停止，或把所有相关任务群都列入。"},
      {"id":"english","label":"英语","structure":"类型五","example":"七年级下册 Unit 1 Animal Friends","route":"四项核心素养各子素养的三级要求 → 三级课程内容中主题统领的六个要素 → 三级学业质量。","focus":"用真实语篇和任务筛选信息获取、归纳、描述、理由表达、文化判断与保护行动；what、where、why、because 和名词复数只作为表达支撑。","direction":"从对话、帖子、说明文和多模态材料中提取并组织动物信息，使用基本准确、较连贯的英语表达喜好及理由，说明动物与人类生活的关系并提出关爱行动。","contribution":"Section A 建立描述与理由表达，Section B 推进到文化意义、生存危险和保护，Project 综合运用信息组织、表达和合作。","pitfall":"从动物主题直接跳到词汇和语法，或在四项素养下平均粘贴全部子素养要求。"}
    ]
  }$subjects$::jsonb
)
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  resource_type_id = excluded.resource_type_id,
  usage_type_id = excluded.usage_type_id,
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();

with block_rows(id, lesson_id, type_key, title, instructions, estimated_minutes, sort_order) as (
  values
    ('9a110000-0000-4000-8101-000000000001'::uuid, '9a110000-0000-4000-8001-000000000001'::uuid, 'pretest', '课前诊断', '先凭已有经验作答；这道题用于暴露起点，不影响完课。', 2, 10),
    ('9a110000-0000-4000-8102-000000000001'::uuid, '9a110000-0000-4000-8001-000000000001'::uuid, 'posttest', '达标检测', '完成正文后再判断三层关系。', 2, 20),
    ('9a110000-0000-4000-8101-000000000002'::uuid, '9a110000-0000-4000-8001-000000000002'::uuid, 'pretest', '课前诊断', '判断一条课标依据是否真的有用。', 2, 10),
    ('9a110000-0000-4000-8102-000000000002'::uuid, '9a110000-0000-4000-8001-000000000002'::uuid, 'posttest', '达标检测', '识别课标分析的越界推断。', 2, 20),
    ('9a110000-0000-4000-8101-000000000003'::uuid, '9a110000-0000-4000-8001-000000000003'::uuid, 'pretest', '课前诊断', '选择更稳定的单元对标起点。', 2, 10),
    ('9a110000-0000-4000-8102-000000000003'::uuid, '9a110000-0000-4000-8001-000000000003'::uuid, 'posttest', '达标检测', '检查三部分定位顺序。', 2, 20),
    ('9a110000-0000-4000-8101-000000000004'::uuid, '9a110000-0000-4000-8001-000000000004'::uuid, 'pretest', '课前诊断', '观察只摘知识名词会遗漏什么。', 2, 10),
    ('9a110000-0000-4000-8102-000000000004'::uuid, '9a110000-0000-4000-8001-000000000004'::uuid, 'posttest', '达标检测', '用四维镜头检查一条课标解读。', 2, 20),
    ('9a110000-0000-4000-8101-000000000005'::uuid, '9a110000-0000-4000-8001-000000000005'::uuid, 'pretest', '课前诊断', '识别学科目录入口。', 2, 10),
    ('9a110000-0000-4000-8102-000000000005'::uuid, '9a110000-0000-4000-8001-000000000005'::uuid, 'posttest', '达标检测', '提炼跨学科共同动作。', 2, 20),
    ('9a110000-0000-4000-8101-000000000006'::uuid, '9a110000-0000-4000-8001-000000000006'::uuid, 'pretest', '课前诊断', '区分摘抄集合与分析报告。', 2, 10),
    ('9a110000-0000-4000-8102-000000000006'::uuid, '9a110000-0000-4000-8001-000000000006'::uuid, 'posttest', '达标检测', '检查报告填写规则与证据链。', 2, 20),
    ('9a110000-0000-4000-8101-000000000007'::uuid, '9a110000-0000-4000-8001-000000000007'::uuid, 'pretest', '课前诊断', '凭记忆补全课标分析路径。', 2, 10),
    ('9a110000-0000-4000-8102-000000000007'::uuid, '9a110000-0000-4000-8001-000000000007'::uuid, 'posttest', '达标检测', '确认本单元的合格产出与边界。', 2, 20)
)
insert into public.v2_assessment_blocks (
  id, lesson_id, unit_id, assessment_type_id, title, instructions_markdown,
  required, estimated_minutes, sort_order, status
)
select
  block_rows.id,
  block_rows.lesson_id,
  null,
  items.id,
  block_rows.title,
  block_rows.instructions,
  true,
  block_rows.estimated_minutes,
  block_rows.sort_order,
  'published'
from block_rows
join public.v2_dictionary_groups groups on groups.key = 'assessment_type'
join public.v2_dictionary_items items on items.group_id = groups.id and items.key = block_rows.type_key
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  assessment_type_id = excluded.assessment_type_id,
  title = excluded.title,
  instructions_markdown = excluded.instructions_markdown,
  required = excluded.required,
  estimated_minutes = excluded.estimated_minutes,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

with item_rows(id, block_id, prompt, case_text, sort_order) as (
  values
    ('9a110000-0000-4000-8201-000000000001'::uuid, '9a110000-0000-4000-8101-000000000001'::uuid, '以下关于课标、教材和教案的说法，哪一项最准确？', null, 10),
    ('9a110000-0000-4000-8202-000000000001'::uuid, '9a110000-0000-4000-8102-000000000001'::uuid, '哪一种备课顺序体现了课标、教材和教案的正确关系？', null, 10),
    ('9a110000-0000-4000-8201-000000000002'::uuid, '9a110000-0000-4000-8101-000000000002'::uuid, '一条课标内容既不改变单元终点，也不改变对教材核心的判断，应怎样处理？', null, 10),
    ('9a110000-0000-4000-8202-000000000002'::uuid, '9a110000-0000-4000-8102-000000000002'::uuid, '课标写“分析材料之间的联系”，教师据此规定全单元必须使用项目式学习。主要问题是什么？', null, 10),
    ('9a110000-0000-4000-8201-000000000003'::uuid, '9a110000-0000-4000-8101-000000000003'::uuid, '准备九年级语文议论性文章单元时，哪个对标起点更合适？', null, 10),
    ('9a110000-0000-4000-8202-000000000003'::uuid, '9a110000-0000-4000-8102-000000000003'::uuid, '以下哪一个顺序最符合“三部分定位法”？', null, 10),
    ('9a110000-0000-4000-8201-000000000004'::uuid, '9a110000-0000-4000-8101-000000000004'::uuid, '只从“运用植物生理知识解释生产生活现象”中摘出三个生理过程名称，主要遗漏了什么？', null, 10),
    ('9a110000-0000-4000-8202-000000000004'::uuid, '9a110000-0000-4000-8102-000000000004'::uuid, '分析“借助图表，初步解释数据变化规律”时，哪一组对应完全正确？', null, 10),
    ('9a110000-0000-4000-8201-000000000005'::uuid, '9a110000-0000-4000-8101-000000000005'::uuid, '下列“教材单元—课程内容入口”匹配正确的是哪一项？', null, 10),
    ('9a110000-0000-4000-8202-000000000005'::uuid, '9a110000-0000-4000-8102-000000000005'::uuid, '跨学科迁移课标分析时，哪一组共同动作最稳定？', null, 10),
    ('9a110000-0000-4000-8201-000000000006'::uuid, '9a110000-0000-4000-8101-000000000006'::uuid, '哪项最能区分“摘抄集合”和“分析报告”？', null, 10),
    ('9a110000-0000-4000-8202-000000000006'::uuid, '9a110000-0000-4000-8102-000000000006'::uuid, '某学科课标没有单独设置“学业要求”时，报告应怎样填写？', null, 10),
    ('9a110000-0000-4000-8201-000000000007'::uuid, '9a110000-0000-4000-8101-000000000007'::uuid, '“抓准对标对象”之后，下一组关键动作是什么？', null, 10),
    ('9a110000-0000-4000-8202-000000000007'::uuid, '9a110000-0000-4000-8102-000000000007'::uuid, '以下哪份产出已经完成本单元要求？', null, 10)
)
insert into public.v2_assessment_items (
  id, assessment_block_id, item_type_id, grading_mode_id, prompt_markdown,
  case_markdown, max_score, rubric, sort_order, is_required
)
select
  item_rows.id,
  item_rows.block_id,
  item_type.id,
  grading_mode.id,
  item_rows.prompt,
  item_rows.case_text,
  4,
  null,
  item_rows.sort_order,
  true
from item_rows
join public.v2_dictionary_groups item_group on item_group.key = 'item_type'
join public.v2_dictionary_items item_type on item_type.group_id = item_group.id and item_type.key = 'single_choice'
join public.v2_dictionary_groups grading_group on grading_group.key = 'grading_mode'
join public.v2_dictionary_items grading_mode on grading_mode.group_id = grading_group.id and grading_mode.key = 'auto'
on conflict (id) do update set
  assessment_block_id = excluded.assessment_block_id,
  item_type_id = excluded.item_type_id,
  grading_mode_id = excluded.grading_mode_id,
  prompt_markdown = excluded.prompt_markdown,
  case_markdown = excluded.case_markdown,
  max_score = excluded.max_score,
  rubric = excluded.rubric,
  sort_order = excluded.sort_order,
  is_required = excluded.is_required,
  updated_at = now();

with option_rows(item_id, option_key, option_text, sort_order) as (
  values
    ('9a110000-0000-4000-8201-000000000001'::uuid, 'A', '课标规定每节课必须使用的教学流程', 10),
    ('9a110000-0000-4000-8201-000000000001'::uuid, 'B', '教材是课标的逐字展开', 20),
    ('9a110000-0000-4000-8201-000000000001'::uuid, 'C', '课标给方向与要求，教材组织载体，教案面向具体学生作安排', 30),
    ('9a110000-0000-4000-8201-000000000001'::uuid, 'D', '教材出现的内容都自动成为单元重点', 40),
    ('9a110000-0000-4000-8202-000000000001'::uuid, 'A', '先写课堂活动，再找一句课标装饰', 10),
    ('9a110000-0000-4000-8202-000000000001'::uuid, 'B', '先用课标定尺度，再看教材承载，最后结合学生作教案决策', 20),
    ('9a110000-0000-4000-8202-000000000001'::uuid, 'C', '把教材目录复制为课标分析', 30),
    ('9a110000-0000-4000-8202-000000000001'::uuid, 'D', '先规定教法，再改写课标动词', 40),
    ('9a110000-0000-4000-8201-000000000002'::uuid, 'A', '因为来自课标，必须全文保留', 10),
    ('9a110000-0000-4000-8201-000000000002'::uuid, 'B', '作为主要依据置顶', 20),
    ('9a110000-0000-4000-8201-000000000002'::uuid, 'C', '降为背景或删除', 30),
    ('9a110000-0000-4000-8201-000000000002'::uuid, 'D', '改写成教学活动', 40),
    ('9a110000-0000-4000-8202-000000000002'::uuid, 'A', '目标太低', 10),
    ('9a110000-0000-4000-8202-000000000002'::uuid, 'B', '把表现要求越界推断成固定教学流程', 20),
    ('9a110000-0000-4000-8202-000000000002'::uuid, 'C', '没有引用教材', 30),
    ('9a110000-0000-4000-8202-000000000002'::uuid, 'D', '课标不能用于目标', 40),
    ('9a110000-0000-4000-8201-000000000003'::uuid, 'A', '逐篇搜索课文标题', 10),
    ('9a110000-0000-4000-8201-000000000003'::uuid, 'B', '从观点、材料、论证、质疑与有依据表达等单元核心要素出发', 20),
    ('9a110000-0000-4000-8201-000000000003'::uuid, 'C', '复制全部语文核心素养', 30),
    ('9a110000-0000-4000-8201-000000000003'::uuid, 'D', '只搜索“议论文”三个字', 40),
    ('9a110000-0000-4000-8202-000000000003'::uuid, 'A', '课程内容 → 学业质量 → 主题要素 → 课程目标', 10),
    ('9a110000-0000-4000-8202-000000000003'::uuid, 'B', '学业质量 → 课程目标 → 课程内容 → 教材标题', 20),
    ('9a110000-0000-4000-8202-000000000003'::uuid, 'C', '教材标题 → 教学提示 → 教学活动', 30),
    ('9a110000-0000-4000-8202-000000000003'::uuid, 'D', '主题与核心要素 → 课程目标 → 课程内容 → 学业质量', 40),
    ('9a110000-0000-4000-8201-000000000004'::uuid, 'A', '只遗漏教材页码', 10),
    ('9a110000-0000-4000-8201-000000000004'::uuid, 'B', '遗漏认知动词和应用条件，把要求降成知识清单', 20),
    ('9a110000-0000-4000-8201-000000000004'::uuid, 'C', '遗漏固定教学流程', 30),
    ('9a110000-0000-4000-8201-000000000004'::uuid, 'D', '没有遗漏', 40),
    ('9a110000-0000-4000-8202-000000000004'::uuid, 'A', '动词：借助；对象：图表；条件：初步；程度：解释', 10),
    ('9a110000-0000-4000-8202-000000000004'::uuid, 'B', '动词：数据；对象：解释；条件：规律；程度：图表', 20),
    ('9a110000-0000-4000-8202-000000000004'::uuid, 'C', '动词：解释；对象：数据变化规律；条件：借助图表；程度：初步', 30),
    ('9a110000-0000-4000-8202-000000000004'::uuid, 'D', '四个维度都无法判断', 40),
    ('9a110000-0000-4000-8201-000000000005'::uuid, 'A', '数学全等三角形 → 只全文搜索“全等”', 10),
    ('9a110000-0000-4000-8201-000000000005'::uuid, 'B', '语文议论性单元 → 思辨性阅读与表达任务群＋第四学段', 20),
    ('9a110000-0000-4000-8201-000000000005'::uuid, 'C', '英语 Animal Friends → 先查语法项目，匹配后停止', 30),
    ('9a110000-0000-4000-8201-000000000005'::uuid, 'D', '道德与法治维护社会秩序 → 不分学段读取全部法治教育', 40),
    ('9a110000-0000-4000-8202-000000000005'::uuid, 'A', '统一使用全文关键词搜索', 10),
    ('9a110000-0000-4000-8202-000000000005'::uuid, 'B', '每个学科都平均覆盖全部核心素养', 20),
    ('9a110000-0000-4000-8202-000000000005'::uuid, 'C', '课程目标找终点、课程内容找载体、学业质量校准、最后做减法', 30),
    ('9a110000-0000-4000-8202-000000000005'::uuid, 'D', '先决定教学活动，再反推课标依据', 40),
    ('9a110000-0000-4000-8201-000000000006'::uuid, 'A', '摘录文字越多越好', 10),
    ('9a110000-0000-4000-8201-000000000006'::uuid, 'B', '每一行必须填满四个维度', 20),
    ('9a110000-0000-4000-8201-000000000006'::uuid, 'C', '原文有出处、解读有依据、综合结论能由证据推出', 30),
    ('9a110000-0000-4000-8201-000000000006'::uuid, 'D', '结论只需写“落实核心素养”', 40),
    ('9a110000-0000-4000-8202-000000000006'::uuid, 'A', '从其他位置找一段文字冒充学业要求', 10),
    ('9a110000-0000-4000-8202-000000000006'::uuid, 'B', '删除整行且不作说明', 20),
    ('9a110000-0000-4000-8202-000000000006'::uuid, 'C', '自行编写一条学业要求', 30),
    ('9a110000-0000-4000-8202-000000000006'::uuid, 'D', '注明“本课标未单列”，不虚构替代文字', 40),
    ('9a110000-0000-4000-8201-000000000007'::uuid, 'A', '直接写教学活动', 10),
    ('9a110000-0000-4000-8201-000000000007'::uuid, 'B', '先制作课件', 20),
    ('9a110000-0000-4000-8201-000000000007'::uuid, 'C', '完成三部分定位，再进行四维解读', 30),
    ('9a110000-0000-4000-8201-000000000007'::uuid, 'D', '寻找一份现成教案', 40),
    ('9a110000-0000-4000-8202-000000000007'::uuid, 'A', '摘录全部核心素养的文档', 10),
    ('9a110000-0000-4000-8202-000000000007'::uuid, 'B', '有版本与路径、有差异化解读、结论可回溯到证据的单元课标分析报告', 20),
    ('9a110000-0000-4000-8202-000000000007'::uuid, 'C', '直接由课标生成的课堂活动流程', 30),
    ('9a110000-0000-4000-8202-000000000007'::uuid, 'D', '教材知识点清单', 40)
)
insert into public.v2_assessment_options (id, item_id, option_key, option_text, sort_order)
select
  gen_random_uuid(),
  option_rows.item_id,
  option_rows.option_key,
  option_rows.option_text,
  option_rows.sort_order
from option_rows
where not exists (
  select 1 from public.v2_assessment_options existing
  where existing.item_id = option_rows.item_id and existing.option_key = option_rows.option_key
);

with answer_rows(item_id, correct_key) as (
  values
    ('9a110000-0000-4000-8201-000000000001'::uuid, 'C'),
    ('9a110000-0000-4000-8202-000000000001'::uuid, 'B'),
    ('9a110000-0000-4000-8201-000000000002'::uuid, 'C'),
    ('9a110000-0000-4000-8202-000000000002'::uuid, 'B'),
    ('9a110000-0000-4000-8201-000000000003'::uuid, 'B'),
    ('9a110000-0000-4000-8202-000000000003'::uuid, 'D'),
    ('9a110000-0000-4000-8201-000000000004'::uuid, 'B'),
    ('9a110000-0000-4000-8202-000000000004'::uuid, 'C'),
    ('9a110000-0000-4000-8201-000000000005'::uuid, 'B'),
    ('9a110000-0000-4000-8202-000000000005'::uuid, 'C'),
    ('9a110000-0000-4000-8201-000000000006'::uuid, 'C'),
    ('9a110000-0000-4000-8202-000000000006'::uuid, 'D'),
    ('9a110000-0000-4000-8201-000000000007'::uuid, 'C'),
    ('9a110000-0000-4000-8202-000000000007'::uuid, 'B')
)
insert into private.v2_assessment_keys (item_id, answer_key, scoring_config)
select item_id, jsonb_build_object('correct', jsonb_build_array(correct_key)), '{"points_per_correct":4}'::jsonb
from answer_rows
on conflict (item_id) do update set
  answer_key = excluded.answer_key,
  scoring_config = excluded.scoring_config;

commit;
