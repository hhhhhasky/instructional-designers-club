#!/usr/bin/env node

/**
 * Canonical HAI textbook payload contract.
 *
 * Content granularity remains source-driven: a book may contain unit, lesson,
 * or frame records. The hierarchy fields and bidirectional links are stable
 * across every subject and generator.
 */

import crypto from "node:crypto";

export const HAI_TEXTBOOK_SCHEMA_VERSION = "hai-textbook-v2";
export const HAI_TEXTBOOK_SECTION_LEVELS = new Set(["unit", "lesson", "frame"]);
export const HAI_TEXTBOOK_LINK_TYPES = new Set([
  "unit_to_lesson",
  "lesson_to_unit",
  "lesson_to_frame",
  "frame_to_lesson",
]);

const emptyRoute = {
  lesson_number: 0,
  lesson_label: "",
  lesson_title: "",
  frame_number: 0,
  frame_label: "",
  frame_title: "",
};

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function completeTextbookPayload({
  collections,
  sections,
  links = [],
  schemaVersion = HAI_TEXTBOOK_SCHEMA_VERSION,
  generatedAt = new Date().toISOString(),
  schema_version: _legacySchemaVersion,
  generated_at: _legacyGeneratedAt,
  ...metadata
}) {
  const collectionMap = new Map(collections.map((collection) => [collection.slug, collection]));
  const sourceSections = sections.map((section) => normalizeSection(section));
  const sectionMap = new Map(sourceSections.map((section) => [section.section_key, section]));

  for (const section of [...sourceSections]) {
    if (section.section_level === "frame") {
      ensureParentSection(sourceSections, sectionMap, section, "lesson", collectionMap);
      ensureParentSection(sourceSections, sectionMap, section, "unit", collectionMap);
    } else if (section.section_level === "lesson") {
      ensureParentSection(sourceSections, sectionMap, section, "unit", collectionMap);
    }
  }

  const normalizedLinks = normalizeLinks(links, sectionMap);
  const completeLinks = addRequiredBidirectionalLinks(normalizedLinks, sectionMap);
  const sortedSections = [...sectionMap.values()].sort(compareSections);

  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    ...metadata,
    collections,
    sections: sortedSections,
    links: completeLinks,
  };
}

export function validateHaiTextbookPayload(payload, { source = "payload" } = {}) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${source}: 教材 payload 必须是 JSON 对象。`);
  }
  if (payload.schema_version !== HAI_TEXTBOOK_SCHEMA_VERSION) {
    errors.push(`schema_version 必须是 ${HAI_TEXTBOOK_SCHEMA_VERSION}，当前为 ${String(payload.schema_version)}`);
  }
  for (const key of ["collections", "sections", "links"]) {
    if (!Array.isArray(payload[key])) errors.push(`${key} 必须是数组`);
  }
  if (errors.length > 0) throwPayloadErrors(source, errors);

  const collections = payload.collections;
  const sections = payload.sections;
  const links = payload.links;
  const collectionSlugs = new Set();
  for (const [index, collection] of collections.entries()) {
    const prefix = `${source}.collections[${index}]`;
    requireText(collection, "slug", prefix, errors);
    requireText(collection, "title", prefix, errors);
    requireText(collection, "stage", prefix, errors);
    requireText(collection, "subject", prefix, errors);
    requireText(collection, "grade_label", prefix, errors);
    requireText(collection, "volume", prefix, errors);
    if (collectionSlugs.has(collection.slug)) errors.push(`${prefix}: slug 重复 ${collection.slug}`);
    collectionSlugs.add(collection.slug);
  }

  const sectionMap = new Map();
  for (const [index, section] of sections.entries()) {
    const prefix = `${source}.sections[${index}]`;
    requireText(section, "section_key", prefix, errors);
    requireText(section, "collection_slug", prefix, errors);
    requireText(section, "section_level", prefix, errors);
    requireText(section, "unit_label", prefix, errors);
    requireText(section, "unit_title", prefix, errors);
    requireText(section, "section_path", prefix, errors);
    requireText(section, "content_type", prefix, errors);
    requireText(section, "content_markdown", prefix, errors);
    requireText(section, "content_text", prefix, errors);
    if (!collectionSlugs.has(section.collection_slug)) errors.push(`${prefix}: collection_slug 不存在 ${section.collection_slug}`);
    if (!HAI_TEXTBOOK_SECTION_LEVELS.has(section.section_level)) errors.push(`${prefix}: section_level 非法 ${section.section_level}`);
    if (sectionMap.has(section.section_key)) errors.push(`${prefix}: section_key 重复 ${section.section_key}`);
    sectionMap.set(section.section_key, section);
    validateSectionShape(section, prefix, errors);
  }

  const linkMap = new Map();
  for (const [index, link] of links.entries()) {
    const prefix = `${source}.links[${index}]`;
    requireText(link, "section_key", prefix, errors);
    requireText(link, "linked_section_key", prefix, errors);
    requireText(link, "relation_type", prefix, errors);
    if (!HAI_TEXTBOOK_LINK_TYPES.has(link.relation_type)) errors.push(`${prefix}: relation_type 非法 ${link.relation_type}`);
    const sourceSection = sectionMap.get(link.section_key);
    const targetSection = sectionMap.get(link.linked_section_key);
    if (!sourceSection || !targetSection) {
      errors.push(`${prefix}: link 两端 section_key 必须都存在`);
    } else {
      validateLinkShape(link, sourceSection, targetSection, prefix, errors);
    }
    const key = `${link.section_key}|${link.linked_section_key}|${link.relation_type}`;
    if (linkMap.has(key)) errors.push(`${prefix}: link 重复`);
    linkMap.set(key, link);
  }

  for (const section of sections) {
    if (section.section_level === "unit") continue;
    const parentLevel = section.section_level === "lesson" ? "unit" : "lesson";
    const parent = sections.find((candidate) => candidate.section_level === parentLevel && sameParentRoute(candidate, section, parentLevel));
    if (!parent) errors.push(`${source}.sections.${section.section_key}: 缺少 ${parentLevel} 父级记录`);
    const forward = `${parent?.section_key}|${section.section_key}|${parentLevel === "unit" ? "unit_to_lesson" : "lesson_to_frame"}`;
    const reverse = `${section.section_key}|${parent?.section_key}|${parentLevel === "unit" ? "lesson_to_unit" : "frame_to_lesson"}`;
    if (parent && (!linkMap.has(forward) || !linkMap.has(reverse))) errors.push(`${source}.sections.${section.section_key}: 缺少父子双向 link`);
  }

  if (errors.length > 0) throwPayloadErrors(source, errors);
  return true;
}

function normalizeSection(section) {
  const sectionLevel = section.section_level || inferSectionLevel(section);
  const base = {
    ...section,
    section_level: sectionLevel,
    lesson_number: Number(section.lesson_number || 0),
    frame_number: Number(section.frame_number || 0),
    content_markdown: String(section.content_markdown ?? "").trim(),
    content_text: String(section.content_text ?? section.content_markdown ?? "").trim(),
  };
  if (sectionLevel === "unit") Object.assign(base, emptyRoute);
  if (sectionLevel === "lesson") Object.assign(base, { frame_number: 0, frame_label: "", frame_title: "" });
  return base;
}

function ensureParentSection(sections, sectionMap, child, level, collectionMap) {
  const key = parentKey(child, level);
  if (sectionMap.has(key)) return sectionMap.get(key);
  const existingParent = sections.find((candidate) => candidate.section_level === level && sameParentRoute(candidate, child, level));
  if (existingParent) return existingParent;
  const parent = makeParentSection(child, level, sections, collectionMap.get(child.collection_slug));
  sectionMap.set(key, parent);
  sections.push(parent);
  return parent;
}

function makeParentSection(child, level, sections, collection) {
  const isUnit = level === "unit";
  const key = parentKey(child, level);
  const title = isUnit ? child.unit_title : child.lesson_title;
  const label = isUnit ? child.unit_label : child.lesson_label;
  const childTitles = sections
    .filter((candidate) => candidate.collection_slug === child.collection_slug && sameParentRoute(candidate, child, level) && candidate.section_level !== level)
    .map((candidate) => isUnit ? `${candidate.lesson_label} ${candidate.lesson_title}` : `${candidate.frame_label} ${candidate.frame_title}`)
    .filter(Boolean);
  const contentMarkdown = isUnit
    ? `# ${label} ${title}\n\n目录背景：本单元包含${[...new Set(childTitles)].join("、") || "待补充"}。`
    : `# ${label} ${title}\n\n目录背景：本课包含${[...new Set(childTitles)].join("、") || "待补充"}。`;
  return {
    section_key: key,
    collection_slug: child.collection_slug,
    section_level: level,
    unit_number: child.unit_number,
    unit_label: child.unit_label,
    unit_title: child.unit_title,
    lesson_number: isUnit ? 0 : child.lesson_number,
    lesson_label: isUnit ? "" : child.lesson_label,
    lesson_title: isUnit ? "" : child.lesson_title,
    frame_number: 0,
    frame_label: "",
    frame_title: "",
    section_path: isUnit
      ? `${collection?.title || child.collection_slug} / ${child.unit_label} ${child.unit_title} / 单元背景`
      : `${collection?.title || child.collection_slug} / ${child.unit_label} ${child.unit_title} / ${child.lesson_label} ${child.lesson_title} / 课题背景`,
    content_type: isUnit ? "unit_context" : "lesson_context",
    content_markdown: contentMarkdown,
    content_text: contentMarkdown.replace(/[#>*`|_]/g, " ").replace(/\s+/g, " ").trim(),
    knowledge_point_count: 0,
    char_count: [...contentMarkdown].length,
    sort_order: Math.max(0, Number(child.sort_order || 0) - (isUnit ? 2 : 1)),
    content_hash: sha256(contentMarkdown),
    verification_status: child.verification_status,
    metadata: { synthetic_context: true, generated_from: child.section_key },
  };
}

function parentKey(section, level) {
  if (level === "unit") return `${section.collection_slug}::u${section.unit_number}`;
  return `${section.collection_slug}::u${section.unit_number}::l${section.lesson_number}`;
}

function inferSectionLevel(section) {
  if (!section.lesson_label && !section.lesson_title) return "unit";
  if (!section.frame_label && !section.frame_title) return "lesson";
  return "frame";
}

function sameParentRoute(candidate, section, level) {
  if (candidate.collection_slug !== section.collection_slug || candidate.unit_number !== section.unit_number) return false;
  return level === "unit" || candidate.lesson_number === section.lesson_number;
}

function normalizeLinks(links, sectionMap) {
  return links.filter((link) => sectionMap.has(link.section_key) && sectionMap.has(link.linked_section_key));
}

function addRequiredBidirectionalLinks(links, sectionMap) {
  const result = [...links];
  const existing = new Set(result.map((link) => `${link.section_key}|${link.linked_section_key}|${link.relation_type}`));
  for (const section of sectionMap.values()) {
    if (section.section_level === "unit") continue;
    const level = section.section_level === "lesson" ? "unit" : "lesson";
    const parent = [...sectionMap.values()].find((candidate) => candidate.section_level === level && sameParentRoute(candidate, section, level));
    if (!parent) continue;
    const relation = level === "unit" ? "unit_to_lesson" : "lesson_to_frame";
    const reverse = level === "unit" ? "lesson_to_unit" : "frame_to_lesson";
    addLink(result, existing, parent.section_key, section.section_key, relation);
    addLink(result, existing, section.section_key, parent.section_key, reverse);
  }
  return result;
}

function addLink(result, existing, sectionKey, linkedSectionKey, relationType) {
  const key = `${sectionKey}|${linkedSectionKey}|${relationType}`;
  if (existing.has(key)) return;
  existing.add(key);
  result.push({ section_key: sectionKey, linked_section_key: linkedSectionKey, relation_type: relationType });
}

function compareSections(a, b) {
  return a.collection_slug.localeCompare(b.collection_slug)
    || a.unit_number - b.unit_number
    || a.lesson_number - b.lesson_number
    || a.frame_number - b.frame_number
    || a.section_level.localeCompare(b.section_level);
}

function validateSectionShape(section, prefix, errors) {
  if (!Number.isInteger(section.unit_number) || section.unit_number <= 0) errors.push(`${prefix}: unit_number 必须是正整数`);
  if (section.section_level === "unit") {
    if (section.lesson_number !== 0 || section.frame_number !== 0) errors.push(`${prefix}: unit 段的 lesson/frame number 必须为 0`);
    if (section.lesson_label || section.lesson_title || section.frame_label || section.frame_title) errors.push(`${prefix}: unit 段的 lesson/frame 字段必须为空`);
  }
  if (section.section_level === "lesson") {
    if (section.lesson_number <= 0 || section.frame_number !== 0) errors.push(`${prefix}: lesson 段的 lesson_number 正数且 frame_number 为 0`);
    if (!section.lesson_label || !section.lesson_title || section.frame_label || section.frame_title) errors.push(`${prefix}: lesson 段必须有课题字段且框题字段为空`);
  }
  if (section.section_level === "frame") {
    if (section.lesson_number <= 0 || section.frame_number <= 0) errors.push(`${prefix}: frame 段的 lesson/frame number 必须为正数`);
    if (!section.lesson_label || !section.lesson_title || !section.frame_label || !section.frame_title) errors.push(`${prefix}: frame 段必须有完整课题和框题字段`);
  }
}

function validateLinkShape(link, source, target, prefix, errors) {
  if (source.collection_slug !== target.collection_slug) errors.push(`${prefix}: link 不能跨教材册次`);
  const valid = link.relation_type === "unit_to_lesson"
    ? source.section_level === "unit" && target.section_level === "lesson" && sameParentRoute(source, target, "unit")
    : link.relation_type === "lesson_to_unit"
      ? source.section_level === "lesson" && target.section_level === "unit" && sameParentRoute(source, target, "unit")
      : link.relation_type === "lesson_to_frame"
        ? source.section_level === "lesson" && target.section_level === "frame" && sameParentRoute(source, target, "lesson")
        : source.section_level === "frame" && target.section_level === "lesson" && sameParentRoute(source, target, "lesson");
  if (!valid) errors.push(`${prefix}: relation_type 与两端 section 层级/目录不匹配`);
}

function requireText(value, key, prefix, errors) {
  if (typeof value?.[key] !== "string" || !value[key].trim()) errors.push(`${prefix}.${key} 必须是非空字符串`);
}

function throwPayloadErrors(source, errors) {
  throw new Error(`${source}: 教材 payload 校验失败（${errors.length}项）\n- ${errors.slice(0, 20).join("\n- ")}${errors.length > 20 ? "\n- ..." : ""}`);
}
