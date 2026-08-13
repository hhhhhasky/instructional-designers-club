begin;

do $$
declare
  v_payload jsonb := $subjectskill${"skill_slug":"subject-lesson-design-biology","source_skill_name":"biology-public-lesson-design","version_label":"v2.0.0","snapshot_hash":"a5458f94eb7ae0ed828c07df53dd73d2bf8d3b01cecd6f3c28e4206bbd7c6904","instructions":"---\nname: biology-public-lesson-design\ndescription: Design complete junior-secondary biology public lessons from precisely matched textbook evidence, selecting a discipline-specific pathway for observation and comparison, structure-function model construction, controlled investigation, data-based physiological explanation, ecology systems modeling, heredity-evolution reasoning, or health and socio-scientific decision making. Use for 初中生物学公开课、优质课、展示课、赛课 and lesson plans requiring big-concept positioning, biological evidence, model revision, organism ethics, assessment, assignments, and reflection.\n---\n\n# 生物学公开课设计\n\n把准确教材证据转化为一节以生命大概念统摄事实、用观察/实验/数据建构模型、再用生命观念解释真实现象的公开课。学生不能只记结构名称和结论；必须形成结构与功能、物质与能量、进化与适应或生态系统中的一种核心解释视角。\n\n## 运行门禁\n\n1. 核对年级、版本、册次、单元、章、节、课时位置及教材正文、图表、数据和活动。\n2. 当前教材库若只有官方目录摘要，只能输出证据缺口和设计框架，不得生成声称依据教材正文的完整教案。\n3. 活体、人体数据、显微材料、解剖、培养、健康和生态调查须核对伦理、安全、隐私与放归/处置要求。\n4. 必读 [主流模式](references/mainstream-models.md)、[输出模板](references/output-template.md)、[初中样例](references/excellent-example-junior.md)；查依据时读 [来源边界](references/sources-and-boundaries.md)。\n\n## 核心工作流\n\n### 1. 建立大概念与解释地图\n\n提取学习主题、大概念/重要概念、生命层次与尺度、关键结构和过程、证据来源、模型及局限、变量与因果、进化/生态关系、健康或社会意义。明确本课从哪些事实走向哪个生命观念。\n\n### 2. 诊断前概念\n\n识别目的论（“为了需要所以长出”）、拟人化、结构名词堆积、相关即因果、个体结论外推群体、静态图代替动态过程、模型当实物、健康建议缺证据等问题。无班情时标“一般性预判”，用画图、排序、数据解释或反例判断诊断。\n\n### 3. 确定核心增长\n\n> 学生从“罗列事实/凭直觉解释”，走向“能依据哪些观察、实验或数据，使用何种生命观念和模型，在什么尺度与边界解释或预测什么生命现象”。\n\n目标2—4项，绑定个体证据和标准。证据可为观察图、比较表、原始数据、变量方案、机制模型及修订痕迹、证据论证、生态网络或健康决策。\n\n### 4. 选择主导模式\n\n- 观察—比较—分类—概念；\n- 数据冲突—结构功能模型—验证修订；\n- 问题—变量—实验—证据—解释；\n- 生理过程的数据分析与机制解释；\n- 生态系统关系建模与扰动推演；\n- 遗传/进化证据与概率模型；\n- 健康/生物技术社会议题的证据决策。\n\n依 [主流模式](references/mainstream-models.md) 执行，不机械套完整探究环节。\n\n### 5. 构建证据—模型循环\n\n`现象/数据→个体模型→模型预测→新证据检验→比较质疑→修订模型→概念表达→新情境解释`。区分直接观察、数据事实、模型推断和价值判断；标注尺度、样本、对照和外推边界。\n\n### 6. 写出实践与伦理\n\n明确材料来源、样本数量、分组轮换、显微/测量规范、活体福利、人体隐私、微生物与生物材料处置、放归原则和停止条件。不得为了展示伤害生物、采集保护物种或公开个人健康信息。\n\n### 7. 复核\n\n- 是否由大概念组织事实并形成可迁移生命观念；\n- 模型是否由学生证据修订，而非教师直接展示；\n- 结构功能是否有证据，因果是否有对照/机制支持；\n- 是否保留原始观察、个体差异和异常；\n- 是否避免目的论、拟人化和过度外推；\n- 全员证据、评价、伦理、安全、时间和下一课连接是否闭合。\n\n## 输出要求\n\n严格使用 [输出模板](references/output-template.md) 十三部分，Markdown 输出。教材仅目录、图表/数据缺失、外部健康事实或伦理条件不明时明确停止并列补充项；样例只示范机制。","input_contract":{"format":"biology_public_lesson_input_v1","required":["stage","subject","grade","volume","unit","topic","lesson_type"],"supported_stages":["初中"],"evidence_gate":"full_text_or_user_material_required_when_catalogue_only"},"output_contract":{"format":"biology_public_lesson_markdown_v1","required_sections":["课程基本信息","单元大概念与教材定位","生命现象—证据—模型分析","学情与前概念","核心增长与目标—任务—证据","重难点与证据—模型链","主导模式与课堂主线","材料、样本、安全伦理与分工","原始记录、模型与评价工具","教学流程","板书与动态模型","评价量规、差异化与作业","教学反思与核验清单"],"lesson_flow_required":["环节功能/对应目标","对象/尺度","核心问题/预测/指令","个体先行证据","材料/分工/伦理","教师行为","学生生物学实践","观察/变量/模型要求","原始证据/产出","典型误解/异常","评价与反馈分支","生命观念/方法落点","结论与外推边界","阶段成果与过渡","时间核算"]},"source_metadata":{"source_package":"biology-public-lesson-design","source_kind":"repository_skill_source","source_file_count":6,"runtime_reference_count":4,"source_skill_hash":"bac8b077d888ec55c0712e9cba2b54e29b23a469817b41dc56b5e820627a6230"},"references":[{"path":"references/mainstream-models.md","name":"初中生物学公开课主流教学模式","description":"七类模式、生命观念、证据模型与伦理边界","media_type":"text/markdown","content":"# 初中生物学公开课主流模式\n\n| 模式 | 适用内容 | 核心循环 | 必须证据 | 失败信号 |\n|---|---|---|---|---|\n| 观察比较与分类 | 细胞、组织、生物类群 | 规范观察→个体绘图→特征比较→分类依据→共同性/差异→概念迁移 | 原始观察图、比例/标注、比较表 | 照教材图画；只背名称 |\n| 结构—功能模型建构 | 肾单位、血管、叶片、神经等 | 黑箱问题→数据约束→初模→预测→新图像/数据→修模→解释异常 | 初模与修订痕迹、结构功能证据 | 教师直接给标准图；“结构为了功能而产生” |\n| 控制变量探究 | 萌发、趋性、酶、蒸腾等 | 问题→假设→变量/对照→实施→原始数据→统计趋势→有限结论 | 变量表、重复数据、异常与样本边界 | 单一样本；相关当因果 |\n| 生理机制解释 | 消化、循环、呼吸、调节 | 生活/临床数据→过程排序→物质流/信息流模型→结构功能→异常预测 | 数据表、机制箭头图、预测 | 名词串联；把示意箭头当直接观察 |\n| 生态系统建模 | 食物网、能量、稳定性 | 系统边界→成分关系→网络模型→扰动→反馈与限度→行动评价 | 系统图、情境推演、证据来源 | 食物链越多越稳定等绝对化结论 |\n| 遗传与进化推理 | 基因传递、变异、适应、分类 | 证据/模拟→概率或谱系模型→多代/群体推理→替代解释→边界 | 模拟记录、概率分布、证据链 | 个体适应需求解释进化；把随机当无规律 |\n| 健康与社会议题 | 营养、传染病、免疫、生物技术 | 真实问题→来源分级→机制→风险收益→个体/群体边界→决策沟通 | 来源矩阵、机制证据、条件化建议 | 恐吓式健康教育；单案例下医学结论 |\n\n## 通用规则\n\n- 生命观念不是口号：结构与功能、物质与能量、进化与适应、生态观必须用于解释新现象。\n- 图片、模型和动画是表征，不等于活体直接事实；模型写明保留、忽略和尺度。\n- 生物数据存在个体差异；保留离群值并核查样本、条件和测量，不能追求整齐。\n- 健康课区分一般教育信息与医疗诊断；涉及个人化验单须匿名或使用虚构/公开样例。\n- 活体实验遵守最少伤害、最少数量、适宜环境和妥善放归/处置。","content_hash":"295fa1509a9e5722a057d17d110e7ed384f18e3a314d29068caad9a2c971c6fd","load_mode":"always","max_chars":933,"sort_order":10,"metadata":{"source_package":"biology-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"references/output-template.md","name":"初中生物学公开课完整输出模板","description":"十三部分教案、模型修订、实践伦理与质量硬约束","media_type":"text/markdown","content":"# 初中生物学公开课完整输出模板\n\n## 一、课程基本信息\n\n年级、教材版本/册次、单元—章—节、课型/时长、主导模式、大概念/生命观念、教材证据状态、实践性质、待核实项。\n\n## 二、单元大概念与教材定位\n\n说明七主题关联、概念层级、前后知识/方法依赖、本课独特功能及后续用途。\n\n## 三、生命现象—证据—模型分析\n\n列真实问题、生命层次/尺度、直接观察与数据、关键结构/过程、模型保留与忽略、结构功能/物质能量/进化生态解释、替代解释和外推边界。\n\n## 四、学情与前概念\n\n列已有经验、观念模型、观察实验技能、数据图表能力、至少2项典型误解、伦理健康意识和差异；给2—4分钟诊断及三类分支。\n\n## 五、核心增长与目标—任务—证据\n\n一句核心增长；2—4项目标对齐核心任务、个体证据、成功标准、时点。\n\n## 六、重难点与证据—模型链\n\n写具体障碍、主链 `事实→初模→预测→新证据→修模→概念→迁移`，及本课不能推出的结论。\n\n## 七、主导模式与课堂主线\n\n写选择理由、核心问题、最终生物学成果、自主/指导边界、学习性亮点和删除的形式活动。\n\n## 八、材料、样本、安全伦理与分工\n\n材料来源、数量、规格、预实验、角色轮换、活体福利、人体隐私、显微/解剖/培养规范、停止条件、清理放归/处置、版权。关键条件未核准不得实施。\n\n## 九、原始记录、模型与评价工具\n\n给空白观察/数据表、模型框、证据论证表；写样本、重复、对照、图表规则、异常核查、分批释放证据的时点、模型修订版本和外部数据标识。过程模型的每条箭头必须绑定物质/信息、起点、终点、过程和数据依据，并写模型边界；颜色不得是唯一编码。\n\n## 十、教学流程\n\n每环含：功能/目标、对象/尺度、核心问题、个体先行、材料分工伦理；表格写教师话语、学生实践、观察/变量/模型要求、原始证据、典型误解/异常、反馈分支；补生命观念落点、结论边界、过渡、时间核算。总时长闭合。\n\n## 十一、板书与动态模型\n\n呈现大问题、证据、初模→修模、关键结构过程、生命观念、边界与迁移。标准图须注明来源，不能覆盖学生模型生长。\n\n## 十二、评价量规、差异化与作业\n\n至少四维、3级表现：观察记录、变量方案、数据解释、模型质量/修订、生命观念迁移、证据论证、伦理责任。写分层和色觉、低视力/绘图、数据阅读、口头/书面表达困难的等价参与路径；作业含巩固、模型解释、真实迁移、选做实践及安全隐私边界。\n\n## 十三、反思与核验\n\n3类个体证据、3个风险调整、异常/个体差异处理、模型不足、教材/数据/健康/伦理/版权待核，以及下一课连接。\n\n## 硬约束\n\n- 仅有目录不得生成教材细节。\n- 不把模型当实物、相关当因果、个体外推群体或适应写成有目的改变。\n- 不编造整齐生物数据，不以教师标准图替代学生初模和修订。\n- 不泄露健康隐私，不给个体医疗诊断，不伤害或随意放生活体。\n- 健康数据必须说明来源类别、字段最小化、防反识别和留存/销毁规则；模型箭头只有同时说明对象、方向、过程和证据才算有效。","content_hash":"e4e0ae45315b88cfc038c3bcd162a662e1256f584be2fa548370087284cc31cb","load_mode":"always","max_chars":1272,"sort_order":20,"metadata":{"source_package":"biology-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"references/excellent-example-junior.md","name":"初中生物学优秀教案样例","description":"依据课标附录机制重构的尿液形成过程模型建构示范","media_type":"text/markdown","content":"# 初中生物学优秀教案参考样例\n\n> 依据《义务教育生物学课程标准（2022年版）》附录“尿液的形成过程”教学评价案例原创扩展，示范结构—功能模型建构课。当前项目生物教材仅有官方目录，正式使用前必须补入当册教材正文、肾单位图、成分数据和活动要求；不得把本样例当教材原文。\n\n## 一、课程基本信息\n\n初中生物学，人体生理与健康主题，“尿液的形成过程”，模型建构课，40分钟。核心生命观念：结构与功能相适应、人体是协调统一的整体。教材版本/章/节待实际正文确认。\n\n## 二、单元大概念与教材定位\n\n本课应位于血液、血管及泌尿系统组成之后。学生要从“肾脏能产生尿”这一器官功能描述，进入肾单位结构、滤过与重吸收的机制模型，并用模型解释尿液成分和异常指标。医学异常仅作一般教育解释，不作个人诊断。\n\n## 三、生命现象—证据—模型分析\n\n| 层次 | 内容 |\n|---|---|\n| 现象/数据 | 经核验的血液、原尿、尿液成分及产生量比较 |\n| 初始黑箱 | 肾动脉输入、肾静脉和输尿管输出；肾内过程未知 |\n| 结构模型 | 肾小球—肾小囊—肾小管；具体图按教材核对 |\n| 功能过程 | 滤过与重吸收；物质去向须由数据约束 |\n| 模型局限 | 简化图不呈现全部血管、细胞机制和调节过程 |\n| 迁移边界 | 可作“哪些结构/过程可能异常”的假设，不据化验单诊断疾病 |\n\n## 四、学情与前概念\n\n一般性预判：学生可能认为尿液由血液“直接漏出”、有用物质全部不能通过、箭头越多模型越好。诊断3分钟：只给输入/输出框和匿名成分表，每人画肾脏黑箱初模并标物质去向。没有数据依据者获得“比较有/无、多少变化”支架。\n\n## 五、核心增长与目标—任务—证据\n\n**核心增长**：从器官名称记忆走向用成分数据约束、检验和修订结构—功能模型。\n\n| 目标 | 任务 | 个体证据 | 成功标准 |\n|---|---|---|---|\n| 从数据提出模型约束 | 比较三类液体 | 个人差异表 | 区分直接事实与推断 |\n| 建构并修订机制模型 | 初模—质询—新证据—修模 | 两色模型图 | 结构、流向、过程和数据对应 |\n| 形成结构功能解释 | 口头/书面机制链 | CER卡 | 不用目的论，说明证据 |\n| 谨慎迁移健康情境 | 匿名异常指标分析 | 假设卡 | 只提可能环节及需进一步证据 |\n\n## 六、重难点与证据—模型链\n\n难点不是背肾单位，而是让“原尿与尿液差异”推动模型增加重吸收过程。主链：输入输出数据→黑箱初模→预测→显微图/成分与数量新证据→修模→滤过/重吸收概念→匿名异常迁移。\n\n## 七、主导模式与课堂主线\n\n采用数据冲突—结构功能模型—验证修订。最终成果是一张有版本痕迹和证据标注的尿液形成模型。教师标准图只在学生初模与质询之后出现。\n\n## 八、材料、安全伦理与分工\n\n使用来源可追的教材数据、权威公开教学数据或明确标注为“虚构教学情境”的去身份化数据，不使用学生或家属真实化验单。只保留本课必需的成分与相对数量字段，移除姓名、日期、机构、编号、罕见病史等可反识别信息；教师课前审核，课堂不拍摄传播，课后按学校规则销毁临时纸张/文件。四人分别负责数据核对、模型绘制、证据质询、边界审查，并在第二轮交换；每人仍提交个人模型。健康情境不公开个人信息，不给治疗建议。\n\n## 九、原始记录与模型工具\n\n空白表包含“血液/原尿/尿液：某成分有无或相对变化—直接事实—可支持推断—不能推出”。模型框保留输入、两个输出和待解释黑箱。每条箭头必须同时标注：物质/成分类别、起点、终点、过程名称、对应数据编号；图下注明模型保留和省略的内容。第一版铅笔，新证据后可用蓝/红增删，也可用 `+ / △ / ×`、不同线型或贴签编码，不能把颜色作为唯一通道。\n\n## 十、教学流程\n\n1. **黑箱诊断（3分钟）**：只发第一包“血液与尿液”的最小化匿名/虚构成分资料，引出“尿来自哪里、怎样形成”，每人画初模；第二包原尿数据此时封存，避免提前泄露冲突。\n2. **数据约束初模（7分钟）**：个人比较第一包数据，写两条事实和一个结构预测；小组只质询证据，不先看标准图。\n3. **第一次模型建构（7分钟）**：标输入输出和可能屏障。每条箭头必须回答“什么成分、从哪里到哪里、经什么过程、依据数据几”；只有箭头或结构名而无机制证据者退回补标。未核数据不使用。\n4. **新证据造成冲突（7分钟）**：此时才释放第二包“原尿与尿液成分及每日量”资料，问“若只有滤过会怎样”；每人标出初模失败处及触发修改的数据编号。\n5. **修模并形成概念（8分钟）**：加入肾小管与回到血液的路径，再以教材显微图/结构简图校正；用自己的话概括滤过、重吸收和结构功能关系。\n6. **匿名异常迁移（5分钟）**：对“尿中出现通常不应大量出现的成分”写可能受影响环节、模型理由和还需证据；明确不诊断。\n7. **出口证据（3分钟）**：提交两版模型与一句“我的模型因___证据而把___改为___”。\n\n**总时间：3+7+7+7+8+5+3=40分钟。**\n\n## 十一、板书与动态模型\n\n```text\n血液 → [肾脏黑箱] → 尿液\n        ↓ 新证据\n肾小球/肾小囊：滤过 → 原尿\n肾小管：选择性重吸收 → 回到血液 / 形成尿液\n结构证据 + 成分/数量证据 → 修订模型\n模型解释，不等于医学诊断\n```\n\n## 十二、评价、差异化与作业\n\n量规：数据事实、箭头机制标注、模型对应、修订质量、结构功能解释、健康边界，各3级。未达标者用物质卡和半成品流向；达标者补数量解释；提前达标者指出模型省略。色觉困难者使用符号/线型/贴签；低视力或绘图困难者可操作放大实体卡或提交结构化文字模型；数据阅读困难者获得逐行高亮表与朗读版；表达困难者可指卡排序并录音说明，评价标准等价。作业为整理两版模型并解释一项变化（12分钟），选做阅读权威肾健康科普并标注来源，不分析家人化验单。\n\n## 十三、反思与核验\n\n收集差异表、两版模型、异常假设卡。风险：标准图过早公布、箭头替代机制、健康迁移变诊断；分别延迟标准图、强制证据注释和使用匿名情境。正式实施前核对教材章节、图、数据单位及健康表述。","content_hash":"d92d32dba1d8e2078199ce96d132ec5e5e746ab1befae1ce7d0d4c25b1ebb757","load_mode":"always","max_chars":2595,"sort_order":30,"metadata":{"source_package":"biology-public-lesson-design","runtime_role":"discipline_reference","stages":["初中"]}},{"path":"references/sources-and-boundaries.md","name":"生物学 Skill 来源与边界","description":"课标、新教材、目录证据、健康伦理与版权边界","media_type":"text/markdown","content":"# 生物学 Skill 来源与边界\n\n- 本地《义务教育生物学课程标准（2022年版）》正文及其附录教学评价案例是首要方法依据；官方入口：[义务教育课程方案和课程标准（2022年版）](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)。\n- [人教版义务教育生物学（七～八年级）新教材介绍](https://www.pep.com.cn/xw/zt/hd/12/xjcjs/cz/202409/t20240914_1995532.html) 用于核对“单元—章—节”、大概念、实验探究/观察思考/分析讨论和教学评一体化方向。\n- [2024年部级精品课名单](https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A06/202506/W020250624684887950733.pdf) 用于确认细胞、生态、植物、人体等代表课题，不反推具体流程。\n\n当前本项目生物教材仅为官方目录摘要，明确注明“目录不替代教材正文”。因此运行时只有目录时必须请求正文、图表、数据或用户材料；不能用课标案例填充当前教材事实。\n\n样例依据课标附录“尿液的形成过程”机制原创展开，不复制教材图。医学/健康内容只作一般教育，化验数据使用匿名公开或虚构案例并标注；不诊断个人疾病。活体、微生物、人体样本、解剖和野外调查遵守学校伦理安全与当地法规；来源、采集、放归和处置均需核准。外部图表、论文、视频与教案注明来源和授权。","content_hash":"39218ed01ded6ceb65ee29cd0d68fe23d90547296c4d193e57cf7929564fd9f2","load_mode":"always","max_chars":662,"sort_order":50,"metadata":{"source_package":"biology-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"agents/openai.yaml","name":"OpenAI Skill 界面配置","description":"源包界面元数据，不进入生成上下文","media_type":"application/yaml","content":"interface:\n  display_name: \"生物学公开课设计\"\n  short_description: \"依据生命大概念、观察证据和模型建构生成完整公开课教案\"\n  default_prompt: \"请依据准确教材内容，为初中生物学公开课生成可实施、可评价的完整教案。\"","content_hash":"472afd42963260e9fbc54304d0d994c59ff663b52254dd9030fd181cd36eb158","load_mode":"evaluation_only","max_chars":142,"sort_order":60,"metadata":{"source_package":"biology-public-lesson-design","runtime_role":"evaluation_only"}}],"skill_description":"完整初中生物学公开课设计 Skill：以生命大概念、观察数据和模型修订组织学习，生成实践伦理、健康边界与迁移完整的教案。","match_criteria":{"subjects":["生物"],"lesson_types":["公开课"]}}$subjectskill$::jsonb;
  v_skill_id uuid;
  v_version_id uuid;
begin
  select id into v_skill_id
  from public.hai_work_skills
  where slug = v_payload->>'skill_slug';

  if v_skill_id is null then
    raise exception 'Work Skill 不存在：%', v_payload->>'skill_slug';
  end if;

  if exists (
    select 1 from public.hai_work_skill_versions
    where skill_id = v_skill_id
      and version_label = v_payload->>'version_label'
      and status in ('published', 'archived')
  ) then
    raise exception '同名学科 Work Skill 版本已冻结：%', v_payload->>'version_label';
  end if;

  update public.hai_work_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id and status = 'published';

  insert into public.hai_work_skill_versions (
    skill_id, version_label, status, prompt_template, default_prompt_template,
    input_contract, output_contract, snapshot_hash, source_metadata, published_at
  ) values (
    v_skill_id,
    v_payload->>'version_label',
    'draft',
    v_payload->>'instructions',
    v_payload->>'instructions',
    v_payload->'input_contract',
    v_payload->'output_contract',
    v_payload->>'snapshot_hash',
    v_payload->'source_metadata',
    null
  )
  on conflict (skill_id, version_label) do update set
    status = 'draft',
    prompt_template = excluded.prompt_template,
    default_prompt_template = excluded.default_prompt_template,
    input_contract = excluded.input_contract,
    output_contract = excluded.output_contract,
    snapshot_hash = excluded.snapshot_hash,
    source_metadata = excluded.source_metadata,
    published_at = null,
    updated_at = now()
  returning id into v_version_id;

  delete from public.hai_work_skill_references where skill_version_id = v_version_id;

  insert into public.hai_work_skill_references (
    skill_version_id, path, name, description, media_type, content,
    content_hash, load_mode, max_chars, sort_order, metadata
  )
  select
    v_version_id, item.path, item.name, item.description, item.media_type,
    item.content, item.content_hash, item.load_mode, item.max_chars,
    item.sort_order, item.metadata
  from jsonb_to_recordset(v_payload->'references') as item(
    path text, name text, description text, media_type text, content text,
    content_hash text, load_mode text, max_chars integer, sort_order integer,
    metadata jsonb
  );

  update public.hai_work_skill_versions
  set status = 'published', published_at = now(), updated_at = now()
  where id = v_version_id;

  update public.hai_work_skills
  set name = '生物学公开课设计 Skill',
      description = v_payload->>'skill_description',
      match_criteria = v_payload->'match_criteria',
      is_fallback = false,
      is_enabled = true,
      updated_at = now()
  where id = v_skill_id;

  perform public.hai_recompute_work_module_enabled('subject-lesson-design');
end;
$$;

commit;
