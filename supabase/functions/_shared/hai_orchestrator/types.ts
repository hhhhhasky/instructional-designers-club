export type IntentName =
  | "teaching_design"
  | "lesson_plan_diagnosis"
  | "public_lesson"
  | "learning_profile"
  | "classroom_management"
  | "learning_motivation"
  | "assessment_feedback"
  | "ai_lesson_planning"
  | "pbl_crossdisciplinary"
  | "teacher_growth"
  | "general_question"
  | "unknown";

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

export type ProblemRewrite = {
  original_question: string;
  surface_problem: string;
  deeper_problem: string;
  wrong_attribution_risk?: string;
  hai_reframing: string;
  recommended_answer_direction: string;
};

export type RetrievalPlan = {
  retrieve_cases: boolean;
  case_query?: string;
  retrieve_methods: boolean;
  method_query?: string;
  retrieve_theory: boolean;
  theory_query?: string;
  retrieve_expressions: boolean;
  expression_query?: string;
  max_cases?: number;
  max_methods?: number;
  max_theories?: number;
  max_expressions?: number;
};

export type RetrievedCase = {
  id: string;
  intent: IntentName;
  user_question: string;
  surface_problem: string;
  deeper_problem: string;
  hai_judgement: string;
  recommended_structure: string;
  sample_answer: string;
};

export type RetrievedContextItem = {
  id?: string;
  title?: string;
  content: string;
  source?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type HAIContextPackage = {
  user_question: string;
  core_identity: string;
  safety_boundaries: string;
  response_composer_prompt?: string;
  evaluator_prompt?: string;
  intent_result: IntentResult;
  memory_selection: MemorySelection;
  selected_memory?: unknown;
  problem_rewrite: ProblemRewrite;
  diagnostic_framework: string;
  diagnostic_module: IntentName;
  retrieval_plan: RetrievalPlan;
  retrieved_cases?: RetrievedCase[];
  retrieved_methods?: unknown[];
  retrieved_theories?: unknown[];
  retrieved_expressions?: string[];
  style_pack: string;
};

export type HAIOrchestratorConfig = {
  caseMax: number;
  methodMax: number;
  theoryMax: number;
  expressionMax: number;
};

export type HAIPromptConfigMap = Record<string, string>;

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

export type HAITrace = {
  question: string;
  intent_result: IntentResult;
  memory_selection: MemorySelection;
  problem_rewrite: ProblemRewrite;
  diagnostic_module: IntentName;
  retrieval_plan: RetrievalPlan;
  retrieved_context_ids: Array<string | null | undefined>;
  draft_answer: string;
  evaluation_result: ResponseEvaluation;
  final_answer: string;
};
