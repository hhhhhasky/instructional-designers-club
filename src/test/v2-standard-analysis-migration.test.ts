import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260911031900_seed_standard_analysis_v2_lessons.sql"), "utf8");
const revisionSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260911034945_revise_standard_analysis_narration.sql"), "utf8");

describe("standard analysis V2 seed migration", () => {
  it("seeds the seven published lessons and their learning components", () => {
    for (let lesson = 1; lesson <= 7; lesson += 1) {
      expect(sql).toContain(`'standard-analysis-0${lesson}'`);
      expect(sql).toContain(`'9a110000-0000-4000-8101-00000000000${lesson}'`);
      expect(sql).toContain(`'9a110000-0000-4000-8102-00000000000${lesson}'`);
    }
    expect(sql).toContain("'published'");
    expect(sql).toContain('"component":"subject_example_explorer"');
    expect(sql).toContain('"id":"math"');
    expect(sql).toContain('"id":"chinese"');
    expect(sql).toContain('"id":"english"');
  });

  it("revises every lesson with continuous learner-facing narration", () => {
    for (let lesson = 1; lesson <= 7; lesson += 1) {
      expect(revisionSql).toContain(`$l${lesson}$`);
      expect(revisionSql).toContain(`'9a110000-0000-4000-8001-00000000000${lesson}'`);
    }
    expect(revisionSql).toContain("你有没有遇到过这样的备课时刻");
    expect(revisionSql).toContain("请跟着我走一遍备课时真正有用的思考过程");
    expect(revisionSql).not.toContain("### 专家思考");
  });
});
