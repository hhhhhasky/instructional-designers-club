import { supabase } from "./supabase";
import type { Json } from "@/types/database.generated";
import {
  LIVE_STATUS_LABELS,
  type AdminLiveQuestion,
  type LiveAnswer,
  type LiveAdminParticipant,
  type LiveAudienceMode,
  type LiveQuestion,
  type LiveQuestionOption,
  type LiveQuestionType,
  type LiveParticipantResults,
  type LiveResponse,
  type LiveSession,
} from "@/lib/live";
import {
  buildAdminLiveSessionDashboard,
  type AdminLiveSessionDashboard,
  type LiveRoomAudienceSummary,
} from "@/lib/live-dashboard";

export interface LiveQuestionInput {
  title: string;
  type: LiveQuestionType;
  content: string;
  options: LiveQuestionOption[];
  correct_answer: Json;
  audience_mode: LiveAudienceMode;
  target_user_ids: string[];
  target_tags: string[];
}

export interface LiveParticipantSnapshot {
  session: LiveSession;
  question: LiveQuestion | null;
  response: LiveResponse | null;
  correctAnswer: Json | null;
  results: LiveParticipantResults | null;
}

interface RawAdminQuestion {
  id: string;
  live_id: string;
  position: number;
  title: string;
  type: LiveQuestionType;
  content: string;
  options: Json;
  audience_mode?: LiveAudienceMode;
  question_keys?: { correct_answer: Json } | { correct_answer: Json }[] | null;
  live_question_target_users?: { user_id: string }[] | null;
  live_question_target_tags?: { tag: string }[] | null;
}

interface RawQuestion {
  id: string;
  live_id: string;
  position: number;
  title: string;
  type: LiveQuestionType;
  content: string;
  options: Json;
  audience_mode?: LiveAudienceMode;
}

interface RawResponse {
  question_id: string;
  user_id: string;
  answer: Json;
  answered_at: string;
}

function normalizeOptions(value: Json): LiveQuestionOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LiveQuestionOption[] => {
    if (typeof item !== "object" || item === null) return [];
    const option = item as { id?: unknown; text?: unknown };
    if (typeof option.id !== "string" || typeof option.text !== "string") return [];
    return [{ id: option.id, text: option.text }];
  });
}

function normalizeQuestion(row: RawQuestion): LiveQuestion {
  return {
    id: row.id,
    live_id: row.live_id,
    position: row.position,
    title: row.title,
    type: row.type,
    content: row.content,
    options: normalizeOptions(row.options),
    audience_mode: row.audience_mode === "targeted" ? "targeted" : "all",
  };
}

function normalizeAdminQuestion(row: RawAdminQuestion): AdminLiveQuestion {
  const embedded = Array.isArray(row.question_keys) ? row.question_keys[0] : row.question_keys;
  return {
    ...normalizeQuestion(row),
    correct_answer: embedded?.correct_answer ?? null,
    target_user_ids: (row.live_question_target_users ?? []).map((target) => target.user_id),
    target_tags: (row.live_question_target_tags ?? []).map((target) => target.tag),
  };
}

function normalizeAdminParticipant(value: unknown): LiveAdminParticipant | null {
  if (typeof value !== "object" || value === null) return null;
  const participant = value as Record<string, unknown>;
  if (
    typeof participant.user_id !== "string"
    || typeof participant.nickname !== "string"
    || typeof participant.joined_at !== "string"
    || typeof participant.last_seen_at !== "string"
    || !Array.isArray(participant.tags)
  ) return null;
  return {
    user_id: participant.user_id,
    nickname: participant.nickname,
    joined_at: participant.joined_at,
    last_seen_at: participant.last_seen_at,
    tags: participant.tags.filter((tag): tag is string => typeof tag === "string"),
  };
}

function normalizeSession(row: LiveSession): LiveSession {
  return row;
}

function normalizeResponse(row: RawResponse): LiveResponse {
  return {
    question_id: row.question_id,
    user_id: row.user_id,
    answer: row.answer,
    answered_at: row.answered_at,
  };
}

function normalizeParticipantResults(value: unknown): LiveParticipantResults | null {
  if (typeof value !== "object" || value === null) return null;
  const result = value as { question_id?: unknown; answered_count?: unknown; options?: unknown };
  if (
    typeof result.question_id !== "string"
    || typeof result.answered_count !== "number"
    || !Array.isArray(result.options)
  ) return null;

  const options = result.options.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const option = item as { id?: unknown; label?: unknown; count?: unknown; percentage?: unknown };
    if (
      typeof option.id !== "string"
      || typeof option.label !== "string"
      || typeof option.count !== "number"
      || typeof option.percentage !== "number"
    ) return [];
    return [{
      id: option.id,
      label: option.label,
      count: option.count,
      percentage: option.percentage,
    }];
  });

  return {
    questionId: result.question_id,
    answeredCount: result.answered_count,
    options,
  };
}

function getLiveError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return new Error(message);
  }
  return new Error(fallback);
}

async function throwIfError(error: unknown, fallback: string): Promise<never> {
  throw getLiveError(error, fallback);
}

function generateRoomCode(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return String(100000 + (buffer[0] % 900000));
  }
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function nextPosition(liveId: string): Promise<number> {
  const { data, error } = await supabase
    .from("questions")
    .select("position")
    .eq("live_id", liveId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) await throwIfError(error, "读取题目顺序失败");
  return (((data?.[0] as { position?: number } | undefined)?.position) ?? 0) + 1;
}

export async function getAdminLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .order("title", { ascending: true });
  if (error) await throwIfError(error, "读取 Live 房间失败");
  const statusOrder: Record<string, number> = { live: 0, draft: 1, ended: 2 };
  return ((data as LiveSession[]) ?? []).sort((left, right) =>
    statusOrder[left.status] - statusOrder[right.status]
    || left.title.localeCompare(right.title, "zh-Hans-CN")
  );
}

export async function getLiveSessionsForParticipants(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("status", "live")
    .order("title", { ascending: true });
  if (error) await throwIfError(error, "读取当前互动失败");
  return (data as LiveSession[]) ?? [];
}

export async function createLiveSession(title: string): Promise<LiveSession> {
  const { data, error } = await supabase
    .from("live_sessions")
    .insert({ title, status: "draft", question_state: "waiting" })
    .select("*")
    .single();
  if (error) await throwIfError(error, "创建直播失败");
  return normalizeSession(data as LiveSession);
}

export async function updateLiveTitle(liveId: string, title: string): Promise<LiveSession> {
  const { data, error } = await supabase
    .from("live_sessions")
    .update({ title })
    .eq("id", liveId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) await throwIfError(error, "保存直播标题失败");
  return normalizeSession(data as LiveSession);
}

export async function openLiveSession(liveId: string): Promise<LiveSession> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("live_sessions")
      .update({
        room_code: generateRoomCode(),
        status: "live",
        current_question_id: null,
        question_state: "waiting",
      })
      .eq("id", liveId)
      .eq("status", "draft")
      .select("*")
      .single();
    if (!error && data) return normalizeSession(data as LiveSession);
    lastError = error;
    const message = error?.message ?? "";
    if (!message.includes("duplicate key") && !message.includes("unique")) {
      await throwIfError(error, "开启房间失败");
    }
  }
  return throwIfError(lastError, "房间号生成冲突，请重试");
}

export async function updateLiveSessionState(
  liveId: string,
  updates: Partial<Pick<LiveSession, "status" | "current_question_id" | "question_state">>,
): Promise<LiveSession> {
  const { data, error } = await supabase
    .from("live_sessions")
    .update(updates)
    .eq("id", liveId)
    .select("*")
    .single();
  if (error) await throwIfError(error, "更新互动状态失败");
  return normalizeSession(data as LiveSession);
}

export async function endLiveSession(liveId: string): Promise<LiveSession> {
  return updateLiveSessionState(liveId, { status: "ended" });
}

export async function getAdminLiveQuestions(liveId: string): Promise<AdminLiveQuestion[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*, question_keys(correct_answer), live_question_target_users(user_id), live_question_target_tags(tag)")
    .eq("live_id", liveId)
    .order("position", { ascending: true });
  if (error) await throwIfError(error, "读取题目失败");
  return ((data as unknown as RawAdminQuestion[]) ?? []).map(normalizeAdminQuestion);
}

export async function createLiveQuestion(
  liveId: string,
  input: LiveQuestionInput,
): Promise<AdminLiveQuestion> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const position = await nextPosition(liveId);
    const { data, error } = await supabase
      .from("questions")
      .insert({
        live_id: liveId,
        position,
        title: input.title,
        type: input.type,
        content: input.content,
        options: input.options,
        audience_mode: input.audience_mode,
      })
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("duplicate key") || error.message.includes("unique")) continue;
      await throwIfError(error, "创建题目失败");
    }

    const question = data as RawQuestion;
    const keyResult = await supabase
      .from("question_keys")
      .upsert(
        { question_id: question.id, correct_answer: input.correct_answer },
        { onConflict: "question_id" },
      )
      .select("correct_answer")
      .single();
    if (keyResult.error) {
      await supabase.from("questions").delete().eq("id", question.id);
      await throwIfError(keyResult.error, "保存正确答案失败");
    }
    try {
      await setLiveQuestionAudience(
        question.id,
        input.audience_mode,
        input.target_user_ids,
        input.target_tags,
      );
    } catch (error) {
      await supabase.from("questions").delete().eq("id", question.id);
      throw error;
    }
    return {
      ...normalizeQuestion(question),
      correct_answer: (keyResult.data as { correct_answer: Json } | null)?.correct_answer ?? input.correct_answer,
      target_user_ids: input.audience_mode === "targeted" ? input.target_user_ids : [],
      target_tags: input.audience_mode === "targeted" ? input.target_tags : [],
    };
  }
  throw new Error("题目序号冲突，请重试");
}

export async function updateLiveQuestion(
  questionId: string,
  input: LiveQuestionInput,
): Promise<void> {
  const questionResult = await supabase
    .from("questions")
    .update({
      title: input.title,
      type: input.type,
      content: input.content,
      options: input.options,
    })
    .eq("id", questionId);
  if (questionResult.error) await throwIfError(questionResult.error, "更新题目失败");

  const keyResult = await supabase
    .from("question_keys")
    .upsert(
      { question_id: questionId, correct_answer: input.correct_answer },
      { onConflict: "question_id" },
    );
  if (keyResult.error) await throwIfError(keyResult.error, "更新正确答案失败");

  await setLiveQuestionAudience(
    questionId,
    input.audience_mode,
    input.target_user_ids,
    input.target_tags,
  );
}

export async function copyLiveQuestion(questionId: string): Promise<AdminLiveQuestion | null> {
  const source = (await getAdminLiveQuestionsSnapshot(questionId));
  if (!source) return null;
  return createLiveQuestion(source.live_id, {
    title: `${source.title}（副本）`,
    type: source.type,
    content: source.content,
    options: source.options,
    correct_answer: source.correct_answer,
    audience_mode: source.audience_mode,
    target_user_ids: source.target_user_ids,
    target_tags: source.target_tags,
  });
}

async function getAdminLiveQuestionsSnapshot(questionId: string): Promise<AdminLiveQuestion | null> {
  const { data, error } = await supabase
    .from("questions")
    .select("*, question_keys(correct_answer), live_question_target_users(user_id), live_question_target_tags(tag)")
    .eq("id", questionId)
    .maybeSingle();
  if (error) await throwIfError(error, "读取题目失败");
  return data ? normalizeAdminQuestion(data as unknown as RawAdminQuestion) : null;
}

export async function deleteLiveQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) await throwIfError(error, "删除题目失败");
}

export async function getLiveResponses(questionId: string): Promise<LiveResponse[]> {
  const { data, error } = await supabase
    .from("responses")
    .select("question_id, user_id, answer, answered_at")
    .eq("question_id", questionId)
    .order("answered_at", { ascending: true });
  if (error) await throwIfError(error, "读取实时答案失败");
  return ((data as RawResponse[]) ?? []).map(normalizeResponse);
}

export async function getAdminLiveParticipants(liveId: string): Promise<LiveAdminParticipant[]> {
  const { data, error } = await supabase.rpc("get_live_admin_participants", { p_live_id: liveId });
  if (error) await throwIfError(error, "读取 Live 学员标签失败");
  if (!Array.isArray(data)) throw new Error("Live 学员标签数据格式错误");
  return data.flatMap((participant) => {
    const normalized = normalizeAdminParticipant(participant);
    return normalized ? [normalized] : [];
  });
}

export async function setLiveParticipantTags(
  liveId: string,
  userId: string,
  tags: string[],
): Promise<string[]> {
  const { data, error } = await supabase.rpc("set_live_participant_tags", {
    p_live_id: liveId,
    p_user_id: userId,
    p_tags: tags,
  });
  if (error) await throwIfError(error, "保存学员标签失败");
  return Array.isArray(data) ? data.filter((tag): tag is string => typeof tag === "string") : [];
}

export async function setLiveQuestionAudience(
  questionId: string,
  audienceMode: LiveAudienceMode,
  userIds: string[],
  tags: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_live_question_audience", {
    p_question_id: questionId,
    p_audience_mode: audienceMode,
    p_user_ids: userIds,
    p_tags: tags,
  });
  if (error) await throwIfError(error, "保存题目发送对象失败");
}

export async function getAdminLiveSessionDashboard(
  session: LiveSession,
): Promise<AdminLiveSessionDashboard> {
  const [questions, participants] = await Promise.all([
    getAdminLiveQuestions(session.id),
    getAdminLiveParticipants(session.id),
  ]);

  const questionIds = questions.map((question) => question.id);
  let responses: LiveResponse[] = [];
  if (questionIds.length > 0) {
    const { data, error } = await supabase
      .from("responses")
      .select("question_id, user_id, answer, answered_at")
      .in("question_id", questionIds)
      .order("answered_at", { ascending: true });
    if (error) await throwIfError(error, "读取 Live 看板答题数据失败");
    responses = ((data as RawResponse[]) ?? []).map(normalizeResponse);
  }

  return buildAdminLiveSessionDashboard(
    session,
    questions,
    responses,
    participants,
  );
}

export async function recordLiveParticipant(liveId: string): Promise<void> {
  const { error } = await supabase.rpc("record_live_participant", { p_live_id: liveId });
  if (error) await throwIfError(error, "记录 Live 进入状态失败");
}

export async function getLiveRoomAudienceSummary(
  liveId: string,
): Promise<LiveRoomAudienceSummary> {
  const { data, error } = await supabase.rpc("get_live_room_audience_summary", {
    p_live_id: liveId,
  });
  if (error) await throwIfError(error, "读取 Live 房间数据失败");
  if (typeof data !== "object" || data === null) throw new Error("Live 房间数据格式错误");
  const value = data as {
    live_id?: unknown;
    current_question_id?: unknown;
    joined_count?: unknown;
    targeted_count?: unknown;
    answered_count?: unknown;
  };
  if (
    typeof value.live_id !== "string"
    || (value.current_question_id !== null && typeof value.current_question_id !== "string")
    || typeof value.joined_count !== "number"
    || typeof value.targeted_count !== "number"
    || typeof value.answered_count !== "number"
  ) throw new Error("Live 房间数据格式错误");
  return {
    liveId: value.live_id,
    currentQuestionId: value.current_question_id ?? null,
    joinedCount: value.joined_count,
    targetedCount: value.targeted_count,
    answeredCount: value.answered_count,
  };
}

export async function getLiveParticipantResults(
  questionId: string,
): Promise<LiveParticipantResults | null> {
  const { data, error } = await supabase.rpc("get_live_participant_results", {
    p_question_id: questionId,
  });
  if (error) await throwIfError(error, "读取匿名答题统计失败");
  return normalizeParticipantResults(data);
}

export async function getLiveParticipantSnapshot(
  roomCode: string,
  userId: string,
): Promise<LiveParticipantSnapshot | null> {
  const sessionResult = await supabase
    .from("live_sessions")
    .select("*")
    .eq("room_code", roomCode)
    .eq("status", "live")
    .maybeSingle();
  if (sessionResult.error) await throwIfError(sessionResult.error, "进入互动课堂失败");
  const session = sessionResult.data as LiveSession | null;
  if (!session) return null;

  if (!session.current_question_id) {
    return { session, question: null, response: null, correctAnswer: null, results: null };
  }

  const [questionResult, responseResult] = await Promise.all([
    supabase
      .from("questions")
      .select("*")
      .eq("id", session.current_question_id)
      .maybeSingle(),
    supabase
      .from("responses")
      .select("question_id, user_id, answer, answered_at")
      .eq("question_id", session.current_question_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (questionResult.error) await throwIfError(questionResult.error, "读取当前题目失败");
  if (responseResult.error) await throwIfError(responseResult.error, "读取我的答案失败");

  const question = questionResult.data ? normalizeQuestion(questionResult.data as RawQuestion) : null;
  const response = responseResult.data ? normalizeResponse(responseResult.data as RawResponse) : null;
  let correctAnswer: Json | null = null;
  if (session.question_state === "revealed") {
    const keyResult = await supabase
      .from("question_keys")
      .select("correct_answer")
      .eq("question_id", session.current_question_id)
      .maybeSingle();
    if (keyResult.error) await throwIfError(keyResult.error, "读取正确答案失败");
    correctAnswer = (keyResult.data as { correct_answer: Json } | null)?.correct_answer ?? null;
  }

  const results = question && response
    ? await getLiveParticipantResults(session.current_question_id)
    : null;

  return { session, question, response, correctAnswer, results };
}

export async function submitLiveAnswer(
  questionId: string,
  userId: string,
  answer: LiveAnswer,
): Promise<LiveResponse> {
  const { data, error } = await supabase
    .from("responses")
    .upsert(
      {
        question_id: questionId,
        user_id: userId,
        answer,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "question_id,user_id" },
    )
    .select("question_id, user_id, answer, answered_at")
    .single();
  if (error) await throwIfError(error, "提交答案失败，请确认当前题目仍在作答中");
  return normalizeResponse(data as RawResponse);
}

export function getLiveStatusFallback(status: LiveSession["status"]): string {
  return LIVE_STATUS_LABELS[status];
}
