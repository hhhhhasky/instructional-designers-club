import { supabase } from "@/db/supabase";
import { createAsyncCache } from "@/lib/async-cache";
import type {
  AdminCourseQuestionItem,
  AdminCourseQuestionReply,
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

function resolveDisplayName(
  authorId: string,
  isAnonymous: boolean,
  profileMap: Map<string, string>,
): string {
  if (isAnonymous) return "匿名";
  return profileMap.get(authorId) ?? "学员";
}

function normalizeAdminQuestion(
  row: Record<string, unknown>,
  profileMap: Map<string, string>,
): AdminCourseQuestionItem {
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

  const authorId = row.author_id as string;
  const isAnonymous = Boolean(row.is_anonymous);

  return {
    id: row.id as string,
    course_id: row.course_id as string,
    author_id: authorId,
    body: row.body as string,
    is_anonymous: isAnonymous,
    status: row.status as CourseQuestionStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author_display_name: resolveDisplayName(authorId, isAnonymous, profileMap),
    course_title: course.title ?? "未知课程",
    course_category: course.category ?? null,
    course_membership_type: course.membership_type ?? "free",
    tags: tagLinks
      .map((link) => link.course_question_tags)
      .filter((tag): tag is CourseQuestionTag => Boolean(tag)),
    replies: replies.map(
      (reply): AdminCourseQuestionReply => ({
        ...reply,
        author_display_name: resolveDisplayName(reply.author_id, reply.is_anonymous, profileMap),
      }),
    ),
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

  const rows = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : [];

  // Collect all unique author IDs from questions and replies
  const authorIds = new Set<string>();
  for (const row of rows) {
    authorIds.add(row.author_id as string);
    const replies = Array.isArray(row.course_question_replies)
      ? row.course_question_replies as CourseQuestionReply[]
      : [];
    for (const reply of replies) {
      authorIds.add(reply.author_id);
    }
  }

  // Batch fetch profiles for all authors
  const profileMap = new Map<string, string>();
  if (authorIds.size > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", Array.from(authorIds));

    if (profileError) {
      console.error("getAdminCourseQuestions profile fetch error:", profileError);
    } else if (profiles) {
      for (const p of profiles as Array<{ id: string; nickname: string | null }>) {
        if (p.nickname) profileMap.set(p.id, p.nickname);
      }
    }
  }

  return rows.map((row) => normalizeAdminQuestion(row, profileMap));
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
