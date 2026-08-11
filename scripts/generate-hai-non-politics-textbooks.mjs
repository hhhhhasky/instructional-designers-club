#!/usr/bin/env node

/**
 * Build the reviewed, non-politics textbook payload used by
 * hai_import_textbook_payload(). The source files intentionally stay in the
 * user's Obsidian vault; this artifact records the exact source hash and the
 * normalized unit/lesson boundaries that are sent to Supabase.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const vaultRoot = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程";
const mathRoot = path.join(vaultRoot, "数学教材");
const libraryRoot = path.join(vaultRoot, "教材课标知识库");
const outputPath = path.resolve(process.argv[2] ?? "supabase/seed-data/hai-non-politics-textbooks.json");

const zhNumbers = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function rel(filePath) {
  return path.relative(vaultRoot, filePath).split(path.sep).join("/");
}

function filesIn(dir, predicate = () => true) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function chineseNumber(value) {
  const text = String(value).replace(/[第单元章课]/g, "");
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? (zhNumbers[tens] ?? 0) : 1) * 10 + (ones ? (zhNumbers[ones] ?? 0) : 0);
  }
  return zhNumbers[text] ?? 0;
}

function cleanTitle(value) {
  return value
    .replace(/^第\s*[一二三四五六七八九十\d]+\s*(?:单元|章节|课|章)\s*[:：.、]?\s*/u, "")
    .replace(/^\d+[.、：:]\s*/, "")
    .replace(/^课文\s*\d+\s*\*?\s*[:：.]\s*/u, "")
    .replace(/^（(.+)）$/u, "$1")
    .replace(/[（(](?:教材深度解析|单元导语|单元导入)[）)]/g, "")
    .trim();
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/u, "").trim();
}

function plainText(markdown) {
  return markdown
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

function getBlocks(markdown, matcher, levels = null) {
  const { headings } = headingParts(markdown);
  return headings
    .filter((heading) => (!levels || levels.includes(heading.level)) && matcher(heading.title, heading.level))
    .map((heading) => ({ heading, content: sectionBetween(markdown, headings, heading, [heading.level]) }));
}

function parseUnitTitle(fileName, fallback = "单元综合教材分析") {
  if (/古诗词诵读/u.test(fileName)) return { number: 7, title: "古诗词诵读" };
  const match = fileName.match(/(?:第\s*)?([一二三四五六七八九十\d]+)\s*单元[·_\-：: ]*(.*?)(?:·教材深度解析)?\.md$/u)
    ?? fileName.match(/^(\d{1,2})[-_](.*)\.md$/u);
  if (!match) return { number: 1, title: fallback };
  return { number: chineseNumber(match[1]), title: cleanTitle(match[2]) || fallback };
}

function makeSection({ collectionSlug, unit, lessonNumber, lessonTitle, level, content, label, type, sortOrder, sourceFiles, metadata = {} }) {
  const normalized = stripFrontmatter(content).trim();
  const sectionKey = `${collectionSlug}::u${unit.number}::${level}${lessonNumber || 0}`;
  return {
    section_key: sectionKey,
    collection_slug: collectionSlug,
    section_level: level,
    unit_number: unit.number,
    unit_label: `第${unit.number}单元`,
    unit_title: unit.title,
    lesson_number: level === "unit" ? 0 : lessonNumber,
    lesson_label: level === "unit" ? "" : `第${lessonNumber}课`,
    lesson_title: level === "unit" ? "" : lessonTitle,
    frame_number: 0,
    frame_label: "",
    frame_title: "",
    section_path: `${unit.number} ${unit.title}${level === "unit" ? " / 单元背景" : ` / ${lessonNumber} ${lessonTitle}`}`,
    content_type: type,
    content_markdown: normalized,
    content_text: plainText(normalized),
    knowledge_point_count: Math.max(1, (normalized.match(/(?:^|\n)\s*[-*]\s+/g) ?? []).length),
    char_count: normalized.length,
    sort_order: sortOrder,
    content_hash: sha256(normalized),
    verification_status: "source_declared_user_provided_summary",
    metadata: { source_files: sourceFiles, ...metadata },
  };
}

function makeCollection({ slug, title, stage, subject, grade, volume, edition, files, sections }) {
  const sourceText = files.map((file) => `${rel(file)}\n${read(file)}`).join("\n\n");
  return {
    slug,
    title,
    stage,
    subject,
    publisher: "人民教育出版社",
    edition_family: subject === "科学" ? "人教鄂教版" : subject === "语文" ? "统编版" : "人教版",
    edition_label: edition,
    grade_level: grade,
    grade_label: `${grade}年级`,
    volume,
    publication_status: "current",
    verification_status: "source_declared_user_provided_summary",
    requires_confirmation: true,
    content_type: "knowledge_summary",
    source_type: "user_provided_teacher_summary",
    source_file_name: files.map(rel).join("; "),
    source_note: "来自用户指定知识库的结构化教材整理，不是教材逐字原文；生成教案时仍需以教师手中当册教材核对版本和具体措辞。",
    source_hash: sha256(sourceText),
    metadata: {
      source_scope: "user_vault_non_politics_textbooks",
      source_files: files.map(rel),
      ingestion_version: "non-politics-unit-lesson-v1",
      section_levels: ["unit", "lesson"],
    },
    sections,
  };
}

function unitIntro(markdown, firstLessonIndex, extraTitles = []) {
  const lines = markdown.split(/\r?\n/);
  let intro = lines.slice(0, firstLessonIndex ?? lines.length).join("\n").trim();
  for (const title of extraTitles) {
    const marker = new RegExp(`^#{2,5}\\s+.*${title}.*$`, "mu");
    const match = markdown.match(marker);
    if (match) {
      const start = markdown.slice(0, match.index).split(/\r?\n/).length - 1;
      const tail = markdown.split(/\r?\n/).slice(start).join("\n");
      intro += `\n\n${tail}`;
    }
  }
  return intro;
}

function addUnitAndLessons({ collectionSlug, unit, markdown, sourceFiles, lessonBlocks, unitContent, metadata = {} }) {
  const sections = [];
  const links = [];
  sections.push(makeSection({
    collectionSlug, unit, lessonNumber: 0, lessonTitle: "", level: "unit",
    content: unitContent || markdown, label: unit.unitLabel, type: "unit_context",
    sortOrder: unit.number * 1000, sourceFiles, metadata,
  }));
  lessonBlocks.forEach((block, index) => {
    const lessonNumber = index + 1;
    const lesson = makeSection({
      collectionSlug, unit, lessonNumber, lessonTitle: block.title, level: "lesson",
      content: block.content, label: `第${lessonNumber}课`, type: "lesson_summary",
      sortOrder: unit.number * 1000 + lessonNumber, sourceFiles,
      metadata: { source_heading: block.heading ?? block.title, ...metadata },
    });
    sections.push(lesson);
    links.push({ section_key: sections[0].section_key, linked_section_key: lesson.section_key, relation_type: "unit_to_lesson" });
    links.push({ section_key: lesson.section_key, linked_section_key: sections[0].section_key, relation_type: "lesson_to_unit" });
  });
  return { sections, links };
}

function parsePrimaryChinese(filePath, collectionSlug) {
  const markdown = read(filePath);
  const fileName = path.basename(filePath);
  const { headings } = headingParts(markdown);
  const unit = parseUnitTitle(fileName);
  const lessonContainer = headings.find((heading) => heading.level === 2 && /^课文(?:全文)?$/u.test(heading.title));
  const lessonBlocks = getBlocks(markdown, (title) => /^(?:\d+[.．、\s]|第\s*\d+\s*课|课文\s*\d+\s*[:：.]|古诗词?\s*\d*)/u.test(title), [3, 4]);
  const lessonAreaBlocks = lessonContainer
    ? headings.filter((heading) => heading.level === 3 && heading.index > lessonContainer.index && !headings.some((next) => next.level === 2 && next.index > lessonContainer.index && next.index < heading.index))
      .map((heading) => ({ heading, content: sectionBetween(markdown, headings, heading, [heading.level]) }))
    : [];
  const blocks = [...lessonBlocks, ...lessonAreaBlocks]
    .filter((block, index, all) => all.findIndex((candidate) => candidate.heading.index === block.heading.index) === index)
    .filter((block) => !/语文园地|本单元|课文全文/u.test(block.heading.title))
    .map((block) => ({
      title: cleanTitle(block.heading.title),
      heading: block.heading.title,
      content: block.content,
    }));
  const firstLesson = blocks[0]?.heading ? headings.find((heading) => heading.title === blocks[0].heading) : undefined;
  const intro = unitIntro(markdown, firstLesson?.index, ["语文园地", "口语交际", "习作", "综合性学习"]);
  return addUnitAndLessons({ collectionSlug, unit, markdown, sourceFiles: [filePath], lessonBlocks: blocks, unitContent: intro, metadata: { parser: "primary-chinese-unit-file" } });
}

function parseJuniorChinese(filePath, collectionSlug) {
  const markdown = read(filePath);
  const unitBlocks = getBlocks(markdown, (title) => /^第\s*[一二三四五六七八九十\d]+\s*单元/u.test(title), [2]);
  const sections = [];
  const links = [];
  let unitCursor = 0;
  for (const unitBlock of unitBlocks) {
    const match = unitBlock.heading.title.match(/^第\s*([一二三四五六七八九十\d]+)\s*单元[：:：\s]*(.*)$/u);
    const unit = { number: chineseNumber(match?.[1] ?? ++unitCursor), title: cleanTitle(match?.[2] || unitBlock.heading.title) };
    unitCursor = unit.number;
    const lessonBlocks = getBlocks(unitBlock.content, (title) => /^(?:\d+[.．、\s]|第\s*\d+\s*课)/u.test(title), [4, 3])
      .map((block) => ({ title: cleanTitle(block.heading.title), heading: block.heading.title, content: block.content }));
    const result = addUnitAndLessons({ collectionSlug, unit, markdown: unitBlock.content, sourceFiles: [filePath], lessonBlocks, unitContent: unitBlock.content.split(/\r?\n/).slice(0, Math.max(1, unitBlock.content.split(/\r?\n/).findIndex((line) => /^####\s+/.test(line)))).join("\n"), metadata: { parser: "junior-chinese-volume-file" } });
    sections.push(...result.sections);
    links.push(...result.links);
  }
  return { sections, links };
}

function parseMiddleMath(filePath, collectionSlug) {
  const markdown = read(filePath);
  const rawChapterBlocks = getBlocks(markdown, (title) => /^第\s*[一二三四五六七八九十\d]+\s*章/u.test(title) && !/程序|索引|速查/u.test(title), [1]);
  const chapterByNumber = new Map();
  for (const chapterBlock of rawChapterBlocks) {
    const number = chineseNumber(chapterBlock.heading.title.match(/^第\s*([一二三四五六七八九十\d]+)\s*章/u)?.[1] ?? "0");
    const current = chapterByNumber.get(number);
    if (!current || chapterBlock.content.length > current.content.length) chapterByNumber.set(number, chapterBlock);
  }
  const chapterBlocks = [...chapterByNumber.values()].sort((a, b) => a.heading.index - b.heading.index);
  const sections = [];
  const links = [];
  let cursor = 0;
  for (const chapterBlock of chapterBlocks) {
    const match = chapterBlock.heading.title.match(/^第\s*([一二三四五六七八九十\d]+)\s*章\s*(.*)$/u);
    const unit = { number: chineseNumber(match?.[1] ?? ++cursor), title: cleanTitle(match?.[2] || chapterBlock.heading.title) };
    cursor = unit.number;
    const lessonBlocks = getBlocks(chapterBlock.content, (title) => /^\d+\.\d+/u.test(title), [2])
      .map((block) => ({ title: cleanTitle(block.heading.title), heading: block.heading.title, content: block.content }));
    const firstLesson = headingParts(chapterBlock.content).headings.find((heading) => /^\d+\.\d+/u.test(heading.title));
    const intro = unitIntro(chapterBlock.content, firstLesson?.index, []);
    const result = addUnitAndLessons({ collectionSlug, unit, markdown: chapterBlock.content, sourceFiles: [filePath], lessonBlocks, unitContent: intro, metadata: { parser: "junior-math-volume-file" } });
    sections.push(...result.sections);
    links.push(...result.links);
  }
  return { sections, links };
}

function parsePrimaryMath(filePath, collectionSlug) {
  const markdown = read(filePath);
  const unit = parseUnitTitle(path.basename(filePath));
  const { headings } = headingParts(markdown);
  const candidates = headings.filter((heading) =>
    (heading.level === 2 && /^(?:\d+[.、\s]|[一二三四五六七八九十]+、)/u.test(heading.title))
      || (heading.level === 3 && /^(?:例题|例\s*\d|活动|探究|复习活动|[一二三四五六七八九十]+、)/u.test(heading.title))
  );
  const lessonCandidates = candidates
    .filter((heading) => !/单元知识结构|结论与法则|评估与练习|情境与真实问题|单元关系|新课标|教学建议/u.test(heading.title));
  const blocks = lessonCandidates
    .map((heading) => ({ title: cleanTitle(heading.title), heading: heading.title, content: sectionBetween(markdown, headings, heading, [heading.level]) }));
  const firstLesson = lessonCandidates[0];
  const intro = unitIntro(markdown, firstLesson?.index, []);
  const result = addUnitAndLessons({ collectionSlug, unit, markdown, sourceFiles: [filePath], lessonBlocks: blocks.length ? blocks : [{ title: `${unit.title}（单元综合教材分析）`, content: markdown, heading: "synthetic" }], unitContent: intro, metadata: { parser: "primary-math-unit-file", synthetic_lesson: blocks.length === 0 } });
  return result;
}

function parseScience(filePath, collectionSlug) {
  const markdown = read(filePath);
  const { headings } = headingParts(markdown);
  const unitHeadings = headings.filter((heading) => heading.level === 3 && /^第\s*[一二三四五六七八九十\d]+\s*单元/u.test(heading.title));
  const grouped = new Map();
  for (const heading of unitHeadings) {
    const number = chineseNumber(heading.title.match(/^第\s*([一二三四五六七八九十\d]+)/u)?.[1] ?? "1");
    const block = sectionBetween(markdown, headings, heading, [2, 3]);
    grouped.set(number, [...(grouped.get(number) ?? []), { heading, block }]);
  }
  const sections = [];
  const links = [];
  for (const [number, parts] of grouped) {
    const title = cleanTitle(parts[0].heading.title);
    const unit = { number, title };
    const combined = parts.map((part) => part.block).join("\n\n");
    const lessonMap = new Map();
    for (const part of parts) {
      for (const match of part.block.matchAll(/\|\s*第\s*(\d+)\s*课\s*\|\s*([^|\n]+?)\s*\|/gu)) {
        const lessonNumber = Number(match[1]);
        lessonMap.set(lessonNumber, `${match[2].replace(/[《》]/g, "").trim()}\n\n来源表格：${match[0].trim()}`);
      }
    }
    const lessonBlocks = [...lessonMap.entries()].sort((a, b) => a[0] - b[0]).map(([lessonNumber, content]) => ({
      title: content.split("\n")[0], heading: `第${lessonNumber}课`, content,
    }));
    const result = addUnitAndLessons({ collectionSlug, unit, markdown: combined, sourceFiles: [filePath], lessonBlocks, unitContent: combined, metadata: { parser: "primary-science-volume-file", source_sections: parts.map((part) => part.heading.title) } });
    sections.push(...result.sections);
    links.push(...result.links);
  }
  return { sections, links };
}

function volumeInfo(name) {
  const match = name.match(/([一二三四五六七八九\d]+)年级(上册|下册)/u);
  if (!match) throw new Error(`Cannot determine grade/volume: ${name}`);
  return { grade: chineseNumber(match[1]), volume: match[2] };
}

function build() {
  const collections = [];
  const sections = [];
  const links = [];
  const add = (collection, parsed) => {
    collections.push(makeCollection(collection));
    sections.push(...parsed.sections);
    links.push(...parsed.links);
  };

  for (const filePath of filesIn(mathRoot, (name) => name.endsWith(".md"))) {
    const info = volumeInfo(path.basename(filePath));
    const collectionSlug = `junior-math-grade-${info.grade}-volume-${info.volume === "上册" ? 1 : 2}`;
    add({ slug: collectionSlug, title: `人教版数学${info.grade}年级${info.volume}教材内容整理`, stage: "初中", subject: "数学", grade: info.grade, volume: info.volume, edition: "人教版（用户知识库整理版）", files: [filePath] }, parseMiddleMath(filePath, collectionSlug));
  }

  const juniorChineseDir = path.join(libraryRoot, "初中语文教材");
  for (const filePath of filesIn(juniorChineseDir, (name) => name.endsWith("目录与知识点.md"))) {
    const info = volumeInfo(path.basename(filePath));
    const collectionSlug = `junior-chinese-grade-${info.grade}-volume-${info.volume === "上册" ? 1 : 2}`;
    add({ slug: collectionSlug, title: `统编版初中语文${info.grade}年级${info.volume}目录与知识点`, stage: "初中", subject: "语文", grade: info.grade, volume: info.volume, edition: "统编版（2024修订资料）", files: [filePath] }, parseJuniorChinese(filePath, collectionSlug));
  }

  const primaryChineseDir = path.join(libraryRoot, "小学语文教材");
  for (const gradeDir of fs.readdirSync(primaryChineseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^(?:一|二|三|四|五|六)年级/u.test(entry.name))) {
    const gradeFiles = filesIn(path.join(primaryChineseDir, gradeDir.name), (name) => name.endsWith(".md"));
    const info = volumeInfo(gradeDir.name);
    const collectionSlug = `primary-chinese-grade-${info.grade}-volume-${info.volume === "上册" ? 1 : 2}`;
    const parsed = { sections: [], links: [] };
    for (const selectedFile of gradeFiles) {
      const result = parsePrimaryChinese(selectedFile, collectionSlug);
      parsed.sections.push(...result.sections);
      parsed.links.push(...result.links);
    }
    add({ slug: collectionSlug, title: `部编版小学语文${info.grade}年级${info.volume}教材分析`, stage: "小学", subject: "语文", grade: info.grade, volume: info.volume, edition: "部编版（2024修订资料）", files: gradeFiles }, parsed);
  }

  const scienceDir = path.join(libraryRoot, "人教版小学科学教材");
  for (const filePath of filesIn(scienceDir, (name) => /^\d{2}\..*年级.*(上册|下册)\.md$/u.test(name))) {
    const info = volumeInfo(path.basename(filePath));
    const collectionSlug = `primary-science-grade-${info.grade}-volume-${info.volume === "上册" ? 1 : 2}`;
    add({ slug: collectionSlug, title: `人教鄂教版小学科学${info.grade}年级${info.volume}教材分析`, stage: "小学", subject: "科学", grade: info.grade, volume: info.volume, edition: "人教鄂教版（2024-2026教材分析资料）", files: [filePath] }, parseScience(filePath, collectionSlug));
  }

  const primaryMathDir = path.join(libraryRoot, "人教版小学数学教材");
  for (const gradeDir of fs.readdirSync(primaryMathDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^(?:一|二|三|四|五|六)年级/u.test(entry.name))) {
    const info = volumeInfo(gradeDir.name);
    const dir = path.join(primaryMathDir, gradeDir.name);
    const candidateFiles = filesIn(dir, (name) => name.endsWith(".md") && !/README|总览|汇总|目录|索引|^人教版六年级[上下]册数学\.md$/u.test(name));
    const byUnit = new Map();
    for (const candidate of candidateFiles) {
      const unit = parseUnitTitle(path.basename(candidate));
      const current = byUnit.get(unit.number);
      if (!current || (/教材深度解析/u.test(path.basename(candidate)) && !/教材深度解析/u.test(path.basename(current)))) {
        byUnit.set(unit.number, candidate);
      }
    }
    const unitFiles = [...byUnit.values()].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const collectionSlug = `primary-math-grade-${info.grade}-volume-${info.volume === "上册" ? 1 : 2}`;
    const parsed = { sections: [], links: [] };
    for (const filePath of unitFiles) {
      const result = parsePrimaryMath(filePath, collectionSlug);
      parsed.sections.push(...result.sections);
      parsed.links.push(...result.links);
    }
    add({ slug: collectionSlug, title: `人教版小学数学${info.grade}年级${info.volume}教材分析`, stage: "小学", subject: "数学", grade: info.grade, volume: info.volume, edition: "人教版（用户知识库整理版）", files: unitFiles }, parsed);
  }

  const seenCollections = new Set();
  const dedupCollections = collections.filter((collection) => {
    if (seenCollections.has(collection.slug)) return false;
    seenCollections.add(collection.slug);
    return true;
  });
  const collectionSlugs = new Set(dedupCollections.map((collection) => collection.slug));
  const filteredSections = sections.filter((section) => collectionSlugs.has(section.collection_slug));
  const sectionKeys = new Set(filteredSections.map((section) => section.section_key));
  const filteredLinks = links.filter((link) => sectionKeys.has(link.section_key) && sectionKeys.has(link.linked_section_key));
  const payload = {
    schema_version: "non-politics-unit-lesson-v1",
    generated_at: new Date().toISOString(),
    excluded_scopes: ["初中思政教材", "小学道法教材解析", "高中思想政治教材", "新课标（2022）", "小学英语课堂活动清单.md"],
    collections: dedupCollections,
    sections: filteredSections,
    links: filteredLinks,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const counts = {};
  for (const collection of dedupCollections) counts[collection.subject] = (counts[collection.subject] ?? 0) + 1;
  console.log(JSON.stringify({ output: outputPath, collections: dedupCollections.length, sections: filteredSections.length, links: filteredLinks.length, by_subject: counts }, null, 2));
}

build();
