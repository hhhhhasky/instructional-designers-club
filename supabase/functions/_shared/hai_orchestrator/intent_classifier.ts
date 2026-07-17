import type {
  IntentName,
  IntentResult,
  SupportDepth,
  TeachingScene,
  UserGoal,
} from "./types.ts";

const showcaseSignals =
  /公开课|展示课|观摩课|优质课|汇报课|录课|课例展示|赛课|比赛课|教学比赛|说课|说课稿|评委|获奖/;
const teachingSignals =
  /教学|课堂|备课|教案|说课|学生|教材|课文|课标|学情|目标|活动|评价|作业|复习课|讲评课|试卷|提分|课程|学习|教师|班级|授课|上课|课题/;
const conceptSignals =
  /是什么|什么意思|概念|定义|区别|关系|原理|理论|为什么|如何理解|怎么理解|内涵|特征|教学法|学习科学|教育哲学|核心素养|形成性评价|大概念|项目式|PBL|跨学科/;
const existingWorkSignals =
  /我已经|我设计(?:了|的)?|我写(?:了|的)?|我用了|我采用|我现在是|目前是|我的(?:教案|说课稿|设计稿|方案|环节|流程|活动|目标)|我的(?:公开课|说课|赛课)(?:设计|开头|结尾|方案|环节)?|这(?:份|个|一)(?:教案|说课稿|设计稿|方案|环节|流程|活动)|(?:教案|说课稿|设计稿|方案|环节|流程|活动)的(?:开头|结尾|部分|一段|某段|这一段)|目标写|课堂上|上完|讲完|学生总是|这样做|这么做|这个设计|这段|这一部分/;
const diagnosisRequestSignals =
  /怎么看|看法|意见|评价|诊断|看看|是否合理|合不合适|对不对|可以吗|行不行|有没有问题|问题在哪|哪里不好|怎么改|如何改|优化|修改|改写|调整|提升|为什么.*不|还是不会|效果不好|不聚焦|不够清楚|不清楚|不理想/;
const designSupportSignals =
  /没思路|没有思路|不知道怎么|不会设计|怎么设计|如何设计|怎么上|如何上|怎么讲|如何讲|从哪里开始|怎么开始|给.*思路|提供.*思路|给.*框架|提供.*框架|示范|样例|例子|帮我设计|帮我想|帮我写|写一份|生成.*(?:教案|说课稿)|设计一个|做一个/;
const demonstrationSignals =
  /示范|样例|例子|改写一段|写一段|写一个|帮我写|写一份|生成.*(?:教案|说课稿)|局部设计|局部修改|结构样例|框架样例/;
const ideasSignals =
  /思路|框架|结构|方向|怎么设计|如何设计|怎么上|如何上|怎么讲|如何讲|从哪里开始|怎么开始|帮我想/;

export function classifyIntent(question: string): IntentResult {
  const normalized = question.trim();
  if (
    !normalized ||
    !teachingSignals.test(normalized) && !showcaseSignals.test(normalized)
  ) {
    return buildResult({
      question: normalized,
      intent: "unknown",
      scene: "unclear",
      userGoal: "unclear",
      supportDepth: "advice",
      confidence: normalized ? 0.42 : 0.25,
      reason: normalized
        ? "未发现足够明确的教学场景或教学概念信号。"
        : "用户问题为空。",
    });
  }

  const scene = inferScene(normalized);
  const userGoal = inferUserGoal(normalized, scene);
  const supportDepth = inferSupportDepth(normalized, userGoal);
  const intent = combineIntent(scene, userGoal);
  const confidence = inferConfidence(normalized, scene, userGoal, intent);

  return buildResult({
    question: normalized,
    intent,
    scene,
    userGoal,
    supportDepth,
    confidence,
    reason: buildRouteReason(scene, userGoal, intent),
  });
}

function inferScene(question: string): TeachingScene {
  if (/赛课|比赛课|教学比赛|评委|获奖/.test(question)) {
    return "competition_lesson";
  }
  if (/说课|说课稿/.test(question)) return "lesson_presentation";
  if (/公开课|展示课|观摩课|优质课|汇报课|录课|课例展示/.test(question)) {
    return "public_lesson";
  }
  if (/试卷讲评|讲评课|错题讲评|试卷分析/.test(question)) {
    return "exam_review";
  }
  if (/复习课|复习阶段|总复习|期中复习|期末复习/.test(question)) {
    return "review_lesson";
  }
  if (
    /日常课|常态课|新授课|练习课|提分|成绩|考试|作业|课堂|备课|教案|教材|课文|学生|上课|授课/
      .test(question)
  ) {
    return "daily_lesson";
  }
  return "general_teaching";
}

function inferUserGoal(question: string, scene: TeachingScene): UserGoal {
  const hasExistingWork = existingWorkSignals.test(question);
  const asksForDiagnosis = diagnosisRequestSignals.test(question);
  const asksForDesign = designSupportSignals.test(question);
  const asksConcept = conceptSignals.test(question);
  const isSpecificLesson = scene !== "general_teaching" && scene !== "unclear";

  if (hasExistingWork && asksForDiagnosis) return "diagnosis";
  if (asksForDesign) return "design_support";
  if (asksForDiagnosis && isSpecificLesson) return "diagnosis";
  if (asksConcept && !isSpecificLesson) return "concept_qa";
  if (hasExistingWork) return "diagnosis";
  if (isSpecificLesson) return "design_support";
  if (asksConcept) return "concept_qa";
  if (scene === "general_teaching") return "concept_qa";
  return "unclear";
}

function inferSupportDepth(
  question: string,
  userGoal: UserGoal,
): SupportDepth {
  if (demonstrationSignals.test(question)) return "demonstration";
  if (userGoal === "design_support" || ideasSignals.test(question)) {
    return "ideas";
  }
  return "advice";
}

function combineIntent(
  scene: TeachingScene,
  userGoal: UserGoal,
): IntentName {
  if (userGoal === "concept_qa") return "teaching_concept_qa";
  const isShowcase = [
    "public_lesson",
    "lesson_presentation",
    "competition_lesson",
  ].includes(scene);
  if (isShowcase && userGoal === "diagnosis") {
    return "showcase_lesson_diagnosis";
  }
  if (isShowcase && userGoal === "design_support") {
    return "showcase_lesson_design";
  }
  if (userGoal === "diagnosis") return "daily_improvement_diagnosis";
  if (userGoal === "design_support") return "daily_improvement_design";
  return "unknown";
}

function inferConfidence(
  question: string,
  scene: TeachingScene,
  userGoal: UserGoal,
  intent: IntentName,
) {
  if (intent === "unknown") return 0.48;
  let score = 0.64;
  if (scene !== "general_teaching" && scene !== "unclear") score += 0.1;
  if (userGoal !== "unclear") score += 0.1;
  if (showcaseSignals.test(question)) score += 0.04;
  if (
    existingWorkSignals.test(question) && diagnosisRequestSignals.test(question)
  ) {
    score += 0.05;
  }
  if (designSupportSignals.test(question)) score += 0.04;
  return Math.round(Math.min(0.94, score) * 100) / 100;
}

function buildResult(params: {
  question: string;
  intent: IntentName;
  scene: TeachingScene;
  userGoal: UserGoal;
  supportDepth: SupportDepth;
  confidence: number;
  reason: string;
}): IntentResult {
  return {
    primary_intent: params.intent,
    secondary_intents: [],
    scene: params.scene,
    user_goal: params.userGoal,
    support_depth: params.supportDepth,
    explicit_need: inferExplicitNeed(
      params.question,
      params.intent,
      params.supportDepth,
    ),
    implicit_need: inferImplicitNeed(params.intent),
    risk_of_wrong_framing: inferRisk(params.intent),
    confidence: params.confidence,
    route_method: params.intent === "unknown" ? "fallback" : "keyword",
    route_reason: params.reason,
    matched_signals: [],
  };
}

function inferExplicitNeed(
  question: string,
  intent: IntentName,
  supportDepth: SupportDepth,
) {
  const clipped = question.length > 140
    ? `${question.slice(0, 140)}...`
    : question;
  const labels: Record<IntentName, string> = {
    showcase_lesson_diagnosis: "用户想诊断并修改已有的公开课、说课或赛课方案",
    showcase_lesson_design: "用户想获得公开课、说课或赛课的设计思路",
    daily_improvement_diagnosis: "用户想诊断并改进已有的日常教学或提分方案",
    daily_improvement_design: "用户想获得日常课、复习课或提分场景的设计思路",
    teaching_concept_qa: "用户想理解一个教学概念、原理或方法",
    unknown: "用户意图不明确",
  };
  const depth = supportDepth === "demonstration"
    ? "；可以提供局部示范或结构样例，但不得代写完整交付物"
    : "";
  return `${labels[intent]}${depth}：${clipped || "用户问题为空"}`;
}

function inferImplicitNeed(intent: IntentName) {
  const needs: Record<IntentName, string> = {
    showcase_lesson_diagnosis:
      "用户需要区分教学有效性、展示效果和评审要求，并找到现有设计的最早结构断点。",
    showcase_lesson_design:
      "用户需要先建立展示课的学习主线，再选择必要的亮点形式和局部示范。",
    daily_improvement_diagnosis:
      "用户需要从学生学习结果倒查已有教学方案的问题，而不是只润色表达或增加活动。",
    daily_improvement_design:
      "用户需要从目标、学情和学习证据出发形成可执行的局部设计思路。",
    teaching_concept_qa: "用户需要理解概念的课堂含义、适用条件和使用边界。",
    unknown: "当前问题缺少足够信息，需要先做最少追问。",
  };
  return needs[intent];
}

function inferRisk(intent: IntentName) {
  const risks: Record<IntentName, string> = {
    showcase_lesson_diagnosis:
      "可能只追求形式亮点，忽略真实学习和现实评审要求之间的平衡。",
    showcase_lesson_design:
      "可能过早生成完整方案，跳过目标、学情、规则和取舍判断。",
    daily_improvement_diagnosis:
      "可能把学习效果问题误认为表达、趣味或活动数量问题。",
    daily_improvement_design:
      "可能直接堆流程和活动，没有形成目标、任务与评价证据闭环。",
    teaching_concept_qa: "可能回答成百科定义，没有说明课堂应用边界。",
    unknown: "信息不足时容易给出泛泛建议或错误假设。",
  };
  return risks[intent];
}

function buildRouteReason(
  scene: TeachingScene,
  userGoal: UserGoal,
  intent: IntentName,
) {
  if (intent === "unknown") {
    return "识别到教学相关信号，但场景或用户目的仍不明确。";
  }
  return `先识别场景为 ${scene}，再识别用户目的为 ${userGoal}，组合得到 ${intent}。`;
}
