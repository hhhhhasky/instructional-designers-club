import type { IntentName, IntentResult } from "./types.ts";

type Signal = {
  label: string;
  pattern: RegExp;
  weight: number;
};

type IntentRule = {
  intent: IntentName;
  signals: Signal[];
  implicitNeed: string;
  risk: string;
};

const intentRules: IntentRule[] = [
  {
    intent: "public_lesson",
    signals: [
      signal("公开课/赛课/优质课", /公开课|赛课|优质课|展示课|观摩课|磨课/, 5),
      signal("说课", /说课|说课稿|说课比赛/, 5),
      signal("亮点包装", /亮点|出彩|创新点|展示效果|评委/, 4),
      signal("公开展示活动", /汇报课|录课|课例展示/, 3),
    ],
    implicitNeed: "用户可能真正需要的是找到这节课的学习性亮点和理解转折，而不是增加展示形式。",
    risk: "用户可能把亮点误认为技术、活动或包装。",
  },
  {
    intent: "lesson_plan_diagnosis",
    signals: [
      signal("教案诊断", /教案.*(诊断|看看|修改|问题|不聚焦)|帮我看看.*教案/, 5),
      signal("活动堆叠", /活动很多|环节很多|流程很多|不聚焦|目标不清|主线不清/, 5),
      signal("完整流程诊断", /流程.*完整|环节.*完整|情境导入.*小组讨论|展示交流.*练习巩固|不够有力量|问题在哪/, 6),
      signal("目标活动评价一致性", /目标.*活动.*评价|评价.*目标|活动.*目标/, 4),
      signal("教学设计稿诊断", /教学设计稿|设计稿|课时设计/, 3),
    ],
    implicitNeed: "用户可能需要检查目标、活动、评价和学情之间是否一致。",
    risk: "用户可能只想润色文本，但真实问题可能是设计结构不成立。",
  },
  {
    intent: "teaching_design",
    signals: [
      signal("备课/怎么上", /备课|怎么上|这节课怎么讲|教学设计|课堂设计|教学思路/, 4),
      signal("教材课文切入", /教材|课文|文本|单元|章节|课题|切入|导入|怎么切入|从哪里入手|《[^》]+》/, 5),
      signal("教学目标编写", /教学目标|目标怎么写|目标写|核心目标|本课目标|理解.*掌握|掌握.*理解/, 5),
      signal("任务链/主线", /任务链|学习任务|教学主线|学习主线|活动设计|问题链/, 4),
      signal("课标/核心素养", /课标|核心素养|学习目标|单元目标/, 3),
    ],
    implicitNeed: "用户可能需要把课题、目标、学情、活动和评价证据组织成一条学习主线。",
    risk: "用户可能把备课理解成安排环节，而不是设计学习发生。",
  },
  {
    intent: "learning_profile",
    signals: [
      signal("学情", /学情|学生基础|学生特点|已有经验|前测|起点|预习情况/, 5),
      signal("差异与薄弱", /差异|薄弱|基础差|基础弱|分层|后进生|优生|中等生/, 4),
      signal("学习障碍画像", /误区|易错|卡点|难点.*学生|学生.*难点/, 3),
    ],
    implicitNeed: "用户可能需要把泛泛的学生描述转成会影响教学决策的学习证据。",
    risk: "用户可能把学情写成背景介绍，而不是设计依据。",
  },
  {
    intent: "classroom_management",
    signals: [
      signal("纪律秩序", /纪律|课堂管理|课堂秩序|吵|讲话|捣乱|管不住/, 5),
      signal("不配合", /不配合|不听指令|插嘴|起哄|分心|玩手机/, 4),
      signal("规则奖惩", /规则|奖惩|惩罚|提醒|班规|小组纪律/, 3),
    ],
    implicitNeed: "用户可能需要区分纪律问题、任务结构问题和关系问题。",
    risk: "用户可能把所有问题归因为学生态度或管理技巧不足。",
  },
  {
    intent: "learning_motivation",
    signals: [
      signal("不爱听/没兴趣", /不爱听|不想听|没兴趣|没有兴趣|兴趣不高|无聊|枯燥/, 5),
      signal("投入参与", /投入|参与|不参与|走神|发呆|课堂有趣|有趣|互动|游戏|热闹/, 4),
      signal("学习必要感", /为什么要学|学这个有什么用|必要感|认知入口|问题意识/, 5),
      signal("动力不足", /动机|积极性|主动性|不主动|不愿意学/, 4),
    ],
    implicitNeed: "用户可能需要设计认知入口和学习必要感，而不是单纯增加趣味活动。",
    risk: "用户可能把学生不投入误归因为课堂不够热闹。",
  },
  {
    intent: "assessment_feedback",
    signals: [
      signal("评价反馈", /评价|反馈|即时反馈|形成性评价|课堂评价|评价量规|rubric/i, 5),
      signal("作业批改", /作业|批改|讲评|订正|错题|改错/, 4),
      signal("学习证据", /学习证据|出口题|检测|随堂测|当堂检测|看不出来|怎么判断.*学会/, 5),
      signal("假懂/题目暴露", /点头|听懂了|一做题|不会做题|还是错|讲完.*不会|会听不会做/, 5),
      signal("大班额", /大班|大班额|五十|50|四十|40|几十个学生/, 4),
    ],
    implicitNeed: "用户可能需要低成本收集学习证据，而不是增加教师批改负担。",
    risk: "用户可能把评价等同于分数或对错检查。",
  },
  {
    intent: "ai_lesson_planning",
    signals: [
      signal("AI 工具", /\bAI\b|\bai\b|大模型|ChatGPT|Claude|DeepSeek|智能体|提示词/, 5),
      signal("AI 生成教案", /生成教案|AI.*备课|ai.*备课|用.*AI|用.*ai|生成.*普通|模板化/, 5),
      signal("人机协作", /让AI|让ai|指令|prompt|代写|审稿|改稿/, 3),
    ],
    implicitNeed: "用户可能需要把 AI 从代写工具改成诊断和审稿工具。",
    risk: "用户可能把流畅文本误认为高质量教学设计。",
  },
  {
    intent: "pbl_crossdisciplinary",
    signals: [
      signal("PBL/项目式", /PBL|pbl|项目式|项目化|项目学习/, 5),
      signal("跨学科/真实任务", /跨学科|真实任务|真实情境|大任务|驱动性问题/, 5),
      signal("理念落地", /大概念|核心概念|理念落地|任务群|综合实践/, 4),
    ],
    implicitNeed: "用户可能需要把理念口号转成真实问题、学科核心和可评价产出。",
    risk: "用户可能把项目式、跨学科理解成活动拼盘。",
  },
  {
    intent: "teacher_growth",
    signals: [
      signal("教师成长", /教师成长|专业成长|青年教师|新教师|骨干教师|名师/, 5),
      signal("教研复盘", /教研|听评课|评课|复盘|教学反思|课例研究/, 4),
      signal("能力改进", /我该怎么提升|怎么成长|教学能力|基本功|赛后反思/, 4),
    ],
    implicitNeed: "用户可能需要把成长问题转成一个可复盘的小周期改进任务。",
    risk: "用户可能把成长理解成多学理论、多看课，而没有形成课堂改进证据。",
  },
];

export function classifyIntent(question: string): IntentResult {
  const normalized = question.trim();
  const scored = intentRules
    .map((rule) => {
      const matched = rule.signals.filter((item) => item.pattern.test(normalized));
      return {
        ...rule,
        matched,
        score: matched.reduce((total, item) => total + item.weight, 0),
      };
    })
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const primary = scored[0];
  if (!primary) {
    const fallbackIntent: IntentName = normalized.length < 8 ? "unknown" : "general_question";
    return {
      primary_intent: fallbackIntent,
      secondary_intents: [],
      explicit_need: normalized || "用户问题为空",
      implicit_need: "当前问题缺少足够教学场景，需要先做假设性诊断。",
      risk_of_wrong_framing: "信息不足时容易给出泛泛建议。",
      confidence: normalized.length < 8 ? 0.35 : 0.5,
      route_method: "fallback",
      route_reason: "未命中足够明确的关键词信号。",
      matched_signals: [],
    };
  }

  const second = scored[1];
  const margin = primary.score - (second?.score ?? 0);
  const confidence = confidenceFromScore(primary.score, margin, primary.matched.length);
  const secondary = scored
    .slice(1, 4)
    .filter((item) => item.intent !== primary.intent && item.score >= 3)
    .map((item) => item.intent);

  return {
    primary_intent: primary.intent,
    secondary_intents: secondary,
    explicit_need: inferExplicitNeed(normalized, primary.intent),
    implicit_need: primary.implicitNeed,
    risk_of_wrong_framing: primary.risk,
    confidence,
    route_method: "keyword",
    route_reason: margin <= 2 && second
      ? `确定性信号接近，${primary.intent} 与 ${second.intent} 需要语义兜底复核。`
      : "命中明确教学场景关键词，可用代码规则直接路由。",
    matched_signals: primary.matched.map((item) => item.label),
  };
}

function signal(label: string, pattern: RegExp, weight: number): Signal {
  return { label, pattern, weight };
}

function confidenceFromScore(score: number, margin: number, matchCount: number) {
  const base = 0.48 + Math.min(score, 12) * 0.035 + Math.min(matchCount, 3) * 0.05;
  const marginBonus = Math.max(0, Math.min(margin, 6)) * 0.025;
  const ambiguityPenalty = margin <= 1 ? 0.08 : margin <= 2 ? 0.04 : 0;
  return roundConfidence(Math.max(0.45, Math.min(0.94, base + marginBonus - ambiguityPenalty)));
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}

function inferExplicitNeed(question: string, intent: IntentName) {
  const clipped = question.length > 140 ? `${question.slice(0, 140)}...` : question;
  const labels: Record<IntentName, string> = {
    teaching_design: "用户想获得教学设计或备课建议",
    lesson_plan_diagnosis: "用户想诊断教案或设计稿的问题",
    public_lesson: "用户想优化公开课、赛课或说课表现",
    learning_profile: "用户想分析学生基础、差异或学习障碍",
    classroom_management: "用户想处理课堂秩序或学生配合问题",
    learning_motivation: "用户想提升学生投入、兴趣或课堂参与",
    assessment_feedback: "用户想改进评价、反馈或作业处理",
    ai_lesson_planning: "用户想用 AI 辅助备课或改进 AI 输出质量",
    pbl_crossdisciplinary: "用户想把 PBL、跨学科或教育理念落到课堂",
    teacher_growth: "用户想处理教师专业成长或教研改进问题",
    general_question: "用户想获得一个教育问题的解释或建议",
    unknown: "用户意图不明确",
  };
  return `${labels[intent]}：${clipped}`;
}
