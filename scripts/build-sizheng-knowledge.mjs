#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const defaultKnowledgeRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程/思政知识库";
const knowledgeRoot = path.resolve(process.argv[2] || defaultKnowledgeRoot);
const outputDir = path.resolve(process.argv[3] || "supabase/seed-data");

const chineseNumbers = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
};
const gradeNumbers = { 一年级: 1, 二年级: 2, 三年级: 3, 四年级: 4, 五年级: 5, 六年级: 6 };

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readMarkdownFiles(root) {
  if (!fs.existsSync(root)) throw new Error(`资料目录不存在：${root}`);
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) return readMarkdownFiles(filePath);
    return entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_") ? [filePath] : [];
  }).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function parseNumber(value, fallback = 1) {
  const digits = String(value || "").match(/\d+/)?.[0];
  if (digits) return Number(digits);
  const chinese = String(value || "").match(/[一二三四五六七八九十]{1,3}/)?.[0];
  if (!chinese) return fallback;
  if (chinese.length === 1) return chineseNumbers[chinese] || fallback;
  if (chinese.startsWith("十")) return 10 + (chineseNumbers[chinese.slice(1)] || 0);
  if (chinese.endsWith("十")) return (chineseNumbers[chinese[0]] || 1) * 10;
  return (chineseNumbers[chinese[0]] || 1) * 10 + (chineseNumbers[chinese.slice(-1)] || 0);
}

function cleanHeading(value) {
  return value.replace(/^#+\s*/, "").replace(/\s+#+\s*$/, "").replace(/\s+/g, " ").trim();
}

function headingInfo(line) {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  return match ? { level: match[1].length, title: cleanHeading(match[2]) } : null;
}

function extractUnitFromText(value, fallbackNumber = 1) {
  const title = cleanHeading(value);
  const numberFirstMatch = title.match(/^(?:内容)?(?:第\s*)?([一二三四五六七八九十\d]+)\s*单元\s*[:：]?\s*(.*)$/);
  const unitFirstMatch = title.match(/^(?:内容)?单元\s*([一二三四五六七八九十\d]+)?\s*[:：]?\s*(.*)$/);
  const match = numberFirstMatch || unitFirstMatch;
  if (!match) return { number: fallbackNumber, label: `第${fallbackNumber}单元`, title: title || "未命名单元" };
  const number = parseNumber(match[1], fallbackNumber);
  const unitTitle = match[2]?.trim() || "未命名单元";
  return { number, label: `第${number}单元`, title: unitTitle };
}

function extractLesson(value, fallbackNumber = 1) {
  const title = cleanHeading(value);
  const match = title.match(/第\s*([一二三四五六七八九十\d]+)\s*课\s*[:：]?\s*(.*)$/);
  if (!match) return { number: fallbackNumber, label: `第${fallbackNumber}课`, title: title || "未命名课题" };
  return { number: parseNumber(match[1], fallbackNumber), label: `第${parseNumber(match[1], fallbackNumber)}课`, title: match[2]?.trim() || "未命名课题" };
}

function extractFrame(value, fallbackNumber = 1) {
  const title = cleanHeading(value);
  const match = title.match(/(?:(?:第)?([一二三四五六七八九十\d]+)\s*框|框题\s*([一二三四五六七八九十\d]+)?)[：:]?\s*(.*)$/);
  if (!match) return { number: fallbackNumber, label: `第${fallbackNumber}框`, title: title || "全课内容" };
  const number = parseNumber(match[1] || match[2], fallbackNumber);
  return { number, label: `第${number}框`, title: match[3]?.trim() || "全课内容" };
}

function findFirstHeading(lines, predicate) {
  return lines.map((line, index) => ({ line, index, info: headingInfo(line) })).find((item) => item.info && predicate(item.info.title, item.info.level));
}

function collectionMetadata({ stage, subject, gradeLevel, gradeLabel, volume, title, sourceFileName, sourceHash, metadata }) {
  return {
    slug: metadata.slug,
    title,
    stage,
    subject,
    publisher: metadata.publisher,
    edition_family: metadata.editionFamily,
    edition_label: metadata.editionLabel,
    grade_level: gradeLevel,
    grade_label: gradeLabel,
    volume,
    effective_from: null,
    publication_status: "current",
    verification_status: "source_declared_current",
    requires_confirmation: Boolean(metadata.requiresConfirmation),
    content_type: "knowledge_summary",
    source_type: "user_provided_teacher_summary",
    source_file_name: sourceFileName,
    source_note: "来自用户指定的 Obsidian 思政知识库；内容是教师知识点梳理，不是教材逐字原文。",
    source_hash: sourceHash,
    metadata: { source_scope: metadata.sourceScope, source_files: metadata.sourceFiles || [] },
  };
}

function sectionFromBlock({ collection, unit, lesson, frame, body, sourceFileName, sourceHash, sortOrder, synthetic = false }) {
  const contentMarkdown = normalizeText(body) || `本节仅建立教材目录定位，具体内容请教师补充或核对原教材。`;
  return {
    section_key: `${collection.slug}__u${unit.number}__l${lesson.number}__f${frame.number}`,
    collection_slug: collection.slug,
    unit_number: unit.number,
    unit_label: unit.label,
    unit_title: unit.title,
    lesson_number: lesson.number,
    lesson_label: lesson.label,
    lesson_title: lesson.title,
    frame_number: frame.number,
    frame_label: frame.label,
    frame_title: frame.title,
    section_path: `${collection.title} / ${unit.label} ${unit.title} / ${lesson.label} ${lesson.title} / ${frame.label} ${frame.title}`,
    content_type: "knowledge_summary",
    content_markdown: contentMarkdown,
    content_text: contentMarkdown.replace(/[#>*`|_]/g, " ").replace(/\s+/g, " ").trim(),
    knowledge_point_count: (contentMarkdown.match(/^\s*(?:[-*]|\d+[.)])\s+/gm) || []).length,
    char_count: contentMarkdown.length,
    sort_order: sortOrder,
    content_hash: sha256(contentMarkdown),
    verification_status: synthetic ? "source_declared_current_synthetic_frame" : "source_declared_current",
    metadata: { source_file_name: sourceFileName, source_hash: sourceHash, synthetic_frame: synthetic },
  };
}

function parseTextbookFile(filePath, context) {
  const raw = fs.readFileSync(filePath, "utf8");
  const sourceHash = sha256(raw);
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const headings = lines.map((line, index) => ({ line, index, info: headingInfo(line) })).filter((item) => item.info);
  const fileName = path.basename(filePath);
  const unitFromFile = extractUnitFromText(fileName.replace(/\.md$/, "").replace(/^[^_]*_/, ""), context.defaultUnitNumber);
  const unitHeadings = headings.filter(({ info }) => /^(?:内容)?(?:第)?[一二三四五六七八九十\d]+\s*单元/.test(info.title));
  const lessonHeadings = headings.filter(({ info }) => /^第\s*[一二三四五六七八九十\d]+\s*课(?:\s|$)/.test(info.title) && !/教学建议|课后/.test(info.title));
  const frameHeadings = headings.filter(({ info }) => /框题|(?:第)?[一二三四五六七八九十\d]+\s*框/.test(info.title));
  const sections = [];
  let sortOrder = context.sortOffset;
  const nearestUnit = (index) => {
    const unitHeading = [...unitHeadings].reverse().find((item) => item.index < index);
    return unitHeading ? extractUnitFromText(unitHeading.info.title, unitFromFile.number) : unitFromFile;
  };
  const nextBoundary = (index, candidates) => candidates.find((item) => item.index > index)?.index ?? lines.length;
  for (const lessonHeading of lessonHeadings) {
    const lesson = extractLesson(lessonHeading.info.title, 1);
    const unit = nearestUnit(lessonHeading.index);
    const lessonEnd = nextBoundary(lessonHeading.index, [...unitHeadings, ...lessonHeadings].sort((a, b) => a.index - b.index));
    const lessonFrames = frameHeadings.filter((frame) => frame.index > lessonHeading.index && frame.index < lessonEnd);
    if (lessonFrames.length === 0) {
      sections.push(sectionFromBlock({
        collection: context.collection,
        unit,
        lesson,
        frame: { number: 1, label: "全课内容", title: "全课内容" },
        body: lines.slice(lessonHeading.index + 1, lessonEnd).join("\n"),
        sourceFileName: fileName,
        sourceHash,
        sortOrder: sortOrder++,
        synthetic: true,
      }));
      continue;
    }
    for (const [frameIndex, frameHeading] of lessonFrames.entries()) {
      const frame = extractFrame(frameHeading.info.title, frameIndex + 1);
      const frameEnd = nextBoundary(frameHeading.index, lessonFrames.slice(frameIndex + 1));
      sections.push(sectionFromBlock({
        collection: context.collection,
        unit,
        lesson,
        frame,
        body: lines.slice(frameHeading.index + 1, frameEnd).join("\n"),
        sourceFileName: fileName,
        sourceHash,
        sortOrder: sortOrder++,
      }));
    }
  }
  if (sections.length === 0) {
    const lesson = { number: 1, label: "全课", title: context.lessonFallback || fileName.replace(/\.md$/, "") };
    sections.push(sectionFromBlock({
      collection: context.collection,
      unit: currentUnit,
      lesson,
      frame: { number: 1, label: "全课内容", title: "全课内容" },
      body: raw,
      sourceFileName: fileName,
      sourceHash,
      sortOrder,
      synthetic: true,
    }));
  }
  return { sections, sourceHash };
}

function primaryMetadata(filePath, primaryRoot) {
  const relative = path.relative(primaryRoot, filePath).split(path.sep);
  const volume = relative.length > 1 ? relative[0] : path.basename(filePath, ".md").match(/[一二三四五六]年级(?:上册|下册)/)?.[0] || "未知册次";
  const gradeLabel = volume.match(/^[一二三四五六]年级/)?.[0] || "小学";
  const gradeLevel = gradeNumbers[gradeLabel] || 1;
  const volumeLabel = volume.match(/(上册|下册)/)?.[1] || "上册";
  const volumeFiles = readMarkdownFiles(primaryRoot)
    .filter((item) => path.basename(item).includes(volume))
    .map((item) => path.basename(item));
  return {
    stage: "小学",
    subject: "道德与法治",
    gradeLevel,
    gradeLabel,
    volume: volumeLabel,
    collection: {
      slug: `primary-daode-fazhi-${gradeLevel}-${volumeLabel === "上册" ? "upper" : "lower"}`,
      title: `小学道德与法治 ${gradeLabel}${volumeLabel}`,
      stage: "小学",
      subject: "道德与法治",
      publisher: "人民教育出版社（资料标注）",
      editionFamily: "统编版道德与法治",
      editionLabel: `人教版小学道德与法治 ${gradeLabel}${volumeLabel}`,
      requiresConfirmation: false,
      sourceScope: "user_vault_primary",
      sourceFiles: volumeFiles,
    },
    defaultUnitNumber: parseNumber(filePath.match(/(?:第)?([一二三四五六七八九十\d]+)单元/)?.[1], 1),
  };
}

function highMetadata(filePath) {
  const fileName = path.basename(filePath, ".md");
  const match = fileName.match(/^\d+_(.+?)_知识点$/);
  const sourceBookTitle = match?.[1] || fileName;
  const [series, ...titleParts] = sourceBookTitle.split("_");
  const textbookName = titleParts.join("_");
  const bookTitle = textbookName ? `${series}《${textbookName}》` : sourceBookTitle;
  const volume = bookTitle;
  return {
    stage: "高中",
    subject: "思想政治",
    gradeLevel: 10,
    gradeLabel: "高中",
    volume,
    collection: {
      slug: `senior-politics-${fileName.replace(/[^\w一-龥]+/g, "-").toLowerCase()}`,
      title: `高中思想政治《${bookTitle}》`,
      stage: "高中",
      subject: "思想政治",
      publisher: "人民教育出版社（资料标注）",
      editionFamily: "统编版普通高中思想政治",
      editionLabel: `人教版高中思想政治《${bookTitle}》`,
      requiresConfirmation: true,
      sourceScope: "user_vault_senior",
      sourceFiles: [path.basename(filePath)],
    },
    defaultUnitNumber: 1,
  };
}

function buildTextbooks() {
  const primaryRoot = path.join(knowledgeRoot, "教材与课标", "小学道法教材");
  const highRoot = path.join(knowledgeRoot, "教材与课标", "高中思想政治教材");
  const collections = new Map();
  const collectionSourceHashes = new Map();
  const sections = [];
  for (const filePath of [...readMarkdownFiles(primaryRoot), ...readMarkdownFiles(highRoot)]) {
    const metadata = filePath.startsWith(primaryRoot) ? primaryMetadata(filePath, primaryRoot) : highMetadata(filePath);
    const sourceHash = sha256(fs.readFileSync(filePath, "utf8"));
    const collection = collectionMetadata({
      ...metadata,
      title: metadata.collection.title,
      sourceFileName: metadata.collection.sourceFiles.join("；"),
      sourceHash,
      metadata: metadata.collection,
    });
    if (!collections.has(collection.slug)) collections.set(collection.slug, collection);
    if (!collectionSourceHashes.has(collection.slug)) collectionSourceHashes.set(collection.slug, []);
    collectionSourceHashes.get(collection.slug).push(sourceHash);
    const parsed = parseTextbookFile(filePath, {
      ...metadata,
      collection: metadata.collection,
      sortOffset: sections.length,
      lessonFallback: metadata.collection.title,
    });
    sections.push(...parsed.sections);
  }
  for (const collection of collections.values()) {
    collection.source_hash = sha256((collectionSourceHashes.get(collection.slug) || []).sort().join("\n"));
  }
  return { collections: [...collections.values()], sections };
}

function stripMarkdown(value) {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
}

function splitTableRow(line) {
  if (!/^\s*\|/.test(line) || !/\|\s*$/.test(line)) return [];
  return line.trim().slice(1, -1).split("|").map((cell) => stripMarkdown(cell.trim()));
}

function buildCases() {
  const caseRoot = path.join(knowledgeRoot, "案例库");
  const files = readMarkdownFiles(caseRoot);
  const sources = [];
  const cases = [];
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const sourceHash = sha256(raw);
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath, ".md");
    if (path.basename(filePath).startsWith("_")) continue;
    const sourceSlug = `politics-case-source-${sha256(path.basename(filePath)).slice(0, 16)}`;
    const stageScope = ["小学", "初中", "高中"];
    sources.push({
      slug: sourceSlug,
      title,
      stage_scope: stageScope,
      subject_scope: ["道德与法治", "思想政治"],
      source_file_name: path.basename(filePath),
      source_hash: sourceHash,
      source_note: "来自用户指定案例库；案例概要和课堂问题仅作为备课候选，事实与时效仍需教师复核。",
      metadata: { source_scope: "user_vault_politics_cases" },
    });
    let caseIndex = 0;
    for (const [lineIndex, line] of raw.split(/\r?\n/).entries()) {
      const cells = splitTableRow(line);
      if (cells.length < 7 || /^小议题方向$|^批次$|^文件$/.test(cells[0])) continue;
      if (/^[-: ]+$/.test(cells[0])) continue;
      const [topicDirection, caseTitle, eventDate, summary, classroomQuestion, concepts, source] = cells;
      if (!caseTitle || !summary || !classroomQuestion) continue;
      caseIndex += 1;
      const caseKey = `${sourceSlug}__${caseIndex}`;
      const contentMarkdown = [
        `案例：${caseTitle}`,
        `小议题方向：${topicDirection}`,
        `时间：${eventDate}`,
        `案例概要：${summary}`,
        `适合转化的课堂问题：${classroomQuestion}`,
        `主要适配概念：${concepts}`,
        `来源：${source}`,
      ].join("\n");
      cases.push({
        case_key: caseKey,
        source_slug: sourceSlug,
        title: caseTitle,
        topic_direction: topicDirection,
        event_date: eventDate,
        summary,
        classroom_question: classroomQuestion,
        concepts: concepts.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean),
        source_urls: [...source.matchAll(/https?:\/\/[^)\s]+/g)].map((match) => match[0]),
        content_markdown: contentMarkdown,
        content_text: stripMarkdown(contentMarkdown),
        stage_scope: stageScope,
        char_count: contentMarkdown.length,
        sort_order: lineIndex,
        content_hash: sha256(contentMarkdown),
        verification_status: "source_declared_requires_fact_check",
        metadata: { source_file_name: path.basename(filePath), source_hash: sourceHash },
      });
    }
  }
  return { sources, cases };
}

fs.mkdirSync(outputDir, { recursive: true });
const textbooks = buildTextbooks();
const cases = buildCases();
fs.writeFileSync(path.join(outputDir, "hai-sizheng-textbooks.json"), `${JSON.stringify(textbooks, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "hai-politics-cases.json"), `${JSON.stringify(cases, null, 2)}\n`);
console.log(JSON.stringify({
  knowledge_root: knowledgeRoot,
  textbook_collections: textbooks.collections.length,
  textbook_sections: textbooks.sections.length,
  case_sources: cases.sources.length,
  cases: cases.cases.length,
  output_dir: outputDir,
}, null, 2));
