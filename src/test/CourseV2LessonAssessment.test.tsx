import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { V2AssessmentSection } from "@/pages/CourseV2LessonPage";
import type { V2DictionaryItem, V2LessonBundle } from "@/db/v2-api";

const itemType: V2DictionaryItem = {
  id: "single-choice", group_id: "item-types", key: "single_choice", label: "单选题",
  description: null, metadata: {}, sort_order: 10, is_active: true,
};

const assessment: V2LessonBundle["assessments"][number] = {
  id: "assessment-1", lesson_id: "lesson-1", unit_id: null, assessment_type_id: "pretest",
  title: "课前诊断", instructions_markdown: "先凭已有经验作答。", required: true,
  estimated_minutes: 2, sort_order: 10, status: "published",
  items: [{
    id: "item-1", assessment_block_id: "assessment-1", item_type_id: itemType.id,
    grading_mode_id: null, prompt_markdown: "哪项最准确？", case_markdown: null,
    max_score: 4, rubric: null, sort_order: 10, is_required: true,
    options: [
      { id: "a", item_id: "item-1", option_key: "A", option_text: "选项 A", sort_order: 10 },
      { id: "b", item_id: "item-1", option_key: "B", option_text: "选项 B", sort_order: 20 },
    ],
  }],
};

describe("V2 lesson assessment presentation", () => {
  it("uses one container title and renders type plus prompt on one line", () => {
    const { container } = render(
      <V2AssessmentSection
        assessment={assessment}
        dictionaryItems={[itemType]}
        latestAttemptByBlock={new Map()}
        answers={[]}
        reviews={[]}
        answerDrafts={{}}
        setAnswerDrafts={vi.fn()}
        onSubmit={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "课前诊断" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(container.querySelector("section > .rounded-2xl.border.border-bdl.p-5")).toBeNull();
    expect(container.textContent).toContain("单选题：哪项最准确？");
  });
});
