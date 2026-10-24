import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  IMAGE_PROMPT_CATALOG,
  type ImagePromptOverrides,
  validateImagePrompt,
} from "./hai_image_prompt_catalog.ts";

/** Per request, no process cache: edits apply to the next generation. */
export async function loadImagePromptOverrides(
  admin: Pick<SupabaseClient, "from">,
): Promise<ImagePromptOverrides> {
  const { data, error } = await admin.from("hai_runtime_settings")
    .select("key,value,enabled").like("key", "image_prompt.%");
  if (error) throw new Error(`生图提示词读取失败：${error.message}`);
  const known = new Set(
    IMAGE_PROMPT_CATALOG.map((definition) => definition.key),
  );
  const result: ImagePromptOverrides = {};
  for (const row of data ?? []) {
    if (!known.has(row.key) || row.enabled === false) continue;
    if (
      typeof row.value !== "string" || validateImagePrompt(row.key, row.value)
    ) {
      throw new Error(`生图提示词配置无效：${row.key}`);
    }
    result[row.key] = row.value;
  }
  return result;
}
