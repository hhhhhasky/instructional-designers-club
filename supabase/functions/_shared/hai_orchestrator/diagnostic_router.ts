import { diagnosticModules } from "./static_content.ts";
import type { IntentName } from "./types.ts";

export function routeDiagnosticFramework(intent: IntentName) {
  return {
    diagnostic_module: intent,
    diagnostic_framework: diagnosticModules[intent] ?? diagnosticModules.general_question,
  };
}
