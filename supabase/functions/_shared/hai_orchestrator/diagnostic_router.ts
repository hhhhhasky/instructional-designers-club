import { diagnosticModules } from "./static_content.ts";
import type { DiagnosticModuleName, IntentName } from "./types.ts";

const defaultDiagnosticModuleByIntent: Record<
  IntentName,
  DiagnosticModuleName
> = {
  showcase_lesson_diagnosis: "showcase_lesson_diagnosis",
  showcase_lesson_design: "showcase_lesson_design",
  daily_improvement_diagnosis: "daily_improvement_diagnosis",
  daily_improvement_design: "daily_improvement_design",
  teaching_concept_qa: "teaching_concept_qa",
  unknown: "teaching_concept_qa",
};

export function routeDiagnosticFramework(
  intent: IntentName,
  diagnosticModule?: DiagnosticModuleName,
) {
  const fallbackModule = defaultDiagnosticModuleByIntent[intent];
  const module = diagnosticModule || fallbackModule;
  return {
    diagnostic_module: module,
    diagnostic_framework: diagnosticModules[module] ??
      diagnosticModules[fallbackModule] ??
      diagnosticModules.teaching_concept_qa,
  };
}
