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
  sseHeaders,
} from "../_shared/hai.ts";
import {
  applyWorkCompletionPolicy,
  assertWorkSkillRuntimeReady,
  buildWorkArtifactTitle,
  buildWorkPrompt,
  buildWorkTaskTitle,
  createEmptyWorkSkill,
  isHaiWorkToolSlug,
  selectWorkSkillReferences,
  selectWorkSkill,
  resolveTextbookRouteFromSnapshots,
  validateWorkInput,
  type WorkSkillCandidate,
  type HaiWorkGenerationMode,
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
  responseMode?: unknown;
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
    const requestedGenerationMode = String(input.output_mode ?? "diagnosis").trim();
    if (!['diagnosis', 'lesson-plan-optimization'].includes(requestedGenerationMode)) {
      throw new HttpError(400, "未知的 HAI Work 生成模式。");
    }
    if (requestedGenerationMode === "lesson-plan-optimization" && toolSlug !== "lesson-diagnosis") {
      throw new HttpError(400, "只有教案诊断支持基于诊断报告生成优化教案。");
    }
    if (toolSlug === "subject-lesson-design") {
      const subject = String(input.subject ?? "").trim();
      const isPoliticsSubject = subject === "道德与法治" || subject === "思想政治";
      input.teaching_mode = isPoliticsSubject ? String(input.teaching_mode ?? "").trim() : "";
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
    if (existing) return workSubmissionResponse(existing, body.responseMode, true);
    const { data: queueReady, error: queueError } = await auth.admin.rpc("hai_work_queue_ready");
    if (queueError || !queueReady) throw new HttpError(503, "HAI Work 后台执行器尚未配置，请联系管理员。");

    const module = await loadModule(auth.admin, toolSlug);
    const materials = await loadMaterials(auth.admin, auth.user.id, materialIds);
    const skill = await loadSelectedSkill(auth.admin, toolSlug, input);
    try {
      assertWorkSkillRuntimeReady(skill, input);
    } catch (error) {
      throw new HttpError(503, error instanceof Error ? error.message : "公开课设计 Skill 运行资料不完整。");
    }
    const runtime = await loadHaiRuntimeConfig(auth.admin);
    const completionOptions = applyWorkCompletionPolicy(
      toolSlug,
      buildChatCompletionOptions({ module, runtime }),
    );
    const materialContext = await loadMaterialContext(
      auth.admin,
      auth.user.id,
      materialIds,
      buildMaterialQuery(input),
    );
    const textbook = await loadTextbookContext(auth.admin, input, Boolean(body.parentArtifactId));
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

    let taskId = body.taskId
      ? await validateTask(auth.admin, auth.user.id, String(body.taskId), toolSlug)
      : null;
    const parentArtifact = body.parentArtifactId
      ? await loadArtifact(auth.admin, auth.user.id, taskId!, String(body.parentArtifactId))
      : null;
    const generationMode = requestedGenerationMode as HaiWorkGenerationMode;
    if (generationMode === "lesson-plan-optimization" && !parentArtifact) {
      throw new HttpError(400, "生成优化教案时必须先确认一份诊断报告。");
    }
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
      generationMode,
      previousArtifactKind: String(parentArtifact?.content_json?.artifact_kind ?? ""),
    });
    const estimatedInputTokens = estimateTokens(prompt.system) + estimateTokens(prompt.user);

    const run = await createRun(auth.admin, {
      taskId,
      taskTitle: buildWorkTaskTitle(toolSlug, module.name, input),
      toolSlug,
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
    taskId = run.task_id;
    if (run.replayed) return workSubmissionResponse(run, body.responseMode, true);
    await attachMaterials(auth.admin, auth.user.id, taskId, materialIds);
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
          model: completionOptions.model,
          model_provider_id: module.model_provider_id,
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

    try {
      const { error } = await auth.admin.rpc("hai_enqueue_work_job", {
        p_run_id: run.id,
        p_payload: {
          prompt, module: { slug: module.slug, model_provider_id: module.model_provider_id },
          completionOptions, estimatedInputTokens,
          title: buildWorkArtifactTitle(toolSlug, module.name, input),
          artifactKind: generationMode === "lesson-plan-optimization" ? "lesson_plan_optimization" : "diagnosis_report",
        },
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      // A lost enqueue response can follow a committed transaction. Do not
      // close or release an accepted job. An unqueued preparation retains the
      // legacy bounded cleanup; a committed async job is owned by the worker.
      throw new HttpError(503, "任务提交结果暂未确认，请查看最近任务或使用原请求重试。");
    }
    await auth.admin.rpc("hai_dispatch_work_jobs");
    return workSubmissionResponse({ id: run.id, task_id: taskId, status: "queued" }, body.responseMode);

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
  const resolvedSkill = selected ?? createEmptyWorkSkill(moduleSlug);
  if (!selected) console.warn(`[hai-work] ${moduleSlug} 没有可用的已发布 Skill，使用运行时空 Skill。`);
  const { data: references, error: referencesError } = resolvedSkill.version.id
    ? await admin
      .from("hai_work_skill_references")
      .select("id, path, name, description, media_type, content, content_hash, load_mode, max_chars, sort_order, metadata")
      .eq("skill_version_id", resolvedSkill.version.id)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (referencesError) throw new HttpError(500, `Work Skill references 加载失败：${referencesError.message}`);
  return {
    ...resolvedSkill,
    version: { ...resolvedSkill.version, references: references ?? [] },
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

async function loadTextbookContext(
  admin: any,
  input: Record<string, unknown>,
  allowLegacyRevision = false,
) {
  let collectionSlug = String(input.collection_slug ?? "").trim();
  let unitNumber = parseRouteNumber(input.unit_route_number);
  let lessonNumber = parseRouteNumber(input.lesson_route_number);
  let frameNumber = parseRouteNumber(input.frame_route_number);
  let hasAnyFixedRouteId = Boolean(collectionSlug || unitNumber || lessonNumber || frameNumber);
  if (!hasAnyFixedRouteId && allowLegacyRevision) {
    const snapshotContext = await loadTextbookContextFromSnapshot(admin, input);
    if (snapshotContext) return snapshotContext;
  }
  if (!hasAnyFixedRouteId) {
    const recoveredRoute = await recoverTextbookRouteFromSnapshot(admin, input);
    if (recoveredRoute) {
      collectionSlug = recoveredRoute.collectionSlug;
      unitNumber = recoveredRoute.unitNumber;
      lessonNumber = recoveredRoute.lessonNumber;
      frameNumber = recoveredRoute.frameNumber;
      hasAnyFixedRouteId = true;
    }
  }
  if (!hasAnyFixedRouteId) {
    // Runs created before fixed textbook routing may have been valid because
    // they used pasted textbook content or uploaded materials. Keep those
    // existing artifacts revisable; new requests must still choose the catalog
    // route whenever the selected subject is already covered.
    if (allowLegacyRevision) return { context: "", sources: [] as TextbookSource[] };
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

async function loadTextbookContextFromSnapshot(admin: any, input: Record<string, unknown>) {
  const snapshots = Array.isArray(input.textbook_sources)
    ? input.textbook_sources
      .map(normalizeRecord)
      .map((item) => ({ section_id: String(item.section_id ?? "").trim() }))
      .filter((item) => UUID_PATTERN.test(item.section_id))
    : [];
  if (snapshots.length === 0) return null;
  const sectionIds = [...new Set(snapshots.map((item) => item.section_id))];
  const { data: sections, error: sectionError } = await admin
    .from("hai_textbook_sections")
    .select("id, collection_id, section_level, unit_label, unit_title, lesson_label, lesson_title, frame_label, frame_title, unit_number, lesson_number, frame_number, section_path, content_type, content_markdown, content_hash, verification_status")
    .in("id", sectionIds);
  if (sectionError) throw new HttpError(500, `读取历史教材内容失败：${sectionError.message}`);
  const sectionById = new Map((sections ?? []).map((item: any) => [String(item.id), item]));
  if (sectionIds.some((id) => !sectionById.has(id))) return null;
  const collectionIds = [...new Set((sections ?? []).map((item: any) => String(item.collection_id)).filter(Boolean))];
  if (collectionIds.length !== 1) return null;
  const { data: collections, error: collectionError } = await admin
    .from("hai_textbook_collections")
    .select("id, slug, title, stage, subject, edition_label, publication_status, requires_confirmation, source_hash")
    .in("id", collectionIds);
  if (collectionError) throw new HttpError(500, `读取历史教材版本失败：${collectionError.message}`);
  const collection = (collections ?? [])[0] as Record<string, unknown> | undefined;
  if (!collection) return null;
  const subject = String(input.subject ?? "").trim();
  const collectionStage = String(collection.stage ?? "").trim();
  const collectionSubject = String(collection.subject ?? "").trim();
  const politicsSubjects = new Set(["思政", "思想政治", "道德与法治"]);
  if (
    collectionStage !== String(input.stage ?? "").trim() ||
    (collectionSubject !== subject && !(politicsSubjects.has(subject) && politicsSubjects.has(collectionSubject)))
  ) return null;

  const sources = snapshots.map(({ section_id }) => {
    const section = sectionById.get(section_id) as Record<string, unknown>;
    return {
      section_id,
      collection_slug: String(collection.slug ?? ""),
      collection_title: String(collection.title ?? ""),
      edition_label: String(collection.edition_label ?? ""),
      publication_status: String(collection.publication_status ?? ""),
      verification_status: String(section.verification_status ?? ""),
      requires_confirmation: Boolean(collection.requires_confirmation),
      section_path: String(section.section_path ?? ""),
      content_type: String(section.content_type ?? ""),
      section_level: String(section.section_level ?? "") || null,
      unit_label: String(section.unit_label ?? "") || null,
      unit_title: String(section.unit_title ?? "") || null,
      lesson_label: String(section.lesson_label ?? "") || null,
      lesson_title: String(section.lesson_title ?? "") || null,
      frame_label: String(section.frame_label ?? "") || null,
      frame_title: String(section.frame_title ?? "") || null,
      content_markdown: String(section.content_markdown ?? ""),
      source_hash: String(collection.source_hash ?? ""),
      content_hash: String(section.content_hash ?? ""),
      unit_number: Number(section.unit_number),
      lesson_number: Number(section.lesson_number),
      frame_number: section.frame_number === null ? null : Number(section.frame_number),
    } as TextbookSource;
  });
  let length = 0;
  const sectionsForPrompt: string[] = [];
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
    sectionsForPrompt.push(section);
    length += section.length;
  }
  return { context: sectionsForPrompt.join("\n\n"), sources };
}

async function recoverTextbookRouteFromSnapshot(admin: any, input: Record<string, unknown>) {
  const snapshots = Array.isArray(input.textbook_sources)
    ? input.textbook_sources
      .map(normalizeRecord)
      .map((item) => ({
        section_id: String(item.section_id ?? "").trim(),
        collection_slug: String(item.collection_slug ?? "").trim() || null,
      }))
      .filter((item) => UUID_PATTERN.test(item.section_id))
    : [];
  if (snapshots.length === 0) return null;
  const sectionIds = [...new Set(snapshots.map((item) => item.section_id))];
  const { data: sections, error: sectionError } = await admin
    .from("hai_textbook_sections")
    .select("id, collection_id, section_level, unit_number, lesson_number, frame_number")
    .in("id", sectionIds);
  if (sectionError) throw new HttpError(500, `恢复历史教材路由失败：${sectionError.message}`);
  const collectionIds = [...new Set((sections ?? []).map((item: any) => String(item.collection_id)).filter(Boolean))];
  if (collectionIds.length === 0) return null;
  const { data: collections, error: collectionError } = await admin
    .from("hai_textbook_collections")
    .select("id, slug, stage, subject")
    .in("id", collectionIds);
  if (collectionError) throw new HttpError(500, `恢复历史教材版本失败：${collectionError.message}`);
  const collectionById = new Map<string, Record<string, unknown>>(
    (collections ?? []).map((item: any) => [String(item.id), normalizeRecord(item)]),
  );
  const rows = (sections ?? []).flatMap((section: any) => {
    const collection = collectionById.get(String(section.collection_id));
    return collection
      ? [{
        id: String(section.id),
        collection_id: String(section.collection_id),
        collection_slug: String(collection["slug"] ?? ""),
        stage: String(collection["stage"] ?? ""),
        subject: String(collection["subject"] ?? ""),
        section_level: String(section.section_level ?? ""),
        unit_number: Number(section.unit_number),
        lesson_number: Number(section.lesson_number),
        frame_number: section.frame_number === null ? null : Number(section.frame_number),
      }]
      : [];
  });
  return resolveTextbookRouteFromSnapshots(snapshots, rows, input);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { data, error } = await admin.from("hai_work_artifacts").select("id, content_markdown, content_json")
    .eq("id", artifactId).eq("task_id", taskId).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "上一版产物不存在。");
  return data as { id: string; content_markdown: string; content_json?: Record<string, unknown> };
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
  taskId: string | null;
  taskTitle: string;
  toolSlug: string;
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
  const { data, error } = await admin.rpc("hai_prepare_work_run", {
    p_user_id: params.userId,
    p_client_request_id: params.clientRequestId,
    p_task_id: params.taskId,
    p_task_title: params.taskTitle,
    p_module_slug: params.toolSlug,
    p_run: {
      skill_version_id: params.skill.version.id || null,
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
        reference_paths: selectWorkSkillReferences(params.skill, params.input)
          .map((item) => item.path),
        reference_hashes: selectWorkSkillReferences(params.skill, params.input)
          .map((item) => item.content_hash),
        textbook_sources: params.textbookSources.map(textbookSourceSnapshot),
        case_sources: params.caseSources.map(politicsCaseSourceSnapshot),
      },
      revision_instruction: params.revisionInstruction || null,
    },
  });
  if (error) throw new HttpError(500, error.message);
  return data as {
    id: string;
    task_id: string;
    status: string;
    replayed: boolean;
  };
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
      thinking_enabled: params.completionOptions.thinkingEnabled,
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

async function loadIdempotentRun(admin: any, userId: string, requestId: string) {
  const { data, error } = await admin.from("hai_work_runs").select(
    "id, task_id, status, error_message, input_tokens, output_tokens, artifact:hai_work_artifacts!hai_work_artifacts_run_id_fkey(id, version_number)",
  ).eq("user_id", userId).eq("client_request_id", requestId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return data;
}

function workSubmissionResponse(run: any, responseMode: unknown, replayed = false) {
  const artifact = Array.isArray(run.artifact) ? run.artifact[0] : run.artifact;
  const payload = { taskId: run.task_id, runId: run.id, status: run.status,
    artifactId: artifact?.id ?? null, error: run.error_message ?? null, replayed };
  if (responseMode === "json") {
    return jsonResponse(payload, ["queued", "running"].includes(run.status) ? 202 : 200);
  }
  // Compatibility: old clients receive a short acknowledgement, never a model stream.
  const event = run.status === "failed"
    ? { type: "error", ...payload, message: run.error_message || "任务执行失败。" }
    : run.status === "completed" && artifact
    ? { type: "done", ...payload, versionNumber: artifact.version_number }
    : { type: "ready", ...payload };
  return new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: sseHeaders() });
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

function buildMaterialQuery(input: Record<string, unknown>) {
  return [input.stage, input.subject, input.unit, input.topic, input.teaching_mode, input.lesson_type, input.segment_type]
    .map((item) => String(item ?? "").trim()).filter(Boolean).join(" ") || "教学设计";
}
