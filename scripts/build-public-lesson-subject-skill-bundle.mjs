import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const subject = String(process.argv[2] || "mathematics").trim();
const versionLabel = String(process.argv[3] || "v2.0.0").trim();
const seedOnly = process.argv.includes("--seed-only");

const unifiedOutputContract = {
  format: "public_lesson_markdown_v2",
  required_sections: [
    "课程基本信息", "课标分析", "教材分析", "学情分析", "教学目标",
    "教学重难点", "教学流程", "教学评估", "板书设计",
  ],
  lesson_flow_required: [
    "设计意图", "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式", "过渡语",
  ],
  lesson_flow_table_columns: [
    "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式",
  ],
  rubric_columns: {
    primary: ["评价维度", "合格（1分）", "良好（2分）", "优秀（3分）"],
    secondary: ["评价维度", "新手（1分）", "入门（2分）", "熟练（3分）", "专家（4分）"],
  },
};

const configs = {
  mathematics: {
    displayName: "数学公开课设计 Skill",
    skillSlug: "subject-lesson-design-mathematics",
    sourceSkillName: "mathematics-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/mathematics-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/mathematics-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260902093000_hai_mathematics_public_lesson_skill_v4.sql"),
    skillDescription: "数学公开课设计 Skill：在统一九部分 Markdown 结构中保留数学表征、推理、证明、建模和迁移要求。",
    matchCriteria: { subjects: ["数学"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "数学公开课主流教学模式", "六类模式的选择规则、核心循环、证据与失败信号", "always", 10, {}],
      ["references/output-template.md", "数学公开课八要素输出模板", "八要素教案结构、紧凑流程字段与质量硬约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学数学八要素教案样例", "依据权威课例主题重构的小学数学八要素示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中数学八要素教案样例", "依据权威课例主题重构的初中数学八要素示范", "always", 40, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "数学 Skill 来源与边界", "权威来源、课例使用方式、版权与事实核验边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "mathematics_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
    },
    outputContract: {
      format: "mathematics_public_lesson_markdown_v3",
      required_sections: [
        "课标分析", "教材分析", "学情分析", "教学目标", "教学重难点", "教学流程", "教学评估", "板书",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "核心问题/任务", "学生行动与产出", "教师反馈与评价",
      ],
    },
  },
  chinese: {
    displayName: "语文公开课设计 Skill",
    skillSlug: "subject-lesson-design-chinese",
    sourceSkillName: "chinese-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/chinese-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/chinese-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260813230000_hai_chinese_public_lesson_skill_v2.sql"),
    skillDescription: "完整语文公开课设计 Skill：按最终语言实践产出选择八类主导模式，生成读、说、写、评、改及文本证据完整的教案。",
    matchCriteria: { subjects: ["语文"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "语文公开课主流教学模式", "八类模式、教读与自读差异、学习证据和失败信号", "always", 10, {}],
      ["references/output-template.md", "语文公开课完整输出模板", "十三部分教案结构、语文流程字段与质量硬约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学语文优秀教案样例", "依据权威课例主题重构的《荷叶圆圆》完整示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中语文优秀教案样例", "依据获奖课例分析重构的《故乡》完整示范", "always", 40, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "语文 Skill 来源与边界", "课标、教材、公开课例、本地课例分析及版权事实边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "chinese_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中"],
    },
    outputContract: {
      format: "chinese_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与教材分析", "文本与语文学习价值分析", "学情与学习起点",
        "目标—任务—证据设计", "重难点与突破路径", "主导模式与公开课主线", "教学准备",
        "教学流程", "板书设计", "评价量规与差异化支持", "作业与延伸阅读", "教学反思",
      ],
      lesson_flow_required: [
        "环节功能", "文本范围/语言材料/交际情境", "核心问题/任务指令", "个体实践",
        "教师行为", "学生语文实践", "文本依据/表达标准", "预期产出与不同理解",
        "典型误读/困难", "评价证据与反馈分支", "语言知识/阅读表达方法落点",
        "阶段性语言成果", "过渡", "时间核算",
      ],
    },
  },
  science: {
    displayName: "科学公开课设计 Skill",
    skillSlug: "subject-lesson-design-science",
    sourceSkillName: "science-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/science-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/science-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814000000_hai_science_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学科学公开课设计 Skill：按观察、实验、模型、工程、长期观测或科学论证选择模式，生成原始证据、安全和异常处理完整的教案。",
    matchCriteria: { subjects: ["科学"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "小学科学公开课主流教学模式", "六类实践模式、年龄适配、证据要求和失败信号", "always", 10, {}],
      ["references/output-template.md", "小学科学公开课完整输出模板", "十二部分教案、材料安全、原始记录、异常分支与质量硬约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学科学优秀教案样例", "依据当前教材与人教社公开课例重构的《显微镜下的细胞》完整示范", "always", 30, { stages: ["小学"] }],
      ["references/sources-and-boundaries.md", "科学 Skill 来源与边界", "课标、实验评价、教材课例、安全伦理及版权事实边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "science_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学"],
    },
    outputContract: {
      format: "science_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与科学内容分析", "学情、前概念与实践起点", "目标—任务—证据设计",
        "重难点与探究工程主线", "材料器材与安全伦理", "原始记录与评价工具", "教学流程",
        "板书与模型设计", "评价量规与差异化支持", "实践作业", "教学反思",
      ],
      lesson_flow_required: [
        "环节功能", "研究对象/现象/工程需求", "核心问题/预测/任务指令", "个体先行证据",
        "材料/分组/安全", "教师行为", "学生科学实践", "变量/观察/测试标准",
        "原始证据", "预期与异常", "评价和反馈分支", "事实—推断—解释区分",
        "科学概念/方法落点", "阶段成果", "过渡", "清理与复原", "时间核算",
      ],
    },
  },
  english: {
    displayName: "英语公开课设计 Skill",
    skillSlug: "subject-lesson-design-english",
    sourceSkillName: "english-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/english-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/english-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260831033729_hai_english_public_lesson_skill_v3.sql"),
    skillDescription: "英语公开课设计 Skill：在统一九部分 Markdown 结构中按活动观组织语篇理解、语言实践、迁移表达与评估。",
    matchCriteria: { subjects: ["英语"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "英语公开课主流教学模式", "七类课型模式、活动观进阶、学段适配、证据和失败信号", "always", 10, {}],
      ["references/output-template.md", "英语公开课精简教案输出模板", "九部分教案、内容归并、紧凑流程与质量硬约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学英语精简教案样例", "基于当前教材摘要重构的 My feelings 对话交际九部分示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中英语精简教案样例", "基于获奖课例分析重构的新闻语篇阅读九部分示范", "always", 40, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "英语 Skill 来源与边界", "课标、教材说明、课例证据等级、文化版权与事实边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "english_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中"],
    },
    outputContract: {
      format: "english_public_lesson_markdown_v1",
      required_sections: [
        "课标分析", "教材分析", "学情分析", "教学目标", "教学重难点",
        "教学环节", "教学评估", "教学反思", "板书设计",
      ],
      lesson_flow_required: [
        "活动观层级", "目标与功能", "教材范围/情境/对象/任务", "个体先行证据", "教师与学生行动",
        "支架与资源", "预期产出", "典型困难", "评价与反馈分支", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  physics: {
    displayName: "物理公开课设计 Skill",
    skillSlug: "subject-lesson-design-physics",
    sourceSkillName: "physics-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/physics-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/physics-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814020000_hai_physics_public_lesson_skill_v2.sql"),
    skillDescription: "完整初中物理公开课设计 Skill：以现象、实验数据、物理模型和规律边界组织证据链，生成器材安全、异常处理与迁移完整的教案。",
    matchCriteria: { subjects: ["物理"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "初中物理公开课主流教学模式", "六类模式、实验硬约束、分领域适配与失败信号", "always", 10, {}],
      ["references/output-template.md", "初中物理公开课完整输出模板", "十三部分教案、证据链、器材安全、数据异常和质量硬约束", "always", 20, {}],
      ["references/excellent-example-junior.md", "初中物理优秀教案样例", "基于当前教材资料重构的电流与电压关系完整实验探究示范", "always", 30, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "物理 Skill 来源与边界", "课标、教材、实验数据、安全、版权和证据等级边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "physics_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["初中"],
    },
    outputContract: {
      format: "physics_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与物理内容分析", "现象—概念—模型—规律分析", "学情、前概念与方法起点",
        "核心增长与目标—任务—证据", "重难点与证据链", "主导模式与课堂主线", "器材、材料、安全与分工",
        "原始记录与数据处理工具", "教学流程", "板书与模型图", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "研究对象/现象/任务", "核心问题/预测/指令", "个体先行证据",
        "器材/分工/安全", "教师行为", "学生物理实践", "变量/测量/模型要求", "原始证据或产出",
        "典型错误/异常", "评价与反馈分支", "物理观念/方法落点", "结论强度与适用条件",
        "阶段成果和过渡", "时间核算",
      ],
    },
  },
  chemistry: {
    displayName: "化学公开课设计 Skill",
    skillSlug: "subject-lesson-design-chemistry",
    sourceSkillName: "chemistry-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/chemistry-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/chemistry-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814030000_hai_chemistry_public_lesson_skill_v2.sql"),
    skillDescription: "完整初中化学公开课设计 Skill：以大概念、实验事实和宏观—微观—符号表征组织学习，生成安全绿色、证据边界与迁移完整的教案。",
    matchCriteria: { subjects: ["化学"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "初中化学公开课主流教学模式", "六类化学模式、宏微符规则、实验约束与失败信号", "always", 10, {}],
      ["references/output-template.md", "初中化学公开课完整输出模板", "十三部分教案、三重表征、试剂安全、废物处理与证据边界", "always", 20, {}],
      ["references/excellent-example-junior.md", "初中化学优秀教案样例", "基于当前教材资料重构的质量守恒定律完整证据推理示范", "always", 30, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "化学 Skill 来源与边界", "课标、教材、实验安全、数据、版权和证据等级边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "chemistry_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["初中"],
    },
    outputContract: {
      format: "chemistry_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元大概念与教材定位", "化学内容与三重表征分析", "学情与前概念",
        "核心增长与目标—任务—证据", "重难点与主证据链", "主导模式与课堂主线", "试剂器材、安全绿色与分工",
        "原始记录、模型与评价工具", "教学流程", "板书与三重表征", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "物质/变化/体系/真实任务", "核心问题/预测/指令", "个体先行证据",
        "试剂器材/分工/安全", "教师行为", "学生化学实践", "宏观/微观/符号要求", "原始证据/产出",
        "典型错误/异常", "评价与反馈分支", "化学观念/方法落点", "结论强度及边界",
        "阶段成果与过渡", "时间核算",
      ],
    },
  },
  biology: {
    displayName: "生物学公开课设计 Skill",
    skillSlug: "subject-lesson-design-biology",
    sourceSkillName: "biology-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/biology-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/biology-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814040000_hai_biology_public_lesson_skill_v2.sql"),
    skillDescription: "完整初中生物学公开课设计 Skill：以生命大概念、观察数据和模型修订组织学习，生成实践伦理、健康边界与迁移完整的教案。",
    matchCriteria: { subjects: ["生物"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "初中生物学公开课主流教学模式", "七类模式、生命观念、证据模型与伦理边界", "always", 10, {}],
      ["references/output-template.md", "初中生物学公开课完整输出模板", "十三部分教案、模型修订、实践伦理与质量硬约束", "always", 20, {}],
      ["references/excellent-example-junior.md", "初中生物学优秀教案样例", "依据课标附录机制重构的尿液形成过程模型建构示范", "always", 30, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "生物学 Skill 来源与边界", "课标、新教材、目录证据、健康伦理与版权边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "biology_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["初中"],
      evidence_gate: "full_text_or_user_material_required_when_catalogue_only",
    },
    outputContract: {
      format: "biology_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元大概念与教材定位", "生命现象—证据—模型分析", "学情与前概念",
        "核心增长与目标—任务—证据", "重难点与证据—模型链", "主导模式与课堂主线", "材料、样本、安全伦理与分工",
        "原始记录、模型与评价工具", "教学流程", "板书与动态模型", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "对象/尺度", "核心问题/预测/指令", "个体先行证据", "材料/分工/伦理",
        "教师行为", "学生生物学实践", "观察/变量/模型要求", "原始证据/产出", "典型误解/异常",
        "评价与反馈分支", "生命观念/方法落点", "结论与外推边界", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  geography: {
    displayName: "地理公开课设计 Skill",
    skillSlug: "subject-lesson-design-geography",
    sourceSkillName: "geography-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/geography-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/geography-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814050000_hai_geography_public_lesson_skill_v2.sql"),
    skillDescription: "完整初中地理公开课设计 Skill：以地图资料、空间尺度、区域比较和人地系统组织证据，生成实践与规划决策完整的教案。",
    matchCriteria: { subjects: ["地理"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "初中地理公开课主流教学模式", "六类地理模式、地图证据、尺度与人地约束", "always", 10, {}],
      ["references/output-template.md", "初中地理公开课完整输出模板", "十三部分教案、地图数据、区域综合、实践安全与质量约束", "always", 20, {}],
      ["references/excellent-example-junior.md", "初中地理优秀教案样例", "依据课标评价机制重构的山区铁路选线规划决策示范", "always", 30, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "地理 Skill 来源与边界", "课标、新教材、目录证据、标准地图、数据与实践边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "geography_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["初中"],
      evidence_gate: "maps_and_datasets_required_when_catalogue_only",
    },
    outputContract: {
      format: "geography_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与区域定位", "地理事象与资料分析", "学情与地图能力起点",
        "核心增长与目标—任务—证据", "重难点与地理证据链", "主导模式与课堂主线", "地图数据、工具与实践安全",
        "原始读图与分析工具", "教学流程", "板书与地图成果", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "区域/尺度", "地图/数据资料", "核心任务", "个体先行证据", "合作必要性",
        "教师行为", "学生地理实践", "地图/数据要求", "产出", "典型误读", "评价与反馈分支",
        "核心素养落点", "结论与尺度边界", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  history: {
    displayName: "历史公开课设计 Skill",
    skillSlug: "subject-lesson-design-history",
    sourceSkillName: "history-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/history-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/history-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814060000_hai_history_public_lesson_skill_v2.sql"),
    skillDescription: "完整初中历史公开课设计 Skill：以时空框架、可信史料、证据互证和有边界历史解释组织学习，生成史料研习与评价完整的教案。",
    matchCriteria: { subjects: ["历史"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "初中历史公开课主流教学模式", "七类历史模式、史料规则、时空与解释边界", "always", 10, {}],
      ["references/output-template.md", "初中历史公开课完整输出模板", "十三部分教案、史料身份证、互证论证与质量约束", "always", 20, {}],
      ["references/excellent-example-junior.md", "初中历史优秀教案样例", "依据课标与精品课主题重构的考古史料研习示范", "always", 30, { stages: ["初中"] }],
      ["references/sources-and-boundaries.md", "历史 Skill 来源与边界", "课标、统编教材、目录证据、史料版权与争议边界", "always", 50, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60, {}],
    ],
    inputContract: {
      format: "history_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["初中"],
      evidence_gate: "textbook_and_sources_required_when_catalogue_only",
    },
    outputContract: {
      format: "history_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元线索与教材定位", "时空、史事与解释分析", "学情与历史思维起点",
        "核心增长与目标—任务—证据", "重难点与史证解释链", "主导模式与课堂主线", "史料包与版权",
        "研习与评价工具", "教学流程", "板书与时空证据图", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "时空范围", "材料编号", "核心问题", "个体先行证据", "合作必要性",
        "教师行为", "学生历史实践", "史料要求", "产出", "典型误读", "评价与反馈分支",
        "核心素养落点", "解释与证据边界", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  informationTechnology: {
    displayName: "信息科技公开课设计 Skill",
    skillSlug: "subject-lesson-design-information-technology",
    sourceSkillName: "information-technology-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/information-technology-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/information-technology-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814070000_hai_information_technology_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中信息科技/信息技术公开课设计 Skill：以真实数字问题、科学原理、可检验作品、测试调试和信息社会责任组织学习。",
    matchCriteria: { subjects: ["信息科技"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "信息科技公开课主流教学模式", "七类信息科技模式、学段适配、测试调试与责任边界", "always", 10, {}],
      ["references/output-template.md", "信息科技公开课完整输出模板", "十三部分教案、技术核准、测试日志、设备公平和质量约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学信息科技优秀教案样例", "依据身边的算法机制重构的分类算法表达与多例测试示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中信息科技优秀教案样例", "依据物联网机制重构的系统数据流与故障诊断示范", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中信息技术优秀教案样例", "依据数据与计算机制重构的查找算法正确性与效率比较示范", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "信息科技 Skill 来源与边界", "义教/高中课标、教学指南、技术事实、安全隐私与版权边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "information_technology_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_textbook_and_technical_materials_required",
    },
    outputContract: {
      format: "information_technology_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元逻辑与教材定位", "信息科技内容与原理分析", "学情与数字实践起点",
        "核心增长与目标—任务—证据", "重难点与问题解决链", "主导模式与公开课主线", "技术环境、资源、安全与分工",
        "原始工具、测试集与评价材料", "教学流程", "板书与数字成果设计", "评价量规、差异化与作业", "教学反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "场景与真实问题", "原理/数据/代码/系统材料", "核心任务", "个体先行证据", "合作必要性",
        "教师行为", "学生数字实践", "技术环境与安全", "原始产出/日志", "典型错误/故障", "评价与反馈分支",
        "核心素养落点", "结论/模型/系统边界", "版本成果与过渡", "时间核算",
      ],
    },
  },
  psychology: {
    displayName: "心理健康公开课设计 Skill",
    skillSlug: "subject-lesson-design-psychology",
    sourceSkillName: "psychology-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/psychology-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/psychology-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814080000_hai_psychology_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中心理健康公开课设计 Skill：以安全的匿名情境、发展性技能练习、真实选择权、非诊断评价和求助转介边界组织学习。",
    matchCriteria: { subjects: ["心理健康"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "心理健康公开课主流教学模式", "七类发展性模式、分学段适配、活动评价与安全边界", "always", 10, {}],
      ["references/output-template.md", "心理健康公开课完整输出模板", "十三部分教案、安全协议、危机转介、选择权与非诊断约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学心理健康优秀教案样例", "情绪线索、策略选择和可信成人求助的安全示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中心理健康优秀教案样例", "边界表达、风险判断、旁观者支持与校内求助示范", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中心理健康优秀教案样例", "学习压力、最小行动、障碍预案与求助阈值示范", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "心理健康 Skill 来源与边界", "指导纲要、专项行动、教材、专业伦理、隐私和危机边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "psychology_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_materials_and_school_safeguarding_path_required",
    },
    outputContract: {
      format: "psychology_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "课程体系与教材定位", "心理发展主题与知识边界", "学情与安全起点",
        "核心增长与目标—任务—证据", "重难点与体验—技能链", "主导模式与公开课主线", "安全协议、资源与转介预案",
        "活动材料与评价工具", "教学流程", "板书与资源呈现", "评价量规、差异化与课后练习", "反思、随访与核验",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "匿名/虚构情境", "核心指令", "个体先行证据", "参与选择/替代路径", "合作必要性",
        "教师行为与禁语", "学生心理技能实践", "产出", "典型反应/误区", "安全观察点", "评价与反馈分支",
        "策略适用边界", "求助连接", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  music: {
    displayName: "音乐公开课设计 Skill",
    skillSlug: "subject-lesson-design-music",
    sourceSkillName: "music-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/music-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/music-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814090000_hai_music_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中音乐公开课设计 Skill：从音响出发，以多次有目的聆听、音乐表现或创造、反馈复演和文化证据组织学习。",
    matchCriteria: { subjects: ["音乐"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "音乐公开课主流教学模式", "七类音乐模式、分学段实践、听觉证据和失败信号", "always", 10, {}],
      ["references/output-template.md", "音乐公开课完整输出模板", "十三部分教案、作品音响分析、排练复演、安全版权与质量约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学音乐优秀教案样例", "基于真实精品课题重构的速度听辨、律动验证与复演示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中音乐优秀教案样例", "基于真实精品课题重构的主题期待、音响证据与微型创编示范", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中音乐优秀教案样例", "基于公开教学主题重构的调式调性听觉探究与文化边界示范", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "音乐 Skill 来源与边界", "义教/高中课标、精品课、谱例音源、文化版权与安全边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "music_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_textbook_score_recording_and_cultural_sources_required",
    },
    outputContract: {
      format: "music_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与教材定位", "作品、音响与文化分析", "学情与音乐起点",
        "核心增长与目标—任务—证据", "重难点与音乐实践链", "主导模式与公开课主线", "音源乐谱、器材、安全与版权",
        "听辨、排练与评价工具", "教学流程", "板书与音乐成果", "量规、差异化与作业", "反思与核验",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "音响/谱例范围与时码", "聆听/表现指令", "个体先行证据", "合作必要性",
        "教师行为与示范边界", "学生听唱奏动创行动", "音乐/文化支架", "产出", "不同听感/典型困难",
        "评价与反馈分支", "音乐要素与整体表达", "文化/版权/安全边界", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  art: {
    displayName: "美术公开课设计 Skill",
    skillSlug: "subject-lesson-design-art",
    sourceSkillName: "art-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/art-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/art-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814100000_hai_art_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中美术公开课设计 Skill：以慢看和视觉证据、材料试验、多构想、表达/设计意图、观看反馈和作品修订组织学习。",
    matchCriteria: { subjects: ["美术"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "美术公开课主流教学模式", "七类美术模式、视觉证据、材料设计实践和失败信号", "always", 10, {}],
      ["references/output-template.md", "美术公开课完整输出模板", "十三部分教案、作品分析、试验草图评改、安全版权与质量约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学美术优秀教案样例", "基于真实精品课题重构的标识视觉识读、用户测试与修订示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中美术优秀教案样例", "剪纸视觉形式、材料变量、文化来源与结构修订示范", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中美术优秀教案样例", "城市图像D-A-I-E识读、语境核证和有限评述示范", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "美术 Skill 来源与边界", "义教/高中课标、新教材、作品图像、文化版权与材料安全边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "art_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_textbook_artwork_images_materials_and_safety_required",
    },
    outputContract: {
      format: "art_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元与教材定位", "作品、视觉语言与文化分析", "学情与视觉制作起点",
        "核心增长与目标—任务—证据", "重难点与视觉实践链", "主导模式与公开课主线", "图像材料、工具、安全与版权",
        "观察、试验、草图与评价工具", "教学流程", "板书与作品呈现", "量规、差异化与作业", "反思与核验",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "作品/图像/材料编号", "观看/制作任务", "个体先行证据", "合作必要性",
        "教师行为与示范边界", "学生看想试做说改行动", "产出", "不同解释/方案", "典型困难",
        "评价与反馈分支", "视觉语言/材料/文化落点", "工具安全/版权边界", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  physicalEducation: {
    displayName: "体育与健康公开课设计 Skill",
    skillSlug: "subject-lesson-design-physical-education",
    sourceSkillName: "physical-education-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/physical-education-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/physical-education-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814110000_hai_physical_education_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中体育与健康公开课设计 Skill：以结构化运动技能、学练赛评、全员高密度练习、个体负荷、安全应急和相对进步组织学习。",
    matchCriteria: { subjects: ["体育"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "体育与健康公开课主流教学模式", "七类体育健康模式、学练赛评、分学段适配和安全包容规则", "always", 10, {}],
      ["references/output-template.md", "体育与健康公开课完整输出模板", "十三部分教案、运动负荷、组织轮换、安全急救和质量约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学体育与健康优秀教案样例", "基于真实精品课题重构的直线运球、空间观察与游戏复练示范", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中体育与健康优秀教案样例", "篮球结构化传切技能、小场比赛、数据调规与复赛示范", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中体育与健康优秀教案样例", "间歇跑个体配速、多源监控、负荷决策与计划修订示范", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "体育与健康 Skill 来源与边界", "义教/高中课标、新教材、健康医疗、专项风险与隐私边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "physical_education_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_textbook_health_facility_equipment_weather_and_emergency_sop_required",
    },
    outputContract: {
      format: "physical_education_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元结构与教材定位", "运动技能、情境与负荷分析", "学情、健康与运动起点",
        "核心增长与目标—任务—证据", "重难点与学练赛评链", "主导模式与课堂主线", "场地器材、负荷与安全应急",
        "组织、轮换与评价工具", "教学流程", "板书/任务卡与场地图", "量规、差异化与课后练习", "反思与核验",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "场地组织与时间", "任务/规则", "关键动作线索", "教师位置/示范/巡视", "学生运动行动",
        "分层与升降级", "练习密度/负荷", "个体证据", "典型错误/风险", "即时反馈分支", "安全观察/停止条件",
        "健康行为/体育品德", "阶段成果与过渡", "时间核算",
      ],
    },
  },
  integratedPractice: {
    displayName: "综合实践活动公开课设计 Skill",
    skillSlug: "subject-lesson-design-integrated-practice",
    sourceSkillName: "integrated-practice-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/integrated-practice-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/integrated-practice-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814120000_hai_integrated_practice_public_lesson_skill_v2.sql"),
    skillDescription: "完整小学、初中、高中综合实践活动公开课设计 Skill：以真实问题、亲历实践、方法质量、利益相关者、个体贡献、公共反馈和长周期证据组织学习。",
    matchCriteria: { subjects: ["综合实践"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "综合实践活动公开课主流教学模式", "考察探究、社会服务、设计制作、职业体验与跨学科行动五类模式", "always", 10, {}],
      ["references/output-template.md", "综合实践活动公开课完整输出模板", "十三部分教案、长周期定位、方法伦理、档案与公共反馈约束", "always", 20, {}],
      ["references/excellent-example-primary.md", "小学综合实践优秀教案样例", "校园饮水项目观察工具试测、伦理边界与V2修订关键课时", "always", 30, { stages: ["小学"] }],
      ["references/excellent-example-junior.md", "初中综合实践优秀教案样例", "社区数字服务需求核验、安全原型与对象反馈计划关键课时", "always", 40, { stages: ["初中"] }],
      ["references/excellent-example-senior.md", "高中综合实践优秀教案样例", "职业体验多来源互证、生涯假设修订与行动实验关键课时", "always", 50, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "综合实践活动 Skill 来源与边界", "国家指导纲要、校本课程、场域伦理、安全数据与版权边界", "always", 60, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 70, {}],
    ],
    inputContract: {
      format: "integrated_practice_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["小学", "初中", "高中"],
      evidence_gate: "verified_school_plan_prior_student_evidence_permissions_site_and_safety_required",
    },
    outputContract: {
      format: "integrated_practice_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "课程体系与长周期定位", "真实问题、对象与跨学科分析", "学情与实践起点",
        "核心增长与目标—任务—证据", "重难点与模式证据链", "公开课主线与教师指导边界", "场域资源、伦理安全与对外协作",
        "实践工具与档案袋", "教学流程", "板书/项目看板与公共成果", "量规、差异化与课后行动", "反思、档案与核验",
      ],
      lesson_flow_required: [
        "项目阶段/环节功能", "前序证据编号", "核心任务", "个体先行证据", "自主选择点", "合作必要性",
        "教师指导/禁代做", "学生实践", "原始产出", "典型方法/伦理问题", "评价与反馈分支", "安全检查",
        "个人贡献证据", "阶段成果如何进入后续", "时间核算",
      ],
    },
  },
  generalTechnology: {
    displayName: "通用技术公开课设计 Skill",
    skillSlug: "subject-lesson-design-general-technology",
    sourceSkillName: "general-technology-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/general-technology-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/general-technology-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814130000_hai_general_technology_public_lesson_skill_v2.sql"),
    skillDescription: "完整高中通用技术公开课设计 Skill：以真实技术需求、约束、多方案、规范表达、事前试验、原始失败、原型迭代、安全标准和生命周期权衡组织学习。",
    matchCriteria: { subjects: ["通用技术"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "通用技术公开课主流教学模式", "设计迭代、技术试验、结构流程系统、控制、表达、工程项目和技术伦理七类模式", "always", 10, {}],
      ["references/output-template.md", "通用技术公开课完整输出模板", "十三部分教案、需求约束、图样试验、工具安全、迭代和质量约束", "always", 20, {}],
      ["references/excellent-example-senior.md", "高中通用技术优秀教案样例", "承重纸桥试验协议、失效证据、单变量优化和待复测V2示范", "always", 30, { stages: ["高中"] }],
      ["references/sources-and-boundaries.md", "通用技术 Skill 来源与边界", "高中课标、精品课题、模型外推、设备标准、安全与知识产权边界", "always", 40, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 50, {}],
    ],
    inputContract: {
      format: "general_technology_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["高中"],
      evidence_gate: "verified_textbook_facilities_tools_materials_standards_prior_work_and_safety_sop_required",
    },
    outputContract: {
      format: "general_technology_public_lesson_markdown_v1",
      required_sections: [
        "课程基本信息", "单元/项目结构与教材定位", "技术内容、需求与系统分析", "学情与技术实践起点",
        "核心增长与目标—任务—证据", "重难点与技术证据链", "主导模式与公开课主线", "工具材料、设施、安全与标准",
        "图样、试验协议与评价工具", "教学流程", "板书、技术图样与工位布局", "量规、差异化与课后延伸", "反思与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/对应目标", "技术对象/需求/前序证据", "核心任务与限制", "个体先行证据", "教师行为/示范/禁代做",
        "学生技术行动", "工位/分工/轮换", "图样/原始数据/作品", "变量/指标/标准", "预期差异/失败/异常",
        "评价与反馈分支", "安全检查/停止条件", "原理/工程思维/伦理落点", "阶段成果/版本/过渡", "时间核算",
      ],
    },
  },
  professional: {
    displayName: "其他 / 专业课公开课设计 Skill",
    skillSlug: "subject-lesson-design-professional",
    sourceSkillName: "professional-public-lesson-design",
    sourceDir: join(repoRoot, "supabase/skill-sources/professional-public-lesson-design"),
    seedPath: join(repoRoot, "supabase/seed-data/professional-public-lesson-design-work-skill.json"),
    migrationPath: join(repoRoot, "supabase/migrations/20260814140000_hai_professional_public_lesson_skill_v2.sql"),
    skillDescription: "其他 / 专业课元 Skill：先识别办学层次、专业课程和标准，再按知识类型选择工作任务、技能训练、案例决策、项目、研究、仿真、研讨或服务证据链。",
    matchCriteria: { subjects: ["其他 / 专业课"], lesson_types: ["公开课"] },
    references: [
      ["references/mainstream-models.md", "其他 / 专业课公开课主流教学模式", "面向职业与高校课程的八类非同构模式、选择规则和学段适配", "always", 10, {}],
      ["references/output-template.md", "其他 / 专业课公开课完整输出模板", "证据门禁与十三部分教案、专业标准、个体表现、安全伦理和评价约束", "always", 20, {}],
      ["references/excellent-example-other.md", "其他 / 专业课优秀教案样例", "高职现代物流合成数据、多约束线路审计、V1/V2和模拟边界完整示范", "always", 30, { stages: ["其他（中职/高职/高校等）"] }],
      ["references/sources-and-boundaries.md", "其他 / 专业课 Skill 来源与边界", "职业教育专业标准、高校课程、行业数据、高风险执业和版权隐私边界", "always", 40, {}],
      ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 50, {}],
    ],
    inputContract: {
      format: "professional_public_lesson_input_v1",
      required: ["stage", "subject", "grade", "volume", "unit", "topic", "lesson_type"],
      supported_stages: ["其他（中职/高职/高校等）"],
      evidence_gate: "exact_institution_level_major_course_curriculum_standards_materials_prerequisites_facilities_and_safety_required",
    },
    outputContract: {
      format: "professional_public_lesson_markdown_v1",
      required_sections: [
        "证据采集单（门禁）", "课程基本信息", "培养方案、课程标准与课时定位", "专业内容、典型任务与知识结构",
        "学情与先修表现", "核心增长与目标—任务—证据", "重难点与专业证据链", "主导模式与公开课主线",
        "资源、设施、数据、安全伦理与行业协作", "任务书、工作页与评价工具", "教学流程", "板书/流程图/工位或界面设计",
        "评价量规、差异化与迁移任务", "反思、质量改进与核验清单",
      ],
      lesson_flow_required: [
        "环节功能/目标", "专业对象/情境/前序证据", "核心任务/输入/限制", "个体先行证据", "标准/工具/知识支架",
        "教师示范/追问/禁代做", "学生专业行动", "分工/轮换/全员练习", "原始产出/过程记录", "预期差异/错误/异常",
        "评价与反馈分支", "安全/合规/伦理检查", "专业知识/方法/责任落点", "V1/V2/阶段成果/过渡", "时间核算",
      ],
    },
  },
};

const baseConfig = configs[subject];
if (!baseConfig) throw new Error(`未知学科配置：${subject}`);
const config = {
  ...baseConfig,
  outputContract: unifiedOutputContract,
  references: baseConfig.references.map((reference) =>
    reference[0] === "references/output-template.md"
      ? [
        reference[0],
        `${baseConfig.displayName.replace(/\s*Skill$/, "")} 统一输出模板`,
        "九部分 Markdown 教案、五列教学流程与分学段评价量规",
        reference[3],
        reference[4],
        reference[5],
      ]
      : reference
  ),
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const instructions = readFileSync(join(config.sourceDir, "SKILL.md"), "utf8").trim();
const references = config.references.map(([path, name, description, loadMode, sortOrder, metadata]) => {
  const content = readFileSync(join(config.sourceDir, path), "utf8").trim();
  return {
    path,
    name,
    description,
    media_type: path.endsWith(".yaml") ? "application/yaml" : "text/markdown",
    content,
    content_hash: sha256(content),
    load_mode: loadMode,
    max_chars: Math.min(Math.max([...content].length, 1), 50000),
    sort_order: sortOrder,
    metadata: {
      source_package: config.sourceSkillName,
      runtime_role: loadMode === "always" ? "discipline_reference" : loadMode,
      ...metadata,
    },
  };
});

const snapshotMaterial = JSON.stringify({
  instructions,
  references: references.map(({ path, content_hash, load_mode, max_chars, sort_order, metadata }) => ({
    path,
    content_hash,
    load_mode,
    max_chars,
    sort_order,
    metadata,
  })),
});

const payload = {
  skill_slug: config.skillSlug,
  source_skill_name: config.sourceSkillName,
  version_label: versionLabel,
  snapshot_hash: sha256(snapshotMaterial),
  instructions,
  input_contract: config.inputContract,
  output_contract: config.outputContract,
  source_metadata: {
    source_package: config.sourceSkillName,
    source_kind: "repository_skill_source",
    source_file_count: 1 + references.length,
    runtime_reference_count: references.filter((item) => item.load_mode !== "evaluation_only").length,
    source_skill_hash: sha256(instructions),
  },
  references,
};

mkdirSync(dirname(config.seedPath), { recursive: true });
writeFileSync(config.seedPath, `${JSON.stringify(payload, null, 2)}\n`);

const sqlPayload = JSON.stringify({
  ...payload,
  skill_description: config.skillDescription,
  match_criteria: config.matchCriteria,
});
if (sqlPayload.includes("$subjectskill$")) throw new Error("Skill 数据与 SQL 分隔符冲突。");
const sqlPayloadBase64 = Buffer.from(sqlPayload, "utf8").toString("base64");

const migration = `begin;

do $$
declare
  v_payload jsonb := convert_from(decode('${sqlPayloadBase64}', 'base64'), 'UTF8')::jsonb;
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
  set name = '${config.displayName}',
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
`;

if (!seedOnly) writeFileSync(config.migrationPath, migration);
console.log(`已生成 ${config.sourceSkillName} 快照${seedOnly ? "" : "与迁移"}`);
console.log(`snapshot_hash=${payload.snapshot_hash}`);
console.log(config.seedPath);
if (!seedOnly) console.log(config.migrationPath);
