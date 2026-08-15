#!/usr/bin/env node

/**
 * Import-ready HAI textbook payload for the teacher-curated physics,
 * chemistry and English summaries in the user's Obsidian vault.
 *
 * This intentionally stores structured summaries, not a verbatim copy of a
 * commercial textbook. H1/H2/H3 headings are the source-controlled hierarchy:
 * volume -> unit/chapter -> lesson/section -> frame/topic.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { completeTextbookPayload, validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const vaultRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程";
const sourceRoots = {
  physicsChemistry: path.join(vaultRoot, "初中物理化学教材"),
  english: path.join(vaultRoot, "英语教材"),
};
const outputPath = path.resolve(process.argv[2] ?? "supabase/seed-data/hai-physics-chemistry-english-textbooks.json");

const zh = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const sha256 = (value) => crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
const rel = (file) => path.relative(vaultRoot, file).split(path.sep).join("/");
const clean = (value) => String(value).replace(/^第\s*[一二三四五六七八九十\d]+\s*(?:章|单元|课题|节|课)\s*[:：.、]?\s*/u, "").replace(/^\d+(?:\.\d+)?[.、：:]?\s*/u, "").trim();
const number = (value) => {
  const text = String(value).replace(/[^一二三四五六七八九十\d]/gu, "");
  if (/^\d+$/u.test(text)) return Number(text);
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? zh[tens] ?? 0 : 1) * 10 + (ones ? zh[ones] ?? 0 : 0);
  }
  return zh[text] ?? 0;
};
const plain = (markdown) => markdown.replace(/```[\s\S]*?```/gu, " ").replace(/!\[[^\]]*\]\([^)]*\)/gu, " ").replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1").replace(/^\s*[-*>|`#]+\s?/gmu, "").replace(/[\\*_~]/gu, "").replace(/\s+/gu, " ").trim();

function headings(markdown) {
  const lines = markdown.split(/\r?\n/u);
  return lines.flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    return match ? [{ level: match[1].length, title: match[2].trim(), index }] : [];
  });
}

function block(markdown, all, heading) {
  const lines = markdown.split(/\r?\n/u);
  const next = all.find((item) => item.index > heading.index && item.level <= heading.level);
  return lines.slice(heading.index, next?.index ?? lines.length).join("\n").trim();
}

function parseVolume(file, subject, stage = "初中") {
  const markdown = read(file);
  const all = headings(markdown);
  const title = path.basename(file, ".md");
  const gradeMatch = title.match(/([八九七六五四三二一\d]+)年级/u);
  const grade = number(gradeMatch?.[1] ?? (subject === "英语" && title.includes("九年级") ? 9 : 0));
  const volume = title.match(/(上册|下册|全一册)/u)?.[1] ?? "全一册";
  const slug = `reviewed-${subject}-${stage}-${grade || "all"}-${volume.replace("全一册", "one").replace("上册", "1").replace("下册", "2")}`;
  const top = all.filter((item) => item.level === 1 && /^(?:第\s*[一二三四五六七八九十\d]+\s*(?:章|单元)|绪言|本册目录|Unit\s*\d+)/iu.test(item.title));
  const units = top.length ? top : [{ level: 1, title: `${subject}${volume}教材内容整理`, index: 0 }];
  const sections = [];
  const links = [];
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const unitHeading = units[unitIndex];
    const unitNumber = unitIndex + 1;
    const unitTitle = clean(unitHeading.title) || `${subject}第${unitNumber}单元`;
    const unitKey = `${slug}::u${unitNumber}`;
    const unitContent = block(markdown, all, unitHeading);
    sections.push(makeSection({ slug, level: "unit", unitNumber, unitTitle, content: unitContent, sort: unitNumber * 1000, source: file }));
    const boundaryEnd = units[unitIndex + 1]?.index ?? Number.POSITIVE_INFINITY;
    const children = all.filter((item) => item.index > unitHeading.index && item.index < boundaryEnd && item.level === 2);
    const lessons = children.length ? children : [{ level: 2, title: unitTitle, index: unitHeading.index }];
    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const lessonHeading = lessons[lessonIndex];
      const lessonNumber = lessonIndex + 1;
      const lessonTitle = clean(lessonHeading.title) || `${unitTitle}内容`;
      const lessonKey = `${slug}::u${unitNumber}::l${lessonNumber}`;
      sections.push(makeSection({ slug, level: "lesson", unitNumber, unitTitle, lessonNumber, lessonTitle, content: block(markdown, all, lessonHeading), sort: unitNumber * 1000 + lessonNumber, source: file }));
      links.push(link(unitKey, lessonKey, "unit_to_lesson"), link(lessonKey, unitKey, "lesson_to_unit"));
      const lessonEnd = lessons[lessonIndex + 1]?.index ?? boundaryEnd;
      const frames = all.filter((item) => item.index > lessonHeading.index && item.index < lessonEnd && item.level === 3);
      for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
        const frameHeading = frames[frameIndex];
        const frameNumber = frameIndex + 1;
        const frameTitle = clean(frameHeading.title) || `教材栏目${frameNumber}`;
        const frameKey = `${slug}::u${unitNumber}::l${lessonNumber}::f${frameNumber}`;
        sections.push(makeSection({ slug, level: "frame", unitNumber, unitTitle, lessonNumber, lessonTitle, frameNumber, frameTitle, content: block(markdown, all, frameHeading), sort: unitNumber * 1000 + lessonNumber * 10 + frameNumber, source: file }));
        links.push(link(lessonKey, frameKey, "lesson_to_frame"), link(frameKey, lessonKey, "frame_to_lesson"));
      }
    }
  }
  const sourceText = read(file);
  return {
    collection: {
      slug,
      title: `${subject}${grade ? `${grade}年级` : ""}${volume}教材内容整理`,
      stage,
      subject,
      publisher: subject === "英语" ? "人民教育出版社" : "人民教育出版社",
      edition_family: subject === "英语" ? "人教版/PEP" : "人教版",
      edition_label: "用户知识库结构化整理（以源文件版本说明为准）",
      grade_level: grade || null,
      grade_label: grade ? `${grade}年级` : "全一册",
      volume,
      publication_status: "current",
      verification_status: "source_declared_user_provided_summary",
      requires_confirmation: true,
      content_type: "knowledge_summary",
      source_type: "user_provided_teacher_summary",
      source_file_name: rel(file),
      source_note: "来自用户指定知识库的结构化教材整理，不是教材逐字原文；生成教案时仍需以教师手中当册教材核对版本和具体措辞。",
      source_hash: sha256(sourceText),
      metadata: { source_scope: "user_vault_physics_chemistry_english", parser: "heading-hierarchy-v1", section_levels: ["unit", "lesson", "frame"] },
    },
    sections,
    links,
  };
}

function makeSection({ slug, level, unitNumber, unitTitle, lessonNumber = 0, lessonTitle = "", frameNumber = 0, frameTitle = "", content, sort, source }) {
  const normalized = String(content).trim();
  const sectionKey = level === "unit" ? `${slug}::u${unitNumber}` : level === "lesson" ? `${slug}::u${unitNumber}::l${lessonNumber}` : `${slug}::u${unitNumber}::l${lessonNumber}::f${frameNumber}`;
  return {
    section_key: sectionKey,
    collection_slug: slug,
    section_level: level,
    unit_number: unitNumber,
    unit_label: `第${unitNumber}单元`,
    unit_title: unitTitle,
    lesson_number: lessonNumber,
    lesson_label: lessonNumber ? `第${lessonNumber}课` : "",
    lesson_title: lessonTitle,
    frame_number: frameNumber,
    frame_label: frameNumber ? `第${frameNumber}框` : "",
    frame_title: frameTitle,
    section_path: `${unitNumber} ${unitTitle}${lessonNumber ? ` / ${lessonNumber} ${lessonTitle}` : " / 单元背景"}${frameNumber ? ` / ${frameNumber} ${frameTitle}` : ""}`,
    content_type: level === "unit" ? "unit_context" : level === "lesson" ? "lesson_summary" : "knowledge_point",
    content_markdown: normalized || `# ${unitTitle}`,
    content_text: plain(normalized) || unitTitle,
    knowledge_point_count: Math.max(1, (normalized.match(/(?:^|\n)\s*[-*]\s+/gmu) ?? []).length),
    char_count: (plain(normalized) || unitTitle).length,
    sort_order: sort,
    content_hash: sha256(normalized),
    verification_status: "source_declared_user_provided_summary",
    metadata: { source_files: [rel(source)], parser: "heading-hierarchy-v1" },
  };
}

const link = (section_key, linked_section_key, relation_type) => ({ section_key, linked_section_key, relation_type });
function files(dir, predicate) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) return files(fullPath, predicate);
    return item.isFile() && predicate(item.name) ? [fullPath] : [];
  }).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function build() {
  const collections = [];
  const sections = [];
  const links = [];
  const add = (item) => { collections.push(item.collection); sections.push(...item.sections); links.push(...item.links); };
  for (const file of files(sourceRoots.physicsChemistry, (name) => name.endsWith(".md") && !name.startsWith("人教版初中物理化学_"))) {
    const subject = path.basename(file).includes("化学") ? "化学" : "物理";
    add(parseVolume(file, subject));
  }
  const englishFiles = files(sourceRoots.english, (name) => name.endsWith(".md") && !name.includes("全套索引") && !name.includes("2027春预发布"));
  for (const file of englishFiles) {
    const grade = number(path.basename(file).match(/([三四五六七八九\d]+)年级/u)?.[1] ?? "0");
    add(parseVolume(file, "英语", grade >= 3 && grade <= 6 ? "小学" : "初中"));
  }
  const seen = new Set();
  const uniqueCollections = collections.filter((item) => !seen.has(item.slug) && seen.add(item.slug));
  const allowed = new Set(uniqueCollections.map((item) => item.slug));
  const uniqueSections = [...new Map(sections.filter((item) => allowed.has(item.collection_slug)).map((item) => [item.section_key, item])).values()];
  const uniqueLinks = [...new Map(links.map((item) => [`${item.section_key}|${item.linked_section_key}|${item.relation_type}`, item])).values()];
  const payload = completeTextbookPayload({
    schemaVersion: "hai-textbook-v2",
    generatedAt: new Date().toISOString(),
    excluded_scopes: ["高中教材", "缺失学科目录摘要（另行导入）"],
    collections: uniqueCollections,
    sections: uniqueSections,
    links: uniqueLinks,
  });
  validateHaiTextbookPayload(payload, { source: outputPath });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const bySubject = Object.groupBy(payload.collections, (item) => item.subject);
  console.log(JSON.stringify({ output: outputPath, collections: payload.collections.length, sections: payload.sections.length, links: payload.links.length, by_subject: Object.fromEntries(Object.entries(bySubject).map(([key, value]) => [key, value.length])) }, null, 2));
}

build();
