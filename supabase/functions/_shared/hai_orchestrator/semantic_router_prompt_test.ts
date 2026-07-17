import { estimateTokens } from "../hai.ts";
import { classifyIntent } from "./intent_classifier.ts";
import {
  hanCourseMethodCards,
  selectHanMethodCandidatesForRouter,
} from "./knowledge/method_bank/han_course_method_cards.ts";
import { buildSemanticRouterPrompt } from "./semantic_router_prompt.ts";

const cases = [
  ["备课步骤和教案里的设计要素到底是什么关系？", [
    "lesson-preparation-design-master",
  ]],
  ["我听了很多优质课，但不知道怎样用一套教学设计框架拆解和迁移。", [
    "teaching-design-six-elements",
  ]],
  ["学习科学、教学科学和教育哲学分别在回答什么问题？", [
    "teaching-foundations-three-domains",
  ]],
  ["我刚入职，每节课都想备得很精彩，结果压力特别大。", [
    "novice-minimum-standard",
  ]],
  ["我总是先做课件，教案一改课件就跟着返工，备一节课要很久。", [
    "lesson-preparation-workflow",
  ]],
  ["我的目标写的是理解课文内容、培养核心素养，这样合格吗？", [
    "target-quality-three-checks",
  ]],
  ["学情分析总写学生基础薄弱，但写完也不知道课堂怎么调整。", [
    "insight-quality-spectrum",
  ]],
  ["我的教案活动很多，但不知道这些活动是否真的服务目标。", [
    "backward-design",
    "design-logic-chain",
  ]],
  ["我一节课问了几十个问题，学生都能答，但总觉得思考不深入。", [
    "question-chain",
  ]],
  ["任务情境写成请同学们制作一份海报，学生还是不知道具体要做什么。", [
    "task-script-five-elements",
  ]],
  ["复习课就是把教材重新过一遍，学生碰到综合题还是乱。", [
    "review-four-stages",
  ]],
  ["试卷讲评我从第一题一直讲到最后一题，下一次学生还是错。", [
    "exam-review-four-steps",
  ]],
  ["一个班差异太大，讲快了有人跟不上，讲慢了优生又无聊。", [
    "one-lesson-three-levels",
  ]],
  ["小组讨论很热闹，但总是几个人在说，其他人课后还是不会。", [
    "all-student-evidence",
  ]],
  ["学生会背概念定义，但换一个例子就不会判断。", ["concept-induction"]],
] as const;

Deno.test("compact router recall includes the expected method for 15 teaching cases", () => {
  for (const [question, expected] of cases) {
    const candidates = selectHanMethodCandidatesForRouter(
      question,
      classifyIntent(question),
      6,
    ).map((card) => card.id);
    if (!expected.some((id) => candidates.includes(id))) {
      throw new Error(
        `missing candidate for ${question}\nexpected=${
          expected.join("|")
        }\nactual=${candidates.join("|")}`,
      );
    }
  }
});

Deno.test("non-teaching question does not receive a detailed method candidate", () => {
  const question = "学校明天几点放学？";
  const candidates = selectHanMethodCandidatesForRouter(
    question,
    classifyIntent(question),
    6,
  );
  if (candidates.length !== 0) {
    throw new Error(candidates.map((card) => card.id).join("|"));
  }
});

Deno.test("compact semantic router stays below 2600 estimated tokens", () => {
  for (const [question] of [...cases, ["学校明天几点放学？", []] as const]) {
    const prompt = buildSemanticRouterPrompt({
      question,
      fallbackIntent: classifyIntent(question),
    });
    const tokens = estimateTokens(prompt);
    if (tokens > 2600) {
      throw new Error(
        `router prompt too long: ${tokens} tokens for ${question}`,
      );
    }
  }
});

Deno.test("admin semantic router policy is injected into the active prompt", () => {
  const marker = "ADMIN_EDITABLE_ROUTER_POLICY";
  const prompt = buildSemanticRouterPrompt({
    question: "公开课已有教案，请帮我看看哪里需要修改。",
    fallbackIntent: classifyIntent(
      "公开课已有教案，请帮我看看哪里需要修改。",
    ),
    policyPrompt: marker,
  });
  if (!prompt.includes(marker)) {
    throw new Error("editable semantic router policy was not injected");
  }
  if (!prompt.includes("showcase_lesson_diagnosis")) {
    throw new Error("code-owned intent contract should remain in the prompt");
  }
});

Deno.test("admin-created diagnostic modules enter the router catalog", () => {
  const prompt = buildSemanticRouterPrompt({
    question: "学生总是打断课堂，我应该怎么处理？",
    fallbackIntent: classifyIntent("学生总是打断课堂，我应该怎么处理？"),
    diagnosticModules: ["classroom_management"],
    diagnosticModuleCatalog: "classroom_management｜模块：课堂管理与任务秩序",
  });
  if (!prompt.includes("classroom_management")) {
    throw new Error("dynamic diagnostic module id was not included");
  }
  if (!prompt.includes("课堂管理与任务秩序")) {
    throw new Error("dynamic diagnostic module catalog was not included");
  }
});

Deno.test("admin-created method cards enter the router index and candidates", () => {
  const methodCards = [{
    ...hanCourseMethodCards[0],
    id: "custom-classroom-transition",
    name: "课堂过渡三问",
    summary: "检查课堂环节之间的学习任务关系。",
    queryTerms: ["课堂过渡", "环节衔接"],
    useWhen: ["课堂环节衔接混乱"],
  }];
  const prompt = buildSemanticRouterPrompt({
    question: "我的课堂环节衔接很乱，应该怎么调整？",
    fallbackIntent: classifyIntent("我的课堂环节衔接很乱，应该怎么调整？"),
    methodCards,
  });
  if (!prompt.includes("custom-classroom-transition｜课堂过渡三问")) {
    throw new Error("dynamic method card was not included in router index");
  }
  if (!prompt.includes("检查课堂环节之间的学习任务关系")) {
    throw new Error(
      "dynamic method card was not included in router candidates",
    );
  }
});
