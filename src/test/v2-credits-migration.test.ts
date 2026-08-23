import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260822161928_v2_lesson_credits.sql"),
  "utf8",
);

describe("V2 lesson credits migration", () => {
  it("adds a non-negative decimal credit field", () => {
    expect(sql).toContain("add column if not exists credits numeric(8,1) not null default 0");
    expect(sql).toContain("v2_course_lessons_credits_check check (credits >= 0)");
  });

  it("includes completed V1 courses and V2 lessons in the persisted total", () => {
    expect(sql).toContain("from public.learning_records lr");
    expect(sql).toContain("from public.v2_learning_records vlr");
    expect(sql).toContain("join public.v2_course_lessons l on l.id = vlr.lesson_id");
    expect(sql).toContain("+ coalesce(v_v2_lesson_credits, 0)");
  });

  it("refreshes totals when V2 completion or lesson credits change", () => {
    expect(sql).toContain("refresh_total_credits_from_v2_learning_record_trigger");
    expect(sql).toContain("refresh_total_credits_from_v2_lesson_credit_trigger");
  });
});
