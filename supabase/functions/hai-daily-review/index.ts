import {
  buildHaiChatSkillSystemPrompt,
  type HaiChatSkillReference,
  type HaiChatSkillRuntime,
  normalizeHaiChatSkillReferenceConfig,
} from "../_shared/hai_chat_skill.ts";
import {
  type ChatMessage,
  createAdminClient,
  jsonResponse,
  normalizeRecord,
  requireUser,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  compareEvaluationSets,
  type DailyReviewEvaluation,
  explicitDateWindow,
  normalizeSkillFileCandidate,
  normalizeEvaluation,
  previousShanghaiDayWindow,
  REVIEW_DIMENSIONS,
  type ReviewWindow,
  type SkillFileCandidate,
  summarizeEvaluations,
  validateSkillFileCandidate,
} from "../_shared/hai_daily_review.ts";
import {
  type NormalizedHaiTrace,
  readHaiTrace,
} from "../_shared/hai_trace.ts";
import { classifyIntent } from "../_shared/hai_orchestrator/intent_classifier.ts";
import { hanCourseMethodCards } from "../_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts";

type MessageRow = {
  id: string;
  conversation_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type FeedbackRow = {
  message_id: string;
  rating: "up" | "down";
  reason: string | null;
};

type UserMessageRow = {
  conversation_id: string;
  content: string;
  created_at: string;
};

type ReviewTurn = {
  message_id: string;
  created_at: string;
  question: string;
  answer: string;
  trace: NormalizedHaiTrace;
  feedback: FeedbackRow | null;
};

type DailyReviewSettings = {
  enabled: boolean;
  passScore: number;
  minLowScoreTurns: number;
  maxTurns: number;
};

type ReviewDraftOutcome = {
  candidate_skill_version_id: string;
  baseline_skill_version_id: string;
  created: boolean;
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
    if (body.action !== undefined) {
      return jsonResponse({
        message: "每日复盘不再支持 action/rollback；复盘草稿只能人工审查和发布。",
      }, 400);
    }
    const force = body.force === true;
    window = typeof body.runDate === "string"
      ? explicitDateWindow(body.runDate)
      : previousShanghaiDayWindow();
    const existing = await loadExistingRun(admin, window.runDate);
    if (existing?.candidate_skill_version_id) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "该日期已生成复盘 Skill 草稿；重跑不会覆盖已有草稿。",
        run: existing,
      });
    }
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
  const baselineSkill = await loadPublishedChatSkill(admin);
  const currentFiles = skillFiles(baselineSkill);
  const candidates = lowEvaluations.length >= settings.minLowScoreTurns
    ? await proposeCandidates(
      turns,
      lowEvaluations,
      baselineSkill,
      currentFiles,
    )
    : [];
  const lowMessageIds = new Set(
    lowEvaluations.map((evaluation) => evaluation.message_id),
  );
  const candidateResults = candidates.map((candidate) => {
    const validation = validateSkillFileCandidate(candidate, currentFiles);
    if (
      !candidate.evidence_message_ids.some((messageId) =>
        lowMessageIds.has(messageId)
      )
    ) {
      validation.valid = false;
      validation.reasons.push("候选没有引用本次复盘的低分消息。");
    }
    return { ...candidate, validation };
  });
  const validCandidates = candidateResults
    .filter((candidate) => candidate.validation.valid)
    .map(({ validation: _validation, ...candidate }) => candidate);
  const comparison = validCandidates.length > 0
    ? await compareCandidateSkill(
      turns,
      evaluations,
      baselineSkill,
      validCandidates,
      settings.passScore,
    )
    : null;
  const draftOutcome = validCandidates.length > 0
    ? await createReviewDraft(
      admin,
      window.runDate,
      baselineSkill.version_id,
      validCandidates,
      comparison,
    )
    : null;

  if (draftOutcome && !draftOutcome.created) {
    const run = await loadExistingRun(admin, window.runDate);
    return {
      skipped: true,
      reason: "并发复盘已生成草稿，本次结果未覆盖既有草稿。",
      runDate: window.runDate,
      run,
    };
  }

  const changesApplied: Array<Record<string, unknown>> = [];
  const changesPending = candidateResults.map((candidate) => ({
    ...candidate,
    review_policy: "draft_only_manual_publish",
  }));

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
      evaluation_window: window,
      baseline_skill: skillIdentity(baselineSkill),
      evaluations,
      candidate_results: candidateResults,
      comparison,
      candidate_skill_version_id:
        draftOutcome?.candidate_skill_version_id ?? null,
    },
    candidate_changes: validCandidates,
    config_snapshot_before: {
      baseline_skill: skillIdentity(baselineSkill),
    },
    config_snapshot_after: draftOutcome
      ? {
        candidate_skill_version_id: draftOutcome.candidate_skill_version_id,
      }
      : {},
    publish_mode: draftOutcome
      ? "draft"
      : "none",
    note: draftOutcome
      ? "已从当前发布快照生成独立 Skill 草稿；线上版本未改动，必须人工审查后发布。"
      : lowEvaluations.length > 0
      ? "已完成复盘；没有可安全写入草稿的文件级候选，线上版本未改动。"
      : "当日质量达标，无需改动。",
    completed_at: new Date().toISOString(),
    error_message: null,
  });

  return {
    runDate: window.runDate,
    turnsEvaluated: turns.length,
    ...evaluationSummary,
    feedback: feedbackCounts,
    baselineSkillVersionId: baselineSkill.version_id,
    candidateSkillVersionId:
      draftOutcome?.candidate_skill_version_id ?? null,
    changesPending: changesPending.length,
    comparison,
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
    .select("id, conversation_id, content, metadata, created_at")
    .eq("role", "assistant")
    .gte("created_at", window.startIso)
    .lte("created_at", window.endIso)
    .order("created_at", { ascending: false })
    .limit(Math.max(maxTurns * 2, 200));
  if (error) throw error;

  const messages = ((data ?? []) as MessageRow[]).filter((message) =>
    readHaiTrace(message.metadata) !== null
  );
  if (messages.length === 0) return [];
  const fallbackQuestions = await loadFallbackQuestions(
    admin,
    messages,
    window,
  );

  const { data: feedbackData, error: feedbackError } = await admin
    .from("hai_message_feedback")
    .select("message_id, rating, reason")
    .in("message_id", messages.map((message) => message.id));
  if (feedbackError) throw feedbackError;
  const feedbackMap = new Map(
    ((feedbackData ?? []) as FeedbackRow[]).map((row) => [row.message_id, row]),
  );

  const turns = messages.map((message): ReviewTurn => {
    const trace = readHaiTrace(message.metadata);
    if (!trace) {
      throw new Error(`HAI trace ${message.id} 无法解析。`);
    }
    return {
      message_id: message.id,
      created_at: message.created_at,
      question: trace.question ||
        fallbackQuestions.get(message.id) ||
        "（旧 trace 未保存问题文本）",
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

async function loadFallbackQuestions(
  admin: ReturnType<typeof createAdminClient>,
  assistantMessages: MessageRow[],
  window: ReviewWindow,
) {
  const missing = assistantMessages.filter((message) =>
    !readHaiTrace(message.metadata)?.question
  );
  if (missing.length === 0) return new Map<string, string>();
  const conversationIds = [...new Set(
    missing.map((message) => message.conversation_id),
  )];
  const { data, error } = await admin
    .from("hai_messages")
    .select("conversation_id, content, created_at")
    .eq("role", "user")
    .in("conversation_id", conversationIds)
    .lte("created_at", window.endIso)
    .order("created_at", { ascending: false })
    .limit(Math.min(5000, Math.max(conversationIds.length * 100, 1000)));
  if (error) throw error;

  const userMessages = (data ?? []) as UserMessageRow[];
  return new Map(missing.map((assistant) => {
    const preceding = userMessages.find((message) =>
      message.conversation_id === assistant.conversation_id &&
      message.created_at <= assistant.created_at
    );
    return [assistant.id, preceding?.content.trim() ?? ""];
  }));
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
      `评价器返回 ${evaluations.length}/${turns.length} 条，已中止草稿生成。`,
    );
  }
  return evaluations;
}

async function proposeCandidates(
  turns: ReviewTurn[],
  evaluations: DailyReviewEvaluation[],
  baselineSkill: HaiChatSkillRuntime,
  currentFiles: Record<string, string>,
): Promise<SkillFileCandidate[]> {
  const turnMap = new Map(turns.map((turn) => [turn.message_id, turn]));
  const evidence = evaluations.slice(0, 20).map((evaluation) => ({
    ...evaluation,
    question: turnMap.get(evaluation.message_id)?.question,
    answer: turnMap.get(evaluation.message_id)?.answer,
    feedback: turnMap.get(evaluation.message_id)?.feedback,
  }));
  const evidenceReferencePaths = new Set(
    evaluations.flatMap((evaluation) =>
      turnMap.get(evaluation.message_id)?.trace.reference_paths ?? []
    ),
  );
  const candidateFilePaths = [
    "SKILL.md",
    ...baselineSkill.references
      .map((reference) => reference.path)
      .filter((path) => evidenceReferencePaths.has(path))
      .slice(0, 3),
  ];
  const editableFiles = Object.fromEntries(
    candidateFilePaths
      .filter((path) => (currentFiles[path]?.length ?? 0) <= 50000)
      .map((path) => [path, currentFiles[path]]),
  );
  const value = await callJson([
    {
      role: "system",
      content: [
        "你负责 HAI 已发布 Chat Skill 的每日离线审查。只修复被多条真实低分样本共同证明的稳定失败模式，不为改而改。",
        "最多给 2 个文件级候选；target_path 只能从用户提供的文件路径中选择，每个必须返回该文件完整 proposed_content，不得只给 diff。",
        "必须保留当前有效规则；不得删除事实边界、交付边界或未知就说未知。避免 Prompt 膨胀。",
        "任何候选都只会进入独立草稿，绝不会自动发布。改动身份、安全边界或方法论时必须标 high risk。",
        '输出 JSON：{"candidates":[{"target_path":"SKILL.md|references/...","proposed_content":"完整文件","reason":"...","risk":"low|medium|high","evidence_message_ids":["..."]}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: `低分证据：\n${JSON.stringify(evidence)}\n\n当前已发布 Skill 文件：\n${
        JSON.stringify(editableFiles)
      }`,
    },
  ], 18000);
  const rows = Array.isArray(normalizeRecord(value).candidates)
    ? normalizeRecord(value).candidates as unknown[]
    : [];
  const candidates = rows.map(normalizeSkillFileCandidate).filter((
    item,
  ): item is SkillFileCandidate => Boolean(item)).slice(0, 2);
  const seenPaths = new Set<string>();
  return candidates.filter((candidate) => {
    if (seenPaths.has(candidate.target_path)) return false;
    seenPaths.add(candidate.target_path);
    return true;
  });
}

async function compareCandidateSkill(
  turns: ReviewTurn[],
  baselineEvaluations: DailyReviewEvaluation[],
  baselineSkill: HaiChatSkillRuntime,
  candidates: SkillFileCandidate[],
  passScore: number,
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
  const candidateSkill = applySkillCandidates(baselineSkill, candidates);

  const answers = await Promise.all(sample.map(async (turn) => {
    const intent = classifyIntent(turn.question);
    const systemPrompt = buildHaiChatSkillSystemPrompt({
      moduleName: "问问哈老师（每日复盘草稿离线对比）",
      question: turn.question,
      skill: candidateSkill,
      intent,
      methodCards: hanCourseMethodCards,
      memories: [],
    });
    return {
      ...turn,
      feedback: null,
      answer: await callText([
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: turn.question },
      ], 2400),
    };
  }));
  const [baseline, candidateEvaluations] = await Promise.all([
    evaluateTurns(
      sample.map((turn) => ({ ...turn, feedback: null })),
      passScore,
    ),
    evaluateTurns(answers, passScore),
  ]);
  const summary = compareEvaluationSets({
    baseline,
    candidate: candidateEvaluations,
  });
  const baselineById = new Map(
    baseline.map((evaluation) => [evaluation.message_id, evaluation]),
  );
  const candidateById = new Map(
    candidateEvaluations.map((evaluation) => [
      evaluation.message_id,
      evaluation,
    ]),
  );
  return {
    summary,
    cases: answers.map((answer) => ({
      message_id: answer.message_id,
      question: answer.question,
      baseline_answer: sample.find((turn) =>
        turn.message_id === answer.message_id
      )?.answer ?? "",
      candidate_answer: answer.answer,
      baseline_evaluation: baselineById.get(answer.message_id) ?? null,
      candidate_evaluation: candidateById.get(answer.message_id) ?? null,
    })),
  };
}

async function loadPublishedChatSkill(
  admin: ReturnType<typeof createAdminClient>,
): Promise<HaiChatSkillRuntime> {
  const { data: module, error: moduleError } = await admin
    .from("hai_feature_modules")
    .select("id")
    .eq("slug", "ask-han")
    .eq("is_enabled", true)
    .maybeSingle();
  if (moduleError) throw moduleError;
  if (!module?.id) throw new Error("ask-han 模块未启用，无法生成复盘草稿。");

  const { data: binding, error: bindingError } = await admin
    .from("hai_chat_skill_bindings")
    .select("skill_id")
    .eq("module_id", module.id)
    .eq("is_enabled", true)
    .maybeSingle();
  if (bindingError) throw bindingError;
  if (!binding?.skill_id) {
    throw new Error("ask-han 没有启用的 Chat Skill 绑定。");
  }

  const { data: skill, error: skillError } = await admin
    .from("hai_chat_skills")
    .select("id, slug, name, description, source_path")
    .eq("id", binding.skill_id)
    .eq("is_enabled", true)
    .maybeSingle();
  if (skillError) throw skillError;
  if (!skill) throw new Error("ask-han 绑定的 Chat Skill 不存在或未启用。");

  const { data: version, error: versionError } = await admin
    .from("hai_chat_skill_versions")
    .select(
      "id, version_label, snapshot_hash, instructions, reference_config",
    )
    .eq("skill_id", skill.id)
    .eq("status", "published")
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version?.id || !String(version.instructions || "").trim()) {
    throw new Error("ask-han 没有完整的已发布 Chat Skill 快照。");
  }

  const { data: references, error: referencesError } = await admin
    .from("hai_chat_skill_references")
    .select(
      "id, path, name, description, media_type, content, content_hash, load_mode, max_chars, sort_order",
    )
    .eq("skill_version_id", version.id)
    .order("sort_order")
    .order("path");
  if (referencesError) throw referencesError;

  return {
    skill_id: String(skill.id),
    skill_slug: String(skill.slug),
    skill_name: String(skill.name),
    skill_description: String(skill.description || ""),
    source_path: String(skill.source_path || ""),
    version_id: String(version.id),
    version_label: String(version.version_label),
    snapshot_hash: String(version.snapshot_hash || ""),
    instructions: String(version.instructions),
    reference_config: normalizeHaiChatSkillReferenceConfig(
      version.reference_config,
    ),
    references: (references ?? []).map((
      reference: Record<string, unknown>,
    ): HaiChatSkillReference => ({
      id: String(reference.id),
      path: String(reference.path),
      name: String(reference.name || reference.path),
      description: String(reference.description || ""),
      media_type: String(reference.media_type || "text/plain"),
      content: String(reference.content || ""),
      content_hash: String(reference.content_hash || ""),
      load_mode: String(
        reference.load_mode || "on_demand",
      ) as HaiChatSkillReference["load_mode"],
      max_chars: Number(reference.max_chars || 12000),
      sort_order: Number(reference.sort_order || 0),
    })),
  };
}

function skillFiles(skill: HaiChatSkillRuntime) {
  return Object.fromEntries([
    ["SKILL.md", skill.instructions],
    ...skill.references.map((reference) => [
      reference.path,
      reference.content,
    ]),
  ]);
}

function applySkillCandidates(
  baseline: HaiChatSkillRuntime,
  candidates: SkillFileCandidate[],
): HaiChatSkillRuntime {
  const changes = new Map(
    candidates.map((candidate) => [
      candidate.target_path,
      candidate.proposed_content,
    ]),
  );
  return {
    ...baseline,
    version_id: `${baseline.version_id}:daily-review-candidate`,
    version_label: `${baseline.version_label}-review-candidate`,
    snapshot_hash: "",
    instructions: changes.get("SKILL.md") ?? baseline.instructions,
    references: baseline.references.map((reference) => ({
      ...reference,
      content: changes.get(reference.path) ?? reference.content,
      content_hash: "",
    })),
  };
}

function skillIdentity(skill: HaiChatSkillRuntime) {
  return {
    skill_id: skill.skill_id,
    skill_slug: skill.skill_slug,
    version_id: skill.version_id,
    version_label: skill.version_label,
    snapshot_hash: skill.snapshot_hash,
    reference_paths: skill.references.map((reference) => reference.path),
  };
}

async function createReviewDraft(
  admin: ReturnType<typeof createAdminClient>,
  runDate: string,
  baselineVersionId: string,
  candidates: SkillFileCandidate[],
  comparison: Record<string, unknown> | null,
): Promise<ReviewDraftOutcome> {
  const { data, error } = await admin.rpc(
    "hai_create_chat_skill_review_draft",
    {
      p_run_date: runDate,
      p_expected_baseline_version_id: baselineVersionId,
      p_file_changes: candidates,
      p_comparison: comparison ?? {},
    },
  );
  if (error) throw error;
  const result = normalizeRecord(data);
  const candidateVersionId = String(
    result.candidate_skill_version_id || "",
  );
  if (!candidateVersionId) {
    throw new Error("复盘草稿 RPC 没有返回 candidate_skill_version_id。");
  }
  return {
    candidate_skill_version_id: candidateVersionId,
    baseline_skill_version_id: String(
      result.baseline_skill_version_id || baselineVersionId,
    ),
    created: result.created === true,
  };
}

function buildEvaluationPrompt(turns: ReviewTurn[], passScore: number) {
  return [
    "你是严格的 HAI 教学咨询质量评价器。评价真实回答，不评价提示词写得是否漂亮。",
    "六维各 0-100：intent 真实问题识别；teaching_judgment 专业判断；actionability 可执行抓手；factual_boundary 不编造且边界清楚；style 像哈老师且不讨好套话；brevity 聚焦不冗长。",
    "真正问题识别与教学判断最重要。表层迎合、正确废话、无依据教材事实、代写整套方案应显著扣分。",
    `total_score 由系统重算；passed 以 ${passScore} 为线。用户点踩是强负信号，不能被模型高分覆盖。`,
    "target_layer 只能填 skill_instructions/reference/code_or_data/unknown。",
    '输出 JSON：{"evaluations":[{"message_id":"...","scores":{"intent":0,"teaching_judgment":0,"actionability":0,"factual_boundary":0,"style":0,"brevity":0},"problems":["..."],"summary":"...","target_layer":"..."}]}',
    `待评价轮次：\n${
      JSON.stringify(turns.map((turn) => ({
        message_id: turn.message_id,
        question: turn.question,
        answer: turn.answer,
        feedback: turn.feedback,
        route: {
          intent_result: turn.trace.intent_result,
          problem_rewrite: turn.trace.raw.problem_rewrite,
          diagnostic_module: turn.trace.diagnostic_module,
          method_card_ids: turn.trace.method_card_ids,
          reference_paths: turn.trace.reference_paths,
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
  return {
    enabled: Boolean(values.get("daily_review.enabled") ?? true),
    passScore: numberSetting(values, "daily_review.pass_score", 80, 60, 95),
    minLowScoreTurns: numberSetting(
      values,
      "daily_review.min_low_score_turns",
      3,
      2,
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
