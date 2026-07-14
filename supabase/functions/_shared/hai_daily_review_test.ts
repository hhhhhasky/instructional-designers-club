import {
  calculateAbGate,
  explicitDateWindow,
  normalizeEvaluation,
  previousShanghaiDayWindow,
  validateCandidate,
} from "./hai_daily_review.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("previousShanghaiDayWindow 使用北京时间前一自然日", () => {
  assertEquals(previousShanghaiDayWindow(new Date("2026-07-14T16:05:00.000Z")), {
    runDate: "2026-07-14",
    startIso: "2026-07-14T00:00:00+08:00",
    endIso: "2026-07-14T23:59:59.999+08:00",
  });
  assertEquals(explicitDateWindow("2026-07-13").runDate, "2026-07-13");
});

Deno.test("点踩会压低总分并判为不通过", () => {
  const result = normalizeEvaluation({
    message_id: "m1",
    scores: {
      intent: 95,
      teaching_judgment: 95,
      actionability: 95,
      factual_boundary: 95,
      style: 95,
      brevity: 95,
    },
    problems: [],
    summary: "模型认为很好",
    target_layer: "style_pack",
  }, 80, "down");
  assertEquals(result?.total_score, 59);
  assertEquals(result?.passed, false);
});

Deno.test("只有低风险 style_pack 候选可自动发布", () => {
  const current = "当前风格规则。".repeat(30);
  const candidate = {
    key: "style_pack",
    proposed_content: `${current}\n新增一条针对稳定失败模式的短规则。`,
    reason: "连续三条样本出现同一问题",
    risk: "low" as const,
    evidence_message_ids: ["m1", "m2", "m3"],
  };
  assertEquals(validateCandidate(candidate, current).autoPublishable, true);
  assertEquals(validateCandidate({ ...candidate, key: "safety_boundaries" }, current).autoPublishable, false);
});

Deno.test("A/B 门禁要求提分且无维度回退", () => {
  const make = (id: string, score: number) => normalizeEvaluation({
    message_id: id,
    scores: {
      intent: score,
      teaching_judgment: score,
      actionability: score,
      factual_boundary: score,
      style: score,
      brevity: score,
    },
    problems: [],
    summary: "",
    target_layer: "style_pack",
  }, 80)!;
  assertEquals(calculateAbGate({
    baseline: [make("b1", 70), make("b2", 72)],
    candidate: [make("c1", 80), make("c2", 82)],
    minimumImprovement: 4,
  }).passed, true);
});
