import { supabase } from "@/db/supabase";

export type V2Status = "draft" | "published" | "archived";
export type V2SubmissionStatus = "draft" | "submitted" | "reviewed" | "revision_required";

export interface V2Module {
  id: string;
  slug: string;
  title: string;
  description_markdown: string | null;
  sort_order: number;
  status: V2Status;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface V2Unit {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  description_markdown: string | null;
  unit_type_id: string | null;
  sort_order: number;
  status: V2Status;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface V2Lesson {
  id: string;
  unit_id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  lesson_type_id: string | null;
  duration_minutes: number | null;
  credits: number;
  sort_order: number;
  membership_type: string | null;
  is_trial: boolean;
  status: V2Status;
  published_at: string | null;
  challenge_title: string | null;
  challenge_markdown: string | null;
  objectives: V2Objective[];
  success_criteria_markdown: string | null;
  takeaway_markdown: string | null;
  body_markdown: string | null;
  created_at: string;
  updated_at: string;
}

export interface V2Objective {
  id: string;
  text: string;
  type_id?: string | null;
}

export interface V2DictionaryGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface V2DictionaryItem {
  id: string;
  group_id: string;
  key: string;
  label: string;
  description: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

export interface V2Resource {
  id: string;
  lesson_id: string;
  resource_type_id: string | null;
  usage_type_id: string | null;
  title: string | null;
  description: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  is_downloadable: boolean;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface V2KnowledgeCard {
  id: string;
  lesson_id: string;
  card_type_id: string | null;
  title: string;
  content_markdown: string;
  sort_order: number;
  is_active: boolean;
}

export interface V2AssessmentBlock {
  id: string;
  lesson_id: string | null;
  unit_id: string | null;
  assessment_type_id: string | null;
  title: string;
  instructions_markdown: string | null;
  required: boolean;
  estimated_minutes: number | null;
  sort_order: number;
  status: V2Status;
}

export interface V2AssessmentItem {
  id: string;
  assessment_block_id: string;
  item_type_id: string | null;
  grading_mode_id: string | null;
  prompt_markdown: string;
  case_markdown: string | null;
  max_score: number | null;
  rubric: Record<string, unknown> | null;
  sort_order: number;
  is_required: boolean;
}

export interface V2AssessmentOption {
  id: string;
  item_id: string;
  option_key: string;
  option_text: string;
  sort_order: number;
}

export interface V2LearningRecord {
  id: string;
  user_id: string;
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  watch_count: number;
  progress: number;
  last_viewed_at: string | null;
  completed_at: string | null;
}

export interface V2Attempt {
  id: string;
  assessment_block_id: string;
  user_id: string;
  attempt_no: number;
  status: V2SubmissionStatus;
  started_at: string;
  submitted_at: string | null;
  final_score: number | null;
}

export interface V2Answer {
  id: string;
  attempt_id: string;
  item_id: string;
  answer_text: string | null;
  answer_json: unknown;
  attachment_data: unknown[];
  auto_score: number | null;
}

export interface V2ManualReview {
  id: string;
  attempt_id: string;
  answer_id: string | null;
  reviewer_id: string;
  review_status: "reviewed" | "revision_required";
  score: number | null;
  feedback_markdown: string | null;
  rubric_result: Record<string, unknown> | null;
  revision_required: boolean;
  created_at: string;
}

export interface V2LessonBundle {
  lesson: V2Lesson;
  unit: V2Unit;
  module: V2Module;
  resources: V2Resource[];
  cards: V2KnowledgeCard[];
  assessments: Array<V2AssessmentBlock & { items: Array<V2AssessmentItem & { options: V2AssessmentOption[] }> }>;
  learningRecord: V2LearningRecord | null;
  attempts: V2Attempt[];
  answers: V2Answer[];
  reviews: V2ManualReview[];
  savedCardIds: string[];
  dictionaryItems: V2DictionaryItem[];
}

export interface V2Outline {
  module: V2Module;
  units: Array<V2Unit & { lessons: V2Lesson[] }>;
}

export interface V2ReviewQueueItem extends V2Attempt {
  learner_name: string;
  learner_phone: string;
  assessment_title: string;
  lesson_title: string;
  unit_title: string;
  module_title: string;
}

export interface V2ReviewDetail {
  attempt: V2Attempt;
  learner_name: string;
  learner_phone: string;
  block: V2AssessmentBlock;
  lesson: V2Lesson | null;
  items: Array<V2AssessmentItem & { options: V2AssessmentOption[] }>;
  answers: V2Answer[];
  reviews: V2ManualReview[];
}

export interface V2AccessRow {
  user_id: string;
  nickname: string;
  phone: string;
  profile_status: string;
  access_status: "active" | "suspended" | "none";
  starts_at: string | null;
  expires_at: string | null;
  notes: string | null;
}

export interface V2AssessmentItemAdminPayload {
  assessment_block_id: string;
  item_type_id: string | null;
  grading_mode_id: string | null;
  prompt_markdown: string;
  case_markdown: string | null;
  max_score: number | null;
  rubric: Record<string, unknown> | null;
  sort_order: number;
  is_required: boolean;
  options: Array<{ key: string; text: string; sort_order: number }>;
  answer_key: { correct: string[] } | null;
}

type UntypedClient = {
  from: (table: string) => any;
  rpc: (name: string, params?: Record<string, unknown>) => any;
};
const v2 = supabase as unknown as UntypedClient;

function table(name: string) {
  return v2.from(name);
}

function throwIfError<T>(result: { data: T; error: unknown }, message: string): T {
  if (result.error) {
    console.error(message, result.error);
    throw result.error;
  }
  return result.data;
}

export async function getV2Access(userId: string): Promise<{ status: string; starts_at: string | null; expires_at: string | null } | null> {
  const { data, error } = await table("v2_course_access")
    .select("status, starts_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadV2LessonBundle(lessonId: string, userId: string, adminMode: boolean): Promise<V2LessonBundle | null> {
  const lessonResult = await table("v2_course_lessons").select("*").eq("id", lessonId).maybeSingle();
  const lesson = throwIfError(lessonResult, "getV2LessonBundle lesson error") as V2Lesson | null;
  if (!lesson) return null;

  let resourcesQuery = table("v2_lesson_resources").select("*").eq("lesson_id", lesson.id).order("sort_order");
  let cardsQuery = table("v2_lesson_knowledge_cards").select("*").eq("lesson_id", lesson.id).order("sort_order");
  let blocksQuery = table("v2_assessment_blocks").select("*").eq("lesson_id", lesson.id).order("sort_order");
  if (!adminMode) {
    resourcesQuery = resourcesQuery.eq("is_active", true);
    cardsQuery = cardsQuery.eq("is_active", true);
    blocksQuery = blocksQuery.eq("status", "published");
  }

  const [unitResult, resourcesResult, cardsResult, blocksResult, recordResult, attemptsResult, dictionaryItemsResult] = await Promise.all([
    table("v2_course_units").select("*").eq("id", lesson.unit_id).single(),
    resourcesQuery,
    cardsQuery,
    blocksQuery,
    table("v2_learning_records").select("*").eq("lesson_id", lesson.id).eq("user_id", userId).maybeSingle(),
    table("v2_submission_attempts").select("*").eq("user_id", userId).order("attempt_no", { ascending: false }),
    table("v2_dictionary_items").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const unit = throwIfError(unitResult, "getV2LessonBundle unit error") as V2Unit;
  const moduleResult = await table("v2_course_modules").select("*").eq("id", unit.module_id).single();
  const module = throwIfError(moduleResult, "getV2LessonBundle module error") as V2Module;
  const resources = (throwIfError(resourcesResult, "getV2LessonBundle resources error") ?? []) as V2Resource[];
  const cards = (throwIfError(cardsResult, "getV2LessonBundle cards error") ?? []) as V2KnowledgeCard[];
  const blocks = (throwIfError(blocksResult, "getV2LessonBundle blocks error") ?? []) as V2AssessmentBlock[];
  const learningRecord = throwIfError(recordResult, "getV2LessonBundle record error") as V2LearningRecord | null;
  const allAttempts = (throwIfError(attemptsResult, "getV2LessonBundle attempts error") ?? []) as V2Attempt[];
  const dictionaryItems = (throwIfError(dictionaryItemsResult, "getV2LessonBundle dictionaries error") ?? []) as V2DictionaryItem[];
  const attempts = allAttempts.filter((attempt) => blocks.some((block) => block.id === attempt.assessment_block_id));
  const attemptIds = attempts.map((attempt) => attempt.id);
  const [answersResult, reviewsResult, savedResult] = await Promise.all([
    attemptIds.length ? table("v2_submission_answers").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
    attemptIds.length ? table("v2_manual_reviews").select("*").in("attempt_id", attemptIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    cards.length ? table("v2_user_saved_cards").select("knowledge_card_id").eq("user_id", userId).in("knowledge_card_id", cards.map((card) => card.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  const answers = (throwIfError(answersResult, "getV2LessonBundle answers error") ?? []) as V2Answer[];
  const reviews = (throwIfError(reviewsResult, "getV2LessonBundle reviews error") ?? []) as V2ManualReview[];
  const savedCardIds = ((throwIfError(savedResult, "getV2LessonBundle saved cards error") ?? []) as Array<{ knowledge_card_id: string }>).map((row) => row.knowledge_card_id);

  const assessments = await Promise.all(blocks.map(async (block) => {
    const itemsResult = await table("v2_assessment_items").select("*").eq("assessment_block_id", block.id).order("sort_order");
    const items = (throwIfError(itemsResult, "getV2LessonBundle items error") ?? []) as V2AssessmentItem[];
    const optionsResult = items.length
      ? await table("v2_assessment_options").select("*").in("item_id", items.map((item) => item.id)).order("sort_order")
      : { data: [], error: null };
    const options = (throwIfError(optionsResult, "getV2LessonBundle options error") ?? []) as V2AssessmentOption[];
    return { ...block, items: items.map((item) => ({ ...item, options: options.filter((option) => option.item_id === item.id) })) };
  }));

  return { lesson, unit, module, resources, cards, assessments, learningRecord, attempts, answers, reviews, savedCardIds, dictionaryItems };
}

export async function getV2LessonBundle(lessonId: string, userId: string): Promise<V2LessonBundle | null> {
  return loadV2LessonBundle(lessonId, userId, false);
}

export async function getV2LessonAdminBundle(lessonId: string, userId: string): Promise<V2LessonBundle | null> {
  return loadV2LessonBundle(lessonId, userId, true);
}

export async function upsertV2LearningRecord(userId: string, lessonId: string, progress: number, completed: boolean): Promise<V2LearningRecord> {
  const result = await table("v2_learning_records").upsert({
    user_id: userId,
    lesson_id: lessonId,
    status: completed ? "completed" : progress > 0 ? "in_progress" : "not_started",
    progress: Math.min(100, Math.max(0, progress)),
    watch_count: 1,
    last_viewed_at: new Date().toISOString(),
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: "user_id,lesson_id" }).select("*").single();
  return throwIfError(result, "upsertV2LearningRecord error") as V2LearningRecord;
}

export async function saveV2Card(userId: string, cardId: string, saved: boolean): Promise<void> {
  if (saved) {
    const result = await table("v2_user_saved_cards").upsert({ user_id: userId, knowledge_card_id: cardId }, { onConflict: "user_id,knowledge_card_id" });
    throwIfError(result, "saveV2Card insert error");
  } else {
    const result = await table("v2_user_saved_cards").delete().eq("user_id", userId).eq("knowledge_card_id", cardId);
    throwIfError(result, "saveV2Card delete error");
  }
}

export async function createV2Attempt(userId: string, blockId: string, attemptNo: number): Promise<V2Attempt> {
  const result = await table("v2_submission_attempts").insert({ user_id: userId, assessment_block_id: blockId, attempt_no: attemptNo, status: "draft" }).select("*").single();
  return throwIfError(result, "createV2Attempt error") as V2Attempt;
}

export async function saveV2Answers(attemptId: string, answers: Array<Pick<V2Answer, "item_id" | "answer_text" | "answer_json" | "attachment_data">>): Promise<void> {
  if (!answers.length) return;
  const result = await table("v2_submission_answers").upsert(answers.map((answer) => ({ attempt_id: attemptId, ...answer })), { onConflict: "attempt_id,item_id" });
  throwIfError(result, "saveV2Answers error");
}

export async function submitV2Attempt(attemptId: string): Promise<V2Attempt> {
  const result = await v2.rpc("v2_submit_attempt", { p_attempt_id: attemptId });
  return throwIfError(result, "submitV2Attempt error") as V2Attempt;
}

export async function getV2Outlines(): Promise<V2Outline[]> {
  const [modulesResult, unitsResult, lessonsResult] = await Promise.all([
    table("v2_course_modules").select("*").order("sort_order").order("created_at"),
    table("v2_course_units").select("*").order("sort_order").order("created_at"),
    table("v2_course_lessons").select("*").order("sort_order").order("created_at"),
  ]);
  const modules = (throwIfError(modulesResult, "getV2Outlines modules error") ?? []) as V2Module[];
  const units = (throwIfError(unitsResult, "getV2Outlines units error") ?? []) as V2Unit[];
  const lessons = (throwIfError(lessonsResult, "getV2Outlines lessons error") ?? []) as V2Lesson[];
  return modules.map((module) => ({
    module,
    units: units.filter((unit) => unit.module_id === module.id).map((unit) => ({ ...unit, lessons: lessons.filter((lesson) => lesson.unit_id === unit.id) })),
  }));
}

export async function getPublishedV2Outlines(): Promise<V2Outline[]> {
  const [modulesResult, unitsResult, lessonsResult] = await Promise.all([
    table("v2_course_modules").select("*").eq("status", "published").eq("is_active", true).order("sort_order").order("created_at"),
    table("v2_course_units").select("*").eq("status", "published").eq("is_active", true).order("sort_order").order("created_at"),
    table("v2_course_lessons").select("*").eq("status", "published").order("sort_order").order("created_at"),
  ]);
  const modules = (throwIfError(modulesResult, "getPublishedV2Outlines modules error") ?? []) as V2Module[];
  const units = (throwIfError(unitsResult, "getPublishedV2Outlines units error") ?? []) as V2Unit[];
  const lessons = (throwIfError(lessonsResult, "getPublishedV2Outlines lessons error") ?? []) as V2Lesson[];
  return modules
    .map((module) => ({
      module,
      units: units
        .filter((unit) => unit.module_id === module.id)
        .map((unit) => ({ ...unit, lessons: lessons.filter((lesson) => lesson.unit_id === unit.id) }))
        .filter((unit) => unit.lessons.length > 0),
    }))
    .filter((outline) => outline.units.length > 0);
}

export async function saveV2Module(payload: Partial<V2Module> & Pick<V2Module, "title" | "slug">, id?: string): Promise<V2Module> {
  const result = id ? await table("v2_course_modules").update(payload).eq("id", id).select("*").single() : await table("v2_course_modules").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Module error") as V2Module;
}

export async function saveV2Unit(payload: Partial<V2Unit> & Pick<V2Unit, "title" | "slug" | "module_id">, id?: string): Promise<V2Unit> {
  const result = id ? await table("v2_course_units").update(payload).eq("id", id).select("*").single() : await table("v2_course_units").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Unit error") as V2Unit;
}

export async function saveV2Lesson(payload: Partial<V2Lesson> & Pick<V2Lesson, "title" | "unit_id">, id?: string): Promise<V2Lesson> {
  const result = id ? await table("v2_course_lessons").update(payload).eq("id", id).select("*").single() : await table("v2_course_lessons").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Lesson error") as V2Lesson;
}

export async function publishV2LessonAdmin(lessonId: string): Promise<V2Lesson> {
  const result = await v2.rpc("v2_publish_lesson_admin", { p_lesson_id: lessonId });
  return throwIfError(result, "publishV2LessonAdmin error") as V2Lesson;
}

export async function saveV2Resource(payload: Partial<V2Resource> & Pick<V2Resource, "lesson_id">, id?: string): Promise<V2Resource> {
  const result = id ? await table("v2_lesson_resources").update(payload).eq("id", id).select("*").single() : await table("v2_lesson_resources").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Resource error") as V2Resource;
}

export async function uploadV2Resource(lessonId: string, file: File): Promise<V2Resource> {
  const body = new FormData();
  body.append("lessonId", lessonId);
  body.append("file", file);
  const { data, error } = await supabase.functions.invoke("upload-v2-resource", { body });
  if (error) throw error;
  if (!data?.resource) throw new Error("上传成功，但服务端没有返回资源记录");
  return data.resource as V2Resource;
}

export async function saveV2CardAdmin(payload: Partial<V2KnowledgeCard> & Pick<V2KnowledgeCard, "lesson_id" | "title" | "content_markdown">, id?: string): Promise<V2KnowledgeCard> {
  const result = id ? await table("v2_lesson_knowledge_cards").update(payload).eq("id", id).select("*").single() : await table("v2_lesson_knowledge_cards").insert(payload).select("*").single();
  return throwIfError(result, "saveV2CardAdmin error") as V2KnowledgeCard;
}

export async function deleteV2CardAdmin(id: string): Promise<void> {
  const result = await table("v2_lesson_knowledge_cards").delete().eq("id", id);
  throwIfError(result, "deleteV2CardAdmin error");
}

export async function saveV2Block(payload: Partial<V2AssessmentBlock> & Pick<V2AssessmentBlock, "title">, id?: string): Promise<V2AssessmentBlock> {
  const result = id ? await table("v2_assessment_blocks").update(payload).eq("id", id).select("*").single() : await table("v2_assessment_blocks").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Block error") as V2AssessmentBlock;
}

export async function saveV2Item(payload: Partial<V2AssessmentItem> & Pick<V2AssessmentItem, "assessment_block_id" | "prompt_markdown">, id?: string): Promise<V2AssessmentItem> {
  const result = id ? await table("v2_assessment_items").update(payload).eq("id", id).select("*").single() : await table("v2_assessment_items").insert(payload).select("*").single();
  return throwIfError(result, "saveV2Item error") as V2AssessmentItem;
}

export async function saveV2AssessmentItemAdmin(payload: V2AssessmentItemAdminPayload, id?: string): Promise<string> {
  const result = await v2.rpc("v2_save_assessment_item_admin", {
    p_item_id: id ?? null,
    p_assessment_block_id: payload.assessment_block_id,
    p_item_type_id: payload.item_type_id,
    p_grading_mode_id: payload.grading_mode_id,
    p_prompt_markdown: payload.prompt_markdown,
    p_case_markdown: payload.case_markdown,
    p_max_score: payload.max_score,
    p_rubric: payload.rubric,
    p_sort_order: payload.sort_order,
    p_is_required: payload.is_required,
    p_options: payload.options,
    p_answer_key: payload.answer_key,
  });
  return throwIfError(result, "saveV2AssessmentItemAdmin error") as string;
}

export async function getV2AssessmentKeyAdmin(itemId: string): Promise<{ correct: string[] } | null> {
  const result = await v2.rpc("v2_get_assessment_key_admin", { p_item_id: itemId });
  return throwIfError(result, "getV2AssessmentKeyAdmin error") as { correct: string[] } | null;
}

export async function deleteV2AssessmentItemAdmin(id: string): Promise<void> {
  const result = await table("v2_assessment_items").delete().eq("id", id);
  throwIfError(result, "deleteV2AssessmentItemAdmin error");
}

export async function deleteV2AssessmentBlockAdmin(id: string): Promise<void> {
  const result = await table("v2_assessment_blocks").delete().eq("id", id);
  throwIfError(result, "deleteV2AssessmentBlockAdmin error");
}

export async function getV2Dictionaries(): Promise<{ groups: V2DictionaryGroup[]; items: V2DictionaryItem[] }> {
  const [groupsResult, itemsResult] = await Promise.all([
    table("v2_dictionary_groups").select("*").order("sort_order").order("name"),
    table("v2_dictionary_items").select("*").order("sort_order").order("label"),
  ]);
  return {
    groups: (throwIfError(groupsResult, "getV2Dictionaries groups error") ?? []) as V2DictionaryGroup[],
    items: (throwIfError(itemsResult, "getV2Dictionaries items error") ?? []) as V2DictionaryItem[],
  };
}

export async function saveV2DictionaryGroup(payload: Partial<V2DictionaryGroup> & Pick<V2DictionaryGroup, "key" | "name">, id?: string): Promise<V2DictionaryGroup> {
  const result = id ? await table("v2_dictionary_groups").update(payload).eq("id", id).select("*").single() : await table("v2_dictionary_groups").insert(payload).select("*").single();
  return throwIfError(result, "saveV2DictionaryGroup error") as V2DictionaryGroup;
}

export async function saveV2DictionaryItem(payload: Partial<V2DictionaryItem> & Pick<V2DictionaryItem, "group_id" | "key" | "label">, id?: string): Promise<V2DictionaryItem> {
  const result = id ? await table("v2_dictionary_items").update(payload).eq("id", id).select("*").single() : await table("v2_dictionary_items").insert(payload).select("*").single();
  return throwIfError(result, "saveV2DictionaryItem error") as V2DictionaryItem;
}

export async function getV2ReviewQueue(): Promise<V2ReviewQueueItem[]> {
  const attemptsResult = await table("v2_submission_attempts").select("*").neq("status", "draft").order("submitted_at", { ascending: false });
  const attempts = (throwIfError(attemptsResult, "getV2ReviewQueue attempts error") ?? []) as V2Attempt[];
  if (!attempts.length) return [];
  const userIds = [...new Set(attempts.map((attempt) => attempt.user_id))];
  const blockIds = [...new Set(attempts.map((attempt) => attempt.assessment_block_id))];
  const [profilesResult, blocksResult] = await Promise.all([
    table("profiles").select("id, nickname, phone").in("id", userIds),
    table("v2_assessment_blocks").select("*").in("id", blockIds),
  ]);
  const profiles = (throwIfError(profilesResult, "getV2ReviewQueue profiles error") ?? []) as Array<{ id: string; nickname: string; phone: string }>;
  const blocks = (throwIfError(blocksResult, "getV2ReviewQueue blocks error") ?? []) as V2AssessmentBlock[];
  const lessonIds = blocks.map((block) => block.lesson_id).filter(Boolean) as string[];
  const lessonsResult = lessonIds.length ? await table("v2_course_lessons").select("*").in("id", lessonIds) : { data: [], error: null };
  const lessons = (throwIfError(lessonsResult, "getV2ReviewQueue lessons error") ?? []) as V2Lesson[];
  const unitIds = [...new Set(lessons.map((lesson) => lesson.unit_id))];
  const unitsResult = unitIds.length ? await table("v2_course_units").select("*").in("id", unitIds) : { data: [], error: null };
  const units = (throwIfError(unitsResult, "getV2ReviewQueue units error") ?? []) as V2Unit[];
  const moduleIds = [...new Set(units.map((unit) => unit.module_id))];
  const modulesResult = moduleIds.length ? await table("v2_course_modules").select("*").in("id", moduleIds) : { data: [], error: null };
  const modules = (throwIfError(modulesResult, "getV2ReviewQueue modules error") ?? []) as V2Module[];
  return attempts.map((attempt) => {
    const block = blocks.find((row) => row.id === attempt.assessment_block_id);
    const lesson = lessons.find((row) => row.id === block?.lesson_id);
    const unit = units.find((row) => row.id === lesson?.unit_id);
    const module = modules.find((row) => row.id === unit?.module_id);
    const profile = profiles.find((row) => row.id === attempt.user_id);
    return { ...attempt, learner_name: profile?.nickname ?? "未命名学员", learner_phone: profile?.phone ?? "", assessment_title: block?.title ?? "未知评估", lesson_title: lesson?.title ?? "单元任务", unit_title: unit?.title ?? "未知单元", module_title: module?.title ?? "未知模块" };
  });
}

export async function getV2ReviewDetail(attemptId: string): Promise<V2ReviewDetail> {
  const attemptResult = await table("v2_submission_attempts").select("*").eq("id", attemptId).single();
  const attempt = throwIfError(attemptResult, "getV2ReviewDetail attempt error") as V2Attempt;
  const [profileResult, blockResult, answersResult, reviewsResult] = await Promise.all([
    table("profiles").select("nickname, phone").eq("id", attempt.user_id).single(),
    table("v2_assessment_blocks").select("*").eq("id", attempt.assessment_block_id).single(),
    table("v2_submission_answers").select("*").eq("attempt_id", attempt.id),
    table("v2_manual_reviews").select("*").eq("attempt_id", attempt.id).order("created_at", { ascending: false }),
  ]);
  const profile = throwIfError(profileResult, "getV2ReviewDetail profile error") as { nickname: string; phone: string };
  const block = throwIfError(blockResult, "getV2ReviewDetail block error") as V2AssessmentBlock;
  const answers = (throwIfError(answersResult, "getV2ReviewDetail answers error") ?? []) as V2Answer[];
  const reviews = (throwIfError(reviewsResult, "getV2ReviewDetail reviews error") ?? []) as V2ManualReview[];
  const lessonResult = block.lesson_id ? await table("v2_course_lessons").select("*").eq("id", block.lesson_id).maybeSingle() : { data: null, error: null };
  const lesson = throwIfError(lessonResult, "getV2ReviewDetail lesson error") as V2Lesson | null;
  const itemsResult = await table("v2_assessment_items").select("*").eq("assessment_block_id", block.id).order("sort_order");
  const items = (throwIfError(itemsResult, "getV2ReviewDetail items error") ?? []) as V2AssessmentItem[];
  const optionsResult = items.length ? await table("v2_assessment_options").select("*").in("item_id", items.map((item) => item.id)).order("sort_order") : { data: [], error: null };
  const options = (throwIfError(optionsResult, "getV2ReviewDetail options error") ?? []) as V2AssessmentOption[];
  return { attempt, learner_name: profile.nickname, learner_phone: profile.phone, block, lesson, items: items.map((item) => ({ ...item, options: options.filter((option) => option.item_id === item.id) })), answers, reviews };
}

export async function saveV2Review(attemptId: string, reviewerId: string, payload: { status: "reviewed" | "revision_required"; score: number | null; feedback_markdown: string; rubric_result: Record<string, unknown> | null }): Promise<void> {
  const reviewResult = await table("v2_manual_reviews").insert({ attempt_id: attemptId, reviewer_id: reviewerId, answer_id: null, review_status: payload.status, revision_required: payload.status === "revision_required", score: payload.score, feedback_markdown: payload.feedback_markdown || null, rubric_result: payload.rubric_result });
  throwIfError(reviewResult, "saveV2Review insert error");
  const attemptResult = await table("v2_submission_attempts").update({ status: payload.status }).eq("id", attemptId);
  throwIfError(attemptResult, "saveV2Review attempt update error");
}

export async function getV2AccessRows(): Promise<V2AccessRow[]> {
  const [profilesResult, accessResult] = await Promise.all([
    table("profiles").select("id, nickname, phone, status").order("created_at", { ascending: false }),
    table("v2_course_access").select("user_id, status, starts_at, expires_at, notes"),
  ]);
  const profiles = (throwIfError(profilesResult, "getV2AccessRows profiles error") ?? []) as Array<{ id: string; nickname: string; phone: string; status: string }>;
  const access = (throwIfError(accessResult, "getV2AccessRows access error") ?? []) as Array<{ user_id: string; status: "active" | "suspended"; starts_at: string | null; expires_at: string | null; notes: string | null }>;
  return profiles.map((profile) => {
    const row = access.find((item) => item.user_id === profile.id);
    return { user_id: profile.id, nickname: profile.nickname, phone: profile.phone, profile_status: profile.status, access_status: row?.status ?? "none", starts_at: row?.starts_at ?? null, expires_at: row?.expires_at ?? null, notes: row?.notes ?? null };
  });
}

export async function saveV2Access(userId: string, status: "active" | "suspended", notes: string, expiresAt: string | null): Promise<void> {
  const result = await table("v2_course_access").upsert({ user_id: userId, status, notes: notes || null, expires_at: expiresAt || null }, { onConflict: "user_id" });
  throwIfError(result, "saveV2Access error");
}
