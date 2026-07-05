import { diagnosticModules } from "./static_content.ts";
import type { IntentName } from "./types.ts";

export function routeDiagnosticFramework(intent: IntentName, diagnosticModule?: IntentName) {
  const module = diagnosticModule ?? intent;
  return {
    diagnostic_module: module,
    diagnostic_framework: diagnosticModules[module] ?? diagnosticModules[intent] ?? diagnosticModules.general_question,
  };
}
