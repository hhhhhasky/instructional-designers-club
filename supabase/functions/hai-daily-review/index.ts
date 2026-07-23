import {
  type ChatMessage,
  createAdminClient,
  jsonResponse,
  normalizeRecord,
  requireUser,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  calculateAbGate,
  type DailyReviewEvaluation,
  explicitDateWindow,
  normalizeCandidate,
  normalizeEvaluation,
  previousShanghaiDayWindow,
  type PromptCandidate,
  REVIEW_DIMENSIONS,
  type ReviewWindow,
  summarizeEvaluations,
  validateCandidate,
} from "../_shared/hai_daily_review.ts";

type MessageRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type FeedbackRow = {
  message_id: string;
  rating: "up" | "down";
  reason: string | null;
};

type PromptConfigRow = {
  key: string;
  label: string;
  content: string;
  enabled: boolean;
  updated_at: string;
};

type ReviewTurn = {
  message_id: string;
  created_at: string;
  question: string;
  answer: string;
  trace: Record<string, unknown>;
  feedback: FeedbackRow | null;
};

type DailyReviewSettings = {
  enabled: boolean;
  autoPublishMode: "gated" | "review_only";
  passScore: number;
  minTurnsForPublish: number;
  minLowScoreTurns: number;
  minAbImprovement: number;
  maxTurns: number;
};

const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") {
    return jsonResponse({ message: "只支持 POST。" }, 405);
  }

  const admin = createAdminClient();
  let window = previousShanghaiDayWindow();
  let authorized = false;
  let reviewRunAttempt = false;
  try {
    await authorize(request);
    authorized = true;
    const body = normalizeRecord(await request.json().catch(() => ({})));
    if (body.action === "rollback") {
      if (typeof body.runDate !== "string") {
        throw new Error("回滚必须提供 runDate。");
      }
      const rollback = await rollbackDailyReview(admin, body.runDate);
      return jsonResponse({ ok: true, ...rollback });
    }
    const force = body.force === true;
    window = typeof body.runDate === "string"
      ? explicitDateWindow(body.runDate)
      : previousShanghaiDayWindow();
    const existing = await loadExistingRun(admin, window.runDate);
    if (
      !force && existing &&
      ["running", "completed", "skipped"].includes(String(existing.status))
    ) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "该日期已复盘。",
        run: existing,
      });
    }

    const settings = await loadSettings(admin);
    if (!settings.enabled && !force) {
      await writeRun(admin, window, {
        status: "skipped",
        note: "daily_review.enabled=false，已跳过。",
        completed_at: new Date().toISOString(),
      });
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "每日复盘已关闭。",
      });
    }

    await writeRun(admin, window, {
      status: "running",
      started_at: new Date().toISOString(),
      error_message: null,
    });
    reviewRunAttempt = true;

    const result = await runDailyReview(admin, window, settings);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (authorized && reviewRunAttempt) {
      await writeRun(admin, window, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
        note: "每日复盘执行失败；线上 Prompt 未改动。",
      }).catch(() => undefined);
    }
    console.error("hai daily review failed", error);
    return jsonResponse({ message }, 500);
  }
});

async function rollbackDailyReview(
  _admin: ReturnType<typeof createAdminClient>,
  _runDate: string,
): Promise<Record<string, unknown>> {
  throw new Error("Prompt 自动发布链路已退役，历史复盘不再支持配置回滚。");
}

async function runDailyReview(
  admin: ReturnType<typeof createAdminClient>,
  window: ReviewWindow,
  settings: DailyReviewSettings,
) {
  const turns = await loadTurns(admin, window, settings.maxTurns);
  const feedbackCounts = {
    positive: turns.filter((turn) => turn.feedback?.rating === "up").length,
    negative: turns.filter((turn) => turn.feedback?.rating === "down").length,
  };

  if (turns.length === 0) {
    await writeRun(admin, window, {
      status: "skipped",
      turns_evaluated: 0,
      positive_feedback_count: feedbackCounts.positive,
      negative_feedback_count: feedbackCounts.negative,
      note: "该自然日没有可复盘的 HAI assistant trace。",
      completed_at: new Date().toISOString(),
    });
    return {
      skipped: true,
      reason: "没有可复盘的对话。",
      runDate: window.runDate,
    };
  }

  const evaluations = await evaluateTurns(turns, settings.passScore);
  const evaluationSummary = summarizeEvaluations(evaluations);
  const lowEvaluations = evaluations.filter((item) => !item.passed);
  // Prompt 发布与上下文编排已退役；每日复盘只保留质量审计和人工建议，
  // 不再读取或自动改写运行时 Prompt 配置。
  const promptConfigs: PromptConfigRow[] = [];
  const snapshotBefore: Record<string, unknown> = {};
  const candidates = lowEvaluations.length >= settings.minLowScoreTurns
    ? await proposeCandidates(turns, lowEvaluations, promptConfigs)
    : [];
  const candidateResults = candidates.map((candidate) => ({
    ...candidate,
    validation: validateCandidate(candidate, ""),
  }));
  const changesApplied: Array<Record<string, unknown>> = [];
  const changesPending = candidates.map((candidate) => ({
    ...candidate,
    gate_reasons: ["Prompt 自动发布链路已退役，仅保留人工复盘建议。"],
  }));
  const promptConfigsAfter = promptConfigs;

  const issueRows = lowEvaluations.map((item) => ({
    dimension: weakestDimension(item),
    severity: item.total_score < 60
      ? "high"
      : item.total_score < 75
      ? "medium"
      : "low",
    turn_id: item.message_id,
    summary: item.summary,
    problems: item.problems,
    target_layer: item.target_layer,
  }));

  await writeRun(admin, window, {
    status: "completed",
    turns_evaluated: turns.length,
    issues_found: issueRows,
    changes_applied: changesApplied,
    changes_pending: changesPending,
    average_score: evaluationSummary.averageScore,
    pass_rate: evaluationSummary.passRate,
    low_score_count: evaluationSummary.lowScoreCount,
    positive_feedback_count: feedbackCounts.positive,
    negative_feedback_count: feedbackCounts.negative,
    dimension_scores: evaluationSummary.dimensionScores,
    report: {
      sample_policy: "点踩优先，其余按时间倒序，最多评估 max_turns 条。",
      pass_score: settings.passScore,
      evaluations,
      candidate_results: candidateResults,
    },
    candidate_changes: candidates,
    config_snapshot_before: snapshotBefore,
    config_snapshot_after: snapshot(promptConfigsAfter),
    publish_mode: changesApplied.length > 0
      ? "gated_auto"
      : candidates.length > 0
      ? "pending"
      : "none",
    note: changesApplied.length > 0
      ? `已通过门禁自动发布 ${changesApplied.length} 处低风险 Prompt 改动。`
      : lowEvaluations.length > 0
      ? "已完成复盘；没有候选通过自动发布门禁，线上配置未改动。"
      : "当日质量达标，无需改动。",
    completed_at: new Date().toISOString(),
    error_message: null,
  });

  return {
    runDate: window.runDate,
    turnsEvaluated: turns.length,
    ...evaluationSummary,
    feedback: feedbackCounts,
    changesApplied,
    changesPending: changesPending.length,
  };
}

async function authorize(request: Request) {
  const configuredSecret = Deno.env.get("HAI_DAILY_REVIEW_SECRET") || "";
  const suppliedSecret = request.headers.get("x-hai-review-secret") || "";
  if (
    configuredSecret && suppliedSecret &&
    timingSafeEqual(configuredSecret, suppliedSecret)
  ) return;

  const auth = await requireUser(request);
  const { data, error } = await auth.admin.from("profiles").select("role").eq(
    "id",
    auth.user.id,
  ).maybeSingle();
  if (error || data?.role !== "admin") {
    throw new Error("仅管理员或定时任务可触发每日复盘。");
  }
}

async function loadTurns(
  admin: ReturnType<typeof createAdminClient>,
  window: ReviewWindow,
  maxTurns: number,
) {
  const { data, error } = await admin
    .from("hai_messages")
    .select("id, content, metadata, created_at")
    .eq("role", "assistant")
    .gte("created_at", window.startIso)
    .lte("created_at", window.endIso)
    .order("created_at", { ascending: false })
    .limit(Math.max(maxTurns * 2, 200));
  if (error) throw error;

  const messages = ((data ?? []) as MessageRow[]).filter((message) =>
    normalizeRecord(message.metadata).hai_context_trace
  );
  if (messages.length === 0) return [];

  const { data: feedbackData, error: feedbackError } = await admin
    .from("hai_message_feedback")
    .select("message_id, rating, reason")
    .in("message_id", messages.map((message) => message.id));
  if (feedbackError) throw feedbackError;
  const feedbackMap = new Map(
    ((feedbackData ?? []) as FeedbackRow[]).map((row) => [row.message_id, row]),
  );

  const turns = messages.map((message): ReviewTurn => {
    const trace = normalizeRecord(
      normalizeRecord(message.metadata).hai_context_trace,
    );
    return {
      message_id: message.id,
      created_at: message.created_at,
      question: String(trace.question || ""),
      answer: message.content,
      trace,
      feedback: feedbackMap.get(message.id) ?? null,
    };
  });
  return turns.sort((a, b) => {
    const feedbackPriority = Number(b.feedback?.rating === "down") -
      Number(a.feedback?.rating === "down");
    return feedbackPriority || b.created_at.localeCompare(a.created_at);
  }).slice(0, maxTurns);
}

async function evaluateTurns(turns: ReviewTurn[], passScore: number) {
  const batches = chunk(turns, 20);
  const results = await Promise.all(batches.map(async (batch) => {
    const prompt = buildEvaluationPrompt(batch, passScore);
    const value = await callJson([
      { role: "system", content: prompt },
      { role: "user", content: "请逐条评分，只输出约定 JSON。" },
    ], 8000);
    const rows = Array.isArray(normalizeRecord(value).evaluations)
      ? normalizeRecord(value).evaluations as unknown[]
      : [];
    return rows.map((row) => {
      const messageId = String(normalizeRecord(row).message_id || "");
      const feedback = batch.find((turn) => turn.message_id === messageId)
        ?.feedback?.rating;
      return normalizeEvaluation(row, passScore, feedback);
    }).filter((item): item is DailyReviewEvaluation => Boolean(item));
  }));
  const evaluations = results.flat();
  if (evaluations.length !== turns.length) {
    throw new Error(
      `评价器返回 ${evaluations.length}/${turns.length} 条，已中止自动发布。`,
    );
  }
  return evaluations;
}

async function proposeCandidates(
  turns: ReviewTurn[],
  evaluations: DailyReviewEvaluation[],
  configs: PromptConfigRow[],
): Promise<PromptCandidate[]> {
  const turnMap = new Map(turns.map((turn) => [turn.message_id, turn]));
  const evidence = evaluations.slice(0, 20).map((evaluation) => ({
    ...evaluation,
    question: turnMap.get(evaluation.message_id)?.question,
    answer: turnMap.get(evaluation.message_id)?.answer,
    feedback: turnMap.get(evaluation.message_id)?.feedback,
  }));
  const editableConfigs = configs.filter((config) =>
    [
      "style_pack",
      "core_identity",
      "semantic_router_prompt",
      "safety_boundaries",
    ].includes(config.key) ||
    config.key.startsWith("diagnostic_module.") ||
    config.key.startsWith("custom_context.")
  );
  const value = await callJson([
    {
      role: "system",
      content: [
        "你负责 HAI 的每日提示词优化。只修复被多条真实低分样本共同证明的稳定失败模式，不为改而改。",
        "最多给 2 个候选；每个必须返回该 key 的完整 proposed_content，不得只给 diff。",
        "必须保留当前有效规则；不得删除事实边界、交付边界或未知就说未知。避免 Prompt 膨胀。",
        "style_pack 可以标 low risk；身份、路由、诊断模块、自定义上下文和安全边界一律标 medium/high，仅待人工审核。",
        '输出 JSON：{"candidates":[{"key":"...","proposed_content":"...","reason":"...","risk":"low|medium|high","evidence_message_ids":["..."]}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: `低分证据：\n${JSON.stringify(evidence)}\n\n当前可编辑配置：\n${
        JSON.stringify(editableConfigs)
      }`,
    },
  ], 10000);
  const rows = Array.isArray(normalizeRecord(value).candidates)
    ? normalizeRecord(value).candidates as unknown[]
    : [];
  return rows.map(normalizeCandidate).filter((item): item is PromptCandidate =>
    Boolean(item)
  ).slice(0, 2);
}

async function runCounterfactualAb(
  turns: ReviewTurn[],
  baselineEvaluations: DailyReviewEvaluation[],
  candidate: PromptCandidate,
  configs: PromptConfigRow[],
  settings: DailyReviewSettings,
) {
  const lowIds = new Set(
    baselineEvaluations.filter((item) => !item.passed).map((item) =>
      item.message_id
    ),
  );
  const sample = turns.filter((turn) => lowIds.has(turn.message_id)).slice(
    0,
    5,
  );
  const promptMap = new Map(
    configs.filter((item) => item.enabled).map((
      item,
    ) => [item.key, item.content]),
  );
  promptMap.set(candidate.key, candidate.proposed_content);

  const answers = await Promise.all(sample.map(async (turn) => {
    const context = {
      intent_result: turn.trace.intent_result,
      problem_rewrite: turn.trace.problem_rewrite,
      diagnostic_module: turn.trace.diagnostic_module,
      methodology_ids: turn.trace.methodology_ids,
    };
    return {
      ...turn,
      feedback: null,
      answer: await callText([
        {
          role: "system",
          content: [
            promptMap.get("core_identity") || "",
            promptMap.get("safety_boundaries") || "",
            `【本轮编排摘要】${JSON.stringify(context)}`,
            `【风格要求】${promptMap.get("style_pack") || ""}`,
            "只输出给教师看的最终回答。",
          ].filter(Boolean).join("\n\n"),
        },
        { role: "user", content: turn.question },
      ], 2400),
    };
  }));
  const candidateEvaluations = await evaluateTurns(answers, settings.passScore);
  const sampleIds = new Set(sample.map((turn) => turn.message_id));
  const baseline = baselineEvaluations.filter((item) =>
    sampleIds.has(item.message_id)
  );
  return calculateAbGate({
    baseline,
    candidate: candidateEvaluations,
    minimumImprovement: settings.minAbImprovement,
  });
}

function buildEvaluationPrompt(turns: ReviewTurn[], passScore: number) {
  return [
    "你是严格的 HAI 教学咨询质量评价器。评价真实回答，不评价提示词写得是否漂亮。",
    "六维各 0-100：intent 真实问题识别；teaching_judgment 专业判断；actionability 可执行抓手；factual_boundary 不编造且边界清楚；style 像哈老师且不讨好套话；brevity 聚焦不冗长。",
    "真正问题识别与教学判断最重要。表层迎合、正确废话、无依据教材事实、代写整套方案应显著扣分。",
    `total_score 由系统重算；passed 以 ${passScore} 为线。用户点踩是强负信号，不能被模型高分覆盖。`,
    "target_layer 只能填 style_pack/core_identity/semantic_router_prompt/diagnostic_module/custom_context/safety_boundaries/code_or_data/unknown。",
    '输出 JSON：{"evaluations":[{"message_id":"...","scores":{"intent":0,"teaching_judgment":0,"actionability":0,"factual_boundary":0,"style":0,"brevity":0},"problems":["..."],"summary":"...","target_layer":"..."}]}',
    `待评价轮次：\n${
      JSON.stringify(turns.map((turn) => ({
        message_id: turn.message_id,
        question: turn.question,
        answer: turn.answer,
        feedback: turn.feedback,
        route: {
          intent_result: turn.trace.intent_result,
          problem_rewrite: turn.trace.problem_rewrite,
          diagnostic_module: turn.trace.diagnostic_module,
        },
      })))
    }`,
  ].join("\n\n");
}

async function callJson(messages: ChatMessage[], maxTokens: number) {
  const text = await callText(messages, maxTokens, "json_object");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("模型没有返回 JSON 对象。");
  return JSON.parse(match[0]);
}

async function callText(
  messages: ChatMessage[],
  maxTokens: number,
  responseFormat: "text" | "json_object" = "text",
) {
  let output = "";
  for await (
    const token of streamDeepSeek(messages, {
      model,
      temperature: 0.1,
      topP: 0.8,
      maxTokens,
      thinkingEnabled: false,
      responseFormat,
    })
  ) output += token;
  return output.trim();
}

async function loadSettings(
  admin: ReturnType<typeof createAdminClient>,
): Promise<DailyReviewSettings> {
  const { data, error } = await admin.from("hai_runtime_settings").select(
    "key, value",
  ).like("key", "daily_review.%");
  if (error) throw error;
  const values = new Map((data ?? []).map((row) => [row.key, row.value]));
  const mode = String(values.get("daily_review.auto_publish_mode") ?? "gated");
  return {
    enabled: Boolean(values.get("daily_review.enabled") ?? true),
    autoPublishMode: mode === "review_only" ? "review_only" : "gated",
    passScore: numberSetting(values, "daily_review.pass_score", 80, 60, 95),
    minTurnsForPublish: numberSetting(
      values,
      "daily_review.min_turns_for_publish",
      10,
      3,
      100,
    ),
    minLowScoreTurns: numberSetting(
      values,
      "daily_review.min_low_score_turns",
      3,
      2,
      20,
    ),
    minAbImprovement: numberSetting(
      values,
      "daily_review.min_ab_improvement",
      4,
      1,
      20,
    ),
    maxTurns: numberSetting(values, "daily_review.max_turns", 200, 10, 500),
  };
}

async function loadExistingRun(
  admin: ReturnType<typeof createAdminClient>,
  runDate: string,
) {
  const { data, error } = await admin.from("hai_optimization_log").select("*")
    .eq("run_date", runDate).maybeSingle();
  if (error) throw error;
  return data;
}

async function writeRun(
  admin: ReturnType<typeof createAdminClient>,
  window: ReviewWindow,
  updates: Record<string, unknown>,
) {
  const { error } = await admin.from("hai_optimization_log").upsert({
    run_date: window.runDate,
    window_start: window.startIso,
    window_end: window.endIso,
    ...updates,
  }, { onConflict: "run_date" });
  if (error) throw error;
}

function snapshot(configs: PromptConfigRow[]) {
  return Object.fromEntries(configs.map((config) => [config.key, {
    content: config.content,
    enabled: config.enabled,
    updated_at: config.updated_at,
  }]));
}

function weakestDimension(evaluation: DailyReviewEvaluation) {
  return [...REVIEW_DIMENSIONS].sort((a, b) =>
    evaluation.scores[a] - evaluation.scores[b]
  )[0];
}

function numberSetting(
  values: Map<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(values.get(key));
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function chunk<T>(values: T[], size: number) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
