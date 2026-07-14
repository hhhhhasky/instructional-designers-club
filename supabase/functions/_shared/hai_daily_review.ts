export const DAILY_REVIEW_TIME_ZONE = "Asia/Shanghai";

export const REVIEW_DIMENSIONS = [
  "intent",
  "teaching_judgment",
  "actionability",
  "factual_boundary",
  "style",
  "brevity",
] as const;

export type ReviewDimension = typeof REVIEW_DIMENSIONS[number];

export type DailyReviewScores = Record<ReviewDimension, number>;

export type DailyReviewEvaluation = {
  message_id: string;
  scores: DailyReviewScores;
  total_score: number;
  passed: boolean;
  problems: string[];
  summary: string;
  target_layer: string;
};

export type PromptCandidate = {
  key: string;
  proposed_content: string;
  reason: string;
  risk: "low" | "medium" | "high";
  evidence_message_ids: string[];
};

export type ReviewWindow = {
  runDate: string;
  startIso: string;
  endIso: string;
};

const WEIGHTS: DailyReviewScores = {
  intent: 0.25,
  teaching_judgment: 0.30,
  actionability: 0.15,
  factual_boundary: 0.15,
  style: 0.10,
  brevity: 0.05,
};

// R12/R13 当前实际注入链路里，只有 style_pack 是低风险、热生效且不改变
// 身份/事实边界/语义路由的层。其余层可以生成候选，但必须人工审核。
export const AUTO_PUBLISH_PROMPT_KEYS = new Set(["style_pack"]);

export function previousShanghaiDayWindow(now = new Date()): ReviewWindow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_REVIEW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const todayUtc = Date.UTC(year, month - 1, day);
  const previous = new Date(todayUtc - 24 * 60 * 60 * 1000);
  const runDate = previous.toISOString().slice(0, 10);
  return {
    runDate,
    startIso: `${runDate}T00:00:00+08:00`,
    endIso: `${runDate}T23:59:59.999+08:00`,
  };
}

export function explicitDateWindow(runDate: string): ReviewWindow {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error("runDate 必须是 YYYY-MM-DD。");
  }
  return {
    runDate,
    startIso: `${runDate}T00:00:00+08:00`,
    endIso: `${runDate}T23:59:59.999+08:00`,
  };
}

export function normalizeEvaluation(
  value: unknown,
  passScore: number,
  feedback?: "up" | "down" | null,
): DailyReviewEvaluation | null {
  const record = asRecord(value);
  const messageId = text(record.message_id);
  if (!messageId) return null;

  const rawScores = asRecord(record.scores);
  const scores = Object.fromEntries(
    REVIEW_DIMENSIONS.map((dimension) => [dimension, clampScore(rawScores[dimension])]),
  ) as DailyReviewScores;
  let totalScore = weightedScore(scores);

  // 用户点踩优先级高于模型自评；点赞保留原分，避免掩盖评价器发现的问题。
  if (feedback === "down") totalScore = Math.min(totalScore, 59);
  if (scores.intent < 60 || scores.teaching_judgment < 60) {
    totalScore = Math.min(totalScore, 60);
  }
  if (scores.factual_boundary < 60) totalScore = Math.min(totalScore, 55);

  return {
    message_id: messageId,
    scores,
    total_score: round(totalScore),
    passed: totalScore >= passScore && feedback !== "down",
    problems: stringArray(record.problems).slice(0, 5),
    summary: text(record.summary) || "未提供评价摘要。",
    target_layer: text(record.target_layer) || "unknown",
  };
}

export function normalizeCandidate(value: unknown): PromptCandidate | null {
  const record = asRecord(value);
  const key = text(record.key);
  const proposedContent = text(record.proposed_content);
  if (!key || !proposedContent) return null;
  const riskValue = text(record.risk);
  const risk: PromptCandidate["risk"] = riskValue === "low" || riskValue === "medium"
    ? riskValue
    : "high";
  return {
    key,
    proposed_content: proposedContent,
    reason: text(record.reason) || "根据每日低分样本生成。",
    risk,
    evidence_message_ids: stringArray(record.evidence_message_ids).slice(0, 20),
  };
}

export function validateCandidate(
  candidate: PromptCandidate,
  currentContent: string,
): { valid: boolean; autoPublishable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const proposed = candidate.proposed_content.trim();
  const current = currentContent.trim();
  if (!current) reasons.push("当前配置为空，不能自动覆盖。");
  if (proposed.length < 80) reasons.push("候选内容过短，可能丢失原有约束。");
  if (proposed.length > Math.max(600, current.length * 1.25)) {
    reasons.push("候选内容膨胀超过 25%。");
  }
  if (proposed === current) reasons.push("候选与当前配置相同。");
  if (/api[ _-]?key|service[_ -]?role|系统提示词全文|忽略.{0,8}(?:规则|指令)/i.test(proposed)) {
    reasons.push("候选包含敏感实现词或提示词注入模式。");
  }
  const valid = reasons.length === 0;
  return {
    valid,
    autoPublishable: valid && candidate.risk === "low" && AUTO_PUBLISH_PROMPT_KEYS.has(candidate.key),
    reasons,
  };
}

export function summarizeEvaluations(evaluations: DailyReviewEvaluation[]) {
  const count = evaluations.length;
  const dimensionScores = Object.fromEntries(REVIEW_DIMENSIONS.map((dimension) => [
    dimension,
    round(average(evaluations.map((item) => item.scores[dimension]))),
  ]));
  return {
    averageScore: round(average(evaluations.map((item) => item.total_score))),
    passRate: count > 0 ? round(evaluations.filter((item) => item.passed).length / count, 4) : 0,
    lowScoreCount: evaluations.filter((item) => !item.passed).length,
    dimensionScores,
  };
}

export function calculateAbGate(params: {
  baseline: DailyReviewEvaluation[];
  candidate: DailyReviewEvaluation[];
  minimumImprovement: number;
}) {
  const baseline = summarizeEvaluations(params.baseline);
  const candidate = summarizeEvaluations(params.candidate);
  const improvement = round(candidate.averageScore - baseline.averageScore);
  const regressedDimensions = REVIEW_DIMENSIONS.filter((dimension) =>
    Number(candidate.dimensionScores[dimension]) < Number(baseline.dimensionScores[dimension]) - 2
  );
  return {
    passed: improvement >= params.minimumImprovement &&
      candidate.passRate >= baseline.passRate && regressedDimensions.length === 0,
    improvement,
    baseline,
    candidate,
    regressedDimensions,
  };
}

function weightedScore(scores: DailyReviewScores) {
  return REVIEW_DIMENSIONS.reduce((total, dimension) => total + scores[dimension] * WEIGHTS[dimension], 0);
}

function clampScore(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
