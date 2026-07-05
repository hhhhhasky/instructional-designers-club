import { classifyIntent } from "./intent_classifier.ts";
import { selectMemory } from "./memory_selector.ts";
import { coreIdentity, evaluatorPrompt, safetyBoundaries, stylePack } from "./prompts.ts";
import { rewriteProblem } from "./problem_rewriter.ts";
import { planRetrieval, selectExpressions, selectLocalCases } from "./retrieval_planner.ts";
import { routeDiagnosticFramework } from "./diagnostic_router.ts";
import type { HAIContextPackage, HAIOrchestratorConfig, HAIPromptConfigMap, IntentResult, SemanticRouteResult } from "./types.ts";

export class HAIContextOrchestrator {
  buildInitialPackage(
    userQuestion: string,
    config?: Partial<HAIOrchestratorConfig>,
    semanticRoute?: SemanticRouteResult | IntentResult,
    promptConfig: HAIPromptConfigMap = {},
  ): HAIContextPackage {
    const limits = {
      caseMax: Math.max(0, Math.round(config?.caseMax ?? 3)),
      methodMax: Math.max(0, Math.round(config?.methodMax ?? 2)),
      theoryMax: Math.max(0, Math.round(config?.theoryMax ?? 1)),
      expressionMax: Math.max(0, Math.round(config?.expressionMax ?? 5)),
    };
    const route = normalizeSemanticRoute(semanticRoute);
    const intent = route?.intent ?? classifyIntent(userQuestion);
    const memorySelection = selectMemory(userQuestion, intent);
    const problemRewrite = route?.problem_rewrite ?? rewriteProblem(userQuestion, intent);
    const diagnostic = routeDiagnosticFramework(intent.primary_intent, route?.diagnostic_module);
    const diagnosticFramework = promptConfig[`diagnostic_module.${diagnostic.diagnostic_module}`] || diagnostic.diagnostic_framework;
    const retrievalPlan = planRetrieval(intent, problemRewrite);
    retrievalPlan.max_cases = limits.caseMax;
    retrievalPlan.max_methods = limits.methodMax;
    retrievalPlan.max_theories = retrievalPlan.retrieve_theory ? limits.theoryMax : 0;
    retrievalPlan.max_expressions = limits.expressionMax;
    const cases = retrievalPlan.retrieve_cases
      ? selectLocalCases(intent, problemRewrite, retrievalPlan.max_cases)
      : [];
    const expressions = retrievalPlan.retrieve_expressions
      ? selectExpressions(problemRewrite, retrievalPlan.max_expressions)
      : [];

    return {
      user_question: userQuestion,
      core_identity: promptConfig.core_identity || coreIdentity,
      safety_boundaries: promptConfig.safety_boundaries || safetyBoundaries,
      response_composer_prompt: promptConfig.response_composer_prompt,
      evaluator_prompt: promptConfig.response_evaluator_prompt || evaluatorPrompt,
      intent_result: intent,
      memory_selection: memorySelection,
      problem_rewrite: problemRewrite,
      diagnostic_framework: diagnosticFramework,
      diagnostic_module: diagnostic.diagnostic_module,
      retrieval_plan: retrievalPlan,
      retrieved_cases: cases,
      retrieved_expressions: expressions,
      style_pack: promptConfig.style_pack || stylePack,
    };
  }
}

function normalizeSemanticRoute(value?: SemanticRouteResult | IntentResult): SemanticRouteResult | null {
  if (!value) return null;
  if ("intent" in value) return value;
  return { intent: value };
}
