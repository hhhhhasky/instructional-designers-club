import { validateUnitSelection, type UnitBookSelection } from "./hai_unit_design.ts";

// Service-only reads. Every requested number is checked against the same public
// catalog the form used, including the stage/subject and collection identity.
export async function loadUnitTextbookContext(admin: any, input: Record<string, unknown>) {
  const invalid = validateUnitSelection(input.reconstruction_scope, input.textbook_selections);
  if (invalid) throw new Error(invalid);
  const books = input.textbook_selections as UnitBookSelection[];
  const { data: catalog, error } = await admin.rpc("hai_list_textbook_catalog", { p_stage: input.stage, p_subject: input.subject });
  if (error) throw new Error(`读取教材目录失败：${error.message}`);
  const sources: any[] = [];
  const boundaries: string[] = [];
  for (const book of books) {
    const rows = (catalog ?? []).filter((row: any) => row.collection_slug === book.collection_slug);
    if (!rows.length) throw new Error("所选教材与学段、学科不匹配或已停用，请重新选择。");
    const { data: collection, error: bookError } = await admin.from("hai_textbook_collections").select("id, slug, title, edition_label, publication_status, requires_confirmation, source_hash, grade_label, grade_level, volume, publisher").eq("slug", book.collection_slug).eq("is_active", true).single();
    if (bookError || !collection) throw new Error("所选教材已不可用，请重新选择。");
    const sections: any[] = [];
    // Read all pages instead of relying on the Data API's default row limit.
    for (let offset = 0; ; offset += 500) {
      const { data: page, error: sectionError } = await admin.from("hai_textbook_sections")
        .select("id, section_level, unit_number, lesson_number, frame_number, unit_label, unit_title, lesson_label, lesson_title, frame_label, frame_title, section_path, content_type, content_markdown, content_hash, verification_status, sort_order")
        .eq("collection_id", collection.id).eq("is_active", true).in("unit_number", book.units.map((unit) => unit.unit_number)).order("sort_order").order("id").range(offset, offset + 499);
      if (sectionError) throw new Error(`读取教材正文失败：${sectionError.message}`);
      sections.push(...(page ?? []));
      if ((page ?? []).length < 500) break;
    }
    for (const unit of book.units) {
      const unitRows = rows.filter((row: any) => row.unit_route_number === unit.unit_number);
      if (!unitRows.length) throw new Error("所选单元不属于该教材，请重新选择。");
      for (const lesson of unit.lessons ?? []) {
        const lessonRows = unitRows.filter((row: any) => row.lesson_route_number === lesson.lesson_number);
        if (!lessonRows.length || lesson.frame_numbers?.some((n) => !lessonRows.some((row: any) => row.frame_route_number === n))) throw new Error("所选课题或框题与单元关系不一致，请重新选择。");
      }
      const chosen = (sections ?? []).filter((section: any) => {
        if (section.unit_number !== unit.unit_number) return false;
        if (!unit.lessons || section.section_level === "unit") return true;
        const lesson = unit.lessons.find((item) => item.lesson_number === section.lesson_number);
        return lesson && (section.section_level === "lesson" || !lesson.frame_numbers || lesson.frame_numbers.includes(section.frame_number));
      });
      if (!chosen.some((section: any) => section.section_level !== "unit" && section.content_markdown?.trim())) throw new Error("入选内容缺少教材正文，暂时无法生成完整单元设计。");
      // No silent source truncation: the complete selection must fit the request.
      for (const section of chosen) {
        if (!section.content_markdown?.trim()) throw new Error(`教材内容为空：${section.section_path}`);
        sources.push({ ...section, section_id: section.id, collection_slug: collection.slug, collection_title: collection.title, edition_label: collection.edition_label, publication_status: collection.publication_status, requires_confirmation: collection.requires_confirmation, source_hash: collection.source_hash, grade_label: collection.grade_label, grade_level: collection.grade_level, volume: collection.volume, publisher: collection.publisher });
      }
      boundaries.push(`${collection.title}（${collection.edition_label}）/${unitRows[0].unit_label} ${unitRows[0].unit_title}：${unit.lessons ? unit.lessons.map((lesson) => `${lesson.lesson_number}课${lesson.frame_numbers ? `（仅框题 ${lesson.frame_numbers.join("、")}）` : "（完整课题）"}`).join("；") : "完整单元"}`);
    }
  }
  const context = ["## 实际入选边界", ...boundaries, "单元导语和课题概述供前后关系核对；仅框题入选时，不把概述中其他内容扩展为入选范围。", ...sources.map((source) => `### ${source.collection_title} / ${source.section_path}\n资源ID：${source.section_id}；年级：${source.grade_label}；册次：${source.volume}；版本：${source.edition_label}；知识点梳理（非教材逐字原文）；核验：${source.verification_status}${source.requires_confirmation ? "；待纸质教材复核" : ""}\n${source.content_markdown}`)].join("\n\n");
  if (context.length > 160_000) throw new Error("入选教材内容过多，请减少本次重构的单元或课题后再生成，避免遗漏内容。");
  return { context, sources };
}

export function curriculumSubjects(subject: string) {
  if (subject.startsWith("高中数学")) return ["数学"];
  if (subject === "生物") return ["生物", "生物学"];
  if (["思政", "思想政治"].includes(subject)) return ["思想政治"];
  return [subject];
}

export function selectCurriculumExcerpts(content: string, keywords: string[], budget = 22_000) {
  const pieces = content.split(/\n\s*\n/).flatMap((paragraph) => paragraph.match(/[\s\S]{1,2400}/g) ?? []);
  const ranked = pieces.map((text, index) => ({ text, index, score: keywords.reduce((sum, key) => sum + (key.length > 1 && text.includes(key) ? 3 : 0), 0) + (/核心素养|内容要求|学业要求|课程目标|学业质量/.test(text) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  let length = 0;
  const selected = ranked.filter((piece) => { if (piece.score === 0 || length + piece.text.length > budget) return false; length += piece.text.length; return true; });
  return selected.sort((a, b) => a.index - b.index).map((piece) => `正文段落 ${piece.index + 1}\n${piece.text}`).join("\n\n");
}

export async function loadUnitCurriculumContext(admin: any, input: Record<string, unknown>, sources: any[]) {
  const { data, error } = await admin.from("hai_knowledge_sources").select("id, title, content, metadata")
    .eq("is_active", true).eq("visibility", "shared").eq("metadata->>source_kind", "curriculum_standard")
    .in("metadata->>subject", curriculumSubjects(String(input.subject))).limit(100);
  if (error) throw new Error(`读取课标失败：${error.message}`);
  const matching = (data ?? []).filter((source: any) => {
    const band = `${source.metadata?.grade_band ?? ""} ${source.title}`;
    return input.stage === "高中" ? /高中/.test(band) : ["小学", "初中"].includes(String(input.stage)) ? /义务教育/.test(band) || band.includes(String(input.stage)) : band.includes(String(input.stage));
  }).sort((a: any, b: any) => String(b.title).localeCompare(String(a.title), "zh-CN"));
  const records: any[] = [];
  const blocks: string[] = [];
  const keywords = [...new Set<string>(sources.flatMap((source) => [source.unit_title, source.lesson_title, source.frame_title]).filter(Boolean))];
  // Do not combine competing editions without a deliberate version choice.
  if (matching.length > 1) return { context: "", sources: [], status: "ambiguous" };
  for (const source of matching) {
    if (!source.content?.trim()) continue;
    const excerpt = selectCurriculumExcerpts(source.content, keywords);
    if (!excerpt) continue;
    records.push({ id: source.id, title: source.title, metadata: source.metadata, excerpt });
    blocks.push(`### ${source.title}\n资源ID：${source.id}；以下为实际正文节选，适用年级仍须按段落核对，未出现的要求不推断。\n${excerpt}`);
  }
  return { context: blocks.join("\n\n"), sources: records, status: records.length ? "matched" : "missing" };
}
