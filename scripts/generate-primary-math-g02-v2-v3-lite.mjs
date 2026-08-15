#!/usr/bin/env node

/**
 * Generate a V3-lite payload for 人教版小学数学 2年级下册
 * (collection slug: primary-math-pep-legacy-g02-v2).
 *
 * Why: the original non-politics parser created one lesson per "## N." heading
 * AND one per "### 例题" child, doubling the catalog (38 lessons in unit 2,
 * 196 in the whole book). The fixed parsePrimaryMath keeps only the "## N."
 * lesson boundaries and merges every 例题/探究 child into that lesson.
 *
 * This payload is imported through hai_import_textbook_v3_lite_payload, which
 * upserts by canonical slug/section_key, deactivates the stale over-split rows
 * and rebuilds the bidirectional links.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const COLLECTION_SLUG = "primary-math-pep-legacy-g02-v2";
const MATH_DIR = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程/教材课标知识库/人教版小学数学教材/二年级下册";
const OUTPUT = path.resolve(import.meta.dirname, "../supabase/seed-data/primary-math-g02-v2-v3-lite.json");

const unitFiles = [
  "01-数据收集和整理.md",
  "02-表内除法（一）.md",
  "03-图形的运动（一）.md",
  "04-表内除法（二）.md",
  "05-混合运算.md",
  "06-有余数的除法.md",
  "07-万以内数的认识.md",
  "08-克和千克.md",
  "09-小小设计师.md",
  "10-数学广角——推理.md",
  "11-总复习.md",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/u, "").trim();
}

function plainText(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*>|`#]+\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingParts(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) headings.push({ level: match[1].length, title: match[2].trim(), index });
  }
  return { lines, headings };
}

function sectionBetween(markdown, headings, startHeading, stopLevels = [startHeading.level]) {
  const end = headings.find((heading) => heading.index > startHeading.index && stopLevels.includes(heading.level));
  const lines = markdown.split(/\r?\n/);
  return lines.slice(startHeading.index, end?.index ?? lines.length).join("\n").trim();
}

function cleanTitle(title) {
  return String(title)
    .replace(/^[#\s]+/u, "")
    .replace(/\s*#+\s*$/u, "")
    .trim();
}

function unitNumberFromFile(fileName) {
  const match = fileName.match(/^(\d{1,2})[-_]/u);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function unitTitleFromFile(fileName) {
  const match = fileName.match(/^\d{1,2}[-_](.*)\.md$/u);
  return (match?.[1] ?? "").replace(/^0+/, "").trim();
}

// Same boundary logic as the fixed parsePrimaryMath in
// scripts/generate-hai-non-politics-textbooks.mjs.
function lessonCandidatesFor(markdown) {
  const { headings } = headingParts(markdown);
  const structured = headings.filter((heading) =>
    heading.level === 2 && /^(?:\d+[.、．\s]|[一二三四五六七八九十]+、|例题|例\s*\d|探究|活动|单元总结)/u.test(heading.title)
  );
  const fallback = headings.filter((heading) =>
    heading.level === 3 && /^(?:例题|例\s*\d|活动|复习活动|探究\s*(?:\d|[一二三四五六七八九十])|[一二三四五六七八九十]+、)/u.test(heading.title)
  );
  const underExcludedParent = (heading) => {
    let parent = null;
    for (const candidate of headings) {
      if (candidate.index >= heading.index) break;
      if (candidate.level < heading.level) parent = candidate;
    }
    return parent?.level === 1 && /复习建议|评估建议|结论与法则|评估与练习|情境与真实问题|单元关系|新课标|教学建议/u.test(parent.title);
  };
  return (structured.length ? structured : fallback)
    .filter((heading) => !underExcludedParent(heading))
    .filter((heading) => !/单元知识结构|结论与法则|评估与练习|情境与真实问题|单元关系|新课标|教学建议/u.test(heading.title));
}

function unitIntro(markdown, firstLessonIndex) {
  const lines = markdown.split(/\r?\n/);
  return lines.slice(0, firstLessonIndex ?? lines.length).join("\n").trim();
}

const collections = [];
const sections = [];
const links = [];
const sourceFiles = unitFiles.map((file) => path.join(MATH_DIR, file));
const sourceText = sourceFiles.map((file) => `${file}\n${read(file)}`).join("\n\n");

for (const fileName of unitFiles) {
  const filePath = path.join(MATH_DIR, fileName);
  const markdown = read(filePath);
  const unitNumber = unitNumberFromFile(fileName);
  const unitTitle = unitTitleFromFile(fileName);
  const { headings } = headingParts(markdown);
  const candidates = lessonCandidatesFor(markdown);
  const unitKey = `${COLLECTION_SLUG}::u${String(unitNumber).padStart(2, "0")}`;

  const intro = unitIntro(markdown, candidates[0]?.index);
  const unitMarkdown = stripFrontmatter(intro).trim();
  sections.push({
    section_key: unitKey,
    collection_slug: COLLECTION_SLUG,
    section_level: "unit",
    unit_number: unitNumber,
    unit_label: `第${unitNumber}单元`,
    unit_title: unitTitle,
    lesson_number: 0,
    lesson_label: "",
    lesson_title: "",
    frame_number: 0,
    frame_label: "",
    frame_title: "",
    section_path: `${unitNumber} ${unitTitle} / 单元背景`,
    content_type: "unit_context",
    content_markdown: unitMarkdown,
    content_text: plainText(unitMarkdown),
    knowledge_point_count: Math.max(1, (unitMarkdown.match(/(?:^|\n)\s*[-*]\s+/g) ?? []).length),
    char_count: plainText(unitMarkdown).length,
    sort_order: unitNumber * 10000,
    content_hash: sha256(unitMarkdown),
    verification_status: "source_declared_user_provided_summary",
    metadata: {
      parser: "primary-math-unit-file",
      source_files: [filePath],
      v3_lite: true,
      lesson_boundary: "level2_heading",
    },
    native_node_type: "unit",
    native_label: `第${unitNumber}单元`,
    frame_policy: "not_applicable",
  });

  candidates.forEach((heading, index) => {
    const lessonNumber = index + 1;
    const content = sectionBetween(markdown, headings, heading, [heading.level]);
    const normalized = stripFrontmatter(content).trim();
    const lessonKey = `${COLLECTION_SLUG}::u${String(unitNumber).padStart(2, "0")}::l${String(lessonNumber).padStart(2, "0")}`;
    const lessonTitle = cleanTitle(heading.title);
    sections.push({
      section_key: lessonKey,
      collection_slug: COLLECTION_SLUG,
      section_level: "lesson",
      unit_number: unitNumber,
      unit_label: `第${unitNumber}单元`,
      unit_title: unitTitle,
      lesson_number: lessonNumber,
      lesson_label: `第${lessonNumber}课`,
      lesson_title: lessonTitle,
      frame_number: 0,
      frame_label: "",
      frame_title: "",
      section_path: `${unitNumber} ${unitTitle} / ${lessonNumber} ${lessonTitle}`,
      content_type: "lesson_summary",
      content_markdown: normalized,
      content_text: plainText(normalized),
      knowledge_point_count: Math.max(1, (normalized.match(/(?:^|\n)\s*[-*]\s+/g) ?? []).length),
      char_count: plainText(normalized).length,
      sort_order: unitNumber * 10000 + lessonNumber * 100,
      content_hash: sha256(normalized),
      verification_status: "source_declared_user_provided_summary",
      metadata: {
        parser: "primary-math-unit-file",
        source_files: [filePath],
        source_heading: heading.title,
        synthetic_lesson: false,
        v3_lite: true,
        lesson_boundary: "level2_heading",
      },
      native_node_type: "lesson",
      native_label: `第${lessonNumber}课`,
      frame_policy: "not_applicable",
    });
    links.push({ section_key: unitKey, linked_section_key: lessonKey, relation_type: "unit_to_lesson" });
    links.push({ section_key: lessonKey, linked_section_key: unitKey, relation_type: "lesson_to_unit" });
  });
}

collections.push({
  slug: COLLECTION_SLUG,
  title: "人教版小学数学2年级下册教材分析",
  stage: "小学",
  subject: "数学",
  publisher: "人民教育出版社",
  edition_family: "人教版",
  edition_label: "人教版（用户知识库整理版）",
  grade_level: 2,
  grade_label: "2年级",
  volume: "下册",
  effective_from: "2013-09-01",
  publication_status: "current",
  verification_status: "source_declared_user_provided_summary",
  requires_confirmation: true,
  content_type: "knowledge_summary",
  source_type: "user_provided_teacher_summary",
  source_file_name: unitFiles.join("; "),
  source_note: "来自用户指定知识库的结构化教材整理，不是教材逐字原文；生成教案时仍需以教师手中当册教材核对版本和具体措辞。",
  source_hash: sha256(sourceText),
  metadata: {
    source_scope: "user_vault_non_politics_textbooks",
    source_files: unitFiles,
    ingestion_version: "non-politics-unit-lesson-v1",
    section_levels: ["unit", "lesson"],
    legacy_slug: "primary-math-grade-2-volume-2",
    v3_lite: true,
    fix: "merged_example_level_lessons_into_lesson",
  },
  edition_year: 2013,
  lifecycle_status: "current",
  is_default: true,
  text_fidelity: "teacher_summary",
  structure_profile: "primary-math-unit-lesson-v2",
});

sections.sort((a, b) => a.unit_number - b.unit_number || a.lesson_number - b.lesson_number);
links.sort((a, b) => a.section_key.localeCompare(b.section_key) || a.linked_section_key.localeCompare(b.linked_section_key));

const payload = {
  schema_version: "hai-textbook-v3-lite",
  generated_at: new Date().toISOString(),
  expected_book_count: collections.length,
  expected_unit_count: sections.filter((section) => section.section_level === "unit").length,
  expected_lesson_count: sections.filter((section) => section.section_level === "lesson").length,
  expected_frame_count: sections.filter((section) => section.section_level === "frame").length,
  expected_section_count: sections.length,
  expected_link_count: links.length,
  collections,
  sections,
  links,
};

validate(payload);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const byUnit = Object.groupBy(sections.filter((section) => section.section_level === "lesson"), (section) => section.unit_number);
console.log(JSON.stringify({
  output: OUTPUT,
  books: collections.length,
  units: payload.expected_unit_count,
  lessons: payload.expected_lesson_count,
  sections: sections.length,
  links: links.length,
  lessons_by_unit: Object.fromEntries(Object.keys(byUnit).map((key) => [key, byUnit[key].length])),
}, null, 2));

function validate(payload) {
  const errors = [];
  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
  const keyPattern = /^[a-z0-9]+(-[a-z0-9]+)*::u\d{2}(::l\d{2})?$/u;
  const slugs = new Set();
  const keys = new Set();
  for (const collection of payload.collections) {
    if (!slugPattern.test(collection.slug)) errors.push(`invalid slug ${collection.slug}`);
    if (slugs.has(collection.slug)) errors.push(`duplicate slug ${collection.slug}`);
    if (!(collection.edition_year >= 2000 && collection.edition_year <= 2100)) errors.push(`invalid edition_year ${collection.edition_year}`);
    if (!["draft", "candidate", "current", "catalogue_summary", "legacy", "retired"].includes(collection.lifecycle_status)) errors.push(`invalid lifecycle ${collection.lifecycle_status}`);
    if (!["catalogue_summary", "teacher_summary", "faithful_reconstruction", "verbatim"].includes(collection.text_fidelity)) errors.push(`invalid fidelity ${collection.text_fidelity}`);
    if (!slugPattern.test(collection.structure_profile || "")) errors.push(`invalid profile ${collection.structure_profile}`);
    slugs.add(collection.slug);
  }
  for (const section of payload.sections) {
    const expectedKey = section.section_level === "unit"
      ? `${section.collection_slug}::u${String(section.unit_number).padStart(2, "0")}`
      : `${section.collection_slug}::u${String(section.unit_number).padStart(2, "0")}::l${String(section.lesson_number).padStart(2, "0")}`;
    if (!keyPattern.test(section.section_key) || section.section_key !== expectedKey) errors.push(`invalid key ${section.section_key}`);
    if (keys.has(section.section_key)) errors.push(`duplicate key ${section.section_key}`);
    if (!slugs.has(section.collection_slug)) errors.push(`unknown collection ${section.collection_slug}`);
    if (sha256(section.content_markdown) !== section.content_hash) errors.push(`hash mismatch ${section.section_key}`);
    if (section.char_count !== section.content_text.length) errors.push(`char mismatch ${section.section_key}`);
    if (section.sort_order !== section.unit_number * 10000 + section.lesson_number * 100 + section.frame_number) errors.push(`sort mismatch ${section.section_key}`);
    if (!["unit", "chapter", "section", "lesson", "topic", "frame", "session", "text", "activity", "supplement"].includes(section.native_node_type)) errors.push(`invalid native type ${section.section_key}`);
    if (!["native_printed_frame", "subject_field_block", "evidence_block", "not_applicable"].includes(section.frame_policy)) errors.push(`invalid frame policy ${section.section_key}`);
    keys.add(section.section_key);
  }
  for (const link of payload.links) {
    if (!["unit_to_lesson", "lesson_to_unit"].includes(link.relation_type)) errors.push(`invalid relation ${link.relation_type}`);
    if (!keys.has(link.section_key) || !keys.has(link.linked_section_key)) errors.push(`link endpoint missing ${link.section_key}->${link.linked_section_key}`);
  }
  if (errors.length) {
    throw new Error(`Payload validation failed:\n${errors.slice(0, 20).join("\n")}${errors.length > 20 ? `\n...and ${errors.length - 20} more` : ""}`);
  }
}
