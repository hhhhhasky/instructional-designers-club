import type { IntentName, IntentResult } from "./types.ts";

export type MethodIntentTag =
  | "teaching_design"
  | "lesson_plan_diagnosis"
  | "public_lesson"
  | "learning_profile"
  | "classroom_management"
  | "learning_motivation"
  | "assessment_feedback"
  | "ai_lesson_planning"
  | "pbl_crossdisciplinary"
  | "teacher_growth"
  | "general_question"
  | "unknown";

export type HanMethodCardKind =
  | "methodology"
  | "framework"
  | "method"
  | "strategy"
  | "consultation_standard";

export type HanMethodCard = {
  id: string;
  name: string;
  aliases: string[];
  course: string;
  kind: HanMethodCardKind;
  ownership:
    | "han_course"
    | "course_adapted_theory"
    | "consultation_calibration";
  priority: number;
  summary: string;
  useWhen: string[];
  avoidWhen: string[];
  coreJudgement: string;
  moves: string[];
  answerFocus: string;
  queryTerms: string[];
  intents: MethodIntentTag[];
  related: string[];
  sourceRefs: string[];
};

export type HanMethodCardConfigRow = {
  id: string;
  name: string;
  aliases: string[];
  course: string;
  kind: HanMethodCardKind;
  ownership: HanMethodCard["ownership"];
  priority: number;
  summary: string;
  use_when: string[];
  avoid_when: string[];
  core_judgement: string;
  moves: string[];
  answer_focus: string;
  query_terms: string[];
  intents: MethodIntentTag[];
  related: string[];
  source_refs: string[];
  enabled: boolean;
  is_deleted: boolean;
  updated_at?: string;
};

export const hanCourseMethodCards: HanMethodCard[] = [
  {
    id: "lesson-preparation-design-master",
    name: "备课流程＋教学设计框架",
    aliases: ["总方法论", "备课与教学设计总框架", "备课设计全景图"],
    course: "教学通识课",
    kind: "methodology",
    ownership: "han_course",
    priority: 100,
    summary:
      "用分析、设计、研发、迭代四个阶段把握备课顺序，用教材分析、学情分析、教学目标、教学重难点、教学环节和教学评价六个要素把握设计内容与质量。",
    useWhen: [
      "用户需要理解备课和教学设计的全貌",
      "用户混淆备课步骤与教案要素",
      "多个教学问题相互牵连，局部方法无法解释整体关系",
    ],
    avoidWhen: [
      "用户只问一个非常具体的课堂动作",
      "已有更精确的下位方法可以直接解决问题",
    ],
    coreJudgement:
      "备课流程回答先后顺序，教学设计框架回答要设计和检查什么；两者是同一套总方法论的纵向流程与横向结构，不能互相替代。",
    moves: [
      "先完整点出分析、设计、研发、迭代四个阶段",
      "再完整点出教材、学情、目标、重难点、环节、评价六个要素",
      "沿要素间的依据关系找到最早断点",
      "最后选择一个下位方法完成当前动作",
    ],
    answerFocus:
      "回答必须说“在我的教学通识课里，这套总方法论叫备课流程＋教学设计框架”，先完整但简短地交代四阶段和六要素，再只展开一个关键关系或下位方法。",
    queryTerms: [
      "教学设计",
      "备课从哪开始",
      "备课很乱",
      "整体框架",
      "总方法论",
      "备课逻辑",
      "系统思维",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "teacher_growth"],
    related: [
      "lesson-preparation-workflow",
      "teaching-design-six-elements",
      "teaching-foundations-three-domains",
      "design-logic-chain",
    ],
    sourceRefs: [
      "docs/教学通识课Plus-课程大纲.md",
      "docs/哈老师语料/01-新教师与备课入门.md",
    ],
  },
  {
    id: "teaching-design-six-elements",
    name: "教学设计六要素框架",
    aliases: ["教学设计框架", "六要素", "教案六要素"],
    course: "教学通识课",
    kind: "framework",
    ownership: "han_course",
    priority: 100,
    summary:
      "用教材分析、学情分析、教学目标、教学重难点、教学环节或学习流程、教学评价或学习评估六个要素设计、诊断和复盘教学方案。",
    useWhen: [
      "用户要诊断教案或说课的整体逻辑",
      "用户听课后不知道怎样迁移",
      "用户要判断目标、环节和评价是否对齐",
      "用户需要基于设计做教学反思",
    ],
    avoidWhen: [
      "用户的问题只是备课先后顺序",
      "已经明确是某一个要素的局部问题，应优先使用对应下位方法",
    ],
    coreJudgement:
      "六个要素不是教案栏目清单，而是一组有依据关系的设计变量；前端的教材与学情判断要支撑目标和重难点，教学环节与评价要共同检验目标是否达成。",
    moves: [
      "用教材分析确定内容位置与价值",
      "用学情分析确定学生起点与卡点",
      "据此确定目标和教学重难点",
      "设计推动学生抵达目标的教学环节或学习流程",
      "用教学评价或学习评估收集达成证据",
      "沿六要素关系找到最早断裂处",
    ],
    answerFocus:
      "先定位六要素中最可能出问题的一项，再检查它与前后要素的关系，不把六项逐一讲完。",
    queryTerms: [
      "教学设计框架",
      "六要素",
      "教案诊断",
      "听课迁移",
      "目标环节评价",
      "教学反思",
      "学习流程",
      "学习评估",
    ],
    intents: [
      "teaching_design",
      "lesson_plan_diagnosis",
      "public_lesson",
      "teacher_growth",
    ],
    related: [
      "lesson-preparation-design-master",
      "lesson-preparation-workflow",
      "design-logic-chain",
      "reflection-evidence-loop",
    ],
    sourceRefs: [
      "docs/哈老师语料/01-新教师与备课入门.md",
      "docs/HAI_R10_01_FEEDBACK_PROMPT_ITERATION.md",
    ],
  },
  {
    id: "teaching-foundations-three-domains",
    name: "教学框架三大底层领域",
    aliases: ["三大底层领域", "学习科学教学科学教育哲学", "教学设计底层依据"],
    course: "教学通识课",
    kind: "framework",
    ownership: "han_course",
    priority: 97,
    summary:
      "用学习科学解释学习如何发生，用教学科学解释有效教学如何发生，用教育哲学判断好的教育应当呈现怎样的样态。",
    useWhen: [
      "用户追问教学框架为什么这样设计",
      "用户需要区分学习机制、教学有效性与教育价值判断",
      "不同教学主张发生冲突，需要判断分歧来自哪一层",
    ],
    avoidWhen: [
      "用户只需要一个立即可用的课堂动作",
      "没有必要上升到底层依据就能解决具体问题",
    ],
    coreJudgement:
      "一套教学框架既要符合学习发生的规律和有效教学的证据，也要接受教育目的与价值的审视；三者分别回答学习、教学和好教育的问题，不能混为一谈。",
    moves: [
      "先判断当前争议属于学习如何发生、教学如何有效还是教育应当追求什么",
      "用学习科学检查学习机制和学习证据",
      "用教学科学检查策略、支架、反馈与教学有效性",
      "用教育哲学检查目标、学生观和教育价值取向",
      "把底层判断返回备课流程与六要素中的具体设计决定",
    ],
    answerFocus:
      "回答必须说明“在我的教学通识课里，这三个底层领域分别解决三个问题”，再只调用真正能改变本题判断的一个领域；需要解释总框架时才说明三者如何共同支撑。",
    queryTerms: [
      "学习科学",
      "教学科学",
      "教育哲学",
      "底层逻辑",
      "为什么这样教",
      "有效教学",
      "好的教育",
      "教育目的",
    ],
    intents: ["teaching_design", "teacher_growth", "general_question"],
    related: [
      "lesson-preparation-design-master",
      "teaching-design-six-elements",
      "interactive-lecture-cycle",
    ],
    sourceRefs: [
      "docs/教学通识课Plus-课程大纲.md",
      "docs/hai-course-methodology/00-教学通识课总方法论.md",
    ],
  },
  {
    id: "design-logic-chain",
    name: "教学设计逻辑链",
    aliases: ["教案逻辑链", "从教材分析到板书"],
    course: "教学原理篇",
    kind: "framework",
    ownership: "han_course",
    priority: 98,
    summary:
      "教材分析、学情分析、教学目标、重难点、教学策略、教学过程和板书之间不是并列栏目，而是环环相扣的因果链。",
    useWhen: [
      "教案模块齐全但没有逻辑",
      "说课像逐项汇报",
      "听课后只会模仿活动",
      "板书和课堂主线脱节",
    ],
    avoidWhen: ["用户只需要修改一个可测目标", "用户只问一种评价工具的操作"],
    coreJudgement:
      "教案的问题通常不在某个栏目没写满，而在前一项没有为后一项提供依据。",
    moves: [
      "用教材分析确定教什么",
      "用学情和目标确定起点终点",
      "由教材和学情分别确定重点难点",
      "由重难点选择策略",
      "把策略展开为过程",
      "把过程逻辑视觉化为板书",
    ],
    answerFocus:
      "找到当前链条最早断裂的位置，从那里往后解释，不逐项审查所有栏目。",
    queryTerms: [
      "教案逻辑",
      "说课结构",
      "听课模仿",
      "环节很散",
      "板书",
      "栏目齐全",
    ],
    intents: [
      "lesson_plan_diagnosis",
      "teaching_design",
      "public_lesson",
      "teacher_growth",
    ],
    related: [
      "textbook-four-dimensions",
      "key-difficulty-dual-source",
      "strategy-process-board",
    ],
    sourceRefs: ["教师培训课程/教学原理/教学原理-知识模型清单.md"],
  },
  {
    id: "textbook-four-dimensions",
    name: "教材分析四维度",
    aliases: ["教材四维分析", "教材横纵宏观分析"],
    course: "教学原理篇",
    kind: "method",
    ownership: "han_course",
    priority: 92,
    summary:
      "从基本内容、单元横向联系、学段纵向逻辑和课标核心素养宏观视角分析教材。",
    useWhen: [
      "教材分析只是内容摘抄",
      "不知道本课在单元和学段中的位置",
      "教学重点抓不准",
    ],
    avoidWhen: [
      "缺少具体教材、单元或课标材料，无法谈具体内容",
      "问题核心明显在学生卡点而不是教材定位",
    ],
    coreJudgement:
      "教材分析不只是复述这一课讲什么，还要看它在单元、学段和课标中的位置。",
    moves: [
      "说清本课基本内容",
      "找本课与单元前后内容的横向联系",
      "找同主题在学段中的纵向进阶",
      "用课标和核心素养校准方向",
    ],
    answerFocus:
      "材料不足时只给分析维度并索要教材依据，不编造课文、单元或课标内容。",
    queryTerms: [
      "教材分析",
      "单元位置",
      "课标",
      "纵向分析",
      "横向分析",
      "教参",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "public_lesson"],
    related: ["key-difficulty-dual-source", "target-three-step"],
    sourceRefs: ["教师培训课程/教学原理/教学原理-知识模型清单.md"],
  },
  {
    id: "key-difficulty-dual-source",
    name: "重难点双来源模型",
    aliases: ["重点难点双来源", "重点来自教材难点来自学情"],
    course: "教学原理篇",
    kind: "framework",
    ownership: "han_course",
    priority: 96,
    summary:
      "教学重点主要由教材、课标和核心内容决定，教学难点主要由学生的真实起点和卡点决定。",
    useWhen: [
      "重点难点写成同一句话",
      "凭感觉确定难点",
      "不知道重难点与教材学情的关系",
    ],
    avoidWhen: ["没有教材依据也没有学情证据", "用户问的是练习或评价的局部技巧"],
    coreJudgement:
      "重点和难点可能重合，但来源不同，不能因为内容重要就自动判断学生一定难。",
    moves: [
      "从教材和课标找核心内容作为重点依据",
      "从前测、作业和课堂证据找学生卡点作为难点依据",
      "检查策略是否既落实重点又突破难点",
    ],
    answerFocus: "先纠正重点等于难点的混淆，再让用户补一条教材依据或学情证据。",
    queryTerms: [
      "教学重点",
      "教学难点",
      "重难点",
      "重点难点一样",
      "怎么确定难点",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "public_lesson"],
    related: [
      "textbook-four-dimensions",
      "insight-toolbox",
      "strategy-process-board",
    ],
    sourceRefs: ["教师培训课程/教学原理/教学原理-知识模型清单.md"],
  },
  {
    id: "strategy-process-board",
    name: "策略到过程再到板书",
    aliases: ["策略过程链", "板书逻辑视觉化"],
    course: "教学原理篇",
    kind: "framework",
    ownership: "han_course",
    priority: 88,
    summary:
      "教学策略依据重难点产生，教学过程是策略的展开，板书是教学过程逻辑的视觉化。",
    useWhen: [
      "活动很多但没有依据",
      "教法学法只是罗列名词",
      "板书成为装饰或内容抄写",
    ],
    avoidWhen: ["问题还没有确定目标和重难点", "用户只问板书字体或版面美化"],
    coreJudgement:
      "不要先设计活动和板书，先说清楚为了达成什么、突破什么而采用什么策略。",
    moves: [
      "从重难点提炼策略",
      "把策略写成意图、方法、操作",
      "把操作组织成递进过程",
      "用板书呈现过程中的核心关系",
    ],
    answerFocus:
      "只检查一条策略能否一直落到活动和板书，不把教法、学法、活动做成三张清单。",
    queryTerms: [
      "教学策略",
      "教学过程",
      "教法学法",
      "板书设计",
      "活动堆砌",
      "意图方法操作",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "public_lesson"],
    related: ["design-logic-chain", "question-chain"],
    sourceRefs: [
      "教师培训课程/教学原理/教学原理-知识模型清单.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "target-three-step",
    name: "教学目标设计三步法",
    aliases: ["读教材读课标组目标", "三步目标设计法"],
    course: "教学目标篇",
    kind: "method",
    ownership: "han_course",
    priority: 98,
    summary:
      "先读教材梳理前置、本课和后续逻辑，再读课标提取素养要求，最后用可评估句式组装目标。",
    useWhen: [
      "不会写教学目标",
      "目标照抄教参",
      "目标与教材课标脱节",
      "目标过多过空",
    ],
    avoidWhen: [
      "用户已经有目标，只需要检查质量时优先用目标三检",
      "缺少教材和课标时不要代写具体目标",
    ],
    coreJudgement:
      "目标不是先找漂亮动词，而是先确定本课在教材中的位置和课标指向。",
    moves: [
      "读教材，梳理前置知识、本课知识和后续铺垫",
      "读课标，摘取与核心概念和方法相关的要求",
      "组目标，写出活动、认知动作、知识点、达成水平和必要的素养指向",
    ],
    answerFocus:
      "根据用户当前卡点只推进一步，材料不足时让用户提供教材页、单元位置或课标语句。",
    queryTerms: [
      "教学目标",
      "目标怎么写",
      "照抄教参",
      "核心素养",
      "读教材",
      "读课标",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "public_lesson"],
    related: [
      "target-quality-three-checks",
      "backward-design",
      "core-growth-evidence",
    ],
    sourceRefs: [
      "教师培训课程/教学目标设计/教学目标设计-知识模型清单.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "target-quality-three-checks",
    name: "目标质量三检法",
    aliases: ["目标三检", "可评估具体合理"],
    course: "教学目标篇",
    kind: "strategy",
    ownership: "han_course",
    priority: 94,
    summary:
      "检查行为动词能否观察和评估、知识点是否具体、核心素养挂靠是否合理。",
    useWhen: [
      "用户给出了目标并询问是否合格",
      "目标使用理解了解掌握等模糊动词",
      "目标强行挂核心素养",
    ],
    avoidWhen: [
      "尚未读教材和课标，根本无法确定目标内容",
      "用户问的是整节课结构",
    ],
    coreJudgement:
      "好目标不是句式完整，而是课堂上看得见、内容指向具体、素养挂靠不过度。",
    moves: [
      "问行为动作能不能被看见",
      "问换一个老师能不能知道具体教什么",
      "问这个知识是否真的需要上升到核心素养",
    ],
    answerFocus:
      "挑最影响课堂设计的一项修改，并用 Before 和 After 展示，不一次改写所有目标。",
    queryTerms: [
      "目标是否合理",
      "理解了解掌握",
      "目标太空",
      "目标可评估",
      "目标修改",
    ],
    intents: ["lesson_plan_diagnosis", "teaching_design", "public_lesson"],
    related: ["target-three-step", "backward-design"],
    sourceRefs: ["教师培训课程/教学目标设计/教学目标设计-知识模型清单.md"],
  },
  {
    id: "insight-three-dimensions",
    name: "学情洞察三维框架",
    aliases: ["认知态度情境", "三维学情分析", "用户洞察"],
    course: "学情分析篇",
    kind: "framework",
    ownership: "han_course",
    priority: 98,
    summary:
      "从认知、态度和生活情境三个维度理解学生，并把教师视角翻转为学生如何接收和行动的用户视角。",
    useWhen: [
      "学情分析不知道写什么",
      "只写基础和兴趣",
      "课堂设计只考虑教师怎么讲",
    ],
    avoidWhen: [
      "用户已经明确要获取学情证据时优先用洞察工具箱",
      "问题只涉及教材内容定位",
    ],
    coreJudgement:
      "学情不是学生标签，而是本课中学生会不会、想不想和生活经验能不能接上的具体判断。",
    moves: [
      "看认知维度的前概念、误解和卡点",
      "看态度维度的兴趣、认同和情感倾向",
      "看情境维度的生活经验、资源和文化背景",
      "把洞察转成目标、策略或评价调整",
    ],
    answerFocus: "只抓与本课问题最有关的一个维度，并说明它会怎样改变设计。",
    queryTerms: [
      "学情分析写什么",
      "认知态度情境",
      "学生兴趣",
      "学生经验",
      "用户视角",
    ],
    intents: ["learning_profile", "teaching_design", "lesson_plan_diagnosis"],
    related: [
      "insight-quality-spectrum",
      "insight-toolbox",
      "three-question-pretest-errors",
    ],
    sourceRefs: [
      "教师培训课程/用户洞察课程/用户洞察-知识模型清单.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "insight-quality-spectrum",
    name: "学情洞察质量光谱",
    aliases: ["具体有据可用", "好学情三标准"],
    course: "学情分析篇",
    kind: "strategy",
    ownership: "han_course",
    priority: 93,
    summary: "用具体、有据、可用三个标准区分真正的学情洞察和空泛的学生描述。",
    useWhen: [
      "学情写成基础薄弱兴趣不高",
      "学情没有证据",
      "学情写完没有改变教学",
    ],
    avoidWhen: ["用户还没有任何学生材料，应该先选取证方法", "问题核心不是学情"],
    coreJudgement:
      "基础薄弱不是分析结论，只有具体到哪一步、有证据、能导出教学动作，才是可用学情。",
    moves: [
      "把笼统标签改成具体卡点",
      "为判断补一条前测、谈话、作业或课堂证据",
      "写出这条学情将改变的教学动作",
    ],
    answerFocus:
      "把用户现有的一句学情改造成具体、有据、可用的一句，不扩写成长报告。",
    queryTerms: ["基础薄弱", "兴趣不高", "学情太空", "学情有据", "学情怎么用"],
    intents: ["learning_profile", "lesson_plan_diagnosis", "teaching_design"],
    related: ["insight-three-dimensions", "insight-toolbox"],
    sourceRefs: [
      "教师培训课程/用户洞察课程/用户洞察-知识模型清单.md",
      "教师培训课程/日常课教学/09_第3课_学情分析不是写基础薄弱.md",
    ],
  },
  {
    id: "insight-toolbox",
    name: "学情洞察工具箱",
    aliases: ["学情四种方法", "前测谈话作业试讲"],
    course: "学情分析篇",
    kind: "method",
    ownership: "han_course",
    priority: 97,
    summary:
      "用前测诊断、学生谈话、作业试卷分析和教学试讲四种轻量方法取得学情证据。",
    useWhen: [
      "不知道怎样获取真实学情",
      "跨班公开课不了解学生",
      "想用低成本方式找卡点",
    ],
    avoidWhen: [
      "已有充分证据，只需要解释和转化",
      "不要把四种方法全部要求用户同时执行",
    ],
    coreJudgement:
      "学情分析不能靠印象，要根据问题选择成本最低、最能暴露卡点的一种证据。",
    moves: [
      "前测诊断已有知识和易错点",
      "学生谈话理解不同水平学生怎么想",
      "作业试卷分析高频错因",
      "教学试讲观察内容接受和现场反应",
    ],
    answerFocus: "根据场景只推荐一种最合适的方法，并帮助用户设计一个最小动作。",
    queryTerms: [
      "怎么分析学情",
      "学情证据",
      "课前摸底",
      "前测",
      "学生谈话",
      "作业试卷分析",
      "试讲",
    ],
    intents: ["learning_profile", "public_lesson", "teaching_design"],
    related: ["three-question-pretest-errors", "insight-quality-spectrum"],
    sourceRefs: ["教师培训课程/用户洞察课程/用户洞察-知识模型清单.md"],
  },
  {
    id: "backward-design",
    name: "目标评价活动逆向设计",
    aliases: ["逆向设计三步法", "目标评价活动"],
    course: "教学评价篇",
    kind: "method",
    ownership: "course_adapted_theory",
    priority: 99,
    summary:
      "先确定可评估目标，再设计能证明目标达成的评价任务，最后把评价任务嵌入教学活动。",
    useWhen: [
      "活动与目标脱节",
      "评价在教案最后补写",
      "不知道学生是否学会",
      "教学评不一致",
    ],
    avoidWhen: ["目标本身尚未建立在教材和学情上", "用户只问评价后的反馈语言"],
    coreJudgement:
      "不是上完以后再想怎么评，而是先想学生拿出什么证据，再决定怎样教。",
    moves: [
      "确定清晰可测的学习目标",
      "为目标设计评价任务和标准",
      "根据任务难度设计必要的学习活动和支架",
    ],
    answerFocus: "用一个目标和一个证据打通链条，不把回答写成完整教案。",
    queryTerms: [
      "教学评一致",
      "逆向设计",
      "目标活动评价",
      "怎么判断学会",
      "活动不聚焦",
      "评价任务",
    ],
    intents: [
      "assessment_feedback",
      "lesson_plan_diagnosis",
      "teaching_design",
      "public_lesson",
    ],
    related: [
      "target-quality-three-checks",
      "question-chain",
      "core-growth-evidence",
    ],
    sourceRefs: [
      "教师培训课程/教学评价-设计评价工具/02-知识模型清单.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "question-chain",
    name: "目标驱动问题链",
    aliases: ["问题链三步法", "从碎问碎答到问题链"],
    course: "教学评价篇",
    kind: "method",
    ownership: "han_course",
    priority: 94,
    summary:
      "从可测教学目标出发，根据目标难度设计由浅入深的问题链，再优化问题情境和理答预案。",
    useWhen: [
      "课堂提问很多但很碎",
      "满堂问是什么对不对",
      "问题之间没有递进",
      "提问与目标无关",
    ],
    avoidWhen: [
      "用户问题在叫答或理答而不是问题设计",
      "简单目标不必人为拉成长问题链",
    ],
    coreJudgement: "问题数量多不等于思维发生，先让一条问题链服务一个具体目标。",
    moves: [
      "确定可测目标",
      "按目标难度设计三到六个递进问题",
      "检查动词、情境、资源、回答方式并预判理答",
    ],
    answerFocus:
      "选一组碎问题示范怎样合并成一条链，不替用户设计整节课全部提问。",
    queryTerms: [
      "课堂提问",
      "问题链",
      "碎问碎答",
      "问题太多",
      "问题递进",
      "满堂问",
      "思考不深入",
      "学生都能答",
    ],
    intents: [
      "teaching_design",
      "lesson_plan_diagnosis",
      "assessment_feedback",
      "public_lesson",
    ],
    related: ["classroom-response-loop", "backward-design"],
    sourceRefs: [
      "教师培训课程/教学评价-设计评价工具/02-知识模型清单.md",
      "教师培训课程/2025-02-05_课堂提问的完整策略_大纲.md",
    ],
  },
  {
    id: "classroom-response-loop",
    name: "提问叫答理答反馈闭环",
    aliases: ["交流性评价闭环", "课堂应答策略"],
    course: "教学评价篇",
    kind: "framework",
    ownership: "han_course",
    priority: 91,
    summary:
      "课堂交流性评价由提问设计、叫答覆盖、理答推进和评价语反馈四个连续环节构成。",
    useWhen: [
      "学生不回答",
      "提问后总是自己回答",
      "只点少数学生",
      "学生答错后不知道怎么接",
      "评价语只有很好",
    ],
    avoidWhen: [
      "问题本身尚未设计清楚时先改问题",
      "普通事实问题不必每次使用复杂理答",
    ],
    coreJudgement:
      "课堂提问不是把问题说出去，而是通过等待、全员思考、回应错误和具体反馈取得学习证据。",
    moves: [
      "先提出清晰问题并留出思考时间",
      "让全班先写或思考再叫答",
      "根据答不出、答错、答偏和优秀回答采用不同理答",
      "用具体行为、达成程度和下一步建议反馈",
    ],
    answerFocus: "判断断点在提问、叫答、理答还是反馈，只修一个环节。",
    queryTerms: [
      "学生不回答",
      "自问自答",
      "等待时间",
      "叫答",
      "理答",
      "评价语",
      "答错怎么办",
    ],
    intents: [
      "assessment_feedback",
      "classroom_management",
      "learning_motivation",
      "public_lesson",
    ],
    related: ["question-chain", "all-student-evidence"],
    sourceRefs: [
      "教师培训课程/教学评价-设计评价工具/02-知识模型清单.md",
      "教师培训课程/2025-02-05_课堂提问的完整策略_逐字稿.md",
    ],
  },
  {
    id: "task-five-types",
    name: "真实任务五种类型",
    aliases: ["两难个案设计决策故障", "任务选型"],
    course: "任务情境篇",
    kind: "framework",
    ownership: "han_course",
    priority: 90,
    summary:
      "从两难问题、个案分析、设计问题、决策制定和故障排除中选择与学科知识和学习目标匹配的任务类型。",
    useWhen: [
      "不知道设计什么任务",
      "情境只有故事包装没有学生要做的事",
      "PBL 或真实任务选型困难",
    ],
    avoidWhen: [
      "简单知识和技能不需要强行包装成复杂任务",
      "已经有任务但描述不具体时优先用任务脚本",
    ],
    coreJudgement:
      "任务的起点不是编一个热闹故事，而是让学生必须用本课知识完成一件有判断、有产出的事。",
    moves: [
      "根据学习目标判断学生要分析、设计、决策还是排错",
      "选择最自然的一种任务类型",
      "检查学科知识在任务中是否不可替代",
    ],
    answerFocus: "只推荐一种最匹配的任务类型并说明理由，不把五类都改写成方案。",
    queryTerms: [
      "任务情境",
      "真实任务",
      "PBL",
      "任务类型",
      "两难问题",
      "个案分析",
      "设计任务",
      "故障排除",
    ],
    intents: [
      "pbl_crossdisciplinary",
      "teaching_design",
      "public_lesson",
      "learning_motivation",
    ],
    related: ["task-script-five-elements", "task-motivation-hook"],
    sourceRefs: [
      "教师培训课程/任务情境设计方法课/任务情境设计-知识模型清单.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "task-script-five-elements",
    name: "任务脚本五要素",
    aliases: ["身份受众场景产品目标", "任务具体化五要素"],
    course: "任务情境篇",
    kind: "method",
    ownership: "han_course",
    priority: 96,
    summary:
      "用身份、受众、场景、产品和目标五个要素，把模糊任务改造成学生知道为谁、在什么情况下、做什么以及怎样算好的具体任务。",
    useWhen: [
      "任务写得很空",
      "学生不知道要做什么",
      "任务产出和标准模糊",
      "情境像一句口号",
    ],
    avoidWhen: [
      "任务没有学习必要性时，仅补脚本不能解决",
      "普通一分钟练习不需要五要素齐全",
    ],
    coreJudgement:
      "任务的具体，不是把背景故事写长，而是让角色、受众、场景、产品和达标标准都能被学生想象和执行。",
    moves: [
      "明确学生承担的身份",
      "确定真实可想象的受众",
      "给出有约束的场景",
      "规定具体产品",
      "写清达标标准",
    ],
    answerFocus:
      "用糙版和精版改写一个任务，按需要补最缺的要素，不强求每个小任务五项齐全。",
    queryTerms: [
      "任务不具体",
      "情境很假",
      "身份受众场景",
      "产品",
      "任务标准",
      "学生不知道做什么",
    ],
    intents: ["pbl_crossdisciplinary", "teaching_design", "public_lesson"],
    related: ["task-five-types", "task-motivation-hook"],
    sourceRefs: [
      "教师培训课程/任务情境设计方法课/任务情境设计-知识模型清单.md",
    ],
  },
  {
    id: "task-motivation-hook",
    name: "任务卷入感双层模型",
    aliases: ["具体加意义", "任务动机钩子", "八角动机"],
    course: "任务情境篇",
    kind: "framework",
    ownership: "course_adapted_theory",
    priority: 86,
    summary:
      "任务脚本解决学生知不知道做什么，动机钩子解决学生为什么愿意做，具体与意义共同形成卷入感。",
    useWhen: [
      "任务很具体但学生不买账",
      "情境真实却没有驱动力",
      "一味增加游戏和奖励",
    ],
    avoidWhen: ["学生其实是不会做而不是不想做", "不要用动机包装替代学科任务"],
    coreJudgement:
      "真实性不等于现实性，学生愿不愿意进入任务，取决于任务是否触发好奇、选择、成就、所有权或意义，而不是背景看起来像真的。",
    moves: [
      "先确保任务本身清楚可做",
      "判断学生缺的是哪一种学习必要感",
      "只增加一个与任务内容匹配的动机钩子",
    ],
    answerFocus: "先区分不会做和不想做，再只选择一个动机来源，不堆叠八种动机。",
    queryTerms: [
      "学生不买账",
      "任务没兴趣",
      "情境不真实",
      "游戏化",
      "奖励",
      "卷入感",
      "意义感",
    ],
    intents: [
      "learning_motivation",
      "pbl_crossdisciplinary",
      "teaching_design",
    ],
    related: ["task-script-five-elements", "all-student-evidence"],
    sourceRefs: [
      "教师培训课程/任务情境设计方法课/任务情境设计-知识模型清单.md",
    ],
  },
  {
    id: "core-growth-evidence",
    name: "一课一得四问",
    aliases: ["核心增长点", "课末证据四问", "日常课目标筛选"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 99,
    summary:
      "围绕一节课的核心增长点，追问学生必须会什么、以什么任务出现、最可能卡在哪里、用什么当堂证据判断学会。",
    useWhen: [
      "一节课想讲太多",
      "目标漂亮但进不了课堂",
      "日常课抓不住重点",
      "时间有限需要取舍",
    ],
    avoidWhen: [
      "完整单元设计不能被压成一个单课增长点",
      "公开课仍需结合展示和评审约束",
    ],
    coreJudgement:
      "一节课可以有多个知识点，但只能有一个最需要打透的核心增长点，它必须落到学生表现和当堂证据。",
    moves: [
      "学生下课前必须会什么",
      "这个会以什么题、任务或表达出现",
      "学生最可能卡在哪里",
      "用哪一个当堂证据判断他会了",
    ],
    answerFocus: "帮助用户收束出一个核心增长点和一个证据，不替用户铺满整节课。",
    queryTerms: [
      "一节课抓什么",
      "内容太多",
      "目标太多",
      "日常课",
      "核心增长点",
      "一课一得",
      "课末检测",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "teacher_growth"],
    related: [
      "target-quality-three-checks",
      "backward-design",
      "novice-minimum-standard",
    ],
    sourceRefs: ["教师培训课程/日常课教学/08_第2课_一节日常课到底抓什么.md"],
  },
  {
    id: "three-question-pretest-errors",
    name: "三题前测与错因诊断",
    aliases: ["三题前测", "错因五分类", "同分不同因"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 97,
    summary:
      "用前置知识题、核心概念题和易错判断题快速摸清起点，再把错误区分为知识、方法、过程、表达和状态问题。",
    useWhen: [
      "基础薄弱但不知道弱在哪里",
      "新课前想快速诊断",
      "同分学生需要不同处理",
      "错误都被归为粗心",
    ],
    avoidWhen: [
      "高风险考试诊断需要更完整数据",
      "不要把三题前测做成正式排名考试",
    ],
    coreJudgement:
      "分数是结果，错因才是教学入口，学情分析只需要先找到会卡住今天目标的关键断点。",
    moves: [
      "用前置知识题看旧知是否断裂",
      "用核心概念题看本课起点",
      "用易错判断题暴露典型误解",
      "把错误归入知识、方法、过程、表达或状态",
      "只处理会影响当前目标的断点",
    ],
    answerFocus: "给出三题的功能结构或一个错因追问，不替用户制作完整测验。",
    queryTerms: [
      "三题前测",
      "基础薄弱",
      "粗心",
      "错因",
      "同分不同因",
      "摸底",
      "前置知识",
    ],
    intents: ["learning_profile", "assessment_feedback", "teaching_design"],
    related: [
      "insight-toolbox",
      "quality-analysis-five-questions",
      "exam-review-four-steps",
    ],
    sourceRefs: ["教师培训课程/日常课教学/09_第3课_学情分析不是写基础薄弱.md"],
  },
  {
    id: "new-lesson-seven-steps",
    name: "新授课七步学习路径",
    aliases: ["新授课七步", "搭桥式新授课"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 94,
    summary:
      "从终点任务和前置旧知出发，讲清概念、示范思考、同构仿练、单变量变式并当堂检测。",
    useWhen: ["新授课讲完学生仍不会", "学生只会套例题", "新知识和旧知识接不上"],
    avoidWhen: [
      "复习课或试卷讲评课有更合适的课型结构",
      "不是每节新课都要机械呈现七个显性环节",
    ],
    coreJudgement:
      "新授课不是把内容讲完，而是从旧知到新任务搭一座学生能走过去的桥。",
    moves: [
      "看终点任务",
      "查前置旧知",
      "讲清核心概念",
      "示范思考过程",
      "同构仿练",
      "单变量变式",
      "当堂检测",
    ],
    answerFocus: "先判断学生在哪一步断了，只修最关键的一步，不把七步全部展开。",
    queryTerms: [
      "新授课",
      "讲完不会",
      "换个题不会",
      "前置旧知",
      "同构仿练",
      "变式",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "teacher_growth"],
    related: ["teach-practice-three-stage", "core-growth-evidence"],
    sourceRefs: ["教师培训课程/日常课教学/10_第4课_新授课怎么上.md"],
  },
  {
    id: "teach-practice-three-stage",
    name: "讲练三段式",
    aliases: ["示范指导独立", "调扶放", "I do We do You do"],
    course: "日常课教学、罗森海因篇、讲授法篇",
    kind: "method",
    ownership: "course_adapted_theory",
    priority: 96,
    summary:
      "用教师示范、指导练习和独立检查，把教师的思考逐步转化为学生自己的能力。",
    useWhen: [
      "讲多了没时间练",
      "只练不讲学生乱撞",
      "学生听懂但不会做",
      "基础弱学生跟不上探究",
    ],
    avoidWhen: [
      "学生已经熟练，可以减少示范增加独立迁移",
      "不要把三段式僵化成固定时间比例",
    ],
    coreJudgement:
      "讲和练不是对立的，讲让学生知道怎么开始，练让老师看见学生学到哪里。",
    moves: [
      "教师把思考过程示范出来",
      "用同构任务半扶半放地指导练习",
      "让学生无提示独立完成一次检查",
    ],
    answerFocus: "围绕一次讲解补一个小证据，或修复三段中的一个断点。",
    queryTerms: [
      "讲练",
      "讲多练少",
      "听懂不会做",
      "教师示范",
      "指导练习",
      "独立检查",
      "调扶放",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis", "learning_profile"],
    related: ["new-lesson-seven-steps", "all-student-evidence"],
    sourceRefs: [
      "教师培训课程/日常课教学/11_第5课_讲练怎么配.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "review-four-stages",
    name: "复习课四段式",
    aliases: ["补洞建网提法达标", "复习四步"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 96,
    summary:
      "复习不是重讲旧课，而是补关键断点、重建知识关系、提炼题类方法并用分层任务达标。",
    useWhen: [
      "复习课只是过教材和知识点",
      "学生单题会综合题不会",
      "知识点散乱不会调用",
    ],
    avoidWhen: [
      "新授课不使用此结构",
      "时间很短时仍应按问题选择重点而不是四段平均用力",
    ],
    coreJudgement:
      "复习课的价值不是温故，而是把散掉、混掉、断掉的知识重新组织起来。",
    moves: ["补洞", "建网", "提法", "达标"],
    answerFocus:
      "先判断当前复习课缺的是补洞、建网、提法还是达标，只给一个针对性改法。",
    queryTerms: [
      "复习课",
      "过教材",
      "知识点散",
      "综合题不会",
      "补洞",
      "建网",
      "提法",
      "达标",
    ],
    intents: [
      "teaching_design",
      "lesson_plan_diagnosis",
      "assessment_feedback",
    ],
    related: ["three-question-pretest-errors", "teach-practice-three-stage"],
    sourceRefs: ["教师培训课程/日常课教学/12_第6课_复习课怎么上.md"],
  },
  {
    id: "exam-review-four-steps",
    name: "试卷讲评四步法",
    aliases: ["数据筛题错因归类典题变式二次达标", "讲评四步"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 96,
    summary:
      "先用数据筛选值得讲的题，再归类错因、用典题提炼方法、通过同类变式完成二次达标。",
    useWhen: ["试卷讲评逐题讲答案", "同类错误反复出现", "不知道哪些题值得讲"],
    avoidWhen: [
      "没有学生答题数据时只能做假设性建议",
      "个别错误不应占用全班讲评时间",
    ],
    coreJudgement: "讲评课不是把卷子讲完，而是把错误变成下一次得分。",
    moves: ["数据筛题", "错因归类", "典题变式", "二次达标"],
    answerFocus:
      "让用户先拿出一类高价值错误，围绕这一类走完闭环，不逐题重讲整张卷。",
    queryTerms: ["试卷讲评", "逐题讲", "错题", "数据筛题", "二次达标", "变式"],
    intents: ["assessment_feedback", "teaching_design", "teacher_growth"],
    related: [
      "three-question-pretest-errors",
      "quality-analysis-five-questions",
      "homework-feedback-four-questions",
    ],
    sourceRefs: ["教师培训课程/日常课教学/13_第7课_试卷讲评课怎么上.md"],
  },
  {
    id: "homework-feedback-four-questions",
    name: "作业反馈四问",
    aliases: ["作业四问", "作业反馈系统"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 93,
    summary:
      "围绕作业练哪个目标、哪些题必须批、哪些错因要讲、哪一道题二次达标来设计作业反馈。",
    useWhen: [
      "作业很多但效果不稳定",
      "全量批改耗时",
      "作业讲评逐题讲",
      "订正只是抄答案",
    ],
    avoidWhen: [
      "作业的核心目标尚未确定",
      "不要把分层简单做成优生多做、学困生少做",
    ],
    coreJudgement:
      "作业不是布置量，而是反馈系统，价值在于暴露没学会的地方并把它补上。",
    moves: [
      "明确作业对应的课堂目标",
      "只精批目标题、易错题和分层题",
      "按错因而不是题号讲评",
      "用一道同结构任务二次达标",
    ],
    answerFocus: "先替换一个最耗时、最低效的作业动作，不一次重构全部作业制度。",
    queryTerms: [
      "作业太多",
      "批改太累",
      "作业讲评",
      "订正",
      "少而准",
      "二次达标",
    ],
    intents: ["assessment_feedback", "teacher_growth", "teaching_design"],
    related: ["low-cost-replacement", "exam-review-four-steps"],
    sourceRefs: ["教师培训课程/日常课教学/14_第8课_作业怎么少而准.md"],
  },
  {
    id: "one-lesson-three-levels",
    name: "一课三层",
    aliases: ["底线主线高线", "任务分层"],
    course: "日常课教学、差异化教学",
    kind: "method",
    ownership: "han_course",
    priority: 94,
    summary:
      "不固定给学生贴层级标签，而是在同一个核心目标下设置底线、主线和高线三个任务入口。",
    useWhen: [
      "大班额差异大",
      "讲快有人跟不上讲慢优生无聊",
      "想做可执行的差异化教学",
    ],
    avoidWhen: ["不要公开把学生固定分成三等", "不要为三层分别备三份完整教案"],
    coreJudgement:
      "大班额差异化不是一人一案，而是不按学生贴标签，按任务设置入口。",
    moves: [
      "底线任务保住所有学生必须拿住的基础",
      "主线任务让大多数学生达成核心目标",
      "高线任务提供迁移、比较或规范表达挑战",
    ],
    answerFocus: "围绕同一个材料或任务示范三个入口，不建议简单按题量分层。",
    queryTerms: [
      "班级差异大",
      "分层教学",
      "因材施教",
      "优生吃不饱",
      "后进生跟不上",
      "底线主线高线",
    ],
    intents: ["learning_profile", "teaching_design", "classroom_management"],
    related: ["all-student-evidence", "homework-feedback-four-questions"],
    sourceRefs: [
      "教师培训课程/日常课教学/15_第9课_班级差异大怎么办.md",
      "教师培训课程/差异化教学/知识模型清单_差异化教学.md",
    ],
  },
  {
    id: "all-student-evidence",
    name: "全员学习证据",
    aliases: ["人人写选判改", "参与证据", "全员参与"],
    course: "日常课教学",
    kind: "strategy",
    ownership: "han_course",
    priority: 95,
    summary:
      "用人人写、人人选、人人判、人人改等低成本动作，让每个学生留下可见学习证据。",
    useWhen: [
      "只有少数学生举手",
      "课堂热闹但课后不会",
      "小组讨论有人旁观",
      "大班额看不见全班学习",
    ],
    avoidWhen: [
      "不要把所有环节都设计成统一动作",
      "管理或关系冲突不能只靠学习证据解决",
    ],
    coreJudgement:
      "真正的参与不是学生有没有动，而是每个学生有没有留下能判断学习状态的证据。",
    moves: [
      "关键处让人人写一个痕迹",
      "用人人选快速覆盖概念判断",
      "用人人判暴露标准和误解",
      "用人人改检查能否纠错",
    ],
    answerFocus: "根据当前环节只增加一个全员证据动作，避免为了活跃继续加活动。",
    queryTerms: [
      "学生不参与",
      "没人举手",
      "课堂不活跃",
      "小组讨论",
      "全员参与",
      "学习证据",
      "人人写",
    ],
    intents: [
      "learning_motivation",
      "classroom_management",
      "assessment_feedback",
      "teaching_design",
    ],
    related: ["classroom-response-loop", "teach-practice-three-stage"],
    sourceRefs: ["教师培训课程/日常课教学/16_第10课_学生不参与怎么办.md"],
  },
  {
    id: "quality-analysis-five-questions",
    name: "质量分析落课五问",
    aliases: ["数据到课堂五问", "质量分析五问"],
    course: "日常课教学",
    kind: "method",
    ownership: "han_course",
    priority: 92,
    summary:
      "从哪类题、哪类学生、哪类错因，追到下周改哪个课堂动作，以及作业和讲评怎样回收。",
    useWhen: [
      "质量分析会只有均分排名",
      "有数据但不知道怎么改课",
      "考试后只写总结和表态",
    ],
    avoidWhen: [
      "没有题目和学生数据时不能做具体归因",
      "不要把数据直接用于给学生贴永久标签",
    ],
    coreJudgement: "如果质量分析不能变成下一节课的具体动作，它就只是压力传递。",
    moves: [
      "哪类题低于预期",
      "哪类学生集中失分",
      "失分属于哪类错因",
      "下周课堂改哪个动作",
      "作业和讲评如何回收",
    ],
    answerFocus: "帮助用户从一个数据结论走到一个下周动作和一个回收证据。",
    queryTerms: [
      "质量分析",
      "均分",
      "优秀率",
      "及格率",
      "考试数据",
      "怎么改课",
      "失分结构",
    ],
    intents: ["assessment_feedback", "teacher_growth", "teaching_design"],
    related: ["three-question-pretest-errors", "exam-review-four-steps"],
    sourceRefs: ["教师培训课程/日常课教学/17_第11课_质量分析会之后怎么改课.md"],
  },
  {
    id: "low-cost-replacement",
    name: "低成本改课替换法",
    aliases: ["替换而非叠加", "日常课减负改造"],
    course: "日常课教学",
    kind: "methodology",
    ownership: "han_course",
    priority: 97,
    summary:
      "日常课改造不额外叠加表格、活动和任务，而是用更高价值动作替换原有低效动作。",
    useWhen: [
      "老师没时间改课",
      "培训方法增加负担",
      "备课批改讲评过度耗时",
      "日常课追求公开课精度",
    ],
    avoidWhen: [
      "赛课和重大公开课可能需要额外研发投入",
      "安全、政策或学校刚性要求不能擅自删减",
    ],
    coreJudgement:
      "真正能活下来的日常课方法，必须能嵌入原流程、不明显增加工作量，并让学生表现发生变化。",
    moves: [
      "空目标替换为课末检测",
      "全量批改替换为关键题精批",
      "逐题讲解替换为错因分类和一类题",
      "公开点名替换为错因分组",
      "长期加压替换为阶段回收",
      "凭感觉替换为全员证据",
    ],
    answerFocus: "只选择当前最耗时的一项替换，不把六种替换全部交给用户。",
    queryTerms: [
      "没时间",
      "备课太慢",
      "工作量",
      "减负",
      "日常课改造",
      "全量批改",
      "多做事",
    ],
    intents: ["teacher_growth", "teaching_design", "assessment_feedback"],
    related: [
      "homework-feedback-four-questions",
      "core-growth-evidence",
      "lesson-preparation-workflow",
    ],
    sourceRefs: ["教师培训课程/日常课教学/18_第12课_老师时间不够怎么办.md"],
  },
  {
    id: "concept-induction",
    name: "概念归纳教学五步法",
    aliases: ["概念获得模型", "正例反例归纳", "Frayer"],
    course: "概念教学篇",
    kind: "method",
    ownership: "course_adapted_theory",
    priority: 88,
    summary:
      "通过典型正例和反例，引导学生观察属性、提出假设、检验边界并形成概念。",
    useWhen: [
      "学生会背定义但不会判断",
      "概念边界模糊",
      "适合从具体案例归纳共同属性",
    ],
    avoidWhen: [
      "学生缺少足够实例或时间极短",
      "高度抽象概念可能更适合先行组织者和演绎策略",
    ],
    coreJudgement:
      "概念教学不是先给定义让学生背，而是让学生在正例和反例的变异中看见决定概念成立的关键属性。",
    moves: [
      "呈现有代表性的正例",
      "加入只改变关键属性的反例",
      "让学生比较并提出概念假设",
      "用新例子检验假设",
      "形成定义并迁移判断",
    ],
    answerFocus: "帮助用户选择一组能暴露边界的正反例，不替用户展开完整概念课。",
    queryTerms: [
      "概念教学",
      "背定义",
      "概念边界",
      "正例反例",
      "归纳策略",
      "概念获得",
    ],
    intents: ["teaching_design", "lesson_plan_diagnosis"],
    related: ["concept-deduction", "new-lesson-seven-steps"],
    sourceRefs: [
      "教师培训课程/概念教学研发/概念教学系列课程完整摘要.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "concept-deduction",
    name: "概念演绎教学",
    aliases: ["先行组织者", "上位概念导入", "演绎策略"],
    course: "概念教学篇",
    kind: "method",
    ownership: "course_adapted_theory",
    priority: 86,
    summary:
      "先提供能统摄新知识的上位概念或组织框架，再用实例、比较和应用把具体概念纳入已有认知结构。",
    useWhen: [
      "概念高度抽象且学生难以靠实例自行归纳",
      "新知识需要先建立上位框架",
      "知识点很多但关系不清",
    ],
    avoidWhen: [
      "学生有丰富经验且适合自己归纳",
      "不要把先行组织者做成背景故事或普通导入",
    ],
    coreJudgement:
      "演绎教学不是直接宣布定义，而是先给学生一张能安放新知识的认知地图。",
    moves: [
      "激活或提供上位概念",
      "明确新旧概念的联系和区别",
      "用典型实例解释",
      "让学生把新例子归入框架",
      "通过应用检查结构是否建立",
    ],
    answerFocus:
      "先判断学生缺的是上位框架还是具体实例，再选择归纳或演绎，不两套都用。",
    queryTerms: ["抽象概念", "先行组织者", "上位概念", "演绎策略", "知识框架"],
    intents: ["teaching_design", "lesson_plan_diagnosis"],
    related: ["concept-induction", "textbook-four-dimensions"],
    sourceRefs: [
      "教师培训课程/概念教学研发/概念教学系列课程完整摘要.md",
      "教师培训课程/概念教学研发/先行组织者的学科应用.md",
    ],
  },
  {
    id: "interactive-lecture-cycle",
    name: "互动讲授微循环",
    aliases: ["导入讲解释范练习", "小步切块讲授"],
    course: "讲授法篇",
    kind: "method",
    ownership: "course_adapted_theory",
    priority: 89,
    summary:
      "把较长讲授切成导入、讲解、示范、练习的小循环，用小步呈现和即时证据控制认知负荷。",
    useWhen: [
      "教师讲授时间长学生掉线",
      "复杂知识需要系统讲清",
      "误把讲授等同灌输",
    ],
    avoidWhen: [
      "学生已有能力独立探究",
      "不要用互动问题装饰一段没有学习证据的长讲授",
    ],
    coreJudgement:
      "讲授的问题不在老师讲，而在学生只能被动听，好的讲授要把知识切小、把思考示范出来并及时让学生做。",
    moves: [
      "用问题或旧知建立入口",
      "小步讲清一个知识块",
      "示范如何思考或操作",
      "让学生立即完成一次小练习并反馈",
    ],
    answerFocus:
      "把用户最长的一段讲授切成一个微循环，不要求整节课都使用同一形式。",
    queryTerms: [
      "讲授法",
      "老师讲太多",
      "学生走神",
      "灌输",
      "互动讲授",
      "小步切块",
      "认知负荷",
    ],
    intents: [
      "teaching_design",
      "lesson_plan_diagnosis",
      "learning_motivation",
    ],
    related: ["teach-practice-three-stage", "all-student-evidence"],
    sourceRefs: [
      "教师培训课程/官网文字版（长文）/12-重构讲授法：讲授不等于灌输.md",
      "docs/教学通识课Plus-课程大纲.md",
    ],
  },
  {
    id: "lesson-preparation-workflow",
    name: "备课四阶段流程",
    aliases: ["分析设计研发迭代", "备课流程"],
    course: "教学通识课",
    kind: "framework",
    ownership: "han_course",
    priority: 100,
    summary:
      "备课依次处理分析、设计、研发和迭代，避免在教学方案尚未确定时过早制作课件、板书和逐字稿。",
    useWhen: [
      "备课耗时或反复返工",
      "不知道先做教案还是课件",
      "板书学习单逐字稿顺序混乱",
      "课堂语言和教学反思",
    ],
    avoidWhen: [
      "刚入职且问题是最低备课标准时优先用新教师最低有效标准",
      "问题只涉及目标或学情的专业方法",
    ],
    coreJudgement:
      "很多备课慢不是动作慢，而是顺序反了，前端分析和设计没有稳定就进入研发。",
    moves: [
      "分析教材课标和学情",
      "设计目标、重难点、学习流程和评价",
      "研发课件、板书、学习单和教具",
      "通过试讲、反思和课堂语言优化迭代",
    ],
    answerFocus: "先指出用户卡在哪个阶段和前置依赖，只给一个纠偏动作。",
    queryTerms: [
      "备课流程",
      "备课太慢",
      "反复返工",
      "先做课件",
      "逐字稿",
      "学习单",
      "课堂语言",
      "教学反思",
    ],
    intents: [
      "teaching_design",
      "teacher_growth",
      "lesson_plan_diagnosis",
      "public_lesson",
    ],
    related: [
      "lesson-preparation-design-master",
      "teaching-design-six-elements",
      "reflection-evidence-loop",
      "novice-minimum-standard",
    ],
    sourceRefs: [
      "docs/哈老师语料/01-新教师与备课入门.md",
      "docs/HAI_R10_01_FEEDBACK_PROMPT_ITERATION.md",
    ],
  },
  {
    id: "reflection-evidence-loop",
    name: "基于设计证据的教学反思",
    aliases: ["六要素反思", "迭代式反思"],
    course: "教学通识课咨询方法",
    kind: "consultation_standard",
    ownership: "consultation_calibration",
    priority: 94,
    summary:
      "把反思放在备课迭代环节，检查教材与学情判断、目标重难点、学习流程和评价证据之间哪里发生偏离。",
    useWhen: [
      "反思总写课堂气氛和学生表现",
      "不知道课后反思写什么",
      "同类问题反复出现",
    ],
    avoidWhen: [
      "没有教案、课堂记录或学习证据时只能做假设性复盘",
      "不要一次复盘所有要素",
    ],
    coreJudgement:
      "教学反思不是写感受，而是用教学设计和学习证据判断原来的哪个假设不成立。",
    moves: [
      "检查教材和学情判断是否准确",
      "检查目标和重难点是否合理",
      "检查学习流程是否推动目标",
      "检查评价是否拿到证据",
      "只确定下一次要改的一个变量",
    ],
    answerFocus: "围绕一个未达预期的学习证据，往前追到最可能的设计原因。",
    queryTerms: [
      "教学反思",
      "课后反思",
      "反思写什么",
      "课堂气氛",
      "下次怎么改",
    ],
    intents: ["teacher_growth", "lesson_plan_diagnosis", "assessment_feedback"],
    related: ["lesson-preparation-workflow", "design-logic-chain"],
    sourceRefs: [
      "docs/哈老师语料/01-新教师与备课入门.md",
      "docs/HAI_R10_01_FEEDBACK_PROMPT_ITERATION.md",
    ],
  },
  {
    id: "novice-minimum-standard",
    name: "新教师最低有效备课标准",
    aliases: ["完整有逻辑基本有效", "新教师一课一得"],
    course: "教学通识课咨询方法",
    kind: "consultation_standard",
    ownership: "consultation_calibration",
    priority: 100,
    summary:
      "新入职阶段先做到完整、有逻辑、基本有效和一课一得，不用同时追求专家级深度、亮点和精细语言。",
    useWhen: [
      "刚入职或教龄很短",
      "备课焦虑追求面面俱到",
      "拿公开课标准要求每节日常课",
    ],
    avoidWhen: ["赛课和重大公开课有更高展示要求", "用户已经熟练并追问专业进阶"],
    coreJudgement:
      "新教师最重要的不是备精和出彩，而是把目标、达成路径和学习证据说清楚，稳定完成一课一得。",
    moves: [
      "确定这节课最核心的一个目标或增长点",
      "设计能推动这个目标的内容和活动",
      "留下一个判断学生是否达成的证据",
    ],
    answerFocus:
      "主动降低不必要标准，只给一个当天能完成的抓手，不叠加完整备课流程。",
    queryTerms: [
      "刚入职",
      "新教师",
      "新老师",
      "教龄一年",
      "备课焦虑",
      "每节课都想出彩",
    ],
    intents: ["teacher_growth", "teaching_design"],
    related: ["core-growth-evidence", "lesson-preparation-workflow"],
    sourceRefs: [
      "docs/哈老师语料/01-新教师与备课入门.md",
      "docs/HAI_R10_01_FEEDBACK_PROMPT_ITERATION.md",
    ],
  },
];

export const hanMethodCardIds = new Set(
  hanCourseMethodCards.map((card) => card.id),
);

export function mergeHanMethodCards(
  rows: HanMethodCardConfigRow[],
  defaults: HanMethodCard[] = hanCourseMethodCards,
) {
  const cards = new Map(defaults.map((card) => [card.id, card]));
  for (const row of rows) {
    if (!row.id) continue;
    if (row.enabled === false || row.is_deleted === true) {
      cards.delete(row.id);
      continue;
    }
    cards.set(row.id, methodCardFromConfigRow(row));
  }
  return Array.from(cards.values()).sort((a, b) =>
    b.priority - a.priority || a.id.localeCompare(b.id)
  );
}

export function getHanMethodCard(
  id: string,
  cards: HanMethodCard[] = hanCourseMethodCards,
) {
  return cards.find((card) => card.id === id);
}

export function buildHanMethodCatalogForRouter(
  cards: HanMethodCard[] = hanCourseMethodCards,
) {
  return cards.map((card) =>
    [
      card.id,
      card.name,
      card.course,
      card.summary,
      `适用：${card.useWhen.join("；")}`,
      card.avoidWhen.length > 0 ? `不适用：${card.avoidWhen.join("；")}` : "",
    ].filter(Boolean).join("｜")
  ).join("\n");
}

export function buildHanMethodIndexForRouter(
  cards: HanMethodCard[] = hanCourseMethodCards,
) {
  return cards.map((card) => `${card.id}｜${card.name}`).join(
    "\n",
  );
}

export function selectHanMethodCandidatesForRouter(
  question: string,
  intent: IntentResult,
  maxCandidates = 6,
  cards: HanMethodCard[] = hanCourseMethodCards,
) {
  const limit = Math.max(0, Math.min(10, Math.round(maxCandidates)));
  if (limit === 0) return [];
  const normalizedQuestion = normalizeRouterText(question);
  const questionBigrams = toBigrams(normalizedQuestion);

  return cards
    .map((card) => {
      let lexicalScore = 0;
      for (const term of [card.name, ...card.aliases, ...card.queryTerms]) {
        const normalizedTerm = normalizeRouterText(term);
        if (!normalizedTerm || !normalizedQuestion.includes(normalizedTerm)) {
          continue;
        }
        lexicalScore += Math.min(20, 8 + normalizedTerm.length);
      }
      const cardText = normalizeRouterText([
        card.name,
        ...card.aliases,
        card.summary,
        ...card.useWhen,
        ...card.queryTerms,
      ].join(" "));
      const overlapScore = bigramRecall(questionBigrams, toBigrams(cardText)) *
        18;
      const primaryIntentTag = methodIntentTagFor(intent.primary_intent);
      const intentScore = card.intents.includes(primaryIntentTag)
        ? 4
        : (intent.secondary_intents ?? []).some((item) =>
            card.intents.includes(methodIntentTagFor(item))
          )
        ? 1.5
        : 0;
      return {
        card,
        score: lexicalScore + overlapScore + intentScore + card.priority / 1000,
        hasSignal: lexicalScore > 0 || overlapScore >= 4.5,
      };
    })
    .filter((item) => item.hasSignal)
    .sort((a, b) => b.score - a.score || b.card.priority - a.card.priority)
    .slice(0, limit)
    .map((item) => item.card);
}

export function methodIntentTagFor(intent: IntentName): MethodIntentTag {
  const map: Record<IntentName, MethodIntentTag> = {
    showcase_lesson_diagnosis: "public_lesson",
    showcase_lesson_design: "public_lesson",
    daily_improvement_diagnosis: "lesson_plan_diagnosis",
    daily_improvement_design: "teaching_design",
    teaching_concept_qa: "general_question",
    unknown: "unknown",
  };
  return map[intent];
}

export function buildHanMethodCandidateCatalogForRouter(
  question: string,
  intent: IntentResult,
  maxCandidates = 6,
  cards: HanMethodCard[] = hanCourseMethodCards,
) {
  const selectedCards = selectHanMethodCandidatesForRouter(
    question,
    intent,
    maxCandidates,
    cards,
  );
  if (selectedCards.length === 0) return "无明显候选。";
  return selectedCards.map((card) =>
    [
      card.id,
      card.name,
      card.summary,
      `适用：${card.useWhen.join("；")}`,
      card.avoidWhen.length > 0 ? `边界：${card.avoidWhen.join("；")}` : "",
    ].filter(Boolean).join("｜")
  ).join("\n");
}

function methodCardFromConfigRow(row: HanMethodCardConfigRow): HanMethodCard {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    course: row.course,
    kind: row.kind,
    ownership: row.ownership,
    priority: Math.max(0, Math.min(100, Math.round(row.priority ?? 50))),
    summary: row.summary ?? "",
    useWhen: row.use_when ?? [],
    avoidWhen: row.avoid_when ?? [],
    coreJudgement: row.core_judgement ?? "",
    moves: row.moves ?? [],
    answerFocus: row.answer_focus ?? "",
    queryTerms: row.query_terms ?? [],
    intents: row.intents ?? [],
    related: row.related ?? [],
    sourceRefs: row.source_refs ?? [],
  };
}

function normalizeRouterText(text: string) {
  return text.toLowerCase().replace(
    /[\s，。！？、；：,.!?;:'"“”‘’（）()\-_+｜]/g,
    "",
  );
}

function toBigrams(text: string) {
  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) {
    result.add(text.slice(index, index + 2));
  }
  return result;
}

function bigramRecall(question: Set<string>, card: Set<string>) {
  if (question.size === 0 || card.size === 0) return 0;
  let matches = 0;
  for (const gram of question) {
    if (card.has(gram)) matches += 1;
  }
  return matches / question.size;
}
