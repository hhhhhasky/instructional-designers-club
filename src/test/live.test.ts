import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getLiveParticipantResults, getLiveRoomAudienceSummary, recordLiveParticipant, submitLiveAnswer } from "@/db/live-api";
import { supabase } from "@/db/supabase";
import {
  extractLiveEvent,
  formatLiveAudience,
  getLiveControlCapabilities,
  isCorrectLiveAnswer,
  isLiveQuestionEditable,
  liveQuestionTargetsParticipant,
  nextLiveQuestionId,
  summarizeLiveResults,
  type AdminLiveQuestion,
  type LiveQuestion,
  type LiveQuestionOption,
} from "@/lib/live";
import { buildAdminLiveSessionDashboard } from "@/lib/live-dashboard";

vi.mock("@/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const options: LiveQuestionOption[] = [
  { id: "A", text: "知识目标" },
  { id: "B", text: "学习活动" },
  { id: "C", text: "学习结果" },
  { id: "D", text: "评价证据" },
];

function question(type: LiveQuestion["type"]): Pick<LiveQuestion, "type" | "options"> {
  return type === "true_false" ? { type, options: [] } : { type, options };
}

describe("Live V1 state machine", () => {
  it("only allows the control actions defined for each state", () => {
    expect(getLiveControlCapabilities({ status: "live", question_state: "waiting" }))
      .toEqual({ publish: true, close: false, reveal: false, next: false });
    expect(getLiveControlCapabilities({ status: "live", question_state: "answering" }))
      .toEqual({ publish: false, close: true, reveal: false, next: false });
    expect(getLiveControlCapabilities({ status: "live", question_state: "closed" }))
      .toEqual({ publish: false, close: false, reveal: true, next: true });
    expect(getLiveControlCapabilities({ status: "live", question_state: "revealed" }))
      .toEqual({ publish: false, close: false, reveal: false, next: true });
    expect(getLiveControlCapabilities({ status: "ended", question_state: "revealed" }))
      .toEqual({ publish: false, close: false, reveal: false, next: false });
  });

  it("locks a question after it becomes the active interaction question", () => {
    const base = { current_question_id: "q1" } as const;
    expect(isLiveQuestionEditable({ ...base, status: "live", question_state: "waiting" }, "q1")).toBe(true);
    expect(isLiveQuestionEditable({ ...base, status: "live", question_state: "answering" }, "q1")).toBe(false);
    expect(isLiveQuestionEditable({ ...base, status: "live", question_state: "closed" }, "q1")).toBe(false);
    expect(isLiveQuestionEditable({ ...base, status: "ended", question_state: "revealed" }, "q1")).toBe(false);
  });

  it("selects the next question by position", () => {
    const questions = [
      { id: "q1", position: 1 },
      { id: "q2", position: 2 },
      { id: "q3", position: 3 },
    ];
    expect(nextLiveQuestionId(questions, null)).toBe("q1");
    expect(nextLiveQuestionId(questions, "q2")).toBe("q3");
    expect(nextLiveQuestionId(questions, "q3")).toBeNull();
  });
});

describe("Live V1 response statistics", () => {
  it("counts option distribution and exact-answer correctness", () => {
    const result = summarizeLiveResults(
      question("single_choice"),
      "B",
      [
        { answer: "B" },
        { answer: "C" },
        { answer: "B" },
      ],
    );
    expect(result.answeredCount).toBe(3);
    expect(result.options.map((item) => [item.id, item.count, item.percentage])).toEqual([
      ["A", 0, 0],
      ["B", 2, 66.7],
      ["C", 1, 33.3],
      ["D", 0, 0],
    ]);
    expect(result.correctCount).toBe(2);
    expect(result.correctRate).toBe(66.7);
  });

  it("treats multiple-choice answers as correct only when the full set matches", () => {
    expect(isCorrectLiveAnswer(question("multiple_choice"), ["C", "A"], ["A", "C"])).toBe(true);
    expect(isCorrectLiveAnswer(question("multiple_choice"), ["A"], ["A", "C"])).toBe(false);

    const result = summarizeLiveResults(
      question("multiple_choice"),
      ["A", "C"],
      [{ answer: ["C", "A"] }, { answer: ["A"] }],
    );
    expect(result.options.find((item) => item.id === "A")?.count).toBe(2);
    expect(result.options.find((item) => item.id === "C")?.count).toBe(1);
    expect(result.correctCount).toBe(1);
    expect(result.correctRate).toBe(50);
  });
});

describe("Live large dashboard aggregation", () => {
  it("reconciles room reach, unique respondents, question participation, and option totals", () => {
    const session = {
      id: "live-1",
      room_code: "123456",
      title: "公开课互动",
      status: "ended",
      current_question_id: "q2",
      question_state: "revealed",
    } as const;
    const questions: AdminLiveQuestion[] = [
      {
        id: "q1", live_id: "live-1", position: 1, title: "目标题", type: "single_choice",
        content: "请选择", options, correct_answer: "B", audience_mode: "all",
        target_user_ids: [], target_tags: [],
      },
      {
        id: "q2", live_id: "live-1", position: 2, title: "判断题", type: "true_false",
        content: "请判断", options: [], correct_answer: true, audience_mode: "targeted",
        target_user_ids: [], target_tags: ["进度较快"],
      },
    ];
    const responses = [
      { question_id: "q1", user_id: "u1", answer: "B", answered_at: "2026-08-24T08:00:00Z" },
      { question_id: "q1", user_id: "u2", answer: "A", answered_at: "2026-08-24T08:00:01Z" },
      { question_id: "q2", user_id: "u1", answer: true, answered_at: "2026-08-24T08:01:00Z" },
    ];

    const participants = [
      { user_id: "u1", nickname: "甲", joined_at: "2026-08-24T07:59:00Z", last_seen_at: "2026-08-24T08:01:00Z", tags: ["进度较快"] },
      { user_id: "u2", nickname: "乙", joined_at: "2026-08-24T07:59:00Z", last_seen_at: "2026-08-24T08:01:00Z", tags: ["进度较慢"] },
      { user_id: "u3", nickname: "丙", joined_at: "2026-08-24T07:59:00Z", last_seen_at: "2026-08-24T08:01:00Z", tags: ["进度较快"] },
      { user_id: "u4", nickname: "丁", joined_at: "2026-08-24T07:59:00Z", last_seen_at: "2026-08-24T08:01:00Z", tags: [] },
    ];

    const result = buildAdminLiveSessionDashboard(session, questions, responses, participants);
    expect(result).toMatchObject({
      participantCount: 4,
      answeredParticipantCount: 2,
      totalResponses: 3,
      questionCount: 2,
      overallParticipationRate: 50,
    });
    expect(result.questions.map((item) => [item.targetParticipantCount, item.answeredCount, item.responseRate, item.correctRate]))
      .toEqual([[4, 2, 50, 50], [2, 1, 50, 100]]);
  });

  it("matches a targeted question by explicit user or any participant tag", () => {
    const targeted = {
      audience_mode: "targeted" as const,
      target_user_ids: ["u1"],
      target_tags: ["进度较快"],
    };
    expect(liveQuestionTargetsParticipant(targeted, { user_id: "u1", tags: [] })).toBe(true);
    expect(liveQuestionTargetsParticipant(targeted, { user_id: "u2", tags: ["进度较快"] })).toBe(true);
    expect(liveQuestionTargetsParticipant(targeted, { user_id: "u3", tags: ["进度较慢"] })).toBe(false);
    expect(formatLiveAudience(targeted)).toBe("定向 · 1 个标签 + 1 位学员");
  });
});

describe("Live V1 realtime recovery and persistence", () => {
  it("extracts nested and flat event payloads for database-first refresh", () => {
    expect(extractLiveEvent({
      event: "question_opened",
      payload: { question_id: "q1" },
    })).toEqual({ event: "question_opened", questionId: "q1" });
    expect(extractLiveEvent({ event: "session_ended", live_id: "live-1" }))
      .toEqual({ event: "session_ended", liveId: "live-1" });
  });

  it("upserts one current response per user and question", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            question_id: "q1",
            user_id: "user-1",
            answer: "B",
            answered_at: "2026-08-20T07:00:00Z",
          },
          error: null,
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await expect(submitLiveAnswer("q1", "user-1", "B")).resolves.toMatchObject({
      question_id: "q1",
      user_id: "user-1",
      answer: "B",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_id: "q1",
        user_id: "user-1",
        answer: "B",
      }),
      { onConflict: "question_id,user_id" },
    );
  });

  it("reads participant results only through the anonymous aggregate RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        question_id: "q1",
        answered_count: 3,
        options: [
          { id: "A", label: "知识目标", count: 1, percentage: 33.3 },
          { id: "B", label: "学习活动", count: 2, percentage: 66.7 },
        ],
      },
      error: null,
    } as never);

    await expect(getLiveParticipantResults("q1")).resolves.toEqual({
      questionId: "q1",
      answeredCount: 3,
      options: [
        { id: "A", label: "知识目标", count: 1, percentage: 33.3 },
        { id: "B", label: "学习活动", count: 2, percentage: 66.7 },
      ],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("get_live_participant_results", {
      p_question_id: "q1",
    });
  });

  it("records room entry and reads only the learner-safe room summary", async () => {
    vi.mocked(supabase.rpc).mockClear();
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: null } as never)
      .mockResolvedValueOnce({
        data: {
          live_id: "live-1",
          current_question_id: "q1",
          joined_count: 12,
          targeted_count: 8,
          answered_count: 8,
        },
        error: null,
      } as never);

    await expect(recordLiveParticipant("live-1")).resolves.toBeUndefined();
    await expect(getLiveRoomAudienceSummary("live-1")).resolves.toEqual({
      liveId: "live-1",
      currentQuestionId: "q1",
      joinedCount: 12,
      targetedCount: 8,
      answeredCount: 8,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "record_live_participant", { p_live_id: "live-1" });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "get_live_room_audience_summary", { p_live_id: "live-1" });
  });
});

describe("Live V1 database boundary", () => {
  it("keeps the migration to four business tables and the required privacy boundaries", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260820150000_live_interactions_v1.sql"),
      "utf8",
    );
    for (const table of ["live_sessions", "questions", "question_keys", "responses"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
    for (const forbidden of [
      "is_temporary",
      "response_history",
      "question_versions",
      "live_events",
      "live_participants",
      "question_stats",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
    expect(sql).toContain("participants read revealed key");
    expect(sql).toContain("participants insert own responses");
    expect(sql).toContain("live participants listen realtime");
    expect(sql).toContain("jsonb_build_object('question_id', new.question_id)");
  });

  it("exposes only aggregate results to participants after their own submission", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260824075313_live_participant_anonymous_results.sql"),
      "utf8",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("response.user_id = v_user_id");
    expect(sql).toContain("live.current_question_id = question.id");
    expect(sql).toContain("revoke all on function public.get_live_participant_results(uuid) from public");
    expect(sql).toContain("grant execute on function public.get_live_participant_results(uuid) to authenticated");
    expect(sql).toContain("'answered_count', v_answered_count");
    expect(sql).toContain("'options', v_options");
    expect(sql).not.toContain("jsonb_build_object('user_id'");
    expect(sql).not.toContain("jsonb_build_object('answer'");
  });

  it("tracks one participant per room while keeping learner access aggregate-only", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260824080503_live_dashboard_participant_tracking.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.live_participants");
    expect(sql).toContain("primary key (live_id, user_id)");
    expect(sql).toContain("alter table public.live_participants enable row level security");
    expect(sql).toContain("revoke all on table public.live_participants from anon, authenticated");
    expect(sql).toContain("live admin read participants");
    expect(sql).toContain("create or replace function public.record_live_participant");
    expect(sql).toContain("create or replace function public.get_live_room_audience_summary");
    expect(sql).toContain("create or replace function public.live_track_response_participant");
    expect(sql).toContain("create trigger live_response_participant_tracking");
    expect(sql).toContain("after insert or update on public.responses");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("grant execute on function public.get_live_room_audience_summary(uuid) to authenticated");
    expect(sql).not.toContain("grant insert on table public.live_participants to authenticated");
    expect(sql).not.toContain("grant update on table public.live_participants to authenticated");
    expect(sql).not.toContain("'user_id',");
  });

  it("enforces targeted question visibility and keeps tag writes admin-only", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260825021924_live_targeted_audiences.sql"),
      "utf8",
    );
    for (const table of [
      "live_participant_tags",
      "live_question_target_users",
      "live_question_target_tags",
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
    }
    expect(sql).toContain("create or replace function public.live_can_access_question");
    expect(sql).toContain("participants read targeted current question");
    expect(sql).toContain("targeted participants insert own responses");
    expect(sql).toContain("targeted participants update own responses");
    expect(sql).toContain("create or replace function public.set_live_question_audience");
    expect(sql).toContain("create or replace function public.set_live_participant_tags");
    expect(sql).toContain("revoke all on function public.set_live_question_audience(uuid, text, uuid[], text[]) from anon");
    expect(sql).toContain("revoke all on function public.set_live_participant_tags(uuid, uuid, text[]) from anon");
    expect(sql).toContain("'targeted_count', v_targeted_count");
    expect(sql).not.toContain("grant insert on table public.live_participant_tags to authenticated");
    expect(sql).not.toContain("grant update on table public.live_participant_tags to authenticated");
  });
});
