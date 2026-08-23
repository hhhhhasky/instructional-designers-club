import { describe, expect, it } from "vitest";
import { buildV2AssessmentLayout } from "@/lib/v2-assessment-layout";
import type { V2DictionaryItem, V2LessonBundle } from "@/db/v2-api";

function dictionary(id: string, key: string, label: string): V2DictionaryItem {
  return { id, group_id: "assessment", key, label, description: null, metadata: {}, sort_order: 0, is_active: true };
}

function assessment(id: string, typeId: string | null): V2LessonBundle["assessments"][number] {
  return {
    id,
    lesson_id: "lesson-1",
    unit_id: null,
    assessment_type_id: typeId,
    title: id,
    instructions_markdown: null,
    required: true,
    estimated_minutes: 5,
    sort_order: 0,
    status: "published",
    items: [],
  };
}

describe("V2 lesson assessment layout", () => {
  it("places pretests before content and orders post-learning groups by type", () => {
    const dictionaries = [
      dictionary("pre", "pretest", "入门诊断"),
      dictionary("practice", "practice", "随堂练习"),
      dictionary("post", "posttest", "达标检测"),
      dictionary("task", "authentic_task", "真实任务"),
    ];
    const layout = buildV2AssessmentLayout([
      assessment("task-block", "task"),
      assessment("post-block", "post"),
      assessment("pre-block", "pre"),
      assessment("practice-block", "practice"),
    ], dictionaries);

    expect(layout.beforeContent.map((group) => group.label)).toEqual(["入门诊断"]);
    expect(layout.afterContent.map((group) => group.label)).toEqual(["随堂练习"]);
    expect(layout.afterLearning.map((group) => group.label)).toEqual(["达标检测", "真实任务"]);
  });

  it("uses the dictionary label and keeps untyped assessments after learning", () => {
    const layout = buildV2AssessmentLayout(
      [assessment("custom", "custom-type"), assessment("untyped", null)],
      [dictionary("custom-type", "reflection", "学习反思")],
    );

    expect(layout.afterLearning.map((group) => group.label)).toEqual(["学习反思", "评估任务"]);
  });
});
