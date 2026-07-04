import type { IntentName, IntentResult } from "./types.ts";

const intentRules: Array<{
  intent: IntentName;
  keywords: string[];
  implicitNeed: string;
  risk: string;
}> = [
  {
    intent: "public_lesson",
    keywords: ["公开课", "赛课", "展示课", "优质课", "说课", "磨课", "亮点"],
    implicitNeed: "用户可能真正需要的是找到这节课的学习性亮点和理解转折，而不是增加展示形式。",
    risk: "用户可能把亮点误认为技术、活动或包装。",
  },
  {
    intent: "lesson_plan_diagnosis",
    keywords: ["教案", "教学设计稿", "帮我看看", "诊断", "目标不清", "活动很多", "流程"],
    implicitNeed: "用户可能需要检查目标、活动、评价和学情之间是否一致。",
    risk: "用户可能只想润色文本，但真实问题可能是设计结构不成立。",
  },
  {
    intent: "learning_motivation",
    keywords: ["不爱听", "没兴趣", "兴趣", "动机", "投入", "不参与", "走神", "课堂有趣", "游戏", "互动"],
    implicitNeed: "用户可能需要设计认知入口和学习必要感，而不是单纯增加趣味活动。",
    risk: "用户可能把学生不投入误归因为课堂不够热闹。",
  },
  {
    intent: "learning_profile",
    keywords: ["学情", "学生基础", "学生特点", "差异", "薄弱", "前测", "已有经验"],
    implicitNeed: "用户可能需要把泛泛的学生描述转成会影响教学决策的学习证据。",
    risk: "用户可能把学情写成背景介绍，而不是设计依据。",
  },
  {
    intent: "classroom_management",
    keywords: ["纪律", "课堂管理", "吵", "捣乱", "不配合", "管不住", "规则", "秩序"],
    implicitNeed: "用户可能需要区分纪律问题、任务结构问题和关系问题。",
    risk: "用户可能把所有问题归因为学生态度或管理技巧不足。",
  },
  {
    intent: "assessment_feedback",
    keywords: ["评价", "反馈", "作业", "批改", "出口题", "学习证据", "大班", "五十", "50"],
    implicitNeed: "用户可能需要低成本收集学习证据，而不是增加教师批改负担。",
    risk: "用户可能把评价等同于分数或对错检查。",
  },
  {
    intent: "ai_lesson_planning",
    keywords: ["AI", "ai", "大模型", "提示词", "ChatGPT", "Claude", "DeepSeek", "生成教案", "智能体"],
    implicitNeed: "用户可能需要把 AI 从代写工具改成诊断和审稿工具。",
    risk: "用户可能把流畅文本误认为高质量教学设计。",
  },
  {
    intent: "pbl_crossdisciplinary",
    keywords: ["PBL", "pbl", "项目式", "跨学科", "大概念", "真实任务", "情境", "理念落地"],
    implicitNeed: "用户可能需要把理念口号转成真实问题、学科核心和可评价产出。",
    risk: "用户可能把项目式或跨学科做成活动拼盘。",
  },
  {
    intent: "teacher_growth",
    keywords: ["成长", "新教师", "专业发展", "教研", "反思", "听课", "培训", "论文"],
    implicitNeed: "用户可能需要一个可复盘的小周期改进任务。",
    risk: "用户可能把成长理解成多学理论，而不是形成课堂判断。",
  },
  {
    intent: "teaching_design",
    keywords: ["备课", "教学设计", "课堂活动", "导入", "任务链", "教学目标", "怎么上", "一节课"],
    implicitNeed: "用户可能需要从目标、学情、活动和评价证据重建教学主线。",
    risk: "用户可能把备课理解成安排环节，而不是设计学习发生。",
  },
];

export function classifyIntent(question: string): IntentResult {
  const normalized = question.trim();
  const scored = intentRules
    .map((rule) => ({
      ...rule,
      score: rule.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const primary = scored[0];
  if (!primary) {
    return {
      primary_intent: normalized.length < 8 ? "unknown" : "general_question",
      secondary_intents: [],
      explicit_need: normalized || "用户问题为空",
      implicit_need: "当前问题缺少足够教学场景，需要先做假设性诊断。",
      risk_of_wrong_framing: "信息不足时容易给出泛泛建议。",
      confidence: normalized.length < 8 ? 0.35 : 0.55,
    };
  }

  const secondary = scored
    .slice(1, 3)
    .map((item) => item.intent)
    .filter((intent) => intent !== primary.intent);

  return {
    primary_intent: primary.intent,
    secondary_intents: secondary,
    explicit_need: inferExplicitNeed(normalized, primary.intent),
    implicit_need: primary.implicitNeed,
    risk_of_wrong_framing: primary.risk,
    confidence: Math.min(0.92, 0.62 + primary.score * 0.12),
  };
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
