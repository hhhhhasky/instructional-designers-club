import { classifyIntent } from "./intent_classifier.ts";
import { selectMemory } from "./memory_selector.ts";
import { coreIdentity, stylePack } from "./prompts.ts";
import { rewriteProblem } from "./problem_rewriter.ts";
import { planRetrieval, selectExpressions, selectLocalCases } from "./retrieval_planner.ts";
import { routeDiagnosticFramework } from "./diagnostic_router.ts";
import type { HAIContextPackage } from "./types.ts";

export class HAIContextOrchestrator {
  buildInitialPackage(userQuestion: string): HAIContextPackage {
    const intent = classifyIntent(userQuestion);
    const memorySelection = selectMemory(userQuestion, intent);
    const problemRewrite = rewriteProblem(userQuestion, intent);
    const diagnostic = routeDiagnosticFramework(intent.primary_intent);
    const retrievalPlan = planRetrieval(intent, problemRewrite);
    const cases = retrievalPlan.retrieve_cases
      ? selectLocalCases(intent, problemRewrite, retrievalPlan.max_cases ?? 3)
      : [];
    const expressions = retrievalPlan.retrieve_expressions
      ? selectExpressions(problemRewrite, retrievalPlan.max_expressions ?? 5)
      : [];

    return {
      user_question: userQuestion,
      core_identity: coreIdentity,
      intent_result: intent,
      memory_selection: memorySelection,
      problem_rewrite: problemRewrite,
      diagnostic_framework: diagnostic.diagnostic_framework,
      diagnostic_module: diagnostic.diagnostic_module,
      retrieval_plan: retrievalPlan,
      retrieved_cases: cases,
      retrieved_expressions: expressions,
      style_pack: stylePack,
    };
  }
}
