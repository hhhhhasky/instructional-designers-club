import { CASE_RETRIEVAL_SKILL, validateCaseConfig, type CaseConfig } from "./hai_case_retrieval.ts";

// Reuse the existing published Work Skill/version/reference store. An absent or
// disabled helper leaves historical tasks on their original generation path.
export async function loadCaseSkill(admin: any): Promise<CaseConfig | null> {
  const { data: skill, error } = await admin.from("hai_work_skills").select("id").eq("slug", CASE_RETRIEVAL_SKILL).eq("is_enabled", true).maybeSingle();
  if (error) throw new Error("案例检索 Skill 读取失败。");
  if (!skill) return null;
  const { data: version, error: ve } = await admin.from("hai_work_skill_versions").select("id,prompt_template,input_contract").eq("skill_id", skill.id).eq("status", "published").maybeSingle();
  if (ve || !version) throw new Error("案例检索 Skill 已启用，但没有可执行的已发布版本。");
  const { data: references, error: re } = await admin.from("hai_work_skill_references").select("path,content").eq("skill_version_id", version.id).in("path", ["references/sources.json", "references/topics.json"]);
  const reference = references?.find((r: any) => r.path === "references/sources.json");
  const topics = references?.find((r: any) => r.path === "references/topics.json");
  if (re || !reference || (version.input_contract.topic_routing === true && !topics)) throw new Error("案例检索信源或主题清单未配置。");
  const config: CaseConfig = { version_id: version.id, instructions: version.prompt_template,
    sources: JSON.parse(reference.content), searches: version.input_contract.searches, pages: version.input_contract.pages, billing_version: 1,
    ...(topics ? { topics: JSON.parse(topics.content) } : {}) };
  validateCaseConfig(config);
  return config;
}
