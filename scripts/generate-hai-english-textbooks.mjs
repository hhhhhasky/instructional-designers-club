#!/usr/bin/env node

/**
 * Build the English-only textbook payload.
 *
 * English source notes are not organized like politics/math textbooks. The
 * stable public hierarchy is therefore:
 *   real Unit -> teachable Session -> source activity/text evidence
 *
 * Summary headings (unit questions, goals, word lists, language-form indexes)
 * remain in the Unit context and are never exposed as selectable lessons.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { completeTextbookPayload, validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const vaultRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程";
const englishRoot = path.join(vaultRoot, "英语教材");
const outputPath = path.resolve(process.argv[2] ?? "supabase/seed-data/hai-english-textbooks.json");

const zh = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
const sha256 = (value) => crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
const relative = (file) => path.relative(vaultRoot, file).split(path.sep).join("/");
const plain = (markdown) => markdown
  .replace(/```[\s\S]*?```/gu, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
  .replace(/^\s*[-*>|`#]+\s?/gmu, "")
  .replace(/[\\*_~]/gu, "")
  .replace(/\s+/gu, " ")
  .trim();

function number(value) {
  const text = String(value).replace(/[^一二三四五六七八九十\d]/gu, "");
  if (/^\d+$/u.test(text)) return Number(text);
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? zh[tens] ?? 0 : 1) * 10 + (ones ? zh[ones] ?? 0 : 0);
  }
  return zh[text] ?? 0;
}

function headings(markdown) {
  return markdown.split(/\r?\n/u).flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    return match ? [{ level: match[1].length, title: match[2].trim(), index }] : [];
  });
}

function block(markdown, all, heading, endIndex = Number.POSITIVE_INFINITY) {
  const lines = markdown.split(/\r?\n/u);
  const next = all.find((item) => item.index > heading.index && item.index < endIndex && item.level <= heading.level);
  const end = next?.index ?? endIndex;
  return lines.slice(heading.index, end === Number.POSITIVE_INFINITY ? lines.length : end).join("\n").trim();
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    if (!entry.isFile() || !entry.name.endsWith(".md")) return [];
    if (entry.name.includes("全套索引") || entry.name.includes("2027春预发布")) return [];
    return [full];
  }).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function unitHeading(title) {
  const match = String(title).match(/^((?:Starter\s+)?Unit)\s*(\d+)\s*(.*?)\s*$/iu);
  if (!match) return null;
  return {
    label: `${match[1].replace(/\s+/gu, " ")} ${match[2]}`.trim(),
    title: match[3].trim() || `${match[1]} ${match[2]}`,
  };
}

function gradeAndVolume(file) {
  const title = path.basename(file);
  const gradeMatch = title.match(/([八九七六五四三二一\d]+)年级/u);
  const grade = number(gradeMatch?.[1] ?? 0);
  return { grade, volume: title.match(/(上册|下册|全一册)/u)?.[1] ?? "全一册" };
}

function classify(title, stage, currentPart = "") {
  const value = String(title).trim();
  if (/单元问题|单元位置|单元核心|单元内容|内容主线|核心内容|Language Goal|单元主题|单元功能|核心词汇|正式.*词表|正式词汇|重点表达|语言形式|语言与写作|听说读写|语法进阶|阅读.*索引|写作.*进阶|综合任务|教材词汇|册末|附录|核验说明|主要来源|完整度|使用提醒/iu.test(value)) return "unit_context";
  if (/Unit opening|Look and think|Look and share|^开篇页/iu.test(value)) return "opening";
  if (/Section A|Part A|A\s+Let's|A\s+Let’s/iu.test(value)) return "part_a";
  if (/Section B|Part B|B\s+Let's|B\s+Let’s/iu.test(value)) return "part_b";
  if (/Pronunciation|Letters and sounds|Let's spell|Let’s spell/iu.test(value)) return "phonics";
  if (/Grammar Focus|^Grammar\b/iu.test(value)) return "grammar";
  if (/Writing|写作/iu.test(value) && /Project|项目/iu.test(value)) return "writing_project";
  if (/Writing|写作/iu.test(value)) return "writing";
  if (/Vocabulary in Use/iu.test(value)) return "vocabulary";
  if (/Read and write|Start to read|Section B 阅读|Reading/iu.test(value)) return "reading";
  if (/Project|项目|Story time|Reflecting|Self-check|Let's check|Let’s check|复习/iu.test(value)) return "project";
  if (stage === "小学" && currentPart) return currentPart;
  return "other";
}

function childBlocks(markdown, all, parent, boundaryEnd, stage) {
  const parentEnd = all.find((item) => item.index > parent.index && item.index < boundaryEnd && item.level <= parent.level)?.index ?? boundaryEnd;
  const childHeadings = all.filter((item) => item.level === 3 && item.index > parent.index && item.index < parentEnd);
  if (childHeadings.length === 0) return [{ heading: parent, title: parent.title, type: classify(parent.title, stage), content: block(markdown, all, parent, parentEnd) }];
  return childHeadings.map((child) => ({
    heading: child,
    title: `${parent.title}｜${child.title}`,
    type: classify(parent.title, stage),
    content: block(markdown, all, child, parentEnd),
  }));
}

function sourceBlocks(markdown, all, unitHeading, boundaryEnd, stage) {
  const raw = all
    .filter((item) => item.level === 2 && item.index > unitHeading.index && item.index < boundaryEnd)
    .map((heading) => ({ heading, title: heading.title, content: block(markdown, all, heading, boundaryEnd) }));
  let currentPart = "";
  return raw.map((item) => {
    const explicit = classify(item.title, stage, currentPart);
    if (explicit === "part_a" || explicit === "part_b") currentPart = explicit;
    const type = classify(item.title, stage, currentPart);
    const parentEnd = all.find((candidate) => candidate.index > item.heading.index && candidate.index < boundaryEnd && candidate.level <= item.heading.level)?.index ?? boundaryEnd;
    const subheadings = all
      .filter((candidate) => candidate.level === 3 && candidate.index > item.heading.index && candidate.index < parentEnd)
      .map((candidate) => candidate.title);
    return { ...item, type, subheadings };
  });
}

function makeSection({ slug, level, unitNumber, unitLabel, unitTitle, lessonNumber = 0, lessonLabel = "", lessonTitle = "", frameNumber = 0, frameLabel = "", frameTitle = "", content, sort, source, contentType, metadata = {} }) {
  const normalized = String(content || "").trim();
  const sectionKey = level === "unit"
    ? `${slug}::u${unitNumber}`
    : level === "lesson"
    ? `${slug}::u${unitNumber}::l${lessonNumber}`
    : `${slug}::u${unitNumber}::l${lessonNumber}::f${frameNumber}`;
  return {
    section_key: sectionKey,
    collection_slug: slug,
    section_level: level,
    unit_number: unitNumber,
    unit_label: unitLabel,
    unit_title: unitTitle,
    lesson_number: lessonNumber,
    lesson_label: lessonNumber ? lessonLabel : "",
    lesson_title: lessonTitle,
    frame_number: frameNumber,
    frame_label: frameNumber ? frameLabel : "",
    frame_title: frameTitle,
    section_path: `${unitLabel} ${unitTitle}${lessonNumber ? ` / ${lessonLabel} ${lessonTitle}` : " / 单元整体背景"}${frameNumber ? ` / ${frameLabel} ${frameTitle}` : ""}`,
    content_type: contentType || (level === "unit" ? "unit_context" : level === "lesson" ? "lesson_summary" : "knowledge_point"),
    content_markdown: normalized || `# ${unitLabel} ${unitTitle}`,
    content_text: plain(normalized) || unitTitle,
    knowledge_point_count: Math.max(1, (normalized.match(/(?:^|\n)\s*[-*]\s+/gmu) ?? []).length),
    char_count: (plain(normalized) || unitTitle).length,
    sort_order: sort,
    content_hash: sha256(normalized),
    verification_status: "source_declared_user_provided_summary",
    metadata: { source_files: [relative(source)], parser: "english-session-v2", ...metadata },
  };
}

const link = (section_key, linked_section_key, relation_type) => ({ section_key, linked_section_key, relation_type });

function primarySessions(blocks) {
  const opening = blocks.filter((item) => item.type === "opening");
  const partA = blocks.filter((item) => item.type === "part_a");
  const phonics = blocks.filter((item) => item.type === "phonics");
  const partB = blocks.filter((item) => item.type === "part_b");
  const reading = blocks.filter((item) => item.type === "reading");
  const project = blocks.filter((item) => item.type === "project" && !/Reading time|Self-check|Let's check|Let’s check/iu.test(item.title));
  const extension = blocks.filter((item) => /Reading time|Self-check|Let's check|Let’s check/iu.test(item.title));
  const talk = partA.filter((item) => /talk|对话/iu.test(item.title));
  const restA = partA.filter((item) => !talk.includes(item));
  const sessions = [
    { kind: "opening_dialogue", title: "单元导入与对话｜Part A", blocks: [...opening, ...(talk.length ? talk : partA.slice(0, 1))] },
    { kind: "vocabulary_phonics", title: "词汇与语音｜Part A", blocks: [...(talk.length ? restA : partA.slice(1)), ...phonics] },
    { kind: "extended_dialogue", title: "对话与词汇｜Part B", blocks: partB },
    { kind: "reading_writing", title: "阅读与读写｜核心语篇", blocks: reading },
    { kind: "project", title: "综合实践｜Part C / Project", blocks: project },
    { kind: "extension_review", title: "拓展阅读与评价｜Reading time / Self-check", blocks: extension },
  ];
  return sessions.filter((session) => session.blocks.length > 0).map((session) => ({ ...session, session_count_options: "5-7" }));
}

function juniorSessions(blocks, file) {
  const opening = blocks.filter((item) => item.type === "opening");
  const partA = blocks.filter((item) => item.type === "part_a");
  const phonics = blocks.filter((item) => item.type === "phonics");
  const grammar = blocks.filter((item) => item.type === "grammar");
  const partB = blocks.filter((item) => ["part_b", "reading", "vocabulary"].includes(item.type));
  const writing = blocks.filter((item) => ["writing", "writing_project"].includes(item.type));
  const project = blocks.filter((item) => item.type === "project");
  const split = (items) => {
    if (items.length < 2) return [items, []];
    const midpoint = Math.ceil(items.length / 2);
    return [items.slice(0, midpoint), items.slice(midpoint)];
  };
  const [a1, a2] = split(partA);
  const [b1, b2] = split(partB);
  const sectionBReading = blocks.filter((item) => item.type === "reading");
  const sectionBSupport = blocks.filter((item) => ["part_b", "vocabulary"].includes(item.type));
  const sessions = [
    { kind: "listening_speaking", title: "听说课｜Section A", blocks: [...opening, ...a1] },
    { kind: "language_use", title: "语言运用课｜Section A + Grammar Focus", blocks: [...a2, ...phonics, ...grammar] },
    { kind: "reading_preparation", title: "阅读准备课｜Section B", blocks: sectionBSupport.length ? sectionBSupport : b1 },
    { kind: "reading", title: "阅读课｜Section B 核心语篇", blocks: sectionBReading.length ? sectionBReading : b2 },
    { kind: "writing", title: "读写迁移课｜Writing", blocks: writing },
    { kind: "project_review", title: "综合实践与评价｜Project / Reflecting", blocks: project },
  ];
  const filtered = sessions.filter((session) => session.blocks.length > 0);
  if (filtered.length === 4) {
    const last = filtered[filtered.length - 1];
    const previous = filtered[filtered.length - 2];
    if (last.kind === "writing_project" || last.kind === "project_review") {
      previous.blocks.push(...last.blocks);
      filtered.pop();
    }
  }
  return filtered.map((session) => ({
    ...session,
    session_count_options: /2013|审定版|旧版/iu.test(file) ? "4-5" : "5-7",
  }));
}

function parseEnglishVolume(file) {
  const markdown = read(file);
  const all = headings(markdown);
  const { grade, volume } = gradeAndVolume(file);
  const stage = grade >= 3 && grade <= 6 ? "小学" : "初中";
  const slug = `reviewed-英语-${stage}-${grade || "all"}-${volume.replace("全一册", "one").replace("上册", "1").replace("下册", "2")}`;
  const units = all.filter((item) => item.level === 1 && unitHeading(item.title));
  const sections = [];
  const links = [];
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const heading = units[unitIndex];
    const nextUnitIndex = units[unitIndex + 1]?.index ?? Number.POSITIVE_INFINITY;
    const info = unitHeading(heading.title);
    const unitNumber = unitIndex + 1;
    const unitKey = `${slug}::u${unitNumber}`;
    const blocks = sourceBlocks(markdown, all, heading, nextUnitIndex, stage);
    const contextBlocks = blocks.filter((item) => item.type === "unit_context");
    const content = [`# ${info.label} ${info.title}`, ...contextBlocks.map((item) => item.content)].join("\n\n").trim();
    sections.push(makeSection({ slug, level: "unit", unitNumber, unitLabel: info.label, unitTitle: info.title, content, sort: unitNumber * 1000, source: file, contentType: "unit_context", metadata: { context_blocks: contextBlocks.map((item) => item.title) } }));
    const sessions = stage === "小学" ? primarySessions(blocks) : juniorSessions(blocks, file);
    for (const [sessionIndex, session] of sessions.entries()) {
      const lessonNumber = sessionIndex + 1;
      const lessonKey = `${slug}::u${unitNumber}::l${lessonNumber}`;
      const lessonLabel = `第${lessonNumber}课时`;
      sections.push(makeSection({
        slug,
        level: "lesson",
        unitNumber,
        unitLabel: info.label,
        unitTitle: info.title,
        lessonNumber,
        lessonLabel,
        lessonTitle: session.title,
        content: session.blocks.map((item) => item.content).join("\n\n"),
        sort: unitNumber * 1000 + lessonNumber * 10,
        source: file,
        contentType: "lesson_summary",
        metadata: {
          session_kind: session.kind,
          session_count_options: session.session_count_options,
          source_blocks: session.blocks.map((item) => item.title),
          source_block_types: session.blocks.map((item) => item.type),
          selectable: true,
          evidence_only_children: true,
        },
      }));
      links.push(link(unitKey, lessonKey, "unit_to_lesson"), link(lessonKey, unitKey, "lesson_to_unit"));
      for (const [blockIndex, item] of session.blocks.entries()) {
        const frameNumber = blockIndex + 1;
        const frameKey = `${slug}::u${unitNumber}::l${lessonNumber}::f${frameNumber}`;
        sections.push(makeSection({
          slug,
          level: "frame",
          unitNumber,
          unitLabel: info.label,
          unitTitle: info.title,
          lessonNumber,
          lessonLabel,
          lessonTitle: session.title,
          frameNumber,
          frameLabel: `教材证据${frameNumber}`,
          frameTitle: item.title,
          content: item.content,
          sort: unitNumber * 1000 + lessonNumber * 10 + frameNumber,
          source: file,
          contentType: "knowledge_point",
          metadata: { evidence_only: true, source_block_type: item.type, source_subheadings: item.subheadings },
        }));
        links.push(link(lessonKey, frameKey, "lesson_to_frame"), link(frameKey, lessonKey, "frame_to_lesson"));
      }
    }
  }
  const sourceText = read(file);
  return {
    collection: {
      slug,
      title: `英语${grade}年级${volume}教材内容整理`,
      stage,
      subject: "英语",
      publisher: "人民教育出版社",
      edition_family: "人教版/PEP",
      edition_label: "用户知识库结构化整理（英语 Session 重切版，以源文件版本说明为准）",
      grade_level: grade,
      grade_label: `${grade}年级`,
      volume,
      publication_status: "current",
      verification_status: "source_declared_user_provided_summary",
      requires_confirmation: true,
      content_type: "knowledge_summary",
      source_type: "user_provided_teacher_summary",
      source_file_name: relative(file),
      source_note: "来自用户指定知识库的结构化教材整理，不是教材逐字原文；英语课题按 Unit 背景、Session 课时和教材证据重切，生成教案时仍需以教师手中当册教材核对版本和具体措辞。",
      source_hash: sha256(sourceText),
      metadata: { source_scope: "user_vault_physics_chemistry_english", parser: "english-session-v2", lesson_semantics: "teachable_session" },
    },
    sections,
    links,
  };
}

export { parseEnglishVolume };

function build() {
  const parsed = files(englishRoot).map(parseEnglishVolume);
  const collections = parsed.map((item) => item.collection);
  const sections = parsed.flatMap((item) => item.sections);
  const links = parsed.flatMap((item) => item.links);
  const payload = completeTextbookPayload({
    schemaVersion: "hai-textbook-v2",
    generatedAt: new Date().toISOString(),
    excluded_scopes: ["高中教材", "缺失学科目录摘要（另行导入）"],
    collections,
    sections,
    links,
  });
  validateHaiTextbookPayload(payload, { source: outputPath });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const counts = Object.groupBy(payload.collections, (item) => item.stage);
  console.log(JSON.stringify({
    output: outputPath,
    collections: payload.collections.length,
    sections: payload.sections.length,
    links: payload.links.length,
    by_stage: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])),
    levels: Object.fromEntries(["unit", "lesson", "frame"].map((level) => [level, payload.sections.filter((item) => item.section_level === level).length])),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) build();
