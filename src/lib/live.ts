import type { Json } from "@/types/database.generated";

export type LiveStatus = "draft" | "live" | "ended";
export type LiveQuestionState = "waiting" | "answering" | "closed" | "revealed";
export type LiveQuestionType = "single_choice" | "multiple_choice" | "true_false";
export type LiveAnswer = string | boolean | string[];

export interface LiveSession {
  id: string;
  room_code: string | null;
  title: string;
  status: LiveStatus;
  current_question_id: string | null;
  question_state: LiveQuestionState;
}

export interface LiveQuestionOption {
  id: string;
  text: string;
}

export interface LiveQuestion {
  id: string;
  live_id: string;
  position: number;
  title: string;
  type: LiveQuestionType;
  content: string;
  options: LiveQuestionOption[];
}

export interface AdminLiveQuestion extends LiveQuestion {
  correct_answer: Json;
}

export interface LiveResponse {
  question_id: string;
  user_id: string;
  answer: Json;
  answered_at: string;
}

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  draft: "草稿",
  live: "进行中",
  ended: "已结束",
};

export const LIVE_QUESTION_STATE_LABELS: Record<LiveQuestionState, string> = {
  waiting: "等待发布",
  answering: "作答中",
  closed: "已停止作答",
  revealed: "已公布答案",
};

export const LIVE_QUESTION_TYPE_LABELS: Record<LiveQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
};

export function getLiveTopic(liveId: string): string {
  return `live:${liveId}`;
}

export function parseLiveAnswer(value: Json): LiveAnswer | null {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (
    Array.isArray(value)
    && value.length > 0
    && value.every((item): item is string => typeof item === "string")
  ) {
    return value;
  }
  return null;
}

export function isValidLiveAnswer(
  question: Pick<LiveQuestion, "type" | "options">,
  answer: LiveAnswer | null,
): boolean {
  if (answer === null) return false;
  if (question.type === "true_false") return typeof answer === "boolean";
  if (question.type === "single_choice") {
    return typeof answer === "string" && question.options.some((option) => option.id === answer);
  }
  if (!Array.isArray(answer) || answer.length === 0) return false;
  const unique = new Set(answer);
  return unique.size === answer.length
    && answer.every((id) => question.options.some((option) => option.id === id));
}

function canonicalAnswer(answer: LiveAnswer): string {
  return Array.isArray(answer) ? [...answer].sort().join("|") : String(answer);
}

export function liveAnswersEqual(left: LiveAnswer | null, right: LiveAnswer | null): boolean {
  if (left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  return canonicalAnswer(left) === canonicalAnswer(right);
}

export function isCorrectLiveAnswer(
  question: Pick<LiveQuestion, "type" | "options">,
  answer: Json,
  correctAnswer: Json,
): boolean {
  const parsedAnswer = parseLiveAnswer(answer);
  const parsedCorrect = parseLiveAnswer(correctAnswer);
  return isValidLiveAnswer(question, parsedAnswer) && liveAnswersEqual(parsedAnswer, parsedCorrect);
}

export interface LiveResultOption {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface LiveParticipantResults {
  questionId: string;
  answeredCount: number;
  options: LiveResultOption[];
}

export interface LiveResultsSummary {
  answeredCount: number;
  options: LiveResultOption[];
  correctCount: number;
  correctRate: number;
}

export function summarizeLiveResults(
  question: Pick<LiveQuestion, "type" | "options">,
  correctAnswer: Json,
  responses: Pick<LiveResponse, "answer">[],
): LiveResultsSummary {
  const optionLabels = question.type === "true_false"
    ? [
      { id: "true", label: "正确" },
      { id: "false", label: "错误" },
    ]
    : question.options.map((option) => ({ id: option.id, label: option.text || option.id }));
  const counts = new Map(optionLabels.map((option) => [option.id, 0]));
  let correctCount = 0;

  for (const response of responses) {
    const answer = parseLiveAnswer(response.answer);
    if (!isValidLiveAnswer(question, answer)) continue;
    if (isCorrectLiveAnswer(question, response.answer, correctAnswer)) correctCount++;

    const selected = Array.isArray(answer) ? answer : [String(answer)];
    for (const id of selected) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const answeredCount = responses.length;
  return {
    answeredCount,
    options: optionLabels.map((option) => ({
      ...option,
      count: counts.get(option.id) ?? 0,
      percentage: answeredCount === 0 ? 0 : Math.round(((counts.get(option.id) ?? 0) / answeredCount) * 1000) / 10,
    })),
    correctCount,
    correctRate: answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 1000) / 10,
  };
}

export function isLiveQuestionEditable(
  session: Pick<LiveSession, "status" | "current_question_id" | "question_state">,
  questionId: string,
): boolean {
  if (session.status === "ended") return false;
  return !(session.current_question_id === questionId && session.question_state !== "waiting");
}

export function nextLiveQuestionId(
  questions: Pick<LiveQuestion, "id" | "position">[],
  currentQuestionId: string | null,
): string | null {
  if (questions.length === 0) return null;
  if (!currentQuestionId) return questions[0].id;
  const index = questions.findIndex((question) => question.id === currentQuestionId);
  if (index === -1) return questions[0].id;
  return questions[index + 1]?.id ?? null;
}

export interface LiveControlCapabilities {
  publish: boolean;
  close: boolean;
  reveal: boolean;
  next: boolean;
}

export function getLiveControlCapabilities(
  session: Pick<LiveSession, "status" | "question_state">,
): LiveControlCapabilities {
  if (session.status !== "live") {
    return { publish: false, close: false, reveal: false, next: false };
  }
  switch (session.question_state) {
    case "waiting":
      return { publish: true, close: false, reveal: false, next: false };
    case "answering":
      return { publish: false, close: true, reveal: false, next: false };
    case "closed":
      return { publish: false, close: false, reveal: true, next: true };
    case "revealed":
      return { publish: false, close: false, reveal: false, next: true };
  }
}

export function extractLiveEvent(payload: unknown): { event: string; questionId?: string; liveId?: string } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as { event?: unknown; payload?: unknown; question_id?: unknown; live_id?: unknown };
  const nested = typeof record.payload === "object" && record.payload !== null
    ? record.payload as { question_id?: unknown; live_id?: unknown }
    : {};
  const event = typeof record.event === "string" ? record.event : null;
  if (!event) return null;
  return {
    event,
    questionId: typeof nested.question_id === "string"
      ? nested.question_id
      : typeof record.question_id === "string" ? record.question_id : undefined,
    liveId: typeof nested.live_id === "string"
      ? nested.live_id
      : typeof record.live_id === "string" ? record.live_id : undefined,
  };
}

export function formatLiveAnswer(answer: Json): string {
  if (typeof answer === "boolean") return answer ? "正确" : "错误";
  if (Array.isArray(answer)) return answer.map((item) => formatLiveAnswer(item)).join(" / ");
  return String(answer);
}
