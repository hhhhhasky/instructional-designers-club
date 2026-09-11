import type { V2Resource } from "@/db/v2-api";

export const SUBJECT_EXPLORER_COMPONENT = "subject_example_explorer";

export interface V2SubjectExample {
  id: string;
  label: string;
  structure: string;
  example: string;
  route: string;
  focus: string;
  direction: string;
  contribution: string;
  pitfall: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSubjectExplorerResource(resource: V2Resource): boolean {
  return resource.metadata?.component === SUBJECT_EXPLORER_COMPONENT;
}

export function parseSubjectExamples(resource: V2Resource): V2SubjectExample[] {
  if (!isSubjectExplorerResource(resource) || !Array.isArray(resource.metadata.subjects)) return [];

  return resource.metadata.subjects.flatMap((value) => {
    if (!isRecord(value)) return [];
    const fields: Array<keyof V2SubjectExample> = ["id", "label", "structure", "example", "route", "focus", "direction", "contribution", "pitfall"];
    if (!fields.every((field) => nonBlankString(value[field]))) return [];
    return [{
      id: value.id as string,
      label: value.label as string,
      structure: value.structure as string,
      example: value.example as string,
      route: value.route as string,
      focus: value.focus as string,
      direction: value.direction as string,
      contribution: value.contribution as string,
      pitfall: value.pitfall as string,
    }];
  });
}
