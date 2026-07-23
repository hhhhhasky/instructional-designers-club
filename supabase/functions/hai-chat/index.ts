import {
  assertHaiAccess,
  buildChatCompletionOptions,
  type ChatMessage,
  createTitle,
  estimateTokens,
  finalizeUsage,
  type HaiChatCompletionOptions,
  type HaiRuntimeConfig,
  handleCors,
  HttpError,
  jsonResponse,
  loadHaiRuntimeConfig,
  normalizeRecord,
  rememberExplicitTeacherFacts,
  requireUser,
  reserveUsage,
  runtimeConfigSnapshot,
  sendSse,
  sseHeaders,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  buildHaiChatSkillSystemPrompt,
  buildHaiChatSkillTrace,
  type HaiChatSkillReference,
  type HaiChatSkillRuntime,
  type HaiChatSkillTrace,
  normalizeHaiChatSkillReferenceConfig,
} from "../_shared/hai_chat_skill.ts";
import { classifyIntent } from "../_shared/hai_orchestrator/intent_classifier.ts";
import {
  hanCourseMethodCards,
  type HanMethodCard,
  type HanMethodCardConfigRow,
  mergeHanMethodCards,
} from "../_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts";
import {
  memoryCategoryMatchesTypes,
  selectMemory,
} from "../_shared/hai_orchestrator/memory_selector.ts";
import { normalizeHaiVoiceFormatting } from "../_shared/hai_orchestrator/response_composer.ts";
import { evaluateResponse } from "../_shared/hai_orchestrator/response_evaluator.ts";
import type { MemorySelection } from "../_shared/hai_orchestrator/types.ts";

type ModuleRow = {
  id: string;
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
  history_message_limit: number | null;
  memory_limit: number | null;
  material_match_count: number | null;
  knowledge_match_count: number | null;
};

type ConversationRow = {
  id: string;
  title: string;
  module_slug: string | null;
};

type MessageRow = {
  role: "user" | "assistant";
  content: string;
};

type PromptSnapshotModelCall = {
  stage: "answer_draft" | "answer_rewrite";
  messages: ChatMessage[];
  estimated_input_tokens: number;
};

type PromptSnapshot = {
  captured_at: string;
  model_calls: PromptSnapshotModelCall[];
  final_answer: string;
};

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    const accessStatus = await assertHaiAccess(auth.userClient);

    const body = await request.json().catch(() => ({}));
    const text = String(body.message || "").trim();
    const moduleSlug = String(body.moduleSlug || "ask-han").trim();
    const requestedConversationId = body.conversationId
      ? String(body.conversationId)
      : null;
    const clientRequestId = body.clientRequestId
      ? String(body.clientRequestId)
      : crypto.randomUUID();
    const capturePromptSnapshot = body.capturePromptSnapshot === true;
    if (!text) throw new HttpError(400, "消息不能为空。");
    if (capturePromptSnapshot && accessStatus.is_admin !== true) {
      throw new HttpError(403, "完整提示词快照仅供管理员调试。");
    }

    const promptModelCalls: PromptSnapshotModelCall[] = [];

    const runtime = await loadHaiRuntimeConfig(auth.admin);
    const module = await loadModule(auth.admin, moduleSlug);
    const chatSkill = await loadChatSkill(auth.admin, module.id);
    if (!chatSkill) {
      throw new HttpError(
        503,
        "该 Chat 模块没有可用 Skill，请管理员先发布、启用并绑定 Chat Skill。",
      );
    }
    const completionOptions = buildChatCompletionOptions({ module, runtime });
    const configSnapshot = runtimeConfigSnapshot(runtime, completionOptions);
    const methodCards = await loadMethodCards(auth.admin);
    const skillIntent = classifyIntent(text);
    const estimatedSkillPrompt = buildHaiChatSkillSystemPrompt({
      moduleName: module.name,
      question: text,
      skill: chatSkill,
      intent: skillIntent,
      methodCards,
      memories: [],
    });
    const maxOutputTokens = completionOptions.maxTokens;
    const estimatedInputTokens = estimateTokens(text) +
      estimateTokens(estimatedSkillPrompt);
    await reserveUsage({
      userClient: auth.userClient,
      requestId: clientRequestId,
      route: "hai-chat",
      estimatedInputTokens,
      estimatedOutputTokens: maxOutputTokens,
      metadata: buildUsageMetadata(
        runtime,
        buildExecutionMetadata(module.slug, chatSkill),
        configSnapshot,
      ),
    });

    let conversation = requestedConversationId
      ? await loadConversation(
        auth.admin,
        auth.user.id,
        requestedConversationId,
      )
      : null;

    if (!conversation) {
      const { data, error } = await auth.admin
        .from("hai_conversations")
        .insert({
          user_id: auth.user.id,
          title: createTitle(text),
          mode: "chat",
          module_slug: module.slug,
        })
        .select("id, title, module_slug")
        .single();
      if (error) throw new HttpError(500, error.message);
      conversation = data as ConversationRow;
    }

    const conversationId = conversation.id;
    const startedAt = Date.now();
    const { data: userMessage, error: userMessageError } = await auth.admin
      .from("hai_messages")
      .insert({
        conversation_id: conversationId,
        user_id: auth.user.id,
        role: "user",
        content: text,
        metadata: { module_slug: module.slug },
        token_estimate: estimateTokens(text),
        input_tokens: estimateTokens(text),
      })
      .select("id")
      .single();
    if (userMessageError) throw new HttpError(500, userMessageError.message);
    await rememberExplicitTeacherFacts(auth.admin, auth.user.id, text);

    const recentMessages = await loadRecentMessages(
      auth.admin,
      auth.user.id,
      conversationId,
      module,
      runtime,
      String(userMessage.id),
    );
    const memorySelection = chatSkill.reference_config.memory_enabled
      ? selectMemory(text, skillIntent)
      : disabledSkillMemorySelection();
    const memories = await loadMemories(
      auth.admin,
      auth.user.id,
      module,
      runtime,
      memorySelection,
    );
    const systemPrompt = buildHaiChatSkillSystemPrompt({
      moduleName: module.name,
      question: text,
      skill: chatSkill,
      intent: skillIntent,
      methodCards,
      memories,
    });
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
      { role: "user", content: text },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let output = "";
        let assistantMessageId: string | null = null;
        try {
          sendSse(controller, encoder, {
            type: "ready",
            conversationId,
            moduleSlug: module.slug,
          });

          const draftMessages = messages;
          if (capturePromptSnapshot) {
            promptModelCalls.push(
              buildPromptSnapshotCall("answer_draft", draftMessages),
            );
          }
          for await (
            const token of streamDeepSeek(messages, {
              ...completionOptions,
              userId: auth.user.id,
            })
          ) {
            output += token;
          }

          const evaluation = runtime.evaluatorEnabled
            ? evaluateResponse(output, undefined, {
              passScore: runtime.evaluatorPassScore,
            })
            : null;
          const draftAnswer = output;
          let finalAnswer = draftAnswer;
          let finalMessages = draftMessages;

          if (
            evaluation && !evaluation.pass &&
            runtime.evaluatorMaxRewrites > 0
          ) {
            finalAnswer = "";
            const rewriteSystemPrompt = buildHaiChatSkillSystemPrompt({
              moduleName: module.name,
              question: text,
              skill: chatSkill,
              intent: skillIntent,
              methodCards,
              memories,
              evaluation,
              draftAnswer,
            });
            finalMessages = [
              { role: "system", content: rewriteSystemPrompt },
              ...recentMessages,
              { role: "user", content: text },
            ];
            if (capturePromptSnapshot) {
              promptModelCalls.push(
                buildPromptSnapshotCall("answer_rewrite", finalMessages),
              );
            }
            for await (
              const token of streamDeepSeek(finalMessages, {
                ...completionOptions,
                userId: auth.user.id,
              })
            ) {
              finalAnswer += token;
              sendSse(controller, encoder, { type: "token", token });
            }
          } else {
            finalAnswer = normalizeHaiVoiceFormatting(finalAnswer);
            sendSse(controller, encoder, { type: "token", token: finalAnswer });
          }

          finalAnswer = normalizeHaiVoiceFormatting(finalAnswer);

          const skillTrace = buildHaiChatSkillTrace({
            skill: chatSkill,
            question: text,
            intent: skillIntent,
            methodCards,
            memoryLoaded: memories.length > 0,
          });

          output = finalAnswer;
          const inputTokens = estimateTokens(
            finalMessages.map((item) => item.content).join("\n"),
          );
          const outputTokens = estimateTokens(finalAnswer);
          const { data: assistantMessage, error } = await auth.admin
            .from("hai_messages")
            .insert({
              conversation_id: conversationId,
              user_id: auth.user.id,
              role: "assistant",
              content: finalAnswer,
              citations: [],
              metadata: buildMessageMetadata(
                module.slug,
                completionOptions,
                runtime,
                configSnapshot,
                skillTrace,
              ),
              token_estimate: outputTokens,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            })
            .select("id")
            .single();
          if (error) throw error;
          assistantMessageId = assistantMessage.id as string;

          await auth.admin
            .from("hai_conversations")
            .update({
              updated_at: new Date().toISOString(),
              module_slug: module.slug,
            })
            .eq("id", conversationId)
            .eq("user_id", auth.user.id);

          await finalizeUsage({
            userClient: auth.userClient,
            requestId: clientRequestId,
            status: "completed",
            route: "hai-chat",
            inputTokens,
            outputTokens,
            entityType: "conversation",
            entityId: conversationId,
            durationMs: Date.now() - startedAt,
            metadata: buildUsageMetadata(runtime, {
              ...buildExecutionMetadata(
                module.slug,
                chatSkill,
              ),
              message_id: assistantMessageId,
            }, configSnapshot),
          });

          const promptSnapshot: PromptSnapshot | undefined =
            capturePromptSnapshot
              ? {
                captured_at: new Date().toISOString(),
                model_calls: promptModelCalls,
                final_answer: finalAnswer,
              }
              : undefined;
          sendSse(controller, encoder, {
            type: "done",
            conversationId,
            messageId: assistantMessageId,
            usage: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
            promptSnapshot,
          });
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "HAI 响应失败。";
          await finalizeUsage({
            userClient: auth.userClient,
            requestId: clientRequestId,
            status: "failed",
            route: "hai-chat",
            inputTokens: estimatedInputTokens,
            outputTokens: estimateTokens(output),
            entityType: "conversation",
            entityId: conversationId,
            durationMs: Date.now() - startedAt,
            metadata: buildUsageMetadata(runtime, {
              ...buildExecutionMetadata(
                module.slug,
                chatSkill,
              ),
              error: message,
            }, configSnapshot),
          });
          sendSse(controller, encoder, { type: "error", message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "HAI 请求失败。";
    return jsonResponse({ message }, status);
  }
});

async function loadModule(
  admin: { from: (table: string) => any },
  slug: string,
): Promise<ModuleRow> {
  const { data, error } = await admin
    .from("hai_feature_modules")
    .select(
      "id, slug, name, default_model, default_temperature, default_max_output_tokens, thinking_enabled, default_top_p, reasoning_effort, response_format, stop_sequences, history_message_limit, memory_limit, material_match_count, knowledge_match_count",
    )
    .eq("slug", slug)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "该 HAI 功能暂未启用。");
  return data as ModuleRow;
}

async function loadChatSkill(
  admin: { from: (table: string) => any },
  moduleId: string,
): Promise<HaiChatSkillRuntime | null> {
  const { data: binding, error: bindingError } = await admin
    .from("hai_chat_skill_bindings")
    .select("skill_id")
    .eq("module_id", moduleId)
    .eq("is_enabled", true)
    .maybeSingle();
  if (bindingError) {
    if (isMissingChatSkillSchemaError(bindingError)) {
      console.warn(
        "hai chat skill schema is not available",
        bindingError.message,
      );
      return null;
    }
    throw new HttpError(
      500,
      `Chat Skill 绑定加载失败：${bindingError.message}`,
    );
  }
  if (!binding?.skill_id) return null;

  const { data: skill, error: skillError } = await admin
    .from("hai_chat_skills")
    .select("id, slug, name, description, source_path")
    .eq("id", binding.skill_id)
    .eq("is_enabled", true)
    .maybeSingle();
  if (skillError) {
    throw new HttpError(500, `Chat Skill 加载失败：${skillError.message}`);
  }
  if (!skill) return null;

  let { data: version, error: versionError } = await admin
    .from("hai_chat_skill_versions")
    .select(
      "id, version_label, snapshot_hash, instructions, reference_config",
    )
    .eq("skill_id", skill.id)
    .eq("status", "published")
    .maybeSingle();
  if (versionError && isMissingChatSkillSnapshotColumnError(versionError)) {
    const fallback = await admin
      .from("hai_chat_skill_versions")
      .select("id, version_label, instructions, reference_config")
      .eq("skill_id", skill.id)
      .eq("status", "published")
      .maybeSingle();
    version = fallback.data;
    versionError = fallback.error;
  }
  if (versionError) {
    throw new HttpError(
      500,
      `Chat Skill 版本加载失败：${versionError.message}`,
    );
  }
  if (!version?.instructions?.trim()) return null;

  const { data: references, error: referencesError } = await admin
    .from("hai_chat_skill_references")
    .select(
      "id, path, name, description, media_type, content, content_hash, load_mode, max_chars, sort_order",
    )
    .eq("skill_version_id", version.id)
    .order("sort_order")
    .order("path");
  if (
    referencesError && !isMissingChatSkillReferenceSchemaError(
      referencesError,
    )
  ) {
    throw new HttpError(
      500,
      `Chat Skill references 加载失败：${referencesError.message}`,
    );
  }

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
    references: referencesError
      ? []
      : (references ?? []).map((reference: Record<string, unknown>) => ({
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

function isMissingChatSkillReferenceSchemaError(error: unknown) {
  const record = normalizeRecord(error);
  const code = String(record.code || "");
  const message = String(record.message || "");
  return code === "42P01" || code === "PGRST205" ||
    /hai_chat_skill_references.*(does not exist|schema cache|could not find)/i
      .test(message);
}

function isMissingChatSkillSnapshotColumnError(error: unknown) {
  const record = normalizeRecord(error);
  const code = String(record.code || "");
  const message = String(record.message || "");
  return code === "42703" || code === "PGRST204" ||
    /snapshot_hash.*(does not exist|schema cache|could not find)/i.test(
      message,
    );
}

function isMissingChatSkillSchemaError(error: unknown) {
  const record = normalizeRecord(error);
  const code = String(record.code || "");
  const message = String(record.message || "");
  return code === "42P01" || code === "PGRST205" ||
    /hai_chat_skill_bindings.*(does not exist|schema cache|could not find)/i
      .test(
        message,
      );
}

async function loadMethodCards(
  admin: { from: (table: string) => any },
): Promise<HanMethodCard[]> {
  const { data, error } = await admin
    .from("hai_method_card_configs")
    .select(
      "id, name, aliases, course, kind, ownership, priority, summary, use_when, avoid_when, core_judgement, moves, answer_focus, query_terms, intents, related, source_refs, enabled, is_deleted, updated_at",
    );
  if (error) {
    console.warn("hai method card config load failed", error.message);
    return hanCourseMethodCards;
  }
  return mergeHanMethodCards(
    (data ?? []) as HanMethodCardConfigRow[],
    hanCourseMethodCards,
  );
}

async function loadConversation(
  admin: { from: (table: string) => any },
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await admin
    .from("hai_conversations")
    .select("id, title, module_slug")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return data as ConversationRow | null;
}

async function loadRecentMessages(
  admin: { from: (table: string) => any },
  userId: string,
  conversationId: string,
  module: ModuleRow,
  runtime: HaiRuntimeConfig,
  excludeMessageId?: string,
): Promise<MessageRow[]> {
  const limit = boundedLimit(
    module.history_message_limit,
    Math.min(20, Math.floor(runtime.contextWindowTokens / 4000)),
    0,
    80,
  );
  if (limit <= 0) return [];
  let query = admin
    .from("hai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false });
  if (excludeMessageId) query = query.neq("id", excludeMessageId);
  const { data, error } = await query.limit(limit);
  if (error) throw new HttpError(500, error.message);
  return ((data ?? []) as MessageRow[]).reverse();
}

async function loadMemories(
  admin: { from: (table: string) => any },
  userId: string,
  module: ModuleRow,
  runtime: HaiRuntimeConfig,
  selection: MemorySelection,
): Promise<Array<{ category: string; content: string }>> {
  if (!runtime.memoryEnabled) return [];
  if (!selection.should_load_memory) return [];
  const limit = boundedLimit(module.memory_limit, 20, 0, 80);
  if (limit <= 0) return [];
  const { data, error } = await admin
    .from("hai_user_memories")
    .select("category, content")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new HttpError(500, error.message);
  return ((data ?? []) as Array<{ category: string; content: string }>)
    .filter((item) =>
      memoryCategoryMatchesTypes(item.category, selection.memory_types)
    )
    .slice(0, limit);
}

function buildMessageMetadata(
  moduleSlug: string,
  options: HaiChatCompletionOptions,
  runtime: HaiRuntimeConfig,
  configSnapshot: Record<string, unknown>,
  skillTrace: HaiChatSkillTrace,
) {
  const metadata: Record<string, unknown> = {
    module_slug: moduleSlug,
    model: options.model,
    chat_mode: "skill",
    skill_slug: skillTrace.skill_slug,
    skill_version: skillTrace.version_label,
    skill_version_id: skillTrace.version_id,
    skill_snapshot_hash: skillTrace.snapshot_hash,
  };
  if (runtime.logConfigSnapshot) metadata.config = configSnapshot;
  if (runtime.logConfigSnapshot) {
    metadata.hai_skill_trace = skillTrace;
  }
  return metadata;
}

function buildExecutionMetadata(
  moduleSlug: string,
  skill: HaiChatSkillRuntime,
) {
  return {
    module_slug: moduleSlug,
    chat_mode: "skill",
    skill_slug: skill.skill_slug,
    skill_version: skill.version_label,
    skill_version_id: skill.version_id,
    skill_snapshot_hash: skill.snapshot_hash,
  };
}

function buildUsageMetadata(
  runtime: HaiRuntimeConfig,
  metadata: Record<string, unknown>,
  configSnapshot: Record<string, unknown>,
) {
  return runtime.logConfigSnapshot
    ? { ...metadata, config: configSnapshot }
    : metadata;
}

function disabledSkillMemorySelection(): MemorySelection {
  return {
    should_load_memory: false,
    memory_types: [],
    reason: "当前 Chat Skill 版本已关闭用户记忆加载。",
  };
}

function boundedLimit(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const candidate = Number(value);
  const next = Number.isFinite(candidate) ? candidate : fallback;
  return Math.min(max, Math.max(min, Math.round(next)));
}

function buildPromptSnapshotCall(
  stage: PromptSnapshotModelCall["stage"],
  messages: ChatMessage[],
): PromptSnapshotModelCall {
  return {
    stage,
    messages: messages.map((message) => ({ ...message })),
    estimated_input_tokens: estimateTokens(
      messages.map((message) => message.content).join("\n"),
    ),
  };
}
