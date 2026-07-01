import { supabase } from "@/db/supabase";
import { createAsyncCache } from "@/lib/async-cache";
import type {
  AdminCourseQuestionItem,
  CourseQuestion,
  CourseQuestionReply,
  CourseQuestionStatus,
  CourseQuestionTag,
  CourseQuestionWithDetails,
  MembershipType,
} from "@/types/types";

const QUESTION_SELECT = `
  *,
  courses(id, title, category, membership_type),
  course_question_tag_links(course_question_tags(*)),
  course_question_replies(*)
`;

function normalizeQuestionFeed(value: unknown): CourseQuestionWithDetails[] {
  return Array.isArray(value) ? (value as CourseQuestionWithDetails[]) : [];
}

function normalizeAdminQuestion(row: Record<string, unknown>): AdminCourseQuestionItem {
  const course = (row.courses ?? {}) as {
    title?: string;
    category?: string | null;
    membership_type?: MembershipType;
  };
  const tagLinks = Array.isArray(row.course_question_tag_links)
    ? row.course_question_tag_links as Array<{ course_question_tags?: CourseQuestionTag | null }>
    : [];
  const replies = Array.isArray(row.course_question_replies)
    ? row.course_question_replies as CourseQuestionReply[]
    : [];

  return {
    id: row.id as string,
    course_id: row.course_id as string,
    author_id: row.author_id as string,
    body: row.body as string,
    is_anonymous: Boolean(row.is_anonymous),
    status: row.status as CourseQuestionStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    course_title: course.title ?? "未知课程",
    course_category: course.category ?? null,
    course_membership_type: course.membership_type ?? "free",
    tags: tagLinks
      .map((link) => link.course_question_tags)
      .filter((tag): tag is CourseQuestionTag => Boolean(tag)),
    replies,
  };
}

function assertNonEmptyText(value: string, fieldLabel: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldLabel}不能为空`);
  if (normalized.length > 2000) throw new Error(`${fieldLabel}不能超过 2000 字`);
  return normalized;
}

async function fetchCourseQuestionTags(): Promise<CourseQuestionTag[]> {
  const { data, error } = await supabase
    .from("course_question_tags")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getCourseQuestionTags error:", error);
    throw error;
  }

  return (data as CourseQuestionTag[]) ?? [];
}

const questionTagCache = createAsyncCache<CourseQuestionTag[]>({
  key: "club.courseQuestionTags.v1",
  ttlMs: 10 * 60 * 1000,
  storage: "session",
  fetcher: fetchCourseQuestionTags,
});

const courseQuestionCaches = new Map<string, ReturnType<typeof createAsyncCache<CourseQuestionWithDetails[]>>>();

function getCourseQuestionCache(courseId: string) {
  const existing = courseQuestionCaches.get(courseId);
  if (existing) return existing;
  const cache = createAsyncCache<CourseQuestionWithDetails[]>({
    key: `club.courseQuestions.v1.${courseId}`,
    ttlMs: 30 * 1000,
    storage: "session",
    fetcher: () => fetchCourseQuestions(courseId),
  });
  courseQuestionCaches.set(courseId, cache);
  return cache;
}

export function clearCourseQuestionsCache(courseId?: string): void {
  if (courseId) {
    courseQuestionCaches.get(courseId)?.clear();
    courseQuestionCaches.delete(courseId);
    return;
  }
  for (const cache of courseQuestionCaches.values()) cache.clear();
  courseQuestionCaches.clear();
}

export function clearCourseQuestionTagsCache(): void {
  questionTagCache.clear();
}

export async function getCourseQuestionTags(options: { fresh?: boolean } = {}): Promise<CourseQuestionTag[]> {
  return questionTagCache.get(options);
}

async function fetchCourseQuestions(courseId: string): Promise<CourseQuestionWithDetails[]> {
  const { data, error } = await supabase.rpc("course_questions_feed", {
    p_course_id: courseId,
  });

  if (error) {
    console.error("getCourseQuestions error:", error);
    throw error;
  }

  return normalizeQuestionFeed(data);
}

export async function getCourseQuestions(
  courseId: string,
  options: { fresh?: boolean } = {},
): Promise<CourseQuestionWithDetails[]> {
  return getCourseQuestionCache(courseId).get(options);
}

export async function createCourseQuestion(params: {
  courseId: string;
  authorId: string;
  body: string;
  isAnonymous: boolean;
  tagIds: string[];
}): Promise<CourseQuestion> {
  const body = assertNonEmptyText(params.body, "问题内容");
  const { data, error } = await supabase
    .from("course_questions")
    .insert({
      course_id: params.courseId,
      author_id: params.authorId,
      body,
      is_anonymous: params.isAnonymous,
      status: "visible",
    })
    .select("*")
    .single();

  if (error) {
    console.error("createCourseQuestion error:", error);
    throw error;
  }

  const question = data as CourseQuestion;
  const uniqueTagIds = Array.from(new Set(params.tagIds.filter(Boolean)));
  if (uniqueTagIds.length > 0) {
    const { error: linkError } = await supabase
      .from("course_question_tag_links")
      .insert(uniqueTagIds.map((tagId) => ({ question_id: question.id, tag_id: tagId })));

    if (linkError) {
      console.error("createCourseQuestion tag link error:", linkError);
      throw linkError;
    }
  }

  clearCourseQuestionsCache(params.courseId);
  return question;
}

export async function createCourseQuestionReply(params: {
  questionId: string;
  authorId: string;
  body: string;
  isAnonymous: boolean;
}): Promise<CourseQuestionReply> {
  const body = assertNonEmptyText(params.body, "回复内容");
  const { data, error } = await supabase
    .from("course_question_replies")
    .insert({
      question_id: params.questionId,
      author_id: params.authorId,
      body,
      is_anonymous: params.isAnonymous,
      status: "visible",
    })
    .select("*")
    .single();

  if (error) {
    console.error("createCourseQuestionReply error:", error);
    throw error;
  }

  const reply = data as CourseQuestionReply;
  clearCourseQuestionsCache();
  return reply;
}

export async function getAdminCourseQuestions(): Promise<AdminCourseQuestionItem[]> {
  const { data, error } = await supabase
    .from("course_questions")
    .select(QUESTION_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAdminCourseQuestions error:", error);
    throw error;
  }

  return Array.isArray(data)
    ? (data as Array<Record<string, unknown>>).map(normalizeAdminQuestion)
    : [];
}

export async function updateCourseQuestionStatus(
  questionId: string,
  status: CourseQuestionStatus,
): Promise<void> {
  const { error } = await supabase
    .from("course_questions")
    .update({ status })
    .eq("id", questionId);

  if (error) {
    console.error("updateCourseQuestionStatus error:", error);
    throw error;
  }
  clearCourseQuestionsCache();
}

export async function updateCourseQuestionReplyStatus(
  replyId: string,
  status: CourseQuestionStatus,
): Promise<void> {
  const { error } = await supabase
    .from("course_question_replies")
    .update({ status })
    .eq("id", replyId);

  if (error) {
    console.error("updateCourseQuestionReplyStatus error:", error);
    throw error;
  }
  clearCourseQuestionsCache();
}
