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
  assertWorkSkillRuntimeReady,
  buildWorkPrompt,
  isHaiWorkToolSlug,
  selectWorkSkillReferences,
  selectWorkSkill,
  validateWorkInput,
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
  section_level?: string | null;
  unit_label?: string | null;
  unit_title?: string | null;
  lesson_label?: string | null;
  lesson_title?: string | null;
  frame_label?: string | null;
  frame_title?: string | null;
  content_markdown: string;
  source_hash: string;
  content_hash: string;
};

type PoliticsCaseSource = {
  case_id: string;
  source_slug: string;
  source_file_name: string;
  title: string;
  topic_direction: string;
  event_date: string;
  summary: string;
  classroom_question: string;
  concepts: string[];
  source_urls: string[];
  content_markdown: string;
  content_hash: string;
  verification_status: string;
  score: number;
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
    if (toolSlug === "subject-lesson-design" && !String(input.lesson_type ?? "").trim()) {
      input.lesson_type = "公开课";
    }
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
    const textbook = await loadTextbookContext(auth.admin, input);
    const politicsCases = toolSlug === "subject-lesson-design"
      ? await loadPoliticsCaseContext(auth.admin, input)
      : { context: "", sources: [] as PoliticsCaseSource[] };
    if (
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
      caseContext: politicsCases.context,
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
      caseSources: politicsCases.sources,
      revisionInstruction,
    });
    const selectedReferences = selectWorkSkillReferences(skill, input);
    const debugTrace = createDebugTrace({
      toolSlug,
      taskId,
      runId: run.id,
      userId: auth.user.id,
      clientRequestId,
      parentArtifactId: parentArtifact?.id ?? null,
      revisionInstruction,
      input,
      materialIds,
      materials,
      materialContext,
      textbook,
      politicsCases,
      module,
      completionOptions,
      skill,
      selectedReferences,
      prompt,
      estimatedInputTokens,
    });
    await saveRunDebugTrace(auth.admin, run.id, debugTrace);

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
      await appendDebugEvent(auth.admin, run.id, debugTrace, {
        stage: "quota_reservation_failed",
        at: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : "额度预占失败。",
      });
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
          await appendDebugEvent(auth.admin, run.id, debugTrace, {
            stage: "run_started",
            at: new Date().toISOString(),
            status: "running",
          });
          sendSse(controller, encoder, {
            type: "progress",
            stage: "material",
            message: evidenceStatus(materials, materialContext, textbook.sources, politicsCases.sources),
          });
          sendSse(controller, encoder, { type: "progress", stage: "generating", message: "HAI 正在形成第一版工作产物" });

          const firstAttempt = await collectModelOutput({
            system: prompt.system,
            user: prompt.user,
            module,
            completionOptions,
            userId: auth.user.id,
            admin: auth.admin,
          });
          rawOutput = firstAttempt.output;
          await appendDebugAttempt(auth.admin, run.id, debugTrace, firstAttempt, "initial");
          if (firstAttempt.error) throw new Error(firstAttempt.error);
          // 去掉模型可能包裹的 Markdown 代码围栏
          let markdown = rawOutput
            .replace(/^```(?:markdown|md)?\s*\n?/, "")
            .replace(/\n?```\s*$/, "")
            // 去掉 thinking 模式的思考链：deepseek v4 pro 会把推理过程放在正文前面
            .replace(/【思考】[\s\S]*?【\/思考】/g, "")
            .replace(/【思考过程】[\s\S]*?【\/思考过程】/g, "")
            .trim();
          // 如果标题前还有思考链残渣（不以 # 或 * 或数字开头的连续行），从第一个 # 标题开始截取
          const headingMatch = markdown.match(/^#\s+/m);
          if (headingMatch && headingMatch.index! > 0) {
            markdown = markdown.slice(headingMatch.index!);
          }

          if (!markdown) {
            // 空输出重试一次
            sendSse(controller, encoder, { type: "progress", stage: "repairing", message: "产物为空，正在重试" });
            const repairAttempt = await collectModelOutput({
              system: prompt.system,
              user: prompt.user,
              module,
              completionOptions,
              userId: auth.user.id,
              admin: auth.admin,
            });
            rawOutput = repairAttempt.output;
            await appendDebugAttempt(auth.admin, run.id, debugTrace, repairAttempt, "empty_output_repair");
            if (repairAttempt.error) throw new Error(repairAttempt.error);
            markdown = rawOutput
              .replace(/^```(?:markdown|md)?\s*\n?/, "")
              .replace(/\n?```\s*$/, "")
              .replace(/【思考】[\s\S]*?【\/思考】/g, "")
              .replace(/【思考过程】[\s\S]*?【\/思考过程】/g, "")
              .trim();
            const hMatch = markdown.match(/^#\s+/m);
            if (hMatch && hMatch.index! > 0) markdown = markdown.slice(hMatch.index!);
          }

          if (!markdown) throw new Error("AI 未返回任何内容，请重试。");
          const versionNumber = await nextVersionNumber(auth.admin, taskId);
          await appendDebugEvent(auth.admin, run.id, debugTrace, {
            stage: "output_normalized",
            at: new Date().toISOString(),
            raw_output_chars: rawOutput.length,
            normalized_output_chars: markdown.length,
            normalized_output: markdown,
            removed_code_fence: rawOutput.trim() !== markdown,
          });
          const { data: artifact, error: artifactError } = await auth.admin
            .from("hai_work_artifacts")
            .insert({
              task_id: taskId,
              run_id: run.id,
              user_id: auth.user.id,
              parent_artifact_id: parentArtifact?.id ?? null,
              version_number: versionNumber,
              title: taskTitle(module.name, input),
              content_json: { format: "markdown" },
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
          await appendDebugEvent(auth.admin, run.id, debugTrace, {
            stage: "artifact_persisted",
            at: new Date().toISOString(),
            artifact_id: artifact.id,
            version_number: artifact.version_number,
            status: "completed",
          });
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
              model: completionOptions.model,
              model_provider_id: module.model_provider_id ?? null,
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
          await appendDebugEvent(auth.admin, run.id, debugTrace, {
            stage: "run_failed",
            at: new Date().toISOString(),
            status: "failed",
            error: message.slice(0, 2000),
            duration_ms: durationMs,
          });
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
  const collectionSlug = String(input.collection_slug ?? "").trim();
  const unitNumber = parseRouteNumber(input.unit_route_number);
  const lessonNumber = parseRouteNumber(input.lesson_route_number);
  const frameNumber = parseRouteNumber(input.frame_route_number);
  const hasAnyFixedRouteId = Boolean(collectionSlug || unitNumber || lessonNumber || frameNumber);
  if (!hasAnyFixedRouteId) {
    const { data: catalog, error: catalogError } = await admin.rpc("hai_list_textbook_catalog", {
      p_stage: String(input.stage ?? "").trim(),
      p_subject: normalizeTextbookSubject(input.subject),
    });
    if (catalogError) throw new HttpError(500, `读取教材目录失败：${catalogError.message}`);
    if ((catalog ?? []).length > 0) {
      throw new HttpError(400, "请选择内置教材目录中的年级、册次、单元和课题，不要手工填写已收录教材。");
    }
    return { context: "", sources: [] as TextbookSource[] };
  }
  if (!collectionSlug || !unitNumber || !lessonNumber) {
    throw new HttpError(400, "内置教材编号不完整，请重新选择教材、单元和课题。");
  }
  if (String(input.frame ?? "").trim() && !frameNumber) {
    throw new HttpError(400, "框题编号缺失，请重新选择框题。");
  }
  const { data, error } = await admin.rpc("hai_get_textbook_sections_by_route", {
    p_collection_slug: collectionSlug,
    p_unit_number: unitNumber,
    p_lesson_number: lessonNumber,
    p_frame_number: frameNumber || null,
  });
  if (error) throw new HttpError(500, `读取教材知识库失败：${error.message}`);
  const sources = (data ?? []) as TextbookSource[];
  if (sources.length === 0) {
    throw new HttpError(422, "所选教材编号不存在或层级关系不一致，请重新选择教材、单元和课题。");
  }
  const collectionSlugs = new Set(sources.map((item) => item.collection_slug));
  if (collectionSlugs.size !== 1 || collectionSlugs.has(collectionSlug) === false) {
    throw new HttpError(409, "所选教材编号与教材版本不一致，请重新选择教材路径。");
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

function parseRouteNumber(value: unknown) {
  const number = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function loadPoliticsCaseContext(admin: any, input: Record<string, unknown>) {
  const { data, error } = await admin.rpc("hai_match_politics_cases", {
    p_stage: String(input.stage ?? "").trim(),
    p_subject: normalizePoliticsSubject(input.subject),
    p_grade_level: parseGradeLevel(input.grade),
    p_unit_query: String(input.unit ?? "").trim() || null,
    p_lesson_query: String(input.topic ?? "").trim() || null,
    p_frame_query: String(input.frame ?? "").trim() || null,
    p_teaching_mode: String(input.teaching_mode ?? "").trim() || null,
    p_match_count: 6,
  });
  if (error) throw new HttpError(500, `读取思政案例库失败：${error.message}`);
  const sources = (data ?? []) as PoliticsCaseSource[];
  let length = 0;
  const sections: string[] = [];
  for (const item of sources) {
    const section = [
      `### ${item.title}`,
      `来源文件：${item.source_file_name}；适配方向：${item.topic_direction}；时间：${item.event_date || "未提供"}`,
      `核验状态：${item.verification_status}`,
      item.content_markdown,
    ].join("\n");
    if (length + section.length > 24_000) break;
    sections.push(section);
    length += section.length;
  }
  return { context: sections.join("\n\n"), sources };
}

function parseGradeLevel(value: unknown) {
  const text = String(value ?? "");
  const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 } as Record<string, number>;
  const chineseMatch = text.match(/[一二三四五六七八九]年级/);
  if (chineseMatch) return chinese[chineseMatch[0][0]];
  if (/高[一１]/.test(text)) return 10;
  if (/高[二２]/.test(text)) return 11;
  if (/高[三３]/.test(text)) return 12;
  const match = text.match(/(?:^|\D)(1[0-2]|[1-9])(?:年级)?(?:$|\D)/);
  return match ? Number(match[1]) : /高中/.test(text) ? 10 : null;
}

function normalizeTextbookSubject(value: unknown) {
  const subject = String(value ?? "").trim();
  return subject === "思政" ? "思想政治" : subject;
}

function normalizePoliticsSubject(value: unknown) {
  const subject = String(value ?? "").trim();
  return subject === "思政" ? "思想政治" : subject;
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

function politicsCaseSourceSnapshot(item: PoliticsCaseSource) {
  return {
    case_id: item.case_id,
    source_slug: item.source_slug,
    source_file_name: item.source_file_name,
    title: item.title,
    topic_direction: item.topic_direction,
    event_date: item.event_date,
    concepts: item.concepts,
    source_urls: item.source_urls,
    content_hash: item.content_hash,
    verification_status: item.verification_status,
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
  caseSources: PoliticsCaseSource[];
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
      case_sources: params.caseSources.map(politicsCaseSourceSnapshot),
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
      case_sources: params.caseSources.map(politicsCaseSourceSnapshot),
    },
    revision_instruction: params.revisionInstruction || null,
  }).select("id").single();
  if (error) throw new HttpError(500, error.message);
  return data as { id: string };
}

type WorkDebugTrace = Record<string, unknown> & {
  events: Array<Record<string, unknown>>;
  model_attempts: Array<Record<string, unknown>>;
};

function createDebugTrace(params: {
  toolSlug: string;
  taskId: string;
  runId: string;
  userId: string;
  clientRequestId: string;
  parentArtifactId: string | null;
  revisionInstruction: string;
  input: Record<string, unknown>;
  materialIds: string[];
  materials: any[];
  materialContext: string;
  textbook: { context: string; sources: TextbookSource[] };
  politicsCases: { context: string; sources: PoliticsCaseSource[] };
  module: ModuleRow;
  completionOptions: ReturnType<typeof buildChatCompletionOptions>;
  skill: WorkSkillCandidate;
  selectedReferences: ReturnType<typeof selectWorkSkillReferences>;
  prompt: { system: string; user: string };
  estimatedInputTokens: number;
}): WorkDebugTrace {
  return {
    trace_version: 1,
    kind: "hai_work_generation",
    captured_at: new Date().toISOString(),
    request: {
      tool_slug: params.toolSlug,
      task_id: params.taskId,
      run_id: params.runId,
      user_id: params.userId,
      client_request_id: params.clientRequestId,
      parent_artifact_id: params.parentArtifactId,
      revision_instruction: params.revisionInstruction,
    },
    input: params.input,
    materials: {
      selected_ids: params.materialIds,
      records: params.materials,
      retrieved_context: params.materialContext,
    },
    textbook: {
      source_records: params.textbook.sources.map(textbookSourceSnapshot),
      retrieved_context: params.textbook.context,
    },
    case_library: {
      source_records: params.politicsCases.sources.map(politicsCaseSourceSnapshot),
      retrieved_context: params.politicsCases.context,
    },
    module: {
      slug: params.module.slug,
      model: params.module.default_model,
      temperature: params.completionOptions.temperature,
      max_output_tokens: params.completionOptions.maxTokens,
      thinking_enabled: false,
      top_p: params.completionOptions.topP,
      reasoning_effort: params.completionOptions.reasoningEffort,
      response_format: params.completionOptions.responseFormat,
      stop_sequences: params.completionOptions.stopSequences,
      model_provider_id: params.module.model_provider_id,
    },
    skill: {
      slug: params.skill.slug,
      name: params.skill.name,
      version: params.skill.version.version_label,
      version_id: params.skill.version.id,
      snapshot_hash: params.skill.version.snapshot_hash || "",
      fallback: params.skill.is_fallback,
      prompt_template: params.skill.version.prompt_template,
      input_contract: params.skill.version.input_contract,
      output_contract: params.skill.version.output_contract,
      references: params.selectedReferences.map((reference) => ({
        path: reference.path,
        name: reference.name,
        load_mode: reference.load_mode,
        max_chars: reference.max_chars,
        content_hash: reference.content_hash,
        content: reference.content,
      })),
    },
    prompt: {
      system: params.prompt.system,
      user: params.prompt.user,
      estimated_input_tokens: params.estimatedInputTokens,
    },
    events: [{ stage: "prompt_assembled", at: new Date().toISOString() }],
    model_attempts: [],
  };
}

async function saveRunDebugTrace(admin: any, runId: string, trace: WorkDebugTrace) {
  const request = trace.request as Record<string, unknown>;
  const { error } = await admin.from("hai_work_debug_traces").upsert({
    run_id: runId,
    user_id: String(request.user_id ?? ""),
    debug_trace: trace,
    updated_at: new Date().toISOString(),
  }, { onConflict: "run_id" });
  if (error) throw new HttpError(500, `保存 HAI Work debug trace 失败：${error.message}`);
}

async function appendDebugEvent(admin: any, runId: string, trace: WorkDebugTrace, event: Record<string, unknown>) {
  trace.events.push(event);
  await saveRunDebugTrace(admin, runId, trace);
}

async function appendDebugAttempt(
  admin: any,
  runId: string,
  trace: WorkDebugTrace,
  attempt: { output: string; started_at: string; completed_at: string; duration_ms: number; error?: string },
  purpose: string,
) {
  trace.model_attempts.push({
    attempt: trace.model_attempts.length + 1,
    purpose,
    started_at: attempt.started_at,
    completed_at: attempt.completed_at,
    duration_ms: attempt.duration_ms,
    raw_output: attempt.output,
    output_chars: attempt.output.length,
    error: attempt.error ?? null,
  });
  await saveRunDebugTrace(admin, runId, trace);
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
  const startedAt = new Date();
  const model = params.completionOptions.model;
  console.log("[hai-work] calling DeepSeek with model:", model, "providerId:", params.module.model_provider_id, "moduleSlug:", params.module.slug);
  let output = "";
  // 强制关闭 thinking — Markdown 产出不需要推理步骤。
  const workOptions = { ...params.completionOptions, thinkingEnabled: false };
  try {
    for await (const token of streamDeepSeek([
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ], {
      ...workOptions,
      userId: params.userId,
      admin: params.admin,
      modelProviderId: params.module.model_provider_id,
    })) output += token;
    const finishedAt = new Date();
    return {
      output,
      started_at: startedAt.toISOString(),
      completed_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    };
  } catch (error) {
    const failedAt = new Date();
    return {
      output,
      started_at: startedAt.toISOString(),
      completed_at: failedAt.toISOString(),
      duration_ms: failedAt.getTime() - startedAt.getTime(),
      error: error instanceof Error ? error.message : "模型调用失败。",
    };
  }
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

function evidenceStatus(materials: any[], context: string, textbookSources: TextbookSource[], caseSources: PoliticsCaseSource[]) {
  const parts: string[] = [];
  if (textbookSources.length > 0) parts.push(`已精确读取 ${textbookSources.length} 个教材分段`);
  if (caseSources.length > 0) parts.push(`已检索 ${caseSources.length} 个案例候选`);
  if (materials.length > 0 && context) parts.push(`已读取 ${materials.length} 份用户补充材料`);
  if (materials.length > 0 && !context) parts.push(`已校验 ${materials.length} 份材料，但未提取到可用文本`);
  return parts.join("；") || "已读取粘贴内容";
}
