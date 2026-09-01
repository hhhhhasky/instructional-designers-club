#!/usr/bin/env node

/**
 * 将用户知识库中的高中数学 A/B 版教材分析生成 V3-lite payload。
 *
 * 源文档层级：册次目录 → # 章 → ## 节 → ### 小节 → #### 知识点。
 * 入库层级：collection → unit → lesson → frame；知识点保留在所属
 * lesson/frame 的 Markdown 正文中，不额外伪造数据库节点。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { completeTextbookPayload, validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const vaultRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程";
const textbookRoot = path.join(vaultRoot, "教材课标知识库", "高中数学");
const outputPath = path.resolve(process.argv[2] || "supabase/seed-data/senior-math-textbooks-v3-lite.json");

const editions = [
  { subject: "高中数学 A版", folder: "高中数学 A版", code: "a", edition: "人教 A 版" },
  { subject: "高中数学 B版", folder: "高中数学 B版", code: "b", edition: "人教 B 版" },
];

const volumeCodes = new Map([
  ["必修1", "required-1"],
  ["必修2", "required-2"],
  ["必修3", "required-3"],
  ["必修4", "required-4"],
  ["选择性必修1", "selective-required-1"],
  ["选择性必修2", "selective-required-2"],
  ["选择性必修3", "selective-required-3"],
]);

const collections = [];
const sections = [];
const links = [];

for (const edition of editions) {
  const editionRoot = path.join(textbookRoot, edition.folder);
  for (const volume of fs.readdirSync(editionRoot).filter((name) => fs.statSync(path.join(editionRoot, name)).isDirectory()).sort(volumeOrder)) {
    const volumeDir = path.join(editionRoot, volume);
    const files = fs.readdirSync(volumeDir)
      .filter((name) => /^第\d+章_.+\.md$/u.test(name))
      .sort((a, b) => chapterNumber(a) - chapterNumber(b));
    if (files.length === 0) throw new Error(`${edition.folder}/${volume} 没有章节文件`);

    const code = volumeCodes.get(volume);
    if (!code) throw new Error(`未配置册次编码：${volume}`);
    const slug = `senior-math-${edition.code}-${code}`;
    const sourceFiles = files.map((file) => relativeToCourse(path.join(volumeDir, file)));
    const sourceText = files.map((file) => fs.readFileSync(path.join(volumeDir, file), "utf8")).join("\n\n");
    collections.push({
      slug,
      title: `${edition.edition}高中数学${volume}教材分析`,
      stage: "高中",
      subject: edition.subject,
      publisher: "人民教育出版社",
      edition_family: edition.edition,
      edition_label: `${edition.edition}高中数学教材分析汇总`,
      grade_level: 10,
      grade_label: "高中",
      volume,
      effective_from: null,
      publication_status: "current",
      verification_status: "source_declared_user_provided_summary",
      requires_confirmation: true,
      content_type: "knowledge_summary",
      source_type: "user_provided_teacher_summary",
      source_file_name: sourceFiles.join("; "),
      source_note: "来自用户指定知识库的结构化教材整理，不是教材逐字原文；生成教案时仍需以教师手中当册教材核对版本和具体措辞。",
      source_hash: sha256(sourceText),
      metadata: {
        source_scope: "user_vault_senior_math",
        source_files: sourceFiles,
        edition: edition.edition,
        parser: "senior-math-chapter-section-subsection-v1",
        section_levels: ["unit", "lesson", "frame"],
      },
      edition_year: 2024,
      lifecycle_status: "current",
      is_default: true,
      text_fidelity: "teacher_summary",
      structure_profile: "senior-math-chapter-section-subsection-v1",
    });

    for (const file of files) {
      const filePath = path.join(volumeDir, file);
      const markdown = fs.readFileSync(filePath, "utf8");
      const parsed = parseChapter(markdown, file);
      const unitNumber = parsed.number;
      const unitKey = `${slug}::u${pad(unitNumber)}`;
      const unitContent = parsed.preamble || `本章为${parsed.title}，下设${parsed.lessons.length}个教材节。`;
      sections.push(makeSection({
        collectionSlug: slug,
        level: "unit",
        unitNumber,
        unitLabel: `第${unitNumber}章`,
        unitTitle: parsed.title,
        sectionPath: `${volume} / 第${unitNumber}章 ${parsed.title} / 章背景`,
        contentMarkdown: `# 第${unitNumber}章 ${parsed.title}\n\n${unitContent}`,
        sortOrder: unitNumber * 10000,
        nativeNodeType: "chapter",
        nativeLabel: `第${unitNumber}章`,
        metadata: { source_file: relativeToCourse(filePath), source_heading: parsed.heading },
      }));

      for (const [lessonIndex, lesson] of parsed.lessons.entries()) {
        const lessonNumber = lessonIndex + 1;
        const lessonKey = `${unitKey}::l${pad(lessonNumber)}`;
        const lessonBody = lesson.content || (lesson.frames.length
          ? `本节包含：${lesson.frames.map((frame) => frame.title).join("、")}。`
          : `本节教材内容为“${lesson.title}”。`);
        sections.push(makeSection({
          collectionSlug: slug,
          level: "lesson",
          unitNumber,
          unitLabel: `第${unitNumber}章`,
          unitTitle: parsed.title,
          lessonNumber,
          lessonLabel: `第${lessonNumber}节`,
          lessonTitle: lesson.title,
          sectionPath: `${volume} / 第${unitNumber}章 ${parsed.title} / 第${lessonNumber}节 ${lesson.title}`,
          contentMarkdown: lessonBody,
          sortOrder: unitNumber * 10000 + lessonNumber * 100,
          nativeNodeType: "section",
          nativeLabel: lesson.nativeLabel,
          metadata: {
            source_file: relativeToCourse(filePath),
            source_heading: lesson.heading,
            source_number: lesson.nativeLabel,
          },
        }));
        links.push({ section_key: unitKey, linked_section_key: lessonKey, relation_type: "unit_to_lesson" });
        links.push({ section_key: lessonKey, linked_section_key: unitKey, relation_type: "lesson_to_unit" });

        for (const [frameIndex, frame] of lesson.frames.entries()) {
          const frameNumber = frameIndex + 1;
          const frameKey = `${lessonKey}::f${pad(frameNumber)}`;
          const frameBody = frame.content || `本小节内容为“${frame.title}”。`;
          sections.push(makeSection({
            collectionSlug: slug,
            level: "frame",
            unitNumber,
            unitLabel: `第${unitNumber}章`,
            unitTitle: parsed.title,
            lessonNumber,
            lessonLabel: `第${lessonNumber}节`,
            lessonTitle: lesson.title,
            frameNumber,
            frameLabel: `第${frameNumber}小节`,
            frameTitle: frame.title,
            sectionPath: `${volume} / 第${unitNumber}章 ${parsed.title} / 第${lessonNumber}节 ${lesson.title} / 第${frameNumber}小节 ${frame.title}`,
            contentMarkdown: frameBody,
            sortOrder: unitNumber * 10000 + lessonNumber * 100 + frameNumber,
            nativeNodeType: "topic",
            nativeLabel: frame.nativeLabel,
            metadata: {
              source_file: relativeToCourse(filePath),
              source_heading: frame.heading,
              source_number: frame.nativeLabel,
            },
          }));
          links.push({ section_key: lessonKey, linked_section_key: frameKey, relation_type: "lesson_to_frame" });
          links.push({ section_key: frameKey, linked_section_key: lessonKey, relation_type: "frame_to_lesson" });
        }
      }
    }
  }
}

const payload = completeTextbookPayload({
  schemaVersion: "hai-textbook-v2",
  generatedAt: new Date().toISOString(),
  source_scope: "user_vault_senior_math",
  source_note: "高中数学人教 A/B 版教材分析源文档；文本为结构化教材知识整理，不是教材逐字原文。",
  expected_book_count: collections.length,
  expected_unit_count: sections.filter((section) => section.section_level === "unit").length,
  expected_lesson_count: sections.filter((section) => section.section_level === "lesson").length,
  expected_frame_count: sections.filter((section) => section.section_level === "frame").length,
  expected_section_count: sections.length,
  expected_link_count: links.length,
  collections,
  sections,
  links,
});

validateHaiTextbookPayload(payload, { source: outputPath });
const outputPayload = { ...payload, schema_version: "hai-textbook-v3-lite" };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: outputPath,
  collections: collections.length,
  sections: sections.length,
  units: payload.expected_unit_count,
  lessons: payload.expected_lesson_count,
  frames: payload.expected_frame_count,
  links: links.length,
  by_subject: Object.fromEntries(editions.map((edition) => [edition.subject, collections.filter((item) => item.subject === edition.subject).length])),
}, null, 2));

function makeSection({ collectionSlug, level, unitNumber, unitLabel, unitTitle, lessonNumber = 0, lessonLabel = "", lessonTitle = "", frameNumber = 0, frameLabel = "", frameTitle = "", sectionPath, contentMarkdown, sortOrder, nativeNodeType, nativeLabel, metadata }) {
  const contentText = plainText(contentMarkdown);
  return {
    section_key: [collectionSlug, `u${pad(unitNumber)}`, level === "unit" ? null : `l${pad(lessonNumber)}`, level === "frame" ? `f${pad(frameNumber)}` : null].filter(Boolean).join("::"),
    collection_slug: collectionSlug,
    section_level: level,
    unit_number: unitNumber,
    unit_label: unitLabel,
    unit_title: unitTitle,
    lesson_number: level === "unit" ? 0 : lessonNumber,
    lesson_label: level === "unit" ? "" : lessonLabel,
    lesson_title: level === "unit" ? "" : lessonTitle,
    frame_number: level === "frame" ? frameNumber : 0,
    frame_label: level === "frame" ? frameLabel : "",
    frame_title: level === "frame" ? frameTitle : "",
    section_path: sectionPath,
    content_type: level === "unit" ? "unit_context" : level === "lesson" ? "lesson_summary" : "knowledge_point",
    content_markdown: contentMarkdown.trim(),
    content_text: contentText,
    knowledge_point_count: Math.max(1, (contentMarkdown.match(/(?:^|\n)\s*[-*]\s+/g) ?? []).length),
    char_count: [...contentText].length,
    sort_order: sortOrder,
    content_hash: sha256(contentMarkdown.trim()),
    verification_status: "source_declared_user_provided_summary",
    metadata,
    native_node_type: nativeNodeType,
    native_label: nativeLabel,
    frame_policy: level === "frame" ? "native_printed_frame" : "not_applicable",
  };
}

function parseChapter(markdown, file) {
  const lines = markdown.replace(/^---[\s\S]*?---\s*/u, "").split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const heading = lines[headingIndex] || `# ${file}`;
  const match = file.match(/^第(\d+)章_(.+)\.md$/u);
  if (!match) throw new Error(`章节文件名不符合规范：${file}`);
  const number = Number(match[1]);
  const title = match[2];
  const headings = [];
  for (let index = headingIndex; index < lines.length; index += 1) {
    const found = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (found) headings.push({ level: found[1].length, title: found[2].trim(), index });
  }
  const h2 = headings.filter((item) => item.level === 2);
  const preamble = slice(lines, headingIndex + 1, h2[0]?.index ?? lines.length);
  const lessons = h2.map((lessonHeading, index) => {
    const nextH2 = h2[index + 1];
    const end = nextH2?.index ?? lines.length;
    const children = headings.filter((item) => item.level === 3 && item.index > lessonHeading.index && item.index < end);
    const content = slice(lines, lessonHeading.index + 1, children[0]?.index ?? end);
    const frames = children.map((frameHeading, frameIndex) => {
      const nextFrame = children[frameIndex + 1];
      return {
        heading: frameHeading.title,
        nativeLabel: extractNumber(frameHeading.title) || `3.${frameIndex + 1}`,
        title: cleanHeadingTitle(frameHeading.title),
        content: slice(lines, frameHeading.index + 1, nextFrame?.index ?? end),
      };
    });
    return {
      heading: lessonHeading.title,
      nativeLabel: extractNumber(lessonHeading.title) || `2.${index + 1}`,
      title: cleanHeadingTitle(lessonHeading.title),
      content,
      frames,
    };
  });
  return { number, title, heading: heading.slice(2).trim(), preamble, lessons };
}

function cleanHeadingTitle(title) {
  return title
    .replace(/^\d+(?:\.\d+)+\s*/u, "")
    .replace(/\s+\d+(?:\.\d+)+\s*$/u, "")
    .trim();
}

function extractNumber(title) {
  return title.match(/\d+(?:\.\d+)+/u)?.[0] || "";
}

function slice(lines, start, end) { return lines.slice(start, end).join("\n").trim(); }
function plainText(value) { return String(value).replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s+/gmu, "").replace(/^\s*[-*>|`]+\s?/gm, "").replace(/[*_~]/g, "").replace(/\s+/g, " ").trim(); }
function sha256(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function pad(value) { return String(value).padStart(2, "0"); }
function chapterNumber(file) { return Number(file.match(/^第(\d+)章_/u)?.[1] || 0); }
function volumeOrder(a, b) { return volumeRank(a) - volumeRank(b) || a.localeCompare(b); }
function volumeRank(value) { const match = value.match(/(必修|选择性必修)(\d+)/u); return match ? (match[1] === "必修" ? 0 : 10) + Number(match[2]) : 99; }
function relativeToCourse(file) { return path.relative(vaultRoot, file).split(path.sep).join("/"); }
