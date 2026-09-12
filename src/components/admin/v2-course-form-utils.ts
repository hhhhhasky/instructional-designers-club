export type V2CreateType = "unit" | "lesson";

type V2CreateOutline = {
  unit: { id: string };
};

export function resolveV2CreateParentId(
  type: V2CreateType,
  outlines: V2CreateOutline[],
  initialParentId?: string,
): string {
  if (initialParentId) return initialParentId;
  if (type === "lesson") return outlines[0]?.unit.id ?? "";
  return "";
}

export function buildV2OutlineExpansion(outlines: V2CreateOutline[]): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  outlines.forEach((outline) => { expanded[outline.unit.id] = true; });
  return expanded;
}

export function getV2ErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

export function isV2AssessmentVisibleOnLesson(status: string): boolean {
  return status === "published";
}

export function canPublishV2AssessmentBlock(status: string, itemCount: number): boolean {
  return !isV2AssessmentVisibleOnLesson(status) && itemCount > 0;
}
