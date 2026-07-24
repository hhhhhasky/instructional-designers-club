import {
  assertHaiAccess,
  buildChatCompletionOptions,
  estimateTokens,
  finalizeUsage,
  handleCors,
  HttpError,
  jsonResponse,
  loadHaiRuntimeConfig,
  normalizeRecord,
  requireUser,
  reserveUsage,
  sendSse,
  sseHeaders,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  applyWorkOutputRuntimeTrace,
  assertWorkSkillRuntimeReady,
  buildWorkPrompt,
  isHaiWorkToolSlug,
  parseWorkJson,
  renderWorkMarkdown,
  selectWorkSkillReferences,
  selectWorkSkill,
  validateWorkInput,
  validateWorkOutput,
  type WorkSkillCandidate,
} from "../_shared/hai_work.ts";

type ModuleRow = {
  slug: string;
  name: string;
  default_model: string;
  default_temperature: number;
  default_max_output_tokens: number;
  thinking_enabled: boolean;
  default_top_p: number | null;
  reasoning_effort: string | null;
  response_format: string | null;
  stop_sequences: string[] | null;
  model_provider_id: string | null;
};

type WorkRequestBody = {
  toolSlug?: unknown;
  input?: unknown;
  materialIds?: unknown;
  taskId?: unknown;
  parentArtifactId?: unknown;
  revisionInstruction?: unknown;
  clientRequestId?: unknown;
};

type TextbookSource = {
  section_id: string;
  collection_slug: string;
  collection_title: string;
  edition_label: string;
  publication_status: string;
  verification_status: string;
  requires_confirmation: boolean;
  section_path: string;
  content_type: string;
  content_markdown: string;
  source_hash: string;
  content_hash: string;
};

const maxMaterialCount = 5;
const maxMaterialContextChars = 48_000;
const maxInputTextChars = 120_000;

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);
    const body = await request.json().catch(() => ({})) as WorkRequestBody;
    const toolSlug = String(body.toolSlug ?? "").trim();
    if (!isHaiWorkToolSlug(toolSlug)) throw new HttpError(400, "未知的 HAI Work 功能。");
    const input = normalizeRecord(body.input);
    const materialIds = normalizeMaterialIds(body.materialIds);
    if (body.parentArtifactId && !body.taskId) {
      throw new HttpError(400, "追改产物时必须同时提供原任务。");
    }
    validateInputSize(input);
    try {
      validateWorkInput(toolSlug, input, materialIds.length);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "任务输入不完整。");
    }

    const clientRequestId = String(body.clientRequestId ?? "").trim() || crypto.randomUUID();
    const existing = await loadIdempotentRun(auth.admin, auth.user.id, clientRequestId);
    if (existing) return replayExistingRun(existing);

    const module = await loadModule(auth.admin, toolSlug);
    const materials = await loadMaterials(auth.admin, auth.user.id, materialIds);
    const skill = await loadSelectedSkill(auth.admin, toolSlug, input);
    try {
      assertWorkSkillRuntimeReady(skill, input);
    } catch (error) {
      throw new HttpError(503, error instanceof Error ? error.message : "思政公开课 Skill 运行资料不完整。");
    }
    const runtime = await loadHaiRuntimeConfig(auth.admin);
    const completionOptions = buildChatCompletionOptions({ module, runtime });
    const materialContext = await loadMaterialContext(
      auth.admin,
      auth.user.id,
      materialIds,
      buildMaterialQuery(input),
    );
    const textbook = toolSlug === "subject-lesson-design"
      ? await loadTextbookContext(auth.admin, input)
      : { context: "", sources: [] as TextbookSource[] };
    if (
      toolSlug === "subject-lesson-design" &&
      !textbook.context &&
      !materialContext &&
      !String(input.textbook_content ?? "").trim()
    ) {
      throw new HttpError(422, "内置教材库没有命中这节课，请检查年级、册次、单元和课题，或上传教材内容。");
    }

    const taskId = body.taskId
      ? await validateTask(auth.admin, auth.user.id, String(body.taskId), toolSlug)
      : await createTask(auth.admin, auth.user.id, toolSlug, taskTitle(module.name, input));
    await attachMaterials(auth.admin, auth.user.id, taskId, materialIds);
    const parentArtifact = body.parentArtifactId
      ? await loadArtifact(auth.admin, auth.user.id, taskId, String(body.parentArtifactId))
      : null;
    const revisionInstruction = String(body.revisionInstruction ?? "").trim();
    if (parentArtifact && !revisionInstruction) {
      throw new HttpError(400, "继续追改时请填写本轮修改要求。");
    }

    const prompt = buildWorkPrompt({
      toolSlug,
      input,
      skill,
      materialContext,
      textbookContext: textbook.context,
      previousMarkdown: parentArtifact?.content_markdown,
      revisionInstruction,
    });
    const textbookSourcePaths = textbook.sources.length > 0
      ? textbook.sources.map((source) => source.section_path)
      : materialContext
      ? ["用户指定材料"]
      : ["用户填写的教材内容"];
    const estimatedInputTokens = estimateTokens(prompt.system) + estimateTokens(prompt.user);

    const run = await createRun(auth.admin, {
      taskId,
      userId: auth.user.id,
      skill,
      parentArtifactId: parentArtifact?.id ?? null,
      clientRequestId,
      input,
      materialIds,
      textbookSources: textbook.sources,
      revisionInstruction,
    });

    try {
      await reserveUsage({
        userClient: auth.userClient,
        requestId: clientRequestId,
        route: "hai-work",
        estimatedInputTokens,
        estimatedOutputTokens: completionOptions.maxTokens,
        metadata: {
          tool_slug: toolSlug,
          task_id: taskId,
          run_id: run.id,
          skill_slug: skill.slug,
          skill_version: skill.version.version_label,
          skill_snapshot_hash: skill.version.snapshot_hash || "",
          teaching_mode: String(input.teaching_mode ?? ""),
          fallback_skill: skill.is_fallback,
        },
      });
    } catch (error) {
      await markRunFailed(auth.admin, run.id, error instanceof Error ? error.message : "额度预占失败。");
      throw error;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const startedAt = Date.now();
        let rawOutput = "";
        try {
          await auth.admin.from("hai_work_runs").update({
            status: "running",
            started_at: new Date().toISOString(),
          }).eq("id", run.id);
          sendSse(controller, encoder, {
            type: "ready",
            taskId,
            runId: run.id,
            skill: skill.name,
            skillVersion: skill.version.version_label,
            fallback: skill.is_fallback,
          });
          sendSse(controller, encoder, {
            type: "progress",
            stage: "material",
            message: evidenceStatus(materials, materialContext, textbook.sources),
          });
          sendSse(controller, encoder, { type: "progress", stage: "generating", message: "HAI 正在形成第一版工作产物" });

          rawOutput = await collectModelOutput({
            system: prompt.system,
            user: prompt.user,
            module,
            completionOptions,
            userId: auth.user.id,
            admin: auth.admin,
          });
          let parsed = parseWorkJson(rawOutput);
          if (parsed) parsed = applyWorkOutputRuntimeTrace(parsed, skill, input, textbookSourcePaths);
          let validationIssue = "返回内容不是合法 JSON 对象";
          if (parsed) {
            try {
              validateWorkOutput(parsed, skill.version.output_contract);
              validationIssue = "";
            } catch (error) {
              validationIssue = error instanceof Error ? error.message : "返回内容不符合输出契约";
            }
          }
          if (!parsed || validationIssue) {
            sendSse(controller, encoder, { type: "progress", stage: "repairing", message: "正在校正产物格式" });
            rawOutput = await collectModelOutput({
              system: "你是结构化产物修复器。只修复 JSON 格式和缺失结构，不改变已有教学判断，不编造用户未提供的事实。只返回一个合法 JSON 对象。",
              user: `校验问题：${validationIssue}\n\n原始系统要求：\n${prompt.system}\n\n原始任务上下文（包括教材知识与已加载 reference）：\n${prompt.user}\n\n待修复内容：\n${rawOutput}`,
              module,
              completionOptions,
              userId: auth.user.id,
              admin: auth.admin,
            });
            parsed = parseWorkJson(rawOutput);
            if (parsed) parsed = applyWorkOutputRuntimeTrace(parsed, skill, input, textbookSourcePaths);
          }
          if (!parsed) throw new Error("AI 返回内容无法解析为结构化产物，请重试。");
          validateWorkOutput(parsed, skill.version.output_contract);

          const markdown = renderWorkMarkdown(toolSlug, parsed);
          const versionNumber = await nextVersionNumber(auth.admin, taskId);
          const { data: artifact, error: artifactError } = await auth.admin
            .from("hai_work_artifacts")
            .insert({
              task_id: taskId,
              run_id: run.id,
              user_id: auth.user.id,
              parent_artifact_id: parentArtifact?.id ?? null,
              version_number: versionNumber,
              title: taskTitle(module.name, input),
              content_json: parsed,
              content_markdown: markdown,
            })
            .select("id, version_number")
            .single();
          if (artifactError) throw artifactError;

          const durationMs = Date.now() - startedAt;
          const inputTokens = estimateTokens(`${prompt.system}\n${prompt.user}`);
          const outputTokens = estimateTokens(rawOutput);
          await Promise.all([
            auth.admin.from("hai_work_runs").update({
              status: "completed",
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              duration_ms: durationMs,
              completed_at: new Date().toISOString(),
              error_message: null,
            }).eq("id", run.id),
            auth.admin.from("hai_work_tasks").update({
              latest_artifact_id: artifact.id,
              updated_at: new Date().toISOString(),
            }).eq("id", taskId),
          ]);
          await finalizeUsage({
            userClient: auth.userClient,
            requestId: clientRequestId,
            status: "completed",
            route: "hai-work",
            inputTokens,
            outputTokens,
            entityType: "work_task",
            entityId: taskId,
            durationMs,
            metadata: {
              tool_slug: toolSlug,
              run_id: run.id,
              artifact_id: artifact.id,
              artifact_version: artifact.version_number,
              skill_slug: skill.slug,
              skill_version: skill.version.version_label,
              skill_snapshot_hash: skill.version.snapshot_hash || "",
              teaching_mode: String(input.teaching_mode ?? ""),
              fallback_skill: skill.is_fallback,
              revision: Boolean(parentArtifact),
            },
          });
          sendSse(controller, encoder, {
            type: "done",
            taskId,
            runId: run.id,
            artifactId: artifact.id,
            versionNumber: artifact.version_number,
            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "HAI Work 执行失败。";
          const durationMs = Date.now() - startedAt;
          await markRunFailed(auth.admin, run.id, message, durationMs);
          await finalizeUsage({
            userClient: auth.userClient,
            requestId: clientRequestId,
            status: "failed",
            route: "hai-work",
            inputTokens: estimatedInputTokens,
            outputTokens: estimateTokens(rawOutput),
            entityType: "work_task",
            entityId: taskId,
            durationMs,
            metadata: { tool_slug: toolSlug, run_id: run.id, error: message },
          });
          sendSse(controller, encoder, { type: "error", message, taskId, runId: run.id });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: sseHeaders() });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "HAI Work 请求失败。";
    return jsonResponse({ message }, status);
  }
});

async function loadModule(admin: any, slug: string): Promise<ModuleRow> {
  const { data, error } = await admin.from("hai_feature_modules").select(
    "slug, name, default_model, default_temperature, default_max_output_tokens, thinking_enabled, default_top_p, reasoning_effort, response_format, stop_sequences, model_provider_id",
  ).eq("slug", slug).eq("surface_mode", "work").eq("is_enabled", true).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "该 HAI Work 功能暂未启用。");
  return data as ModuleRow;
}

async function loadSelectedSkill(admin: any, moduleSlug: string, input: Record<string, unknown>) {
  const { data: skills, error } = await admin.from("hai_work_skills").select(
    "id, slug, name, description, match_criteria, priority, is_fallback",
  ).eq("module_slug", moduleSlug).eq("is_enabled", true);
  if (error) throw new HttpError(500, error.message);
  const skillIds = (skills ?? []).map((item: any) => item.id);
  const { data: versions, error: versionError } = skillIds.length > 0
    ? await admin.from("hai_work_skill_versions").select(
      "id, skill_id, version_label, prompt_template, input_contract, output_contract, snapshot_hash, source_metadata",
    ).in("skill_id", skillIds).eq("status", "published")
    : { data: [], error: null };
  if (versionError) throw new HttpError(500, versionError.message);
  const bySkill = new Map((versions ?? []).map((item: any) => [item.skill_id, item]));
  const candidates = (skills ?? []).flatMap((skill: any) => {
    const version = bySkill.get(skill.id);
    return version ? [{ ...skill, version } as WorkSkillCandidate] : [];
  });
  const selected = selectWorkSkill(candidates, input);
  if (!selected) throw new HttpError(503, "该功能还没有已发布的 Work Skill。");
  const { data: references, error: referencesError } = await admin
    .from("hai_work_skill_references")
    .select("id, path, name, description, media_type, content, content_hash, load_mode, max_chars, sort_order, metadata")
    .eq("skill_version_id", selected.version.id)
    .order("sort_order", { ascending: true });
  if (referencesError) throw new HttpError(500, `Work Skill references 加载失败：${referencesError.message}`);
  return {
    ...selected,
    version: { ...selected.version, references: references ?? [] },
  } as WorkSkillCandidate;
}

async function loadMaterials(admin: any, userId: string, materialIds: string[]) {
  if (materialIds.length === 0) return [];
  const { data, error } = await admin.from("hai_materials").select(
    "id, title, status, error_message",
  ).eq("user_id", userId).in("id", materialIds);
  if (error) throw new HttpError(500, error.message);
  if ((data ?? []).length !== materialIds.length) throw new HttpError(403, "部分材料不存在或不属于当前用户。");
  const unready = (data ?? []).filter((item: any) => !["processed", "processed_no_embedding"].includes(item.status));
  if (unready.length > 0) throw new HttpError(409, `材料“${unready[0].title}”尚未解析完成。`);
  return data ?? [];
}

async function loadMaterialContext(
  admin: any,
  userId: string,
  materialIds: string[],
  query: string,
) {
  if (materialIds.length === 0) return "";
  const { data, error } = await admin.rpc("hai_match_selected_material_chunks", {
    query_text: query,
    selected_material_ids: materialIds,
    match_count: 24,
    target_user_id: userId,
  });
  if (error) throw new HttpError(500, error.message);
  let length = 0;
  const sections: string[] = [];
  for (const item of data ?? []) {
    const section = `### ${String(item.title || "用户材料")}\n${String(item.content || "")}`;
    if (length + section.length > maxMaterialContextChars) break;
    sections.push(section);
    length += section.length;
  }
  return sections.join("\n\n");
}

async function loadTextbookContext(admin: any, input: Record<string, unknown>) {
  const gradeLevel = parseGradeLevel(input.grade);
  const { data, error } = await admin.rpc("hai_match_textbook_sections", {
    p_stage: String(input.stage ?? "").trim(),
    p_subject: normalizeTextbookSubject(input.subject),
    p_grade_level: gradeLevel,
    p_volume: String(input.volume ?? "").trim(),
    p_unit_query: String(input.unit ?? "").trim(),
    p_lesson_query: String(input.topic ?? "").trim(),
    p_frame_query: String(input.frame ?? "").trim() || null,
    p_match_count: 16,
  });
  if (error) throw new HttpError(500, `读取教材知识库失败：${error.message}`);
  const sources = (data ?? []) as TextbookSource[];
  const collectionSlugs = new Set(sources.map((item) => item.collection_slug));
  if (collectionSlugs.size > 1) {
    throw new HttpError(409, "教材版本命中不唯一，请重新选择年级、册次、单元和课题。");
  }
  let length = 0;
  const sections: string[] = [];
  for (const item of sources) {
    const warning = item.requires_confirmation
      ? "\n> 版本边界：该册内容尚待纸质教材复核，生成时必须提醒教师核对。"
      : "";
    const section = [
      `### ${item.section_path}`,
      `教材版本：${item.edition_label}；内容类型：知识点梳理（非逐字原文）；核验状态：${item.verification_status}${warning}`,
      item.content_markdown,
    ].join("\n");
    if (length + section.length > maxMaterialContextChars) break;
    sections.push(section);
    length += section.length;
  }
  return { context: sections.join("\n\n"), sources };
}

function parseGradeLevel(value: unknown) {
  const match = String(value ?? "").match(/([7-9])/);
  return match ? Number(match[1]) : null;
}

function normalizeTextbookSubject(value: unknown) {
  const subject = String(value ?? "").trim();
  return subject === "思想政治" || subject === "思政" ? "道德与法治" : subject;
}

function textbookSourceSnapshot(item: TextbookSource) {
  return {
    section_id: item.section_id,
    collection_slug: item.collection_slug,
    collection_title: item.collection_title,
    edition_label: item.edition_label,
    publication_status: item.publication_status,
    verification_status: item.verification_status,
    requires_confirmation: item.requires_confirmation,
    section_path: item.section_path,
    content_type: item.content_type,
    source_hash: item.source_hash,
    content_hash: item.content_hash,
  };
}

async function createTask(admin: any, userId: string, moduleSlug: string, title: string) {
  const { data, error } = await admin.from("hai_work_tasks").insert({
    user_id: userId,
    module_slug: moduleSlug,
    title,
  }).select("id").single();
  if (error) throw new HttpError(500, error.message);
  return String(data.id);
}

async function validateTask(admin: any, userId: string, taskId: string, moduleSlug: string) {
  const { data, error } = await admin.from("hai_work_tasks").select("id, module_slug, status")
    .eq("id", taskId).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Work 任务不存在。");
  if (data.status !== "active") throw new HttpError(409, "已归档任务不能继续修改。");
  if (data.module_slug !== moduleSlug) throw new HttpError(409, "不能在同一任务中切换 Work 功能。");
  return String(data.id);
}

async function loadArtifact(admin: any, userId: string, taskId: string, artifactId: string) {
  const { data, error } = await admin.from("hai_work_artifacts").select("id, content_markdown")
    .eq("id", artifactId).eq("task_id", taskId).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "上一版产物不存在。");
  return data as { id: string; content_markdown: string };
}

async function attachMaterials(admin: any, userId: string, taskId: string, materialIds: string[]) {
  if (materialIds.length === 0) return;
  const { error } = await admin.from("hai_work_task_materials").upsert(
    materialIds.map((materialId) => ({ task_id: taskId, material_id: materialId, user_id: userId })),
    { onConflict: "task_id,material_id" },
  );
  if (error) throw new HttpError(500, error.message);
}

async function createRun(admin: any, params: {
  taskId: string;
  userId: string;
  skill: WorkSkillCandidate;
  parentArtifactId: string | null;
  clientRequestId: string;
  input: Record<string, unknown>;
  materialIds: string[];
  textbookSources: TextbookSource[];
  revisionInstruction: string;
}) {
  const { data, error } = await admin.from("hai_work_runs").insert({
    task_id: params.taskId,
    user_id: params.userId,
    skill_version_id: params.skill.version.id,
    parent_artifact_id: params.parentArtifactId,
    client_request_id: params.clientRequestId,
    status: "queued",
    input_snapshot: {
      ...params.input,
      material_ids: params.materialIds,
      textbook_sources: params.textbookSources.map(textbookSourceSnapshot),
    },
    skill_snapshot: {
      slug: params.skill.slug,
      name: params.skill.name,
      version: params.skill.version.version_label,
      fallback: params.skill.is_fallback,
      snapshot_hash: params.skill.version.snapshot_hash || "",
      source_metadata: params.skill.version.source_metadata || {},
      reference_paths: selectWorkSkillReferences(params.skill, params.input).map((item) => item.path),
      reference_hashes: selectWorkSkillReferences(params.skill, params.input).map((item) => item.content_hash),
      textbook_sources: params.textbookSources.map(textbookSourceSnapshot),
    },
    revision_instruction: params.revisionInstruction || null,
  }).select("id").single();
  if (error) throw new HttpError(500, error.message);
  return data as { id: string };
}

async function nextVersionNumber(admin: any, taskId: string) {
  const { data, error } = await admin.from("hai_work_artifacts").select("version_number")
    .eq("task_id", taskId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return Number(data?.version_number ?? 0) + 1;
}

async function collectModelOutput(params: {
  system: string;
  user: string;
  module: ModuleRow;
  completionOptions: ReturnType<typeof buildChatCompletionOptions>;
  userId: string;
  admin: any;
}) {
  let output = "";
  for await (const token of streamDeepSeek([
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ], {
    ...params.completionOptions,
    responseFormat: "json_object",
    userId: params.userId,
    admin: params.admin,
    modelProviderId: params.module.model_provider_id,
  })) output += token;
  return output;
}

async function loadIdempotentRun(admin: any, userId: string, requestId: string) {
  const { data, error } = await admin.from("hai_work_runs").select(
    "id, task_id, status, error_message, input_tokens, output_tokens, artifact:hai_work_artifacts!hai_work_artifacts_run_id_fkey(id, version_number)",
  ).eq("user_id", userId).eq("client_request_id", requestId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return data;
}

function replayExistingRun(run: any) {
  const artifact = Array.isArray(run.artifact) ? run.artifact[0] : run.artifact;
  const events = run.status === "completed" && artifact
    ? [
      { type: "ready", taskId: run.task_id, runId: run.id, replayed: true },
      {
        type: "done",
        taskId: run.task_id,
        runId: run.id,
        artifactId: artifact.id,
        versionNumber: artifact.version_number,
        usage: {
          inputTokens: run.input_tokens ?? 0,
          outputTokens: run.output_tokens ?? 0,
          totalTokens: (run.input_tokens ?? 0) + (run.output_tokens ?? 0),
        },
        replayed: true,
      },
    ]
    : [{ type: "error", taskId: run.task_id, runId: run.id, message: run.error_message || "该请求正在处理或上次未完成。", replayed: true }];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: sseHeaders(),
  });
}

async function markRunFailed(admin: any, runId: string, message: string, durationMs?: number) {
  await admin.from("hai_work_runs").update({
    status: "failed",
    error_message: message.slice(0, 2000),
    duration_ms: durationMs ?? null,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

function normalizeMaterialIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
  if (ids.length > maxMaterialCount) throw new HttpError(400, `每个任务最多使用 ${maxMaterialCount} 份材料。`);
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new HttpError(400, "材料标识格式不正确。");
  }
  return ids;
}

function validateInputSize(input: Record<string, unknown>) {
  const length = Object.values(input).reduce<number>(
    (sum, value) => sum + String(value ?? "").length,
    0,
  );
  if (length > maxInputTextChars) throw new HttpError(413, "粘贴内容过长，请改用文件上传或缩小材料范围。");
}

function taskTitle(moduleName: string, input: Record<string, unknown>) {
  const topic = String(input.topic ?? "").trim();
  return `${moduleName}｜${topic || "未命名任务"}`.slice(0, 80);
}

function buildMaterialQuery(input: Record<string, unknown>) {
  return [input.stage, input.subject, input.unit, input.topic, input.teaching_mode, input.lesson_type, input.segment_type]
    .map((item) => String(item ?? "").trim()).filter(Boolean).join(" ") || "教学设计";
}

function evidenceStatus(materials: any[], context: string, textbookSources: TextbookSource[]) {
  const parts: string[] = [];
  if (textbookSources.length > 0) parts.push(`已精确读取 ${textbookSources.length} 个教材框题`);
  if (materials.length > 0 && context) parts.push(`已读取 ${materials.length} 份用户补充材料`);
  if (materials.length > 0 && !context) parts.push(`已校验 ${materials.length} 份材料，但未提取到可用文本`);
  return parts.join("；") || "已读取粘贴内容";
}
