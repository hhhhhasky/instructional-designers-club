import { selectHanMethodology } from "./methodology_router.ts";
import {
  hanCourseMethodCards,
  type HanMethodCardConfigRow,
  mergeHanMethodCards,
} from "./knowledge/method_bank/han_course_method_cards.ts";
import type {
  IntentName,
  IntentResult,
  ProblemRewrite,
  SemanticRouteResult,
} from "./types.ts";

function intent(primary_intent: IntentName): IntentResult {
  const isShowcase = primary_intent.startsWith("showcase_");
  const isDiagnosis = primary_intent.endsWith("_diagnosis");
  return {
    primary_intent,
    scene: isShowcase
      ? "public_lesson"
      : primary_intent === "unknown"
      ? "unclear"
      : "general_teaching",
    user_goal: primary_intent === "teaching_concept_qa"
      ? "concept_qa"
      : primary_intent === "unknown"
      ? "unclear"
      : isDiagnosis
      ? "diagnosis"
      : "design_support",
    support_depth: "advice",
    explicit_need: "测试",
    implicit_need: "测试",
    confidence: 0.9,
    route_method: "llm",
  };
}

function rewrite(question: string): ProblemRewrite {
  return {
    original_question: question,
    surface_problem: question,
    deeper_problem: question,
    hai_reframing: question,
    recommended_answer_direction: question,
  };
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nexpected=${JSON.stringify(expected)}\nactual=${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("semantic methodology selection wins over fallback keyword scoring", () => {
  const question = "这个班学生差异很大，我怎么照顾不同水平？";
  const semanticRoute: SemanticRouteResult = {
    intent: intent("daily_improvement_diagnosis"),
    problem_rewrite: rewrite(question),
    diagnostic_module: "daily_improvement_diagnosis",
    methodology_ids: ["one-lesson-three-levels"],
    methodology_reason: "真实问题是大班额差异化任务入口。",
  };
  const result = selectHanMethodology({
    question,
    intent: semanticRoute.intent,
    rewrite: semanticRoute.problem_rewrite!,
    semanticRoute,
    maxMethods: 2,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["one-lesson-three-levels"],
    "should use semantic method id",
  );
});

Deno.test("current methodology catalog has one master, two structural dimensions, and three foundations", () => {
  assertEquals(
    hanCourseMethodCards.length,
    35,
    "should expose 35 current cards",
  );
  assertEquals(
    hanCourseMethodCards.slice(0, 3).map((card) => card.id),
    [
      "lesson-preparation-design-master",
      "teaching-design-six-elements",
      "teaching-foundations-three-domains",
    ],
    "should lead with the current methodology hierarchy",
  );
});

Deno.test("all method-card relationships point to current cards", () => {
  const ids = new Set(hanCourseMethodCards.map((card) => card.id));
  const invalid = hanCourseMethodCards.flatMap((card) =>
    card.related.filter((relatedId) => !ids.has(relatedId)).map((relatedId) =>
      `${card.id}->${relatedId}`
    )
  );
  assertEquals(invalid, [], "should not retain removed or unknown card ids");
});

Deno.test("database method cards can add and disable runtime cards", () => {
  const customRow: HanMethodCardConfigRow = {
    id: "custom-classroom-transition",
    name: "课堂过渡三问",
    aliases: ["课堂过渡"],
    course: "后台新增课程",
    kind: "method",
    ownership: "han_course",
    priority: 88,
    summary: "用目标、动作和证据三问检查课堂过渡。",
    use_when: ["课堂环节衔接混乱"],
    avoid_when: [],
    core_judgement: "过渡不是串词，而是学习任务关系。",
    moves: ["检查前一任务证据", "说明下一任务目的"],
    answer_focus: "只处理最早断裂的过渡。",
    query_terms: ["环节衔接"],
    intents: ["teaching_design"],
    related: [],
    source_refs: [],
    enabled: true,
    is_deleted: false,
  };
  const disabledDefault: HanMethodCardConfigRow = {
    ...customRow,
    ...configRowForDefault("review-four-stages"),
    enabled: false,
  };
  const cards = mergeHanMethodCards([customRow, disabledDefault]);
  assertEquals(
    cards.some((card) => card.id === "custom-classroom-transition"),
    true,
    "should add database-created cards",
  );
  assertEquals(
    cards.some((card) => card.id === "review-four-stages"),
    false,
    "should remove disabled default cards from runtime",
  );
});

Deno.test("semantic routing can select an admin-created method card", () => {
  const custom = {
    ...hanCourseMethodCards[0],
    id: "custom-classroom-transition",
    name: "课堂过渡三问",
    course: "后台新增课程",
  };
  const question = "我的课堂环节之间衔接很乱。";
  const semanticRoute: SemanticRouteResult = {
    intent: intent("daily_improvement_design"),
    problem_rewrite: rewrite(question),
    methodology_ids: [custom.id],
    methodology_reason: "需要处理课堂任务之间的过渡关系。",
  };
  const result = selectHanMethodology({
    question,
    intent: semanticRoute.intent,
    rewrite: semanticRoute.problem_rewrite!,
    semanticRoute,
    methodCards: [custom],
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    [custom.id],
    "should use database-created method id",
  );
});

Deno.test("semantic route can select the teaching design six-element framework", () => {
  const question = "我听了很多课，但不知道怎样按一套教学设计框架拆解和迁移。";
  const semanticRoute: SemanticRouteResult = {
    intent: intent("daily_improvement_diagnosis"),
    problem_rewrite: rewrite(question),
    diagnostic_module: "daily_improvement_diagnosis",
    methodology_ids: ["teaching-design-six-elements"],
    methodology_reason: "需要沿六个设计要素定位关系。",
  };
  const result = selectHanMethodology({
    question,
    intent: semanticRoute.intent,
    rewrite: semanticRoute.problem_rewrite!,
    semanticRoute,
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["teaching-design-six-elements"],
    "should use current six-element structure",
  );
});

Deno.test("fallback can locate the three foundational domains", () => {
  const question = "学习科学、教学科学和教育哲学分别在回答什么问题？";
  const result = selectHanMethodology({
    question,
    intent: intent("teaching_concept_qa"),
    rewrite: rewrite(question),
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["teaching-foundations-three-domains"],
    "should select the three-foundations card",
  );
});

Deno.test("fallback selects review lesson method when semantic route has no method id", () => {
  const question = "复习课总是把教材重新过一遍，学生综合题还是不会。";
  const result = selectHanMethodology({
    question,
    intent: intent("daily_improvement_design"),
    rewrite: rewrite(question),
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["review-four-stages"],
    "should select review method",
  );
});

Deno.test("fallback selects all-student evidence for performative participation", () => {
  const question = "小组讨论很热闹，但只有几个学生在说，课后做题还是不会。";
  const result = selectHanMethodology({
    question,
    intent: intent("daily_improvement_diagnosis"),
    rewrite: rewrite(question),
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["all-student-evidence"],
    "should select participation evidence method",
  );
});

Deno.test("novice standard stays primary and does not expand preparation workflow", () => {
  const question = "我刚入职，每节课都想备得很精彩，结果越来越焦虑。";
  const result = selectHanMethodology({
    question,
    intent: intent("teaching_concept_qa"),
    rewrite: rewrite(question),
    maxMethods: 1,
  });
  assertEquals(
    result.cards.map((card) => card.id),
    ["novice-minimum-standard"],
    "should lower novice standard first",
  );
});

Deno.test("unmatched question does not invent a course method", () => {
  const question = "学校明天几点放学？";
  const result = selectHanMethodology({
    question,
    intent: intent("unknown"),
    rewrite: rewrite(question),
    maxMethods: 1,
  });
  assertEquals(result.cards, [], "should return no method card");
});

Deno.test("methodMax zero keeps methodology retrieval disabled", () => {
  const question = "复习课只是把教材重新讲一遍。";
  const result = selectHanMethodology({
    question,
    intent: intent("daily_improvement_design"),
    rewrite: rewrite(question),
    maxMethods: 0,
  });
  assertEquals(result.cards, [], "should honor disabled method retrieval");
});

function configRowForDefault(id: string): HanMethodCardConfigRow {
  const card = hanCourseMethodCards.find((item) => item.id === id);
  if (!card) throw new Error(`missing default method card: ${id}`);
  return {
    id: card.id,
    name: card.name,
    aliases: card.aliases,
    course: card.course,
    kind: card.kind,
    ownership: card.ownership,
    priority: card.priority,
    summary: card.summary,
    use_when: card.useWhen,
    avoid_when: card.avoidWhen,
    core_judgement: card.coreJudgement,
    moves: card.moves,
    answer_focus: card.answerFocus,
    query_terms: card.queryTerms,
    intents: card.intents,
    related: card.related,
    source_refs: card.sourceRefs,
    enabled: true,
    is_deleted: false,
  };
}
