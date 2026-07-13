import { selectHanMethodology } from "./methodology_router.ts";
import { hanCourseMethodCards } from "./knowledge/method_bank/han_course_method_cards.ts";
import type {
  IntentName,
  IntentResult,
  ProblemRewrite,
  SemanticRouteResult,
} from "./types.ts";

function intent(primary_intent: IntentName): IntentResult {
  return {
    primary_intent,
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
    intent: intent("learning_profile"),
    problem_rewrite: rewrite(question),
    diagnostic_module: "learning_profile",
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

Deno.test("semantic route can select the teaching design six-element framework", () => {
  const question = "我听了很多课，但不知道怎样按一套教学设计框架拆解和迁移。";
  const semanticRoute: SemanticRouteResult = {
    intent: intent("lesson_plan_diagnosis"),
    problem_rewrite: rewrite(question),
    diagnostic_module: "lesson_plan_diagnosis",
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
    intent: intent("general_question"),
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
    intent: intent("teaching_design"),
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
    intent: intent("learning_motivation"),
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
    intent: intent("teacher_growth"),
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
    intent: intent("teaching_design"),
    rewrite: rewrite(question),
    maxMethods: 0,
  });
  assertEquals(result.cards, [], "should honor disabled method retrieval");
});
