export type IntentName =
  | "showcase_lesson_diagnosis"
  | "showcase_lesson_design"
  | "daily_improvement_diagnosis"
  | "daily_improvement_design"
  | "teaching_concept_qa"
  | "unknown";

export type TeachingScene =
  | "public_lesson"
  | "lesson_presentation"
  | "competition_lesson"
  | "daily_lesson"
  | "review_lesson"
  | "exam_review"
  | "general_teaching"
  | "unclear";

export type UserGoal =
  | "diagnosis"
  | "design_support"
  | "concept_qa"
  | "unclear";

export type SupportDepth = "advice" | "ideas" | "demonstration";

export type MemoryType =
  | "basic_profile"
  | "current_task"
  | "recurring_patterns"
  | "past_advice"
  | "execution_feedback"
  | "preferences";

export type IntentResult = {
  primary_intent: IntentName;
  secondary_intents?: IntentName[];
  scene: TeachingScene;
  user_goal: UserGoal;
  support_depth: SupportDepth;
  explicit_need: string;
  implicit_need?: string;
  risk_of_wrong_framing?: string;
  confidence: number;
  route_method?: "keyword" | "llm" | "fallback";
  route_reason?: string;
  matched_signals?: string[];
};

export type MemorySelection = {
  should_load_memory: boolean;
  memory_types: MemoryType[];
  reason: string;
};

export type ResponseEvaluation = {
  pass: boolean;
  score: number;
  problems: string[];
  rewrite_instructions: string;
  checks: {
    has_clear_judgement: boolean;
    has_problem_reframing: boolean;
    avoids_generic_advice: boolean;
    has_actionable_steps: boolean;
    uses_hai_style: boolean;
    uses_relevant_context: boolean;
    does_not_overclaim: boolean;
    handles_uncertainty: boolean;
  };
};
