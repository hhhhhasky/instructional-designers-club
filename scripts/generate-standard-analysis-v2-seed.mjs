import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase/migrations/20260912054745_v2_unit_lesson_outline_and_rewritten_standard_analysis.sql");
const importMigrationPath = path.join(root, "supabase/migrations/20260823100000_v2_course_workbook_import.sql");
const scriptDir = path.join(root, "docs/教学通识课第二版课程研发/课标分析课程脚本");
const files = [
  "L01-为什么要分析课标.md",
  "L02-课标是什么.md",
  "L03-定位准确.md",
  "L04-分类示范.md",
  "L05-核心工具-课标分析报告.md",
  "L06-核心小结.md",
];

const lessonTypeKeys = new Map([
  ["概念课", "concept"],
  ["方法课", "method"],
  ["案例课", "case"],
  ["实践课", "practice"],
  ["总结课", "concept"],
]);

function splitSections(markdown) {
  const headings = [...markdown.matchAll(/^## (.+)$/gm)];
  return Object.fromEntries(headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    return [heading[1].trim(), markdown.slice(start, end).trim()];
  }));
}

function plain(value) {
  return value
    .replace(/\+\+(.+?)\+\+/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function parseOptions(block) {
  return [...block.matchAll(/^\s*([A-Z])\.\s*(.+)$/gm)].map((match, index) => ({
    key: match[1],
    text: plain(match[2]),
    sort_order: (index + 1) * 10,
  }));
}

function parseAnswer(block, typeKey) {
  const answer = block.match(/^\s*\*\*(?:答案与反馈|答案)\*\*[：:]\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (typeKey === "true_false") {
    if (answer.startsWith("正确")) return { correct: ["T"] };
    if (answer.startsWith("错误")) return { correct: ["F"] };
  }
  const keys = answer.match(/^[A-Z](?:\s*[,，]\s*[A-Z])*/)?.[0]?.split(/[,，]/).map((key) => key.trim()).filter(Boolean) ?? [];
  return keys.length ? { correct: keys } : null;
}

function itemType(label, options) {
  if (label.includes("多选")) return "multiple_choice";
  if (label.includes("判断")) return "true_false";
  if (label.includes("单选") || options.length) return "single_choice";
  if (/应用|迁移|填表|输出|任务/.test(label)) return "open_task";
  return "short_answer";
}

function assessmentItem(label, block) {
  let options = parseOptions(block);
  const typeKey = itemType(label, options);
  if (typeKey === "true_false" && options.length === 0) {
    options = [
      { key: "T", text: "正确", sort_order: 10 },
      { key: "F", text: "错误", sort_order: 20 },
    ];
  }
  const answerLineIndex = block.search(/^\s*\*\*(?:答案与反馈|答案|评分锚点)\*\*[：:]/m);
  const questionPart = (answerLineIndex >= 0 ? block.slice(0, answerLineIndex) : block)
    .replace(/^\s*[A-Z]\.\s*.+$/gm, "")
    .trim();
  const prompt = plain(questionPart.replace(/^\*\*题目\*\*[：:]\s*/, ""));
  const rubricText = block.match(/^\s*\*\*评分锚点\*\*[：:]\s*(.+)$/m)?.[1]?.trim() ?? null;
  return {
    type_key: typeKey,
    grading_mode_key: ["single_choice", "multiple_choice", "true_false"].includes(typeKey) ? "auto" : "manual",
    prompt_markdown: prompt,
    rubric: rubricText ? { criteria: [plain(rubricText)] } : null,
    options,
    answer_key: parseAnswer(block, typeKey),
  };
}

function parseAssessment(section, phase) {
  if (phase === "pretest") return [assessmentItem("前测", section)];
  const starts = [...section.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*[：:]\s*(.*)$/gm)];
  return starts.map((start, index) => {
    const blockStart = start.index + start[0].length - start[3].length;
    const blockEnd = starts[index + 1]?.index ?? section.length;
    return assessmentItem(start[2], section.slice(blockStart, blockEnd).trim());
  });
}

function parseCards(section) {
  const titles = [...section.matchAll(/^\*\*标题[：:](.+?)\*\*\s*$/gm)];
  return titles.map((title, index) => {
    const start = title.index + title[0].length;
    const end = titles[index + 1]?.index ?? section.length;
    return { title: title[1].trim(), content_markdown: section.slice(start, end).trim() };
  });
}

function parseLesson(markdown, index) {
  const sections = splitSections(markdown);
  const title = markdown.match(/^# Lesson \d+｜(.+)$/m)?.[1]?.trim();
  if (!title) throw new Error(`无法解析第 ${index + 1} 课标题`);
  const positioning = sections["Lesson 定位"] ?? "";
  const duration = Number(positioning.match(/^- 建议时长：(\d+) 分钟$/m)?.[1] ?? 0);
  const typeLabel = positioning.match(/^- 课程类型：(.+)$/m)?.[1]?.trim() ?? "概念课";
  const coreQuestion = positioning.match(/^- 核心问题：(.+)$/m)?.[1]?.trim() ?? title;
  const objectives = [...(sections["学习目标与收获"] ?? "").matchAll(/^\d+\.\s+(.+?)[；;]?$/gm)].map((match, objectiveIndex) => ({
    id: `l${index + 1}-o${objectiveIndex + 1}`,
    text: plain(match[1]),
  }));
  const cards = parseCards(sections["知识卡"] ?? "");
  return {
    id: `9a110000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`,
    slug: `standard-analysis-${String(index + 1).padStart(2, "0")}`,
    title,
    subtitle: coreQuestion,
    description: coreQuestion,
    lesson_type_key: lessonTypeKeys.get(typeLabel) ?? "concept",
    duration_minutes: duration,
    credits: duration >= 20 ? 2 : duration >= 15 ? 1.5 : 1,
    sort_order: (index + 1) * 10,
    is_trial: index === 0,
    challenge_title: coreQuestion,
    challenge_markdown: sections["核心挑战与任务"] ?? null,
    objectives,
    success_criteria_markdown: sections["达标标准"] ?? null,
    takeaway_markdown: cards.map((card) => `### ${card.title}\n\n${card.content_markdown}`).join("\n\n") || null,
    body_markdown: sections["正文脚本"] ?? null,
    cards,
    pretest: parseAssessment(sections["前测"] ?? "", "pretest"),
    posttest: parseAssessment(sections["后测"] ?? "", "posttest"),
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function generatedDataSql(lessons) {
  const lessonJson = sqlLiteral(JSON.stringify(lessons));
  const oldBlockIds = Array.from({ length: 7 }, (_, index) => index + 1).flatMap((lessonNo) => [
    `9a110000-0000-4000-8101-${String(lessonNo).padStart(12, "0")}`,
    `9a110000-0000-4000-8102-${String(lessonNo).padStart(12, "0")}`,
  ]).map((id) => `${sqlLiteral(id)}::uuid`).join(",\n  ");

  return `insert into public.v2_course_units (
  id, slug, title, description_markdown, unit_type_id, sort_order, status, is_active
) values (
  '9a110000-0000-4000-8000-000000000010',
  'standard-analysis',
  '课标分析',
  '以单元为基本单位，按“单元概括—找课程目标—找课程内容—找课程学业评价—概括总结”完成可回溯的课标分析。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'unit_type' and items.key = 'foundation' limit 1),
  10,
  'published',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  unit_type_id = excluded.unit_type_id,
  sort_order = excluded.sort_order,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

delete from public.v2_course_lessons
where id = '9a110000-0000-4000-8001-000000000007';

delete from public.v2_assessment_blocks
where id in (
  ${oldBlockIds}
)
and not exists (
  select 1 from public.v2_submission_attempts attempts
  where attempts.assessment_block_id = v2_assessment_blocks.id
);

update public.v2_assessment_blocks
set status = 'archived', updated_at = now()
where id in (
  ${oldBlockIds}
);

update public.v2_lesson_resources
set is_active = false, updated_at = now()
where id = '9a110000-0000-4000-8003-000000000005';

do $seed$
declare
  lesson_value jsonb;
  card_value jsonb;
  assessment_value jsonb;
  item_value jsonb;
  option_value jsonb;
  lesson_id uuid;
  block_id uuid;
  item_id uuid;
  first_card_id uuid;
  card_index integer;
  assessment_index integer;
  item_index integer;
begin
  for lesson_value in select value from jsonb_array_elements(${lessonJson}::jsonb) loop
    lesson_id := (lesson_value ->> 'id')::uuid;

    insert into public.v2_course_lessons (
      id, unit_id, slug, title, subtitle, description, lesson_type_id, duration_minutes, credits,
      sort_order, membership_type, is_trial, status, published_at, challenge_title, challenge_markdown,
      objectives, success_criteria_markdown, takeaway_markdown, body_markdown
    ) values (
      lesson_id,
      '9a110000-0000-4000-8000-000000000010',
      lesson_value ->> 'slug',
      lesson_value ->> 'title',
      lesson_value ->> 'subtitle',
      lesson_value ->> 'description',
      (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = lesson_value ->> 'lesson_type_key' limit 1),
      (lesson_value ->> 'duration_minutes')::integer,
      (lesson_value ->> 'credits')::numeric,
      (lesson_value ->> 'sort_order')::integer,
      'plus',
      (lesson_value ->> 'is_trial')::boolean,
      'published',
      now(),
      lesson_value ->> 'challenge_title',
      lesson_value ->> 'challenge_markdown',
      lesson_value -> 'objectives',
      lesson_value ->> 'success_criteria_markdown',
      lesson_value ->> 'takeaway_markdown',
      lesson_value ->> 'body_markdown'
    )
    on conflict (id) do update set
      unit_id = excluded.unit_id,
      slug = excluded.slug,
      title = excluded.title,
      subtitle = excluded.subtitle,
      description = excluded.description,
      lesson_type_id = excluded.lesson_type_id,
      duration_minutes = excluded.duration_minutes,
      credits = excluded.credits,
      sort_order = excluded.sort_order,
      membership_type = excluded.membership_type,
      is_trial = excluded.is_trial,
      status = excluded.status,
      published_at = coalesce(public.v2_course_lessons.published_at, excluded.published_at),
      challenge_title = excluded.challenge_title,
      challenge_markdown = excluded.challenge_markdown,
      objectives = excluded.objectives,
      success_criteria_markdown = excluded.success_criteria_markdown,
      takeaway_markdown = excluded.takeaway_markdown,
      body_markdown = excluded.body_markdown,
      updated_at = now();

    card_index := 0;
    for card_value in select value from jsonb_array_elements(lesson_value -> 'cards') loop
      card_index := card_index + 1;
      if card_index = 1 then
        first_card_id := ('9a110000-0000-4000-8002-' || lpad(((lesson_value ->> 'sort_order')::integer / 10)::text, 12, '0'))::uuid;
        insert into public.v2_lesson_knowledge_cards (id, lesson_id, card_type_id, title, content_markdown, sort_order, is_active)
        values (
          first_card_id,
          lesson_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'concept' limit 1),
          card_value ->> 'title',
          card_value ->> 'content_markdown',
          card_index * 10,
          true
        )
        on conflict (id) do update set
          lesson_id = excluded.lesson_id,
          card_type_id = excluded.card_type_id,
          title = excluded.title,
          content_markdown = excluded.content_markdown,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          updated_at = now();
      else
        insert into public.v2_lesson_knowledge_cards (lesson_id, card_type_id, title, content_markdown, sort_order, is_active)
        values (
          lesson_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'concept' limit 1),
          card_value ->> 'title',
          card_value ->> 'content_markdown',
          card_index * 10,
          true
        );
      end if;
    end loop;

    assessment_index := 0;
    for assessment_value in
      select jsonb_build_object('type_key', 'pretest', 'title', '课前诊断', 'items', lesson_value -> 'pretest')
      union all
      select jsonb_build_object('type_key', 'posttest', 'title', '达标检测', 'items', lesson_value -> 'posttest')
    loop
      assessment_index := assessment_index + 1;
      insert into public.v2_assessment_blocks (
        lesson_id, unit_id, assessment_type_id, title, instructions_markdown,
        required, estimated_minutes, sort_order, status
      ) values (
        lesson_id,
        null,
        (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'assessment_type' and items.key = assessment_value ->> 'type_key' limit 1),
        assessment_value ->> 'title',
        case when assessment_value ->> 'type_key' = 'pretest' then '先凭已有经验作答，不影响完课。' else '完成正文后作答，检查本课目标是否达成。' end,
        true,
        case when assessment_value ->> 'type_key' = 'pretest' then 2 else 5 end,
        assessment_index * 10,
        'published'
      ) returning id into block_id;

      item_index := 0;
      for item_value in select value from jsonb_array_elements(assessment_value -> 'items') loop
        item_index := item_index + 1;
        insert into public.v2_assessment_items (
          assessment_block_id, item_type_id, grading_mode_id, prompt_markdown,
          max_score, rubric, sort_order, is_required
        ) values (
          block_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'item_type' and items.key = item_value ->> 'type_key' limit 1),
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'grading_mode' and items.key = item_value ->> 'grading_mode_key' limit 1),
          item_value ->> 'prompt_markdown',
          1,
          item_value -> 'rubric',
          item_index * 10,
          true
        ) returning id into item_id;

        for option_value in select value from jsonb_array_elements(item_value -> 'options') loop
          insert into public.v2_assessment_options (item_id, option_key, option_text, sort_order)
          values (item_id, option_value ->> 'key', option_value ->> 'text', (option_value ->> 'sort_order')::integer);
        end loop;

        if item_value -> 'answer_key' is not null and jsonb_typeof(item_value -> 'answer_key') = 'object' then
          insert into private.v2_assessment_keys (item_id, answer_key, scoring_config)
          values (item_id, item_value -> 'answer_key', '{"points_per_correct":1}'::jsonb);
        end if;
      end loop;
    end loop;
  end loop;
end;
$seed$;`;
}

const lessons = await Promise.all(files.map(async (file, index) => parseLesson(await fs.readFile(path.join(scriptDir, file), "utf8"), index)));
if (lessons.some((lesson) => !lesson.body_markdown || !lesson.objectives.length || !lesson.pretest.length || !lesson.posttest.length || !lesson.cards.length)) {
  throw new Error("六份脚本存在无法切分的必需区块");
}

const importMigration = await fs.readFile(importMigrationPath, "utf8");
const importStart = importMigration.indexOf("create or replace function public.v2_import_course_workbook");
const importEndMarker = "grant execute on function public.v2_import_course_workbook(jsonb) to authenticated;";
const importEnd = importMigration.indexOf(importEndMarker, importStart) + importEndMarker.length;
if (importStart < 0 || importEnd < importEndMarker.length) throw new Error("无法提取 V2 Excel 导入函数");
const importFunctionSql = importMigration.slice(importStart, importEnd);

let migration = await fs.readFile(migrationPath, "utf8");
migration = migration.replace(
  /-- BEGIN GENERATED IMPORT FUNCTION[\s\S]*?-- END GENERATED IMPORT FUNCTION/,
  () => `-- BEGIN GENERATED IMPORT FUNCTION\n${importFunctionSql}\n-- END GENERATED IMPORT FUNCTION`,
);
migration = migration.replace(
  /-- BEGIN GENERATED STANDARD ANALYSIS DATA[\s\S]*?-- END GENERATED STANDARD ANALYSIS DATA/,
  () => `-- BEGIN GENERATED STANDARD ANALYSIS DATA\n${generatedDataSql(lessons)}\n-- END GENERATED STANDARD ANALYSIS DATA`,
);
const generatedImportBlock = migration.match(/-- BEGIN GENERATED IMPORT FUNCTION[\s\S]*?-- END GENERATED IMPORT FUNCTION/)?.[0];
if (!generatedImportBlock) throw new Error("迁移中缺少导入函数生成区块");
migration = migration.replace(generatedImportBlock, "");
migration = migration.replace(
  "drop policy if exists v2_modules_manager on public.v2_course_modules;",
  () => `${generatedImportBlock}\n\ndrop policy if exists v2_modules_manager on public.v2_course_modules;`,
);
migration = migration.replace(/\n{3,}(-- BEGIN GENERATED IMPORT FUNCTION)/, (_match, marker) => `\n\n${marker}`);
await fs.writeFile(migrationPath, migration);

console.log(JSON.stringify({ lessons: lessons.length, cards: lessons.reduce((sum, lesson) => sum + lesson.cards.length, 0), pretestItems: lessons.reduce((sum, lesson) => sum + lesson.pretest.length, 0), posttestItems: lessons.reduce((sum, lesson) => sum + lesson.posttest.length, 0) }, null, 2));
