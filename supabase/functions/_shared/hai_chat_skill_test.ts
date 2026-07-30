import {
  buildHaiChatSkillSystemPrompt,
  buildHaiChatSkillTrace,
  type HaiChatSkillRuntime,
  normalizeHaiChatSkillReferenceConfig,
  selectHaiChatSkillMethodCards,
  selectHaiChatSkillReferences,
} from "./hai_chat_skill.ts";
import { classifyIntent } from "./hai_chat/intent_classifier.ts";
import { hanCourseMethodCards } from "./hai_chat/method_cards.ts";

const skill: HaiChatSkillRuntime = {
  skill_id: "skill-1",
  skill_slug: "hai-consultation",
  skill_name: "哈老师备课答疑",
  skill_description: "教学咨询答疑",
  source_path: "/Users/apple/.shared-skills/hai-consultation/SKILL.md",
  version_id: "version-1",
  version_label: "v1",
  snapshot_hash: "snapshot-hash-1",
  instructions: "先判断场景，再澄清、重构问题、选择方法，最后提出具体小追问。",
  reference_config: normalizeHaiChatSkillReferenceConfig({
    include_method_index: true,
    method_card_limit: 6,
    memory_enabled: true,
    max_reference_count: 4,
    max_reference_chars: 12000,
  }),
  references: [{
    id: "reference-1",
    path: "references/question-chain.md",
    name: "问题链参考",
    description: "公开课提问与问题链设计",
    media_type: "text/markdown",
    content: "问题链要从可测目标出发，并预判学生最可能卡住的位置。",
    content_hash: "hash-1",
    load_mode: "on_demand",
    max_chars: 12000,
    sort_order: 10,
  }],
};

Deno.test("chat skill prompt loads published instructions, method cards and memories", () => {
  const question = "公开课的问题链很多，但学生思考不深入，应该怎么改？";
  const intent = classifyIntent(question);
  const prompt = buildHaiChatSkillSystemPrompt({
    moduleName: "问问哈老师",
    question,
    skill,
    intent,
    methodCards: hanCourseMethodCards,
    memories: [{
      category: "teaching_preference",
      content: "希望先澄清再建议",
    }],
  });

  if (!prompt.includes("当前加载 Skill：哈老师备课答疑")) {
    throw new Error("skill identity was not loaded");
  }
  if (!prompt.includes(skill.instructions)) {
    throw new Error("published skill instructions were not loaded");
  }
  if (!prompt.includes("question-chain")) {
    throw new Error("relevant method card was not loaded");
  }
  if (!prompt.includes("问题链要从可测目标出发")) {
    throw new Error("relevant versioned reference was not loaded");
  }
  if (!prompt.includes("希望先澄清再建议")) {
    throw new Error("relevant user memory was not loaded");
  }
  if (!prompt.includes("不得猜测")) {
    throw new Error("platform safety boundary was not loaded");
  }
  if (!prompt.includes("当前消息已经包含具体教学问题") || !prompt.includes("只有当用户没有提出具体问题")) {
    throw new Error("opening behavior rules were not loaded");
  }
});

Deno.test("chat skill reference config is bounded and supports opt-outs", () => {
  const config = normalizeHaiChatSkillReferenceConfig({
    include_method_index: false,
    method_card_limit: 99,
    memory_enabled: false,
    max_reference_count: 99,
    max_reference_chars: 999999,
  });
  if (config.include_method_index !== false) {
    throw new Error("index opt-out failed");
  }
  if (config.method_card_limit !== 10) {
    throw new Error("method card limit was not bounded");
  }
  if (config.memory_enabled !== false) throw new Error("memory opt-out failed");
  if (config.max_reference_count !== 10) {
    throw new Error("reference count was not bounded");
  }
  if (config.max_reference_chars !== 50000) {
    throw new Error("reference chars were not bounded");
  }
});

Deno.test("chat skill references respect load modes and prompt budgets", () => {
  const references = [
    {
      ...skill.references[0],
      id: "always",
      path: "references/core.md",
      name: "核心规则",
      content: "核心边界",
      content_hash: "core-hash",
      load_mode: "always" as const,
      sort_order: 0,
    },
    skill.references[0],
    {
      ...skill.references[0],
      id: "evaluation",
      path: "references/evaluation.md",
      content: "公开课问题链评估规则",
      content_hash: "evaluation-hash",
      load_mode: "evaluation_only" as const,
      sort_order: 20,
    },
  ];
  const selected = selectHaiChatSkillReferences({
    question: "公开课的问题链怎么设计？",
    references,
    referenceConfig: normalizeHaiChatSkillReferenceConfig({
      max_reference_count: 2,
      max_reference_chars: 1000,
    }),
  });
  if (selected.map((item) => item.id).join(",") !== "always,reference-1") {
    throw new Error("reference load modes or relevance ranking failed");
  }
  if (selected.some((item) => item.id === "evaluation")) {
    throw new Error("evaluation-only reference leaked into user runtime");
  }
});

Deno.test("chat skill trace records the exact published version and selected cards", () => {
  const question = "公开课的问题链很多，但学生思考不深入，应该怎么改？";
  const trace = buildHaiChatSkillTrace({
    skill,
    question,
    intent: classifyIntent(question),
    methodCards: hanCourseMethodCards,
    memorySelection: {
      should_load_memory: false,
      memory_types: [],
      reason: "test",
    },
    memoryLoaded: false,
    evaluation: null,
  });
  if (
    trace.trace_version !== 2 || trace.mode !== "skill" ||
    trace.skill.version.id !== "version-1" ||
    trace.skill.version.snapshot_hash !== "snapshot-hash-1"
  ) {
    throw new Error("skill version trace is incomplete");
  }
  if (trace.method_card_ids.length === 0) {
    throw new Error("skill trace did not record method card selection");
  }
  if (
    !trace.references.some((reference) =>
      reference.path === "references/question-chain.md"
    )
  ) {
    throw new Error("skill trace did not record selected references");
  }
});

Deno.test("method card fallback uses diagnostic module defaults when no keyword hit", () => {
  // 空问题 → 零 bigram、零术语命中，强制走诊断模块兜底，隔离测试兜底映射本身。
  const noopIntent = classifyIntent("");

  const showcase = selectHaiChatSkillMethodCards({
    question: "",
    intent: noopIntent,
    methodCards: hanCourseMethodCards,
    referenceConfig: skill.reference_config,
    diagnosticModule: "showcase_lesson_diagnosis",
  });
  if (
    showcase.map((c) => c.id).join(",") !==
    "design-logic-chain,public-lesson-highlight"
  ) {
    throw new Error(
      `showcase fallback wrong: ${showcase.map((c) => c.id).join(",")}`,
    );
  }

  const concept = selectHaiChatSkillMethodCards({
    question: "",
    intent: noopIntent,
    methodCards: hanCourseMethodCards,
    referenceConfig: skill.reference_config,
    diagnosticModule: "teaching_concept_qa",
  });
  if (concept.length !== 0) {
    throw new Error(
      `concept_qa should not bind default cards: ${concept.map((c) => c.id).join(",")}`,
    );
  }

  const daily = selectHaiChatSkillMethodCards({
    question: "",
    intent: noopIntent,
    methodCards: hanCourseMethodCards,
    referenceConfig: skill.reference_config,
    diagnosticModule: "daily_improvement_diagnosis",
  });
  if (daily.map((c) => c.id).join(",") !== "three-question-pretest-errors") {
    throw new Error(
      `daily diagnosis fallback wrong: ${daily.map((c) => c.id).join(",")}`,
    );
  }
});

Deno.test("method card keyword hit takes precedence over diagnostic fallback", () => {
  const question = "公开课的问题链怎么设计？";
  const hit = selectHaiChatSkillMethodCards({
    question,
    intent: classifyIntent(question),
    methodCards: hanCourseMethodCards,
    referenceConfig: skill.reference_config,
    diagnosticModule: "daily_improvement_diagnosis",
  });
  if (!hit.some((c) => c.id === "question-chain")) {
    throw new Error(
      `keyword hit should win over fallback: ${hit.map((c) => c.id).join(",")}`,
    );
  }
});

Deno.test("chat skill prompt injects diagnostic module and framework", () => {
  const question = "复习课我重新讲教材学生还是不会，怎么改？";
  const prompt = buildHaiChatSkillSystemPrompt({
    moduleName: "问问哈老师",
    question,
    skill,
    intent: classifyIntent(question),
    methodCards: hanCourseMethodCards,
    memories: [],
    diagnosticModule: "daily_improvement_diagnosis",
    diagnosticFramework:
      "模块：日常提分诊断\n适用：用户已经有日常课做法但学习效果不理想。",
  });
  if (!prompt.includes("本轮诊断模块｜daily_improvement_diagnosis")) {
    throw new Error("diagnostic module label missing in prompt");
  }
  if (!prompt.includes("模块：日常提分诊断")) {
    throw new Error("diagnostic framework text missing in prompt");
  }
});
