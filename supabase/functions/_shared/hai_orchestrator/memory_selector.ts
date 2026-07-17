import type {
  IntentName,
  IntentResult,
  MemorySelection,
  MemoryType,
} from "./types.ts";

const defaultMemoryTypes: Partial<Record<IntentName, MemoryType[]>> = {
  showcase_lesson_diagnosis: [
    "basic_profile",
    "current_task",
    "recurring_patterns",
    "past_advice",
    "preferences",
  ],
  showcase_lesson_design: [
    "basic_profile",
    "current_task",
    "past_advice",
    "preferences",
  ],
  daily_improvement_diagnosis: [
    "basic_profile",
    "current_task",
    "recurring_patterns",
    "execution_feedback",
    "preferences",
  ],
  daily_improvement_design: [
    "basic_profile",
    "current_task",
    "recurring_patterns",
    "preferences",
  ],
};

export function selectMemory(
  question: string,
  intent: IntentResult,
): MemorySelection {
  const asksHistory =
    /上次|之前|刚才|继续|沿用|我的|我们班|我教|记得|还记得|偏好|限制|这个班|这个学生/
      .test(question);
  const types = defaultMemoryTypes[intent.primary_intent] ?? [];
  const shouldLoad = asksHistory || types.length > 0 &&
      intent.primary_intent !== "teaching_concept_qa" &&
      intent.primary_intent !== "unknown";

  if (!shouldLoad) {
    return {
      should_load_memory: false,
      memory_types: [],
      reason: "当前问题可以先做一般性诊断，不默认加载长期记忆。",
    };
  }

  const memoryTypes = asksHistory
    ? Array.from(
      new Set<MemoryType>([...types, "past_advice", "execution_feedback"]),
    )
    : types;

  return {
    should_load_memory: true,
    memory_types: memoryTypes.slice(0, 5),
    reason: asksHistory
      ? "用户提到历史语境或个人班级，需要加载相关记忆以保持连续咨询。"
      : `当前意图为 ${intent.primary_intent}，需要少量画像、任务和偏好记忆辅助诊断。`,
  };
}

export function memoryCategoryMatchesTypes(
  category: string,
  memoryTypes: MemoryType[],
) {
  if (memoryTypes.length === 0) return false;
  const mapped = mapMemoryCategory(category);
  return memoryTypes.includes(mapped);
}

function mapMemoryCategory(category: string): MemoryType {
  const map: Record<string, MemoryType> = {
    basic_info: "basic_profile",
    education_philosophy: "preferences",
    student_view: "basic_profile",
    teaching_view: "preferences",
    teaching_preference: "preferences",
    constraint: "current_task",
    behavior: "execution_feedback",
    vision: "preferences",
    challenge: "recurring_patterns",
  };
  return map[category] ?? "preferences";
}
