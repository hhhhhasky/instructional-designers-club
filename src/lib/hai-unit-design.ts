export { UNIT_SCOPES, validateUnitSelection } from "../../supabase/functions/_shared/hai_unit_design";
export type { UnitScope, UnitBookSelection, UnitFile } from "../../supabase/functions/_shared/hai_unit_design";

import type { UnitFile } from "../../supabase/functions/_shared/hai_unit_design";
export function readUnitFiles(content: Record<string, unknown>): UnitFile[] {
  if (!Array.isArray(content.files)) return [];
  return content.files.filter((file): file is UnitFile => Boolean(file && (file.kind === "unit" || file.kind === "lesson") && typeof file.filename === "string" && typeof file.title === "string" && typeof file.markdown === "string"));
}
