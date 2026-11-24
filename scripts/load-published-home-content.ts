import { HOME_LANDING_KEYS, mergeHomeLandingContent } from "../src/lib/home-landing-content";
import type { PublishedHomeContent } from "../src/lib/published-home-content";

export async function loadPublishedHomeContent(
  env: Record<string, string>,
): Promise<PublishedHomeContent> {
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!env.VITE_SUPABASE_URL || !key) {
    throw new Error("首页构建缺少 Supabase 公开读取配置");
  }

  const sections = [...HOME_LANDING_KEYS, "founder"];
  const url = new URL("/rest/v1/site_content", env.VITE_SUPABASE_URL);
  url.searchParams.set("select", "section_key,data");
  url.searchParams.set("section_key", `in.(${sections.join(",")})`);
  const response = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`首页构建读取文案失败（HTTP ${response.status}）`);
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("首页构建收到无效文案");
  const sources: Record<string, { data: Record<string, unknown> }> = {};
  for (const row of rows) {
    if (!sections.includes(row?.section_key)) continue;
    if (!row.data || Array.isArray(row.data) || typeof row.data !== "object") {
      throw new Error(`首页文案区块格式无效（${row.section_key}）`);
    }
    sources[row.section_key] = { data: row.data };
  }

  return {
    landing: mergeHomeLandingContent(sources),
    founder: sources.founder ?? null,
  };
}
