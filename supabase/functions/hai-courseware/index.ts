import { loadImagePromptOverrides } from "../_shared/hai_image_prompt_config.ts";
import { imagePromptValue } from "../_shared/hai_image_prompt_catalog.ts";
import {
  assertHaiAccess,
  type AuthedRequest,
  estimateTokens,
  finalizeUsage,
  type HaiProviderUsage,
  handleCors,
  HttpError,
  jsonResponse,
  recordHaiModelCall,
  requireUser,
  reserveUsage,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  type CoursewareGenerationOptions,
  normalizeCoursewareDeck,
  parseCoursewareJson,
} from "../_shared/hai_courseware.ts";
import {
  DEFAULT_COURSEWARE_COLOR_SCHEME,
  DEFAULT_COURSEWARE_FLAT_PATTERN,
  normalizeCoursewareAnimationPreset,
  normalizeCoursewareColorScheme,
  normalizeCoursewareFlatPattern,
  normalizeCoursewareFontPairing,
} from "../_shared/hai_courseware_style.ts";
import {
  buildCoursewareDesignPrompt,
  buildCoursewareImageOnlyDeck,
  buildCoursewareImagePromptPrompt,
  buildCoursewareMaterialPrompt,
  buildCoursewareOutlinePrompt,
  buildCoursewareVisualDesignPrompt,
  buildInteractiveHtmlPrompt,
  buildInteractiveHtmlRetryPrompt,
  type CoursewareSourcePack,
  type CoursewareSupplement,
  formatCoursewareOutline,
  formatCoursewareSupplements,
  hydrateCoursewareDesign,
  hydrateInteractiveHtml,
  parseCoursewareImagePrompts,
  parseCoursewareManuscript,
  parseCoursewareSupplements,
  parseCoursewareVisualDesign,
  validateCoursewareManuscriptCoverage,
} from "../_shared/hai_courseware_pipeline.ts";
import {
  buildCoursewareSkillSystemPrompt,
  type CoursewareSkillCandidate,
  type CoursewareSkillContext,
  coursewareSkillSnapshot,
  inferCoursewareSourceInfo,
  selectCoursewareSkill,
  selectCoursewareSkillReferences,
} from "../_shared/hai_courseware_skill.ts";

type RequestBody = {
  action?: unknown;
  deckId?: unknown;
  outline?: unknown;
  visualDesign?: unknown;
  artifactId?: unknown;
  clientRequestId?: unknown;
  visualMode?: unknown;
  outputMode?: unknown;
  length?: unknown;
  imageStrategy?: unknown;
  colorScheme?: unknown;
  fontPairing?: unknown;
  animationPreset?: unknown;
  flatPattern?: unknown;
};

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);
    const body = await request.json().catch(() => ({})) as RequestBody;
    const action =
      body.action === "confirm_outline" || body.action === "confirm_visual"
        ? body.action
        : "create";
    if (action !== "create") {
      return await continuePureImageWorkflow(auth, body, action);
    }
    const artifactId = String(body.artifactId ?? "").trim();
    const clientRequestId = String(body.clientRequestId ?? "").trim() ||
      crypto.randomUUID();
    const visualMode = body.visualMode === "V3"
      ? "V3"
      : body.visualMode === "V2"
      ? "V2"
      : "V1";
    const options: CoursewareGenerationOptions = {
      visualMode,
      outputMode: body.outputMode === "interactive" ? "interactive" : "ppt",
      length: body.length === "standard" ? "standard" : "compact",
      imageStrategy: visualMode === "V2" &&
          (body.imageStrategy === "minimal" ||
            body.imageStrategy === "enhanced" || body.imageStrategy === "smart")
        ? body.imageStrategy
        : visualMode === "V2"
        ? "smart"
        : visualMode === "V3"
        ? "enhanced"
        : "minimal",
      colorScheme: visualMode === "V1"
        ? normalizeCoursewareColorScheme(DEFAULT_COURSEWARE_COLOR_SCHEME)
        : undefined,
      fontPairing: visualMode === "V1"
        ? normalizeCoursewareFontPairing(undefined)
        : undefined,
      animationPreset: visualMode === "V1"
        ? normalizeCoursewareAnimationPreset(body.animationPreset)
        : undefined,
      flatPattern: normalizeCoursewareFlatPattern(
        visualMode === "V1" ? DEFAULT_COURSEWARE_FLAT_PATTERN : "none",
      ),
    };
    if (!/^[0-9a-f-]{36}$/i.test(artifactId)) {
      throw new HttpError(400, "教学设计产物标识不正确。");
    }
    if (clientRequestId.length > 100) {
      throw new HttpError(400, "client_request_id 不能超过 100 个字符。");
    }

    const { data: existing } = await auth.admin.from("hai_courseware_decks")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) return jsonResponse({ deck: existing, replayed: true });

    const { data: artifact, error: artifactError } = await auth.admin
      .from("hai_work_artifacts")
      .select(
        "id, task_id, run_id, version_number, title, content_markdown, user_id",
      )
      .eq("id", artifactId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (artifactError) throw new HttpError(500, artifactError.message);
    if (!artifact) throw new HttpError(404, "教学设计产物不存在或你无权访问。");
    const { data: task, error: taskError } = await auth.admin
      .from("hai_work_tasks")
      .select("id, title, module_slug, user_id")
      .eq("id", artifact.task_id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (taskError) throw new HttpError(500, taskError.message);
    if (!task || task.module_slug !== "subject-lesson-design") {
      throw new HttpError(400, "课件 MVP 目前只支持 HAI Work 的教学设计产物。");
    }
    if (!artifact.content_markdown?.trim()) {
      throw new HttpError(400, "教学设计产物为空，无法生成课件。");
    }

    const { subject, grade, subjectProfile, lessonGenre, topic } =
      inferCoursewareSourceInfo(
        artifact.content_markdown,
        String(task.title ?? "课堂课件"),
      );
    const source = {
      taskId: String(artifact.task_id),
      artifactId: String(artifact.id),
      artifactVersion: Number(artifact.version_number),
      taskTitle: String(task.title ?? "教学设计"),
      artifactTitle: String(artifact.title ?? "教学设计"),
      subject,
      grade,
      topic,
      subjectProfile,
      lessonGenre,
    };
    const skillContext: CoursewareSkillContext = {
      subject,
      subjectProfile,
      stage: extractStage(grade),
      lessonGenre,
      visualMode: options.visualMode,
      outputMode: options.outputMode === "interactive" ? "interactive" : "ppt",
    };
    const skill = await loadCoursewareSkill(auth.admin, skillContext);
    const selectedReferences = skill
      ? selectCoursewareSkillReferences(skill, skillContext)
      : [];
    const sourcePack = await loadCoursewareSourcePack(
      auth.admin,
      auth.user.id,
      source.taskId,
      String(artifact.run_id),
    );
    const materialPrompt = buildCoursewareMaterialPrompt(
      artifact.content_markdown,
      sourcePack,
      source,
    );
    const materialSystemPrompt = skill
      ? buildCoursewareSkillSystemPrompt(skill, selectedReferences, "material")
      : "你只依据教案和来源包补齐缺失的课堂投屏素材，不伪造原文或数据。";
    const contentSystemPrompt = skill
      ? buildCoursewareSkillSystemPrompt(skill, selectedReferences, "content")
      : "你只依据教案生成规定格式的逐页 Markdown 内容稿。";
    const designSystemPrompt = skill
      ? buildCoursewareSkillSystemPrompt(
        skill,
        selectedReferences,
        options.outputMode === "interactive" ? "interactive_design" : "design",
      )
      : options.outputMode === "interactive"
      ? "你只依据逐页教学大纲直接生成一份完整的互动课件 HTML；CSS 与 JavaScript 只能内联，不引用外部资源，不发起网络请求，不访问宿主页面。"
      : "你只依据逐页内容稿生成组件与布局设计 JSON，不改写素材。";
    const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
    const materialMaxTokens = options.length === "standard" ? 8000 : 6000;
    const contentMaxTokens = options.length === "standard" ? 16000 : 12000;
    const designMaxTokens = options.outputMode === "interactive"
      ? options.length === "standard" ? 22000 : 16000
      : options.length === "standard"
      ? 9000
      : 7000;
    const { data: inserted, error: insertError } = await auth.admin.from(
      "hai_courseware_decks",
    ).insert({
      user_id: auth.user.id,
      source_task_id: source.taskId,
      source_artifact_id: source.artifactId,
      source_artifact_version: source.artifactVersion,
      client_request_id: clientRequestId,
      title: source.topic.slice(0, 120) || "HAI 课堂课件",
      visual_mode: options.visualMode,
      lesson_genre: lessonGenre,
      skill_version_id: skill?.version.id || null,
      skill_snapshot: skill
        ? coursewareSkillSnapshot(skill, selectedReferences, skillContext)
        : {
          slug: "built-in-courseware-fallback",
          version: "v1",
          subject_profile: subjectProfile,
          lesson_genre: lessonGenre,
          reference_paths: [],
        },
      status: "queued",
    }).select("*").single();
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: replay } = await auth.admin.from("hai_courseware_decks")
          .select("*")
          .eq("user_id", auth.user.id).eq("client_request_id", clientRequestId)
          .maybeSingle();
        if (replay) return jsonResponse({ deck: replay, replayed: true });
      }
      throw new HttpError(500, insertError.message);
    }

    await auth.admin.from("hai_courseware_decks").update({ status: "running" })
      .eq("id", inserted.id);
    const outputs: string[] = [];
    let parsedAiOutput: unknown = null;
    try {
      const runModelStage = async (params: {
        callIndex: number;
        stageName:
          | "material_supplement"
          | "ppt_outline"
          | "component_design"
          | "interactive_html"
          | "interactive_html_retry"
          | "image_prompt";
        systemPrompt: string;
        userPrompt: string;
        maxTokens: number;
        responseFormat: "json_object" | null;
      }) => {
        const startedAt = new Date();
        const stageRequestId = `${inserted.id}:${params.callIndex}`;
        const estimatedInputTokens = estimateTokens(
          `${params.systemPrompt}\n\n${params.userPrompt}`,
        );
        const usageState: { value: HaiProviderUsage | null } = { value: null };
        const chunks: string[] = [];
        let usageReserved = false;
        try {
          await reserveUsage({
            userClient: auth.userClient,
            requestId: stageRequestId,
            route: "hai-courseware",
            estimatedInputTokens,
            estimatedOutputTokens: params.maxTokens,
            metadata: {
              deck_id: inserted.id,
              pipeline_stage: params.stageName,
              source_artifact_id: source.artifactId,
              skill_version_id: skill?.version.id || null,
              parent_client_request_id: clientRequestId,
            },
          });
          usageReserved = true;
          for await (
            const chunk of streamDeepSeek([
              { role: "system", content: params.systemPrompt },
              { role: "user", content: params.userPrompt },
            ], {
              model,
              temperature: params.stageName === "component_design"
                ? 0.1
                : params.stageName === "interactive_html" ||
                    params.stageName === "interactive_html_retry"
                ? 0.25
                : 0.15,
              maxTokens: params.maxTokens,
              responseFormat: params.responseFormat,
              timeoutMs: 180_000,
              onUsage: (value) => {
                usageState.value = value;
              },
            })
          ) chunks.push(chunk);
          const output = chunks.join("");
          const completedAt = new Date();
          outputs.push(output);
          try {
            await recordHaiModelCall({
              admin: auth.admin,
              userId: auth.user.id,
              requestId: clientRequestId,
              callIndex: params.callIndex,
              stage: options.visualMode === "V3"
                ? "courseware_pure_image_planning"
                : "courseware_editable",
              route: "hai-courseware",
              entityType: "courseware_deck",
              entityId: inserted.id,
              model,
              provider: "deepseek",
              startedAt,
              completedAt,
              status: "completed",
              usage: usageState.value,
              metadata: {
                pipeline_stage: params.stageName,
                visual_mode: options.visualMode,
                source_artifact_id: source.artifactId,
                skill_version_id: skill?.version.id || null,
              },
            });
            await finalizeUsage({
              userClient: auth.userClient,
              requestId: stageRequestId,
              status: "completed",
              route: "hai-courseware",
              inputTokens: usageState.value?.promptTokens ||
                estimatedInputTokens,
              outputTokens: usageState.value?.completionTokens ||
                estimateTokens(output),
              entityType: "courseware_deck",
              entityId: inserted.id,
              durationMs: completedAt.getTime() - startedAt.getTime(),
              metadata: {
                pipeline_stage: params.stageName,
                source_artifact_id: source.artifactId,
                parent_client_request_id: clientRequestId,
              },
            });
          } catch (bookkeepingError) {
            console.warn(
              `hai-courseware ${params.stageName} call bookkeeping failed`,
              bookkeepingError,
            );
          }
          return output;
        } catch (error) {
          if (usageReserved) {
            try {
              await finalizeUsage({
                userClient: auth.userClient,
                requestId: stageRequestId,
                status: "failed",
                route: "hai-courseware",
                inputTokens: usageState.value?.promptTokens ||
                  estimatedInputTokens,
                outputTokens: usageState.value?.completionTokens ||
                  estimateTokens(chunks.join("")),
                entityType: "courseware_deck",
                entityId: inserted.id,
                durationMs: Date.now() - startedAt.getTime(),
                metadata: {
                  pipeline_stage: params.stageName,
                  source_artifact_id: source.artifactId,
                  parent_client_request_id: clientRequestId,
                },
              });
            } catch (usageError) {
              console.warn(
                `hai-courseware ${params.stageName} failed to finalize usage`,
                usageError,
              );
            }
          }
          throw error;
        }
      };

      const materialOutput = await runModelStage({
        callIndex: 1,
        stageName: "material_supplement",
        systemPrompt: materialSystemPrompt,
        userPrompt: materialPrompt,
        maxTokens: materialMaxTokens,
        responseFormat: "json_object",
      });
      const supplements = parseCoursewareSupplements(materialOutput);
      parsedAiOutput = {
        materialSupplements: supplements,
        sourcePack: sourcePackSnapshot(sourcePack),
        generationOptions: options,
      };
      await auth.admin.from("hai_courseware_decks").update({
        ai_output: parsedAiOutput,
        ai_output_text: `# 第一阶段：素材补全稿\n\n${
          formatCoursewareSupplements(supplements)
        }`,
      }).eq("id", inserted.id);

      const imagePromptOverrides = await loadImagePromptOverrides(auth.admin);
      const outlinePrompt = buildCoursewareOutlinePrompt(
        artifact.content_markdown,
        source,
        options,
        supplements,
        imagePromptOverrides,
      );
      const contentOutput = await runModelStage({
        callIndex: 2,
        stageName: "ppt_outline",
        systemPrompt: contentSystemPrompt,
        userPrompt: outlinePrompt,
        maxTokens: contentMaxTokens,
        responseFormat: null,
      });
      const manuscript = parseCoursewareManuscript(
        contentOutput,
        supplements,
        options.visualMode,
      );
      validateCoursewareManuscriptCoverage(
        manuscript,
        artifact.content_markdown,
      );
      const normalizedManuscript = formatCoursewareOutline(manuscript);
      parsedAiOutput = {
        ...parsedAiOutput as Record<string, unknown>,
        pptOutline: manuscript.pages,
      };
      await auth.admin.from("hai_courseware_decks").update({
        ai_output: parsedAiOutput,
        ai_output_text: `# 第一阶段：素材补全稿\n\n${
          formatCoursewareSupplements(supplements)
        }\n\n# 第二阶段：逐页 PPT 大纲\n\n${normalizedManuscript}`,
      }).eq("id", inserted.id);

      if (options.visualMode === "V3") {
        await auth.admin.from("hai_courseware_decks").update({
          status: "awaiting_outline_confirmation",
          ai_output: parsedAiOutput,
          error_message: null,
        }).eq("id", inserted.id);
        const { data: deck } = await auth.admin.from("hai_courseware_decks")
          .select("*").eq("id", inserted.id).single();
        return jsonResponse({ deck });
      }

      let deckSpec;
      let aiOutputText: string;
      const designPrompt = options.outputMode === "interactive"
        ? buildInteractiveHtmlPrompt(normalizedManuscript, source)
        : buildCoursewareDesignPrompt(normalizedManuscript, source, options);
      let designOutput = await runModelStage({
        callIndex: 3,
        stageName: options.outputMode === "interactive"
          ? "interactive_html"
          : "component_design",
        systemPrompt: designSystemPrompt,
        userPrompt: designPrompt,
        maxTokens: designMaxTokens,
        responseFormat: options.outputMode === "interactive"
          ? null
          : "json_object",
      });
      let hydratedOutput;
      if (options.outputMode === "interactive") {
        try {
          hydratedOutput = hydrateInteractiveHtml(
            designOutput,
            manuscript,
            source,
          );
        } catch (firstError) {
          const firstMessage = firstError instanceof Error
            ? firstError.message
            : "互动网页首次生成未通过校验。";
          designOutput = await runModelStage({
            callIndex: 4,
            stageName: "interactive_html_retry",
            systemPrompt:
              "你负责重新生成精简且完整的互动课件 HTML。必须先覆盖全部场景并闭合文档，再添加少量共享样式与互动；只输出 HTML。",
            userPrompt: buildInteractiveHtmlRetryPrompt(
              normalizedManuscript,
              source,
              firstMessage,
            ),
            maxTokens: designMaxTokens,
            responseFormat: null,
          });
          try {
            hydratedOutput = hydrateInteractiveHtml(
              designOutput,
              manuscript,
              source,
            );
          } catch (retryError) {
            const retryMessage = retryError instanceof Error
              ? retryError.message
              : "互动网页再次生成未通过校验。";
            throw new Error(`互动网页两次生成均未完成：${retryMessage}`);
          }
        }
      } else {
        hydratedOutput = hydrateCoursewareDesign(
          designOutput,
          manuscript,
          source,
          options,
        );
      }
      parsedAiOutput = options.outputMode === "interactive"
        ? {
          ...parsedAiOutput as Record<string, unknown>,
          interactiveHtml: designOutput,
        }
        : {
          ...parsedAiOutput as Record<string, unknown>,
          componentDesign: parseCoursewareJson(designOutput),
        };
      deckSpec = options.outputMode === "interactive"
        ? hydratedOutput
        : normalizeCoursewareDeck(
          JSON.stringify(hydratedOutput),
          source,
          options,
        );
      aiOutputText = `# 第一阶段：素材补全稿\n\n${
        formatCoursewareSupplements(supplements)
      }\n\n# 第二阶段：逐页教学大纲\n\n${normalizedManuscript}\n\n# 第三阶段：${
        options.outputMode === "interactive"
          ? "互动网页 HTML"
          : "组件与布局设计"
      }\n\n${designOutput}`;
      await auth.admin.from("hai_courseware_decks").update({
        status: "completed",
        title: deckSpec.title.slice(0, 120),
        deck_spec: deckSpec,
        ai_output: parsedAiOutput,
        ai_output_text: aiOutputText,
        error_message: null,
      }).eq("id", inserted.id);
      const { data: deck } = await auth.admin.from("hai_courseware_decks")
        .select("*").eq("id", inserted.id).single();
      return jsonResponse({ deck });
    } catch (error) {
      const message = error instanceof Error ? error.message : "课件生成失败。";
      await auth.admin.from("hai_courseware_decks").update({
        status: "failed",
        error_message: message.slice(0, 2000),
        ai_output: parsedAiOutput,
        ai_output_text: outputs.join("\n\n").slice(0, 180000),
      }).eq("id", inserted.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    console.error("hai-courseware failed", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "课件生成失败。",
    }, 500);
  }
});

async function continuePureImageWorkflow(
  auth: AuthedRequest,
  body: RequestBody,
  action: "confirm_outline" | "confirm_visual",
) {
  const deckId = String(body.deckId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(deckId)) {
    throw new HttpError(400, "课件标识不正确。");
  }
  const { data: deck, error: deckError } = await auth.admin.from(
    "hai_courseware_decks",
  )
    .select("*").eq("id", deckId).eq("user_id", auth.user.id).maybeSingle();
  if (deckError) throw new HttpError(500, deckError.message);
  if (!deck) throw new HttpError(404, "课件不存在或你无权访问。");
  if (deck.visual_mode !== "V3") {
    throw new HttpError(400, "只有纯图片PPT需要中间确认。");
  }
  const expectedStatus = action === "confirm_outline"
    ? "awaiting_outline_confirmation"
    : "awaiting_visual_confirmation";
  if (deck.status !== expectedStatus) {
    throw new HttpError(
      409,
      action === "confirm_outline"
        ? "当前课件不在大纲确认阶段。"
        : "当前课件不在视觉风格确认阶段。",
    );
  }

  const [
    { data: artifact, error: artifactError },
    { data: task, error: taskError },
  ] = await Promise.all([
    auth.admin.from("hai_work_artifacts")
      .select("id, task_id, version_number, title, content_markdown, user_id")
      .eq("id", deck.source_artifact_id).eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.admin.from("hai_work_tasks")
      .select("id, title, module_slug, user_id")
      .eq("id", deck.source_task_id).eq("user_id", auth.user.id).maybeSingle(),
  ]);
  if (artifactError) throw new HttpError(500, artifactError.message);
  if (taskError) throw new HttpError(500, taskError.message);
  if (!artifact || !task) {
    throw new HttpError(404, "课件的原教学设计已不可用。");
  }

  const { subject, grade, subjectProfile, lessonGenre, topic } =
    inferCoursewareSourceInfo(
      String(artifact.content_markdown ?? ""),
      String(task.title ?? deck.title),
    );
  const source = {
    taskId: String(artifact.task_id),
    artifactId: String(artifact.id),
    artifactVersion: Number(artifact.version_number),
    taskTitle: String(task.title ?? "教学设计"),
    artifactTitle: String(artifact.title ?? "教学设计"),
    subject,
    grade,
    topic,
    subjectProfile,
    lessonGenre,
  };
  const storedOutput = rawRecord(deck.ai_output);
  const storedOptions = rawRecord(storedOutput.generationOptions);
  const options: CoursewareGenerationOptions = {
    visualMode: "V3",
    length: storedOptions.length === "standard" ? "standard" : "compact",
    imageStrategy: "enhanced",
    flatPattern: "none",
  };
  const supplements = Array.isArray(storedOutput.materialSupplements)
    ? storedOutput.materialSupplements as CoursewareSupplement[]
    : [];
  const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";

  const runStage = async (params: {
    callIndex: number;
    stageName: "visual_design" | "image_prompt";
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    responseFormat: "json_object" | null;
  }) => {
    const startedAt = new Date();
    const stageRequestId = `${deck.id}:${params.callIndex}`;
    const estimatedInputTokens = estimateTokens(
      `${params.systemPrompt}\n\n${params.userPrompt}`,
    );
    const usageState: { value: HaiProviderUsage | null } = { value: null };
    const chunks: string[] = [];
    let usageReserved = false;
    try {
      await reserveUsage({
        userClient: auth.userClient,
        requestId: stageRequestId,
        route: "hai-courseware",
        estimatedInputTokens,
        estimatedOutputTokens: params.maxTokens,
        metadata: {
          deck_id: deck.id,
          pipeline_stage: params.stageName,
          visual_mode: "V3",
          source_artifact_id: source.artifactId,
          parent_client_request_id: deck.client_request_id,
        },
      });
      usageReserved = true;
      for await (
        const chunk of streamDeepSeek([
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ], {
          model,
          temperature: 0.15,
          maxTokens: params.maxTokens,
          responseFormat: params.responseFormat,
          timeoutMs: 180_000,
          onUsage: (value) => {
            usageState.value = value;
          },
        })
      ) chunks.push(chunk);
      const output = chunks.join("");
      const completedAt = new Date();
      try {
        await recordHaiModelCall({
          admin: auth.admin,
          userId: auth.user.id,
          requestId: deck.client_request_id,
          callIndex: params.callIndex,
          stage: "courseware_pure_image_planning",
          route: "hai-courseware",
          entityType: "courseware_deck",
          entityId: deck.id,
          model,
          provider: "deepseek",
          startedAt,
          completedAt,
          status: "completed",
          usage: usageState.value,
          metadata: {
            pipeline_stage: params.stageName,
            visual_mode: "V3",
            source_artifact_id: source.artifactId,
          },
        });
        await finalizeUsage({
          userClient: auth.userClient,
          requestId: stageRequestId,
          status: "completed",
          route: "hai-courseware",
          inputTokens: usageState.value?.promptTokens || estimatedInputTokens,
          outputTokens: usageState.value?.completionTokens ||
            estimateTokens(output),
          entityType: "courseware_deck",
          entityId: deck.id,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          metadata: {
            pipeline_stage: params.stageName,
            visual_mode: "V3",
            source_artifact_id: source.artifactId,
            parent_client_request_id: deck.client_request_id,
          },
        });
      } catch (bookkeepingError) {
        console.warn(
          `hai-courseware ${params.stageName} bookkeeping failed`,
          bookkeepingError,
        );
      }
      return output;
    } catch (error) {
      if (usageReserved) {
        await finalizeUsage({
          userClient: auth.userClient,
          requestId: stageRequestId,
          status: "failed",
          route: "hai-courseware",
          inputTokens: usageState.value?.promptTokens || estimatedInputTokens,
          outputTokens: usageState.value?.completionTokens ||
            estimateTokens(chunks.join("")),
          entityType: "courseware_deck",
          entityId: deck.id,
          durationMs: Date.now() - startedAt.getTime(),
          metadata: {
            pipeline_stage: params.stageName,
            visual_mode: "V3",
            source_artifact_id: source.artifactId,
            parent_client_request_id: deck.client_request_id,
          },
        }).catch(() => undefined);
      }
      throw error;
    }
  };

  await auth.admin.from("hai_courseware_decks").update({
    status: "running",
    error_message: null,
  }).eq("id", deck.id);
  try {
    const imagePromptOverrides = await loadImagePromptOverrides(auth.admin);
    if (action === "confirm_outline") {
      if (!Array.isArray(body.outline)) {
        throw new HttpError(400, "请提交完整的逐页 PPT 大纲。");
      }
      const manuscript = parseCoursewareManuscript(
        outlinePagesToMarkdown(body.outline),
        supplements,
        "V3",
        true,
      );
      const normalizedOutline = formatCoursewareOutline(manuscript);
      const visualOutput = await runStage({
        callIndex: 3,
        stageName: "visual_design",
        systemPrompt:
          imagePromptValue("courseware.visual_system", imagePromptOverrides),
        userPrompt: buildCoursewareVisualDesignPrompt(
          normalizedOutline,
          source,
          imagePromptOverrides,
        ),
        maxTokens: 1800,
        responseFormat: null,
      });
      const visualDesign = parseCoursewareVisualDesign(visualOutput);
      const nextOutput = {
        ...storedOutput,
        pptOutline: manuscript.pages,
        visualDesign,
        outlineConfirmedAt: new Date().toISOString(),
      };
      const { data: updated, error: updateError } = await auth.admin.from(
        "hai_courseware_decks",
      ).update({
        status: "awaiting_visual_confirmation",
        ai_output: nextOutput,
        ai_output_text:
          `# 用户已确认的逐页 PPT 大纲\n\n${normalizedOutline}\n\n# 待确认的整体视觉设计\n\n${visualDesign}`,
        error_message: null,
      }).eq("id", deck.id).select("*").single();
      if (updateError) throw new HttpError(500, updateError.message);
      return jsonResponse({ deck: updated });
    }

    const visualDesign = parseCoursewareVisualDesign(
      String(body.visualDesign ?? ""),
    );
    const storedOutline = Array.isArray(storedOutput.pptOutline)
      ? storedOutput.pptOutline
      : [];
    const manuscript = parseCoursewareManuscript(
      outlinePagesToMarkdown(storedOutline),
      supplements,
      "V3",
      true,
    );
    const normalizedOutline = formatCoursewareOutline(manuscript);
    const imagePromptOutput = await runStage({
      callIndex: 4,
      stageName: "image_prompt",
      systemPrompt:
        imagePromptValue("courseware.planning_system", imagePromptOverrides),
      userPrompt: buildCoursewareImagePromptPrompt(
        normalizedOutline,
        source,
        options,
        visualDesign,
        imagePromptOverrides,
      ),
      maxTokens: options.length === "standard" ? 24000 : 15000,
      responseFormat: "json_object",
    });
    const imagePrompts = parseCoursewareImagePrompts(
      imagePromptOutput,
      manuscript,
    );
    const deckSpec = normalizeCoursewareDeck(
      JSON.stringify(
        buildCoursewareImageOnlyDeck(manuscript, source, options, imagePrompts),
      ),
      source,
      options,
    );
    const nextOutput = {
      ...storedOutput,
      pptOutline: manuscript.pages,
      visualDesign,
      imagePrompts,
      visualConfirmedAt: new Date().toISOString(),
    };
    const { data: updated, error: updateError } = await auth.admin.from(
      "hai_courseware_decks",
    ).update({
      status: "completed",
      title: deckSpec.title.slice(0, 120),
      deck_spec: deckSpec,
      ai_output: nextOutput,
      ai_output_text:
        `# 用户已确认的逐页 PPT 大纲\n\n${normalizedOutline}\n\n# 用户已确认的整体视觉设计\n\n${visualDesign}`,
      error_message: null,
    }).eq("id", deck.id).select("*").single();
    if (updateError) throw new HttpError(500, updateError.message);
    return jsonResponse({ deck: updated });
  } catch (error) {
    await auth.admin.from("hai_courseware_decks").update({
      status: expectedStatus,
      error_message:
        (error instanceof Error ? error.message : "课件确认阶段生成失败。")
          .slice(0, 2000),
    }).eq("id", deck.id);
    throw error;
  }
}

function outlinePagesToMarkdown(value: unknown[]) {
  return value.map((page, index) => {
    const item = rawRecord(page);
    return `## ${
      String(item.pageId ?? `P${String(index + 1).padStart(2, "0")}`)
    }\n\`\`\`json\n${JSON.stringify(item)}\n\`\`\``;
  }).join("\n\n");
}

function rawRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function snapshotIds(value: unknown, key: string) {
  return Array.isArray(value)
    ? value.map((item) => String(rawRecord(item)[key] ?? "").trim()).filter(
      (item) => /^[0-9a-f-]{36}$/i.test(item),
    )
    : [];
}

function sourcePackSnapshot(sourcePack: CoursewareSourcePack) {
  return {
    textbookSections: sourcePack.textbookSections.map((item) => ({
      id: item.id,
      title: item.title,
      contentType: item.contentType,
      verification: item.verification,
    })),
    userMaterials: sourcePack.userMaterials.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
    })),
    caseMaterials: sourcePack.caseMaterials.map((item) => ({
      id: item.id,
      title: item.title,
      sourceUrls: item.sourceUrls,
      verification: item.verification,
    })),
  };
}

async function loadCoursewareSourcePack(
  admin: any,
  userId: string,
  taskId: string,
  runId: string,
): Promise<CoursewareSourcePack> {
  const [
    { data: run, error: runError },
    { data: taskMaterials, error: taskMaterialError },
  ] = await Promise.all([
    admin.from("hai_work_runs").select("input_snapshot").eq("id", runId)
      .eq("user_id", userId).maybeSingle(),
    admin.from("hai_work_task_materials").select("material_id").eq(
      "task_id",
      taskId,
    ).eq("user_id", userId),
  ]);
  if (runError) {
    throw new HttpError(500, `读取原任务输入失败：${runError.message}`);
  }
  if (taskMaterialError) {
    throw new HttpError(
      500,
      `读取原任务材料失败：${taskMaterialError.message}`,
    );
  }
  const inputSnapshot = rawRecord(run?.input_snapshot);
  const textbookIds = [
    ...new Set(snapshotIds(inputSnapshot.textbook_sources, "section_id")),
  ];
  const caseIds = [
    ...new Set(snapshotIds(inputSnapshot.case_sources, "case_id")),
  ];
  const materialIds = [
    ...new Set([
      ...(Array.isArray(inputSnapshot.material_ids)
        ? inputSnapshot.material_ids.map(String)
        : []),
      ...(taskMaterials ?? []).map((item: { material_id?: unknown }) =>
        String(item.material_id ?? "")
      ),
    ].filter((item) => /^[0-9a-f-]{36}$/i.test(item))),
  ];

  const [textbookResult, materialResult, chunkResult, caseResult] =
    await Promise.all([
      textbookIds.length
        ? admin.from("hai_textbook_sections").select(
          "id, section_path, content_type, content_markdown, verification_status",
        ).in("id", textbookIds)
        : Promise.resolve({ data: [], error: null }),
      materialIds.length
        ? admin.from("hai_materials").select("id, title, kind").eq(
          "user_id",
          userId,
        ).in("id", materialIds)
        : Promise.resolve({ data: [], error: null }),
      materialIds.length
        ? admin.from("hai_material_chunks").select(
          "material_id, chunk_index, content",
        ).eq("user_id", userId).in("material_id", materialIds).order(
          "chunk_index",
        )
        : Promise.resolve({ data: [], error: null }),
      caseIds.length
        ? admin.from("hai_politics_cases").select(
          "id, title, content_markdown, source_urls, verification_status",
        ).in("id", caseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  for (
    const [label, result] of [
      ["教材来源", textbookResult],
      ["用户材料", materialResult],
      ["用户材料正文", chunkResult],
      ["案例来源", caseResult],
    ] as const
  ) {
    if (result.error) {
      throw new HttpError(500, `读取${label}失败：${result.error.message}`);
    }
  }

  const chunksByMaterial = new Map<string, string[]>();
  for (const item of chunkResult.data ?? []) {
    const id = String(item.material_id ?? "");
    const chunks = chunksByMaterial.get(id) ?? [];
    const content = String(item.content ?? "").trim();
    if (content) chunks.push(content);
    chunksByMaterial.set(id, chunks);
  }
  return {
    inputSnapshot,
    textbookSections: (textbookResult.data ?? []).map((item: any) => ({
      id: String(item.id),
      title: String(item.section_path ?? "教材内容"),
      content: String(item.content_markdown ?? "").trim(),
      contentType: String(item.content_type ?? ""),
      verification: String(item.verification_status ?? ""),
    })).filter((item: { content: string }) => item.content),
    userMaterials: (materialResult.data ?? []).map((item: any) => ({
      id: String(item.id),
      title: String(item.title ?? "用户材料"),
      kind: String(item.kind ?? ""),
      content: (chunksByMaterial.get(String(item.id)) ?? []).join("\n\n"),
    })).filter((item: { content: string }) => item.content),
    caseMaterials: (caseResult.data ?? []).map((item: any) => ({
      id: String(item.id),
      title: String(item.title ?? "案例材料"),
      content: String(item.content_markdown ?? "").trim(),
      sourceUrls: Array.isArray(item.source_urls)
        ? item.source_urls.map(String).filter(Boolean)
        : [],
      verification: String(item.verification_status ?? ""),
    })).filter((item: { content: string }) => item.content),
  };
}

function extractStage(grade: string) {
  if (/幼儿|学前/u.test(grade)) return "学前";
  if (/小学|一年级|二年级|三年级|四年级|五年级|六年级/u.test(grade)) {
    return "小学";
  }
  if (/初中|七年级|八年级|九年级/u.test(grade)) return "初中";
  if (/高中|高一|高二|高三/u.test(grade)) return "高中";
  return grade.trim() || "未标注";
}

async function loadCoursewareSkill(
  admin: any,
  context: CoursewareSkillContext,
) {
  const { data: skills, error } = await admin.from("hai_courseware_skills")
    .select(
      "id, slug, name, description, match_criteria, priority, is_fallback",
    )
    .eq("is_enabled", true);
  if (error) {
    if (
      error.code === "42P01" ||
      /does not exist|schema cache/i.test(error.message || "")
    ) return null;
    throw new HttpError(500, `课件 Skill 加载失败：${error.message}`);
  }
  const skillIds = (skills ?? []).map((item: { id: string }) => item.id);
  if (skillIds.length === 0) return null;
  const { data: versions, error: versionError } = await admin.from(
    "hai_courseware_skill_versions",
  )
    .select(
      "id, skill_id, version_label, instructions, input_contract, output_contract, source_metadata",
    )
    .in("skill_id", skillIds)
    .eq("status", "published");
  if (versionError) {
    throw new HttpError(
      500,
      `课件 Skill 版本加载失败：${versionError.message}`,
    );
  }
  const bySkill = new Map(
    (versions ?? []).map((version: any) => [version.skill_id, version]),
  );
  const candidates = (skills ?? []).flatMap((skill: any) => {
    const version = bySkill.get(skill.id);
    return version ? [{ ...skill, version } as CoursewareSkillCandidate] : [];
  });
  const selected = selectCoursewareSkill(candidates, context);
  if (!selected) return null;
  const { data: references, error: referenceError } = await admin.from(
    "hai_courseware_skill_references",
  )
    .select(
      "id, path, name, description, media_type, content, load_mode, match_criteria, max_chars, sort_order, metadata",
    )
    .eq("skill_version_id", selected.version.id)
    .order("sort_order", { ascending: true });
  if (referenceError) {
    throw new HttpError(
      500,
      `课件 Skill references 加载失败：${referenceError.message}`,
    );
  }
  return {
    ...selected,
    version: { ...selected.version, references: references ?? [] },
  } as CoursewareSkillCandidate;
}
