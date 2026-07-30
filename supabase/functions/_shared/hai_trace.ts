import type {
  IntentResult,
  MemorySelection,
  ResponseEvaluation,
} from "./hai_chat/types.ts";

export type HaiPromptAssemblyModelCall = {
  stage: "semantic_router" | "answer_draft" | "answer_rewrite";
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  estimated_input_tokens: number;
};

export type HaiPromptAssembly = {
  captured_at: string;
  final_stage: "answer_draft" | "answer_rewrite";
  model_calls: HaiPromptAssemblyModelCall[];
};

export const HAI_TRACE_VERSION = 2 as const;

export type HaiTraceV2 = {
  trace_version: typeof HAI_TRACE_VERSION;
  kind: "chat_skill";
  mode: "skill";
  question: string;
  skill: {
    id: string;
    slug: string;
    name: string;
    source_path: string;
    version: {
      id: string;
      label: string;
      snapshot_hash: string;
    };
  };
  intent_result: IntentResult;
  method_card_ids: string[];
  references: Array<{
    path: string;
    content_hash: string;
  }>;
  memory_selection: MemorySelection & {
    loaded: boolean;
  };
  evaluation_result: ResponseEvaluation | null;
  diagnostic_module?: string;
  prompt_assembly?: HaiPromptAssembly;
};

export type NormalizedHaiTrace = {
  source: "hai_trace" | "hai_skill_trace" | "hai_context_trace";
  trace_version: number;
  kind: string;
  question: string;
  skill: {
    id: string;
    slug: string;
    name: string;
    source_path: string;
    version: {
      id: string;
      label: string;
      snapshot_hash: string;
    };
  } | null;
  intent_result: Record<string, unknown>;
  evaluation_result: Record<string, unknown> | null;
  diagnostic_module: string;
  method_card_ids: string[];
  reference_paths: string[];
  reference_hashes: string[];
  memory_selection: Record<string, unknown>;
  prompt_assembly: HaiPromptAssembly | null;
  raw: Record<string, unknown>;
};

export function readHaiTrace(metadata: unknown): NormalizedHaiTrace | null {
  const metadataRecord = recordOf(metadata);
  if (!metadataRecord) return null;

  const current = recordOf(metadataRecord.hai_trace);
  if (current) {
    const skill = recordOf(current.skill);
    const version = recordOf(skill?.version);
    const references = arrayOfRecords(current.references);
    return {
      source: "hai_trace",
      trace_version: numberOf(current.trace_version) ?? HAI_TRACE_VERSION,
      kind: textOf(current.kind) || "chat_skill",
      question: textOf(current.question),
      skill: skill
        ? {
          id: textOf(skill.id),
          slug: textOf(skill.slug),
          name: textOf(skill.name),
          source_path: textOf(skill.source_path),
          version: {
            id: textOf(version?.id),
            label: textOf(version?.label),
            snapshot_hash: textOf(version?.snapshot_hash),
          },
        }
        : null,
      intent_result: recordOf(current.intent_result) ?? {},
      evaluation_result: recordOf(current.evaluation_result),
      diagnostic_module: textOf(current.diagnostic_module),
      method_card_ids: stringArray(current.method_card_ids),
      reference_paths: references.map((reference) => textOf(reference.path))
        .filter(Boolean),
      reference_hashes: references.map((reference) =>
        textOf(reference.content_hash)
      ).filter(Boolean),
      memory_selection: recordOf(current.memory_selection) ?? {},
      prompt_assembly: normalizePromptAssembly(current.prompt_assembly),
      raw: current,
    };
  }

  const legacySkill = recordOf(metadataRecord.hai_skill_trace);
  if (legacySkill) {
    return {
      source: "hai_skill_trace",
      trace_version: 1,
      kind: "legacy_chat_skill",
      question: textOf(legacySkill.question),
      skill: {
        id: textOf(legacySkill.skill_id),
        slug: textOf(legacySkill.skill_slug),
        name: textOf(legacySkill.skill_name),
        source_path: textOf(legacySkill.source_path),
        version: {
          id: textOf(legacySkill.version_id),
          label: textOf(legacySkill.version_label),
          snapshot_hash: textOf(legacySkill.snapshot_hash),
        },
      },
      intent_result: recordOf(legacySkill.intent_result) ?? {},
      evaluation_result: recordOf(legacySkill.evaluation_result),
      diagnostic_module: textOf(legacySkill.diagnostic_module),
      method_card_ids: stringArray(legacySkill.method_card_ids),
      reference_paths: stringArray(legacySkill.reference_paths),
      reference_hashes: stringArray(legacySkill.reference_hashes),
      memory_selection: {
        loaded: legacySkill.memory_loaded === true,
      },
      prompt_assembly: null,
      raw: legacySkill,
    };
  }

  const legacyContext = recordOf(metadataRecord.hai_context_trace);
  if (!legacyContext) return null;
  return {
    source: "hai_context_trace",
    trace_version: 1,
    kind: "legacy_context_orchestrator",
    question: textOf(legacyContext.question),
    skill: null,
    intent_result: recordOf(legacyContext.intent_result) ?? {},
    evaluation_result: recordOf(legacyContext.evaluation_result),
    diagnostic_module: textOf(legacyContext.diagnostic_module),
    method_card_ids: stringArray(
      legacyContext.methodology_ids ?? legacyContext.method_card_ids,
    ),
    reference_paths: stringArray(legacyContext.reference_paths),
    reference_hashes: stringArray(legacyContext.reference_hashes),
    memory_selection: recordOf(legacyContext.memory_selection) ?? {},
    prompt_assembly: null,
    raw: legacyContext,
  };
}

function normalizePromptAssembly(value: unknown): HaiPromptAssembly | null {
  const record = recordOf(value);
  if (!record) return null;
  const finalStage = record.final_stage === "answer_rewrite"
    ? "answer_rewrite"
    : record.final_stage === "answer_draft"
    ? "answer_draft"
    : null;
  if (!finalStage || typeof record.captured_at !== "string") return null;
  const modelCalls = Array.isArray(record.model_calls)
    ? record.model_calls.map(normalizePromptAssemblyCall).filter(
      (item): item is HaiPromptAssemblyModelCall => item !== null,
    )
    : [];
  return {
    captured_at: record.captured_at,
    final_stage: finalStage,
    model_calls: modelCalls,
  };
}

function normalizePromptAssemblyCall(value: unknown): HaiPromptAssemblyModelCall | null {
  const record = recordOf(value);
  if (!record) return null;
  const stage = record.stage === "semantic_router" || record.stage === "answer_rewrite"
    ? record.stage
    : record.stage === "answer_draft"
    ? record.stage
    : null;
  if (!stage || typeof record.estimated_input_tokens !== "number") return null;
  const messages = Array.isArray(record.messages)
    ? record.messages.map((item) => {
      const message = recordOf(item);
      if (!message) return null;
      const role = message.role === "system" || message.role === "assistant"
        ? message.role
        : message.role === "user"
        ? message.role
        : null;
      return role && typeof message.content === "string"
        ? { role, content: message.content }
        : null;
    }).filter((item): item is HaiPromptAssemblyModelCall["messages"][number] => item !== null)
    : [];
  return { stage, messages, estimated_input_tokens: record.estimated_input_tokens };
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value)
    ? value.map(recordOf).filter((item): item is Record<string, unknown> =>
      item !== null
    )
    : [];
}

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(textOf).filter(Boolean) : [];
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
