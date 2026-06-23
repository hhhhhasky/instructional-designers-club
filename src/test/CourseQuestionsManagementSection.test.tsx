import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CourseQuestionsManagementSection from "@/components/admin/CourseQuestionsManagementSection";
import {
  getAdminCourseQuestions,
  updateCourseQuestionReplyStatus,
  updateCourseQuestionStatus,
} from "@/db/course-questions";
import type { AdminCourseQuestionItem } from "@/types/types";

vi.mock("@/db/course-questions", () => ({
  getAdminCourseQuestions: vi.fn(),
  updateCourseQuestionStatus: vi.fn(),
  updateCourseQuestionReplyStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const adminQuestion: AdminCourseQuestionItem = {
  id: "question-1",
  course_id: "course-1",
  author_id: "author-1",
  body: "课堂讨论问题如何设计？",
  is_anonymous: false,
  status: "visible",
  created_at: "2026-06-23T08:00:00.000Z",
  updated_at: "2026-06-23T08:00:00.000Z",
  course_title: "讨论设计课",
  course_category: "日常课篇",
  course_membership_type: "plus",
  tags: [
    {
      id: "tag-1",
      slug: "course-category-1",
      name: "日常课篇",
      tag_type: "course_system",
      sort_order: 1,
      is_active: true,
    },
  ],
  replies: [
    {
      id: "reply-1",
      question_id: "question-1",
      author_id: "author-2",
      body: "可以从学生错误概念切入。",
      is_anonymous: true,
      status: "visible",
      created_at: "2026-06-23T08:10:00.000Z",
      updated_at: "2026-06-23T08:10:00.000Z",
    },
  ],
};

describe("CourseQuestionsManagementSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminCourseQuestions).mockResolvedValue([adminQuestion]);
    vi.mocked(updateCourseQuestionStatus).mockResolvedValue();
    vi.mocked(updateCourseQuestionReplyStatus).mockResolvedValue();
  });

  it("loads admin questions and hides a question", async () => {
    const user = userEvent.setup();
    render(<CourseQuestionsManagementSection />);

    expect(await screen.findByText("讨论设计课")).toBeInTheDocument();
    expect(screen.getByText("课堂讨论问题如何设计？")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "隐藏" })[0]);

    await waitFor(() => {
      expect(updateCourseQuestionStatus).toHaveBeenCalledWith("question-1", "hidden");
    });
    await waitFor(() => {
      expect(screen.getAllByText("已隐藏").length).toBeGreaterThanOrEqual(2);
    });
  });
});
