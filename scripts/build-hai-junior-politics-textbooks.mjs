import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const sourceDir = resolve(process.argv[2] || "/Users/apple/Downloads/初中思政教材");
const repoRoot = resolve(import.meta.dirname, "..");
const dataPath = join(repoRoot, "supabase/seed-data/hai-junior-politics-textbooks.json");
const migrationPath = join(repoRoot, "supabase/migrations/20260722180000_hai_junior_politics_textbook_knowledge.sql");

const bookConfigs = [
  {
    file: "七年级上册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-7-volume-1-2024",
    gradeLevel: 7,
    volume: "上册",
    editionLabel: "2024年秋统编新版",
    effectiveFrom: "2024-09-01",
    publicationStatus: "current",
    verificationStatus: "source_declared_current",
    requiresConfirmation: false,
  },
  {
    file: "七年级下册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-7-volume-2-2025",
    gradeLevel: 7,
    volume: "下册",
    editionLabel: "2025年春统编新版",
    effectiveFrom: "2025-02-01",
    publicationStatus: "current",
    verificationStatus: "source_declared_current",
    requiresConfirmation: false,
  },
  {
    file: "八年级上册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-8-volume-1-2025",
    gradeLevel: 8,
    volume: "上册",
    editionLabel: "2025年秋统编新版",
    effectiveFrom: "2025-09-01",
    publicationStatus: "current",
    verificationStatus: "source_declared_current",
    requiresConfirmation: false,
  },
  {
    file: "八年级下册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-8-volume-2-2026",
    gradeLevel: 8,
    volume: "下册",
    editionLabel: "2026年春统编新版",
    effectiveFrom: "2026-02-01",
    publicationStatus: "current",
    verificationStatus: "source_declared_current",
    requiresConfirmation: false,
  },
  {
    file: "九年级上册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-9-volume-1-2026",
    gradeLevel: 9,
    volume: "上册",
    editionLabel: "2026年秋新版待纸质教材复核",
    effectiveFrom: "2026-09-01",
    publicationStatus: "provisional",
    verificationStatus: "provisional_unverified",
    requiresConfirmation: true,
  },
  {
    file: "九年级下册_道德与法治知识点梳理.md",
    slug: "junior-politics-grade-9-volume-2-2026",
    gradeLevel: 9,
    volume: "下册",
    editionLabel: "2026年春现行版",
    effectiveFrom: "2026-02-01",
    publicationStatus: "legacy_current",
    verificationStatus: "source_declared_current",
    requiresConfirmation: false,
  },
];

const chineseDigits = new Map([
  ["零", 0], ["一", 1], ["二", 2], ["两", 2], ["三", 3], ["四", 4],
  ["五", 5], ["六", 6], ["七", 7], ["八", 8], ["九", 9],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseChineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  const [tens, ones = ""] = value.split("十");
  if (value.includes("十")) {
    return (tens ? chineseDigits.get(tens) : 1) * 10 + (ones ? chineseDigits.get(ones) : 0);
  }
  const number = chineseDigits.get(value);
  if (number === undefined) throw new Error(`无法解析中文数字：${value}`);
  return number;
}

function parseHeading(line, level, suffix) {
  const match = line.match(new RegExp(`^#{${level}}\\s+(第([零一二两三四五六七八九十\\d]+)${suffix})\\s+(.+)$`));
  if (!match) return null;
  return { label: match[1], number: parseChineseNumber(match[2]), title: match[3].trim() };
}

function plainText(markdown) {
  return markdown
    .replace(/\*\*/g, "")
    .replace(/^\d+\.\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBook(config) {
  const sourcePath = join(sourceDir, config.file);
  const source = readFileSync(sourcePath, "utf8").replace(/\r\n?/g, "\n").trim();
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const versionNote = source.match(/^>\s*版本说明：(.+)$/m)?.[1]?.trim();
  if (!title || !versionNote) throw new Error(`${config.file}缺少标题或版本说明。`);

  const sections = [];
  let unit = null;
  let lesson = null;
  let frame = null;
  let body = [];

  function flushFrame() {
    if (!frame) return;
    const contentMarkdown = body.join("\n").trim();
    if (!contentMarkdown) throw new Error(`${config.file} ${frame.label}没有内容。`);
    const contentText = plainText(contentMarkdown);
    const sectionKey = `${config.slug}:u${unit.number}:l${lesson.number}:f${frame.number}`;
    sections.push({
      section_key: sectionKey,
      collection_slug: config.slug,
      unit_number: unit.number,
      unit_label: unit.label,
      unit_title: unit.title,
      lesson_number: lesson.number,
      lesson_label: lesson.label,
      lesson_title: lesson.title,
      frame_number: frame.number,
      frame_label: frame.label,
      frame_title: frame.title,
      section_path: `${config.gradeLevel}年级${config.volume}/${unit.label} ${unit.title}/${lesson.label} ${lesson.title}/${frame.label} ${frame.title}`,
      content_type: "knowledge_summary",
      content_markdown: contentMarkdown,
      content_text: contentText,
      knowledge_point_count: contentMarkdown.split("\n").filter((line) => /^\d+\.\s+/.test(line)).length,
      char_count: [...contentText].length,
      sort_order: unit.number * 10000 + lesson.number * 100 + frame.number,
      content_hash: sha256(contentMarkdown),
      verification_status: config.verificationStatus,
      metadata: {
        source_file: config.file,
        source_kind: "user_provided_teacher_summary",
        is_verbatim_textbook: false,
      },
    });
    body = [];
  }

  for (const line of source.split("\n")) {
    const nextUnit = parseHeading(line, 2, "单元");
    const nextLesson = parseHeading(line, 3, "课");
    const nextFrame = parseHeading(line, 4, "框");
    if (nextUnit) {
      flushFrame();
      unit = nextUnit;
      lesson = null;
      frame = null;
      continue;
    }
    if (nextLesson) {
      flushFrame();
      if (!unit) throw new Error(`${config.file}的课题缺少所属单元。`);
      lesson = nextLesson;
      frame = null;
      continue;
    }
    if (nextFrame) {
      flushFrame();
      if (!unit || !lesson) {
        throw new Error(`${config.file}的框题缺少所属单元或课题：${line}；unit=${unit?.label || "空"}；lesson=${lesson?.label || "空"}`);
      }
      frame = nextFrame;
      continue;
    }
    if (frame) body.push(line);
  }
  flushFrame();

  const duplicate = sections.find((section, index) =>
    sections.findIndex((candidate) => candidate.section_key === section.section_key) !== index
  );
  if (duplicate) throw new Error(`重复切分键：${duplicate.section_key}`);

  return {
    collection: {
      slug: config.slug,
      title,
      stage: "初中",
      subject: "道德与法治",
      publisher: "人民教育出版社",
      edition_family: "统编版",
      edition_label: config.editionLabel,
      grade_level: config.gradeLevel,
      grade_label: `${config.gradeLevel}年级`,
      volume: config.volume,
      effective_from: config.effectiveFrom,
      publication_status: config.publicationStatus,
      verification_status: config.verificationStatus,
      requires_confirmation: config.requiresConfirmation,
      content_type: "knowledge_summary",
      source_type: "user_provided_teacher_summary",
      source_file_name: config.file,
      source_note: versionNote,
      source_hash: sha256(source),
      metadata: {
        source_directory: basename(sourceDir),
        is_verbatim_textbook: false,
        ingestion_version: "junior-politics-v1",
      },
    },
    sections,
  };
}

const parsed = bookConfigs.map(parseBook);
const payload = {
  generated_at: new Date().toISOString(),
  schema_version: "junior-politics-v1",
  collections: parsed.map((item) => item.collection),
  sections: parsed.flatMap((item) => item.sections),
};

const unitCount = new Set(payload.sections.map((item) => `${item.collection_slug}:u${item.unit_number}`)).size;
const lessonCount = new Set(payload.sections.map((item) => `${item.collection_slug}:u${item.unit_number}:l${item.lesson_number}`)).size;
if (payload.collections.length !== 6 || unitCount !== 24 || lessonCount !== 67 || payload.sections.length !== 147) {
  throw new Error(`教材结构计数异常：${payload.collections.length}本/${unitCount}单元/${lessonCount}课/${payload.sections.length}框。`);
}

mkdirSync(resolve(dataPath, ".."), { recursive: true });
const payloadJson = JSON.stringify(payload, null, 2);
writeFileSync(dataPath, `${payloadJson}\n`);
writeFileSync(migrationPath, buildMigration(payloadJson));
console.log(`已生成 ${payload.collections.length}本/${unitCount}单元/${lessonCount}课/${payload.sections.length}框`);
console.log(dataPath);
console.log(migrationPath);

function buildMigration(json) {
  const migration = `begin;

-- Canonical, cross-Skill textbook knowledge. Each row is one independently
-- retrievable frame (框题); Skill references keep only method and routing rules.
create table if not exists public.hai_textbook_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  stage text not null,
  subject text not null,
  publisher text not null default '',
  edition_family text not null default '',
  edition_label text not null,
  grade_level integer not null check (grade_level between 1 and 12),
  grade_label text not null,
  volume text not null check (volume in ('上册', '下册', '全一册')),
  effective_from date,
  effective_to date,
  publication_status text not null default 'current',
  verification_status text not null default 'source_declared_current',
  requires_confirmation boolean not null default false,
  content_type text not null default 'knowledge_summary',
  source_type text not null default 'user_provided_teacher_summary',
  source_file_name text not null default '',
  source_note text not null default '',
  source_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_textbook_sections (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hai_textbook_collections(id) on delete cascade,
  section_key text not null unique,
  unit_number integer not null check (unit_number > 0),
  unit_label text not null,
  unit_title text not null,
  lesson_number integer not null check (lesson_number > 0),
  lesson_label text not null,
  lesson_title text not null,
  frame_number integer not null check (frame_number > 0),
  frame_label text not null,
  frame_title text not null,
  section_path text not null,
  content_type text not null default 'knowledge_summary',
  content_markdown text not null,
  content_text text not null,
  knowledge_point_count integer not null default 0 check (knowledge_point_count >= 0),
  char_count integer not null default 0 check (char_count >= 0),
  sort_order integer not null default 0,
  content_hash text not null,
  verification_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, unit_number, lesson_number, frame_number)
);

comment on table public.hai_textbook_collections is
  'Canonical textbook metadata shared across HAI tools and Skills; content is not injected globally.';
comment on table public.hai_textbook_sections is
  'Independently retrievable textbook knowledge summaries separated by unit, lesson and frame.';

create index if not exists idx_hai_textbook_collections_route
  on public.hai_textbook_collections(stage, subject, grade_level, volume, is_active);
create index if not exists idx_hai_textbook_sections_route
  on public.hai_textbook_sections(collection_id, unit_number, lesson_number, frame_number, is_active);
create index if not exists idx_hai_textbook_sections_titles_trgm
  on public.hai_textbook_sections using gin
  ((unit_title || ' ' || lesson_title || ' ' || frame_title) extensions.gin_trgm_ops);

drop trigger if exists update_hai_textbook_collections_updated_at on public.hai_textbook_collections;
create trigger update_hai_textbook_collections_updated_at
  before update on public.hai_textbook_collections
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_hai_textbook_sections_updated_at on public.hai_textbook_sections;
create trigger update_hai_textbook_sections_updated_at
  before update on public.hai_textbook_sections
  for each row execute function public.update_updated_at_column();

alter table public.hai_textbook_collections enable row level security;
alter table public.hai_textbook_sections enable row level security;

grant select, insert, update, delete on public.hai_textbook_collections to authenticated;
grant select, insert, update, delete on public.hai_textbook_sections to authenticated;
grant all on public.hai_textbook_collections, public.hai_textbook_sections to service_role;

drop policy if exists "hai_textbook_collections admin manage" on public.hai_textbook_collections;
create policy "hai_textbook_collections admin manage"
  on public.hai_textbook_collections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "hai_textbook_sections admin manage" on public.hai_textbook_sections;
create policy "hai_textbook_sections admin manage"
  on public.hai_textbook_sections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_list_textbook_catalog(
  p_stage text default null,
  p_subject text default null
)
returns table (
  collection_slug text,
  collection_title text,
  stage text,
  subject text,
  grade_level integer,
  grade_label text,
  volume text,
  edition_label text,
  publication_status text,
  verification_status text,
  requires_confirmation boolean,
  unit_number integer,
  unit_label text,
  unit_title text,
  lesson_number integer,
  lesson_label text,
  lesson_title text,
  frame_number integer,
  frame_label text,
  frame_title text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    collection.slug,
    collection.title,
    collection.stage,
    collection.subject,
    collection.grade_level,
    collection.grade_label,
    collection.volume,
    collection.edition_label,
    collection.publication_status,
    collection.verification_status,
    collection.requires_confirmation,
    section.unit_number,
    section.unit_label,
    section.unit_title,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    section.frame_number,
    section.frame_label,
    section.frame_title
  from public.hai_textbook_collections collection
  join public.hai_textbook_sections section on section.collection_id = collection.id
  where collection.is_active = true
    and section.is_active = true
    and (nullif(trim(p_stage), '') is null or collection.stage = trim(p_stage))
    and (
      nullif(trim(p_subject), '') is null
      or collection.subject = trim(p_subject)
      or (trim(p_subject) in ('思想政治', '思政') and collection.subject = '道德与法治')
    )
  order by collection.grade_level, collection.volume desc,
    section.unit_number, section.lesson_number, section.frame_number;
$$;

create or replace function public.hai_match_textbook_sections(
  p_stage text,
  p_subject text,
  p_grade_level integer default null,
  p_volume text default null,
  p_unit_query text default null,
  p_lesson_query text default null,
  p_frame_query text default null,
  p_match_count integer default 12
)
returns table (
  section_id uuid,
  collection_id uuid,
  collection_slug text,
  collection_title text,
  edition_label text,
  publication_status text,
  verification_status text,
  requires_confirmation boolean,
  grade_level integer,
  grade_label text,
  volume text,
  unit_number integer,
  unit_label text,
  unit_title text,
  lesson_number integer,
  lesson_label text,
  lesson_title text,
  frame_number integer,
  frame_label text,
  frame_title text,
  section_path text,
  content_type text,
  content_markdown text,
  source_hash text,
  content_hash text,
  score real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    section.id,
    collection.id,
    collection.slug,
    collection.title,
    collection.edition_label,
    collection.publication_status,
    section.verification_status,
    collection.requires_confirmation,
    collection.grade_level,
    collection.grade_label,
    collection.volume,
    section.unit_number,
    section.unit_label,
    section.unit_title,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    section.frame_number,
    section.frame_label,
    section.frame_title,
    section.section_path,
    section.content_type,
    section.content_markdown,
    collection.source_hash,
    section.content_hash,
    (
      case when p_grade_level is not null and collection.grade_level = p_grade_level then 4 else 0 end +
      case when nullif(trim(p_volume), '') is not null and collection.volume = trim(p_volume) then 3 else 0 end +
      case when nullif(trim(p_unit_query), '') is not null and
        (section.unit_label || ' ' || section.unit_title) ilike '%' || trim(p_unit_query) || '%' then 4 else 0 end +
      case when nullif(trim(p_lesson_query), '') is not null and
        (section.lesson_label || ' ' || section.lesson_title) ilike '%' || trim(p_lesson_query) || '%' then 6 else 0 end +
      case when nullif(trim(p_frame_query), '') is not null and
        (section.frame_label || ' ' || section.frame_title) ilike '%' || trim(p_frame_query) || '%' then 8 else 0 end +
      similarity(
        section.unit_label || ' ' || section.unit_title || ' ' ||
        section.lesson_label || ' ' || section.lesson_title || ' ' ||
        section.frame_label || ' ' || section.frame_title,
        concat_ws(' ', p_unit_query, p_lesson_query, p_frame_query)
      )
    )::real as score
  from public.hai_textbook_sections section
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  where collection.is_active = true
    and section.is_active = true
    and collection.stage = trim(p_stage)
    and (
      collection.subject = trim(p_subject)
      or (trim(p_subject) in ('思想政治', '思政') and collection.subject = '道德与法治')
    )
    and (p_grade_level is null or collection.grade_level = p_grade_level)
    and (nullif(trim(p_volume), '') is null or collection.volume = trim(p_volume))
    and (
      nullif(trim(p_unit_query), '') is null
      or (section.unit_label || ' ' || section.unit_title) ilike '%' || trim(p_unit_query) || '%'
      or similarity(section.unit_label || ' ' || section.unit_title, trim(p_unit_query)) >= 0.25
    )
    and (
      nullif(trim(p_lesson_query), '') is null
      or (section.lesson_label || ' ' || section.lesson_title) ilike '%' || trim(p_lesson_query) || '%'
      or similarity(section.lesson_label || ' ' || section.lesson_title, trim(p_lesson_query)) >= 0.25
    )
    and (
      nullif(trim(p_frame_query), '') is null
      or (section.frame_label || ' ' || section.frame_title) ilike '%' || trim(p_frame_query) || '%'
      or similarity(section.frame_label || ' ' || section.frame_title, trim(p_frame_query)) >= 0.25
    )
  order by score desc, section.sort_order
  limit least(greatest(p_match_count, 1), 32);
$$;

revoke all on function public.hai_list_textbook_catalog(text, text) from public, anon;
grant execute on function public.hai_list_textbook_catalog(text, text) to authenticated, service_role;
revoke all on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) to service_role;

create temporary table _hai_textbook_seed(payload jsonb) on commit drop;
insert into _hai_textbook_seed(payload)
values ($textbooks$${json}$textbooks$::jsonb);

insert into public.hai_textbook_collections (
  slug, title, stage, subject, publisher, edition_family, edition_label,
  grade_level, grade_label, volume, effective_from, publication_status,
  verification_status, requires_confirmation, content_type, source_type,
  source_file_name, source_note, source_hash, metadata, is_active
)
select
  item.slug, item.title, item.stage, item.subject, item.publisher,
  item.edition_family, item.edition_label, item.grade_level,
  item.grade_label, item.volume, item.effective_from::date,
  item.publication_status, item.verification_status,
  item.requires_confirmation, item.content_type, item.source_type,
  item.source_file_name, item.source_note, item.source_hash,
  item.metadata, true
from _hai_textbook_seed seed
cross join lateral jsonb_to_recordset(seed.payload->'collections') as item(
  slug text, title text, stage text, subject text, publisher text,
  edition_family text, edition_label text, grade_level integer,
  grade_label text, volume text, effective_from text,
  publication_status text, verification_status text,
  requires_confirmation boolean, content_type text, source_type text,
  source_file_name text, source_note text, source_hash text, metadata jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  stage = excluded.stage,
  subject = excluded.subject,
  publisher = excluded.publisher,
  edition_family = excluded.edition_family,
  edition_label = excluded.edition_label,
  grade_level = excluded.grade_level,
  grade_label = excluded.grade_label,
  volume = excluded.volume,
  effective_from = excluded.effective_from,
  publication_status = excluded.publication_status,
  verification_status = excluded.verification_status,
  requires_confirmation = excluded.requires_confirmation,
  content_type = excluded.content_type,
  source_type = excluded.source_type,
  source_file_name = excluded.source_file_name,
  source_note = excluded.source_note,
  source_hash = excluded.source_hash,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

insert into public.hai_textbook_sections (
  collection_id, section_key, unit_number, unit_label, unit_title,
  lesson_number, lesson_label, lesson_title, frame_number, frame_label,
  frame_title, section_path, content_type, content_markdown, content_text,
  knowledge_point_count, char_count, sort_order, content_hash,
  verification_status, metadata, is_active
)
select
  collection.id, item.section_key, item.unit_number, item.unit_label,
  item.unit_title, item.lesson_number, item.lesson_label, item.lesson_title,
  item.frame_number, item.frame_label, item.frame_title, item.section_path,
  item.content_type, item.content_markdown, item.content_text,
  item.knowledge_point_count, item.char_count, item.sort_order,
  item.content_hash, item.verification_status, item.metadata, true
from _hai_textbook_seed seed
cross join lateral jsonb_to_recordset(seed.payload->'sections') as item(
  section_key text, collection_slug text, unit_number integer,
  unit_label text, unit_title text, lesson_number integer,
  lesson_label text, lesson_title text, frame_number integer,
  frame_label text, frame_title text, section_path text,
  content_type text, content_markdown text, content_text text,
  knowledge_point_count integer, char_count integer, sort_order integer,
  content_hash text, verification_status text, metadata jsonb
)
join public.hai_textbook_collections collection on collection.slug = item.collection_slug
on conflict (section_key) do update set
  collection_id = excluded.collection_id,
  unit_number = excluded.unit_number,
  unit_label = excluded.unit_label,
  unit_title = excluded.unit_title,
  lesson_number = excluded.lesson_number,
  lesson_label = excluded.lesson_label,
  lesson_title = excluded.lesson_title,
  frame_number = excluded.frame_number,
  frame_label = excluded.frame_label,
  frame_title = excluded.frame_title,
  section_path = excluded.section_path,
  content_type = excluded.content_type,
  content_markdown = excluded.content_markdown,
  content_text = excluded.content_text,
  knowledge_point_count = excluded.knowledge_point_count,
  char_count = excluded.char_count,
  sort_order = excluded.sort_order,
  content_hash = excluded.content_hash,
  verification_status = excluded.verification_status,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

update public.hai_textbook_sections section
set is_active = false, updated_at = now()
where section.collection_id in (
  select collection.id
  from public.hai_textbook_collections collection
  join _hai_textbook_seed seed on exists (
    select 1 from jsonb_array_elements(seed.payload->'collections') item
    where item->>'slug' = collection.slug
  )
)
and not exists (
  select 1 from _hai_textbook_seed seed
  cross join lateral jsonb_array_elements(seed.payload->'sections') item
  where item->>'section_key' = section.section_key
);

update public.hai_feature_modules
set input_schema = '[{"name":"stage","label":"学段","type":"text","required":true,"default":"初中","readonly":true},{"name":"subject","label":"学科","type":"text","required":true,"default":"道德与法治","readonly":true},{"name":"grade","label":"年级","type":"select","required":true},{"name":"volume","label":"册次","type":"select","required":true},{"name":"unit","label":"单元","type":"select","required":true},{"name":"topic","label":"课题","type":"select","required":true},{"name":"frame","label":"框题","type":"select","required":false},{"name":"lesson_type","label":"课型","type":"text","required":true,"default":"公开课","readonly":true},{"name":"textbook_content","label":"补充教材内容","type":"textarea","required":false}]'::jsonb,
  updated_at = now()
where slug = 'subject-lesson-design';

commit;
`;
  return migration.replace(
    /create temporary table _hai_textbook_seed[\s\S]+?(?=update public\.hai_feature_modules)/,
    "-- Textbook rows are imported idempotently from the reviewed JSON artifact.\n\n",
  );
}
