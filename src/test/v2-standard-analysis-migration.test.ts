import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260911031900_seed_standard_analysis_v2_lessons.sql"), "utf8");
const revisionSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260911034945_revise_standard_analysis_narration.sql"), "utf8");
const markdownRevisionSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260911050056_format_standard_analysis_markdown.sql"), "utf8");
const twoLevelSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260912054745_v2_unit_lesson_outline_and_rewritten_standard_analysis.sql"), "utf8");

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

  it("formats every narration with headings, emphasis, and safe underline markers", () => {
    for (let lesson = 1; lesson <= 7; lesson += 1) {
      expect(markdownRevisionSql).toContain(`$lesson_${lesson}$`);
      expect(markdownRevisionSql).toContain(`'9a110000-0000-4000-8001-00000000000${lesson}'`);
    }
    expect(markdownRevisionSql.match(/^### /gm)?.length).toBeGreaterThanOrEqual(7);
    expect(markdownRevisionSql).toContain("**");
    expect(markdownRevisionSql).toContain("++");
  });

  it("migrates the outline to Unit → Lesson and ingests all six rewritten scripts", () => {
    expect(twoLevelSql).toContain("alter table public.v2_course_units drop column if exists module_id");
    expect(twoLevelSql).toContain("drop table if exists public.v2_course_modules");
    expect(twoLevelSql).toContain("p_payload -> 'units'");
    expect(twoLevelSql).not.toContain("p_payload -> 'modules'");
    expect(twoLevelSql).toContain("'课标分析'");
    for (let lesson = 1; lesson <= 6; lesson += 1) {
      expect(twoLevelSql).toContain(`standard-analysis-0${lesson}`);
      expect(twoLevelSql).toContain(`9a110000-0000-4000-8001-00000000000${lesson}`);
    }
    expect(twoLevelSql).toContain("为什么要分析课标？");
    expect(twoLevelSql).toContain("课标是什么：国家规定的课程基本要求");
    expect(twoLevelSql).toContain("核心工具：课标分析报告");
    expect(twoLevelSql).toContain("jsonb_build_object('type_key', 'pretest'");
    expect(twoLevelSql).toContain("jsonb_build_object('type_key', 'posttest'");
  });
});
