import { classifyIntent } from "./intent_classifier.ts";

function assertRoute(
  question: string,
  expected: {
    intent: string;
    scene: string;
    goal: string;
    depth: string;
  },
) {
  const actual = classifyIntent(question);
  const comparable = {
    intent: actual.primary_intent,
    scene: actual.scene,
    goal: actual.user_goal,
    depth: actual.support_depth,
  };
  if (JSON.stringify(comparable) !== JSON.stringify(expected)) {
    throw new Error(
      `${question}\nexpected=${JSON.stringify(expected)}\nactual=${
        JSON.stringify(comparable)
      }`,
    );
  }
}

Deno.test("intent fallback separates scene, goal, and support depth", () => {
  assertRoute("这是我的公开课教案，活动很多但主线不清，你帮我看看怎么改。", {
    intent: "showcase_lesson_diagnosis",
    scene: "public_lesson",
    goal: "diagnosis",
    depth: "advice",
  });
  assertRoute("我要参加说课比赛，但现在完全没思路，先给我一个结构框架。", {
    intent: "showcase_lesson_design",
    scene: "lesson_presentation",
    goal: "design_support",
    depth: "ideas",
  });
  assertRoute("复习课我现在就是重新讲教材，学生综合题还是不会，怎么改？", {
    intent: "daily_improvement_diagnosis",
    scene: "review_lesson",
    goal: "diagnosis",
    depth: "advice",
  });
  assertRoute("明天要上复习课，我完全不知道怎么设计，给我一个局部示范。", {
    intent: "daily_improvement_design",
    scene: "review_lesson",
    goal: "design_support",
    depth: "demonstration",
  });
  assertRoute("形成性评价和总结性评价有什么区别？", {
    intent: "teaching_concept_qa",
    scene: "general_teaching",
    goal: "concept_qa",
    depth: "advice",
  });
  assertRoute("学校明天几点放学？", {
    intent: "unknown",
    scene: "unclear",
    goal: "unclear",
    depth: "advice",
  });
});

Deno.test("demonstration depth keeps the local-only delivery boundary", () => {
  const result = classifyIntent(
    "我的说课开头不够清楚，你帮我示范改写一段。",
  );
  if (
    result.primary_intent !== "showcase_lesson_diagnosis" ||
    result.support_depth !== "demonstration"
  ) {
    throw new Error(JSON.stringify(result));
  }
  if (!result.explicit_need.includes("不得代写完整交付物")) {
    throw new Error(result.explicit_need);
  }

  const fullDraftRequest = classifyIntent("帮我写一份完整说课稿。");
  if (
    fullDraftRequest.primary_intent !== "showcase_lesson_design" ||
    fullDraftRequest.support_depth !== "demonstration"
  ) {
    throw new Error(JSON.stringify(fullDraftRequest));
  }
});
