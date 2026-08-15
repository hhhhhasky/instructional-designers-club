#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sourceRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程/教材课标知识库/权威文本重建版_待确认_20260814/三层payload候选_待入库";
const outputPath = path.resolve(import.meta.dirname, "../supabase/seed-data/hai-authoritative-reconstruction-textbooks-v3-lite.json");

const subjectConfig = {
  历史: { code: "history", familyCode: "tb", family: "统编版", profile: "junior-history-v3-lite", unitType: "unit", lessonType: "lesson", fields: 7 },
  生物: { code: "biology", familyCode: "pep", family: "人教版", profile: "junior-biology-v3-lite", unitType: "unit", lessonType: "section", fields: 8 },
  地理: { code: "geography", familyCode: "pep", family: "人教版", profile: "junior-geography-v3-lite", unitType: "chapter", lessonType: "topic", fields: 7 },
  语文: { code: "chinese", familyCode: "tb", family: "统编版", profile: "junior-chinese-v3-lite", unitType: "unit", lessonType: "text", fields: 3 },
};

const files = [
  "13_初中历史权威重建三层候选_payload-v2.json",
  "13_初中地理权威重建三层候选_payload-v2.json",
  "13_初中生物权威重建三层候选_payload-v2.json",
  "13_初中语文权威重建三层候选_payload-v2.json",
];

const payloads = files.map((file) => {
  const payload = JSON.parse(fs.readFileSync(path.join(sourceRoot, file), "utf8"));
  if (payload.schema_version !== "hai-textbook-v2") throw new Error(`${file}: expected hai-textbook-v2`);
  return payload;
});

const collections = [];
const sections = [];
const links = [];

for (const source of payloads) {
  const first = source.collections[0];
  const config = subjectConfig[first.subject];
  if (!config) throw new Error(`Unsupported subject: ${first.subject}`);

  const oldSlugToNew = new Map();
  for (const collection of source.collections) {
    const volumeCode = collection.volume === "上册" ? "v1" : collection.volume === "下册" ? "v2" : "full";
    const slug = `junior-${config.code}-${config.familyCode}-2024-g${String(collection.grade_level).padStart(2, "0")}-${volumeCode}`;
    if (oldSlugToNew.has(collection.slug)) throw new Error(`Duplicate source slug: ${collection.slug}`);
    oldSlugToNew.set(collection.slug, slug);

    collections.push({
      ...collection,
      slug,
      title: `${config.family}初中${collection.subject}${collection.grade_label}${collection.volume}权威重建版`,
      edition_label: `${config.family}2024年权威重建版`,
      publication_status: "current",
      verification_status: "authoritative_reconstruction_imported_pending_human_spot_check",
      source_note: "权威目录/课标/PDF证据边界内重建；人工抽检前生成结果仍需提示教师核对当册教材。",
      metadata: {
        ...collection.metadata,
        source_scope: "authoritative_reconstruction_20260814",
        import_status: "ready_for_v3_lite_import",
        v3_lite: true,
        merged_frame_policy: "subject_fields_in_lesson_markdown",
      },
      edition_year: 2024,
      lifecycle_status: "current",
      is_default: true,
      text_fidelity: "faithful_reconstruction",
      structure_profile: config.profile,
    });
  }

  const sourceSections = source.sections.map((section) => ({
    ...section,
    collection_slug: oldSlugToNew.get(section.collection_slug),
  }));
  const lessonMap = new Map();
  for (const section of sourceSections) {
    if (section.section_level === "lesson") {
      lessonMap.set(`${section.collection_slug}|${section.unit_number}|${section.lesson_number}`, {
        lesson: section,
        frames: [],
      });
    }
  }
  for (const section of sourceSections) {
    if (section.section_level !== "frame") continue;
    const parent = lessonMap.get(`${section.collection_slug}|${section.unit_number}|${section.lesson_number}`);
    if (!parent) throw new Error(`Frame has no lesson: ${section.section_key}`);
    parent.frames.push(section);
  }

  for (const { lesson, frames } of lessonMap.values()) {
    frames.sort((a, b) => a.frame_number - b.frame_number);
    if (frames.length !== config.fields) {
      throw new Error(`${lesson.collection_slug} u${lesson.unit_number}l${lesson.lesson_number}: expected ${config.fields} fields, got ${frames.length}`);
    }
  }

  for (const section of sourceSections) {
    if (section.section_level === "frame") continue;
    const paddedUnit = String(section.unit_number).padStart(2, "0");
    const sectionKey = section.section_level === "unit"
      ? `${section.collection_slug}::u${paddedUnit}`
      : `${section.collection_slug}::u${paddedUnit}::l${String(section.lesson_number).padStart(2, "0")}`;
    let contentMarkdown = section.content_markdown.trim();
    let sourceFiles = [...(section.metadata.source_files || [])];
    if (section.section_level === "lesson") {
      const parent = lessonMap.get(`${section.collection_slug}|${section.unit_number}|${section.lesson_number}`);
      contentMarkdown = [
        section.content_markdown.trim(),
        ...parent.frames.map((frame) => `## ${frame.frame_title}\n\n${frame.content_markdown.replace(/^###\s+/mu, "").trim()}`),
      ].join("\n\n");
      sourceFiles = [...new Set([
        ...sourceFiles,
        ...parent.frames.flatMap((frame) => frame.metadata.source_files || []),
      ])];
    }
    const contentText = plain(contentMarkdown);
    sections.push({
      ...section,
      section_key: sectionKey,
      content_type: section.section_level === "unit" ? "unit_context" : "lesson_summary",
      content_markdown: contentMarkdown,
      content_text: contentText,
      char_count: contentText.length,
      content_hash: sha256(contentMarkdown),
      sort_order: section.unit_number * 10000 + section.lesson_number * 100,
      native_node_type: section.section_level === "unit"
        ? (section.collection_slug.includes("geography") && section.unit_title !== "学习入门" ? config.unitType : "unit")
        : config.lessonType,
      native_label: section.section_level === "unit" ? section.unit_label : section.lesson_label,
      frame_policy: "not_applicable",
      metadata: {
        ...section.metadata,
        source_files: [...new Set(sourceFiles)],
        v3_lite: true,
        merged_frame_titles: section.section_level === "lesson"
          ? lessonMap.get(`${section.collection_slug}|${section.unit_number}|${section.lesson_number}`).frames.map((frame) => frame.frame_title)
          : [],
        frame_policy: "not_applicable",
      },
    });
  }

  const newKeys = new Set(sections.map((section) => section.section_key));
  for (const link of source.links) {
    if (link.relation_type !== "unit_to_lesson" && link.relation_type !== "lesson_to_unit") continue;
    const sourceSection = sourceSections.find((section) => section.section_key === link.section_key);
    const targetSection = sourceSections.find((section) => section.section_key === link.linked_section_key);
    if (!sourceSection || !targetSection) throw new Error(`Link endpoint missing: ${JSON.stringify(link)}`);
    const sourceKey = canonicalKey(sourceSection);
    const targetKey = canonicalKey(targetSection);
    if (!newKeys.has(sourceKey) || !newKeys.has(targetKey)) continue;
    links.push({
      section_key: sourceKey,
      linked_section_key: targetKey,
      relation_type: link.relation_type,
    });
  }
}

sections.sort((a, b) => a.collection_slug.localeCompare(b.collection_slug)
  || a.unit_number - b.unit_number
  || a.lesson_number - b.lesson_number);
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
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(JSON.stringify({
  output: outputPath,
  books: collections.length,
  units: payload.expected_unit_count,
  lessons: payload.expected_lesson_count,
  frames: payload.expected_frame_count,
  sections: sections.length,
  links: links.length,
  by_subject: Object.groupBy(collections, (collection) => collection.subject),
}, null, 2));

function canonicalKey(section) {
  const unit = `u${String(section.unit_number).padStart(2, "0")}`;
  if (section.section_level === "unit") return `${section.collection_slug}::${unit}`;
  return `${section.collection_slug}::${unit}::l${String(section.lesson_number).padStart(2, "0")}`;
}

function plain(markdown) {
  return String(markdown)
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/[>*_]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function validate(payload) {
  const errors = [];
  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
  const keyPattern = /^[a-z0-9]+(-[a-z0-9]+)*::u\d{2}(::l\d{2}(::f\d{2})?)?$/u;
  const slugs = new Set();
  const routes = new Set();
  const keys = new Set();

  for (const collection of payload.collections) {
    if (!slugPattern.test(collection.slug)) errors.push(`invalid slug ${collection.slug}`);
    if (slugs.has(collection.slug)) errors.push(`duplicate slug ${collection.slug}`);
    const route = `${collection.stage}|${collection.subject}|${collection.grade_level}|${collection.volume}`;
    if (routes.has(route)) errors.push(`duplicate route ${route}`);
    slugs.add(collection.slug);
    routes.add(route);
  }

  for (const section of payload.sections) {
    const expected = section.section_level === "unit"
      ? `${section.collection_slug}::u${String(section.unit_number).padStart(2, "0")}`
      : `${section.collection_slug}::u${String(section.unit_number).padStart(2, "0")}::l${String(section.lesson_number).padStart(2, "0")}`;
    if (!keyPattern.test(section.section_key) || section.section_key !== expected) errors.push(`invalid key ${section.section_key}`);
    if (keys.has(section.section_key)) errors.push(`duplicate key ${section.section_key}`);
    if (!slugs.has(section.collection_slug)) errors.push(`unknown collection ${section.collection_slug}`);
    if (sha256(section.content_markdown) !== section.content_hash) errors.push(`hash mismatch ${section.section_key}`);
    if (section.char_count !== section.content_text.length) errors.push(`char mismatch ${section.section_key}`);
    if (section.sort_order !== section.unit_number * 10000 + section.lesson_number * 100 + section.frame_number) errors.push(`sort mismatch ${section.section_key}`);
    keys.add(section.section_key);
  }

  const linkKeys = new Set(links.map((link) => `${link.section_key}|${link.linked_section_key}|${link.relation_type}`));
  for (const section of payload.sections) {
    if (section.section_level !== "lesson") continue;
    const unitKey = `${section.collection_slug}::u${String(section.unit_number).padStart(2, "0")}`;
    if (!linkKeys.has(`${unitKey}|${section.section_key}|unit_to_lesson`)) errors.push(`missing forward link ${section.section_key}`);
    if (!linkKeys.has(`${section.section_key}|${unitKey}|lesson_to_unit`)) errors.push(`missing reverse link ${section.section_key}`);
  }
  for (const link of payload.links) {
    if (!keys.has(link.section_key) || !keys.has(link.linked_section_key)) errors.push(`unknown link endpoint ${link.section_key}`);
  }
  if (payload.expected_book_count !== payload.collections.length) errors.push("book manifest mismatch");
  if (payload.expected_section_count !== payload.sections.length) errors.push("section manifest mismatch");
  if (payload.expected_link_count !== payload.links.length) errors.push("link manifest mismatch");
  if (errors.length) throw new Error(`V3-lite payload validation failed:\n${errors.join("\n")}`);
  return true;
}
