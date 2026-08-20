import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { submitLiveAnswer } from "@/db/live-api";
import { supabase } from "@/db/supabase";
import {
  extractLiveEvent,
  getLiveControlCapabilities,
  isCorrectLiveAnswer,
  isLiveQuestionEditable,
  nextLiveQuestionId,
  summarizeLiveResults,
  type LiveQuestion,
  type LiveQuestionOption,
} from "@/lib/live";

vi.mock("@/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
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
});
