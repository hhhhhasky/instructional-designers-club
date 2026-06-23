import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CourseQuestionsPanel from "@/components/course/CourseQuestionsPanel";
import {
  createCourseQuestion,
  createCourseQuestionReply,
  getCourseQuestions,
  getCourseQuestionTags,
} from "@/db/course-questions";
import type { Course, CourseQuestionWithDetails } from "@/types/types";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/db/course-questions", () => ({
  getCourseQuestions: vi.fn(),
  getCourseQuestionTags: vi.fn(),
  createCourseQuestion: vi.fn(),
  createCourseQuestionReply: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const course: Course = {
  id: "course-1",
  title: "测试课程",
  description: "课程描述",
  instructor: "哈老师",
  category_id: null,
  category: "教学目标篇",
  level: "入门",
  duration: 60,
  credits: "1",
  status: "published",
  membership_type: "plus",
  is_trial: false,
  image_url: null,
  video_url: null,
  audio_url: null,
  body: null,
  essence: null,
  images: null,
  plus_lesson_order: null,
  plus_representative: false,
  meeting_url: null,
  sort_order: 1,
  view_count: 0,
  created_at: null,
  updated_at: null,
};

const question: CourseQuestionWithDetails = {
  id: "question-1",
  course_id: "course-1",
  author_id: "author-1",
  body: "如何把教学目标写得更可评价？",
  is_anonymous: true,
  status: "visible",
  created_at: "2026-06-23T08:00:00.000Z",
  updated_at: "2026-06-23T08:00:00.000Z",
  author_display_name: "匿名",
  tags: [
    {
      id: "tag-1",
      slug: "course-category-1",
      name: "教学目标篇",
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
      body: "可以先写出可观察的学生表现。",
      is_anonymous: false,
      status: "visible",
      created_at: "2026-06-23T08:05:00.000Z",
      updated_at: "2026-06-23T08:05:00.000Z",
      author_display_name: "王老师",
    },
  ],
};

describe("CourseQuestionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseQuestionTags).mockResolvedValue(question.tags);
    vi.mocked(getCourseQuestions).mockResolvedValue([question]);
    vi.mocked(createCourseQuestion).mockResolvedValue({
      id: "question-2",
      course_id: "course-1",
      author_id: "user-1",
      body: "新问题",
      is_anonymous: true,
      status: "visible",
      created_at: "2026-06-23T09:00:00.000Z",
      updated_at: "2026-06-23T09:00:00.000Z",
    });
    vi.mocked(createCourseQuestionReply).mockResolvedValue({
      id: "reply-2",
      question_id: "question-1",
      author_id: "user-1",
      body: "新回复",
      is_anonymous: false,
      status: "visible",
      created_at: "2026-06-23T09:00:00.000Z",
      updated_at: "2026-06-23T09:00:00.000Z",
    });
  });

  it("loads and displays course questions with anonymous author and preset tag", async () => {
    render(<CourseQuestionsPanel course={course} />);

    expect(await screen.findByText("如何把教学目标写得更可评价？")).toBeInTheDocument();
    expect(screen.getAllByText("匿名").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("教学目标篇").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 条回复")).toBeInTheDocument();
  });

  it("submits an anonymous plain-text question with the course tag", async () => {
    const user = userEvent.setup();
    render(<CourseQuestionsPanel course={course} />);
    await screen.findByText("如何把教学目标写得更可评价？");

    await user.type(screen.getByPlaceholderText("写下你对这节课的疑问、实践卡点或想继续讨论的问题..."), "我该怎么拆评价标准？");
    await user.click(screen.getByLabelText("匿名提问"));
    await user.click(screen.getByRole("button", { name: /发布问题/ }));

    await waitFor(() => {
      expect(createCourseQuestion).toHaveBeenCalledWith({
        courseId: "course-1",
        authorId: "user-1",
        body: "我该怎么拆评价标准？",
        isAnonymous: true,
        tagIds: ["tag-1"],
      });
    });
  });

  it("expands a question and submits a reply", async () => {
    const user = userEvent.setup();
    render(<CourseQuestionsPanel course={course} />);

    await user.click(await screen.findByText("如何把教学目标写得更可评价？"));
    expect(screen.getByText("可以先写出可观察的学生表现。")).toBeInTheDocument();

    const item = screen.getByText("可以先写出可观察的学生表现。").closest("[data-slot='accordion-content']") ?? document.body;
    await user.type(within(item as HTMLElement).getByPlaceholderText("回复这个问题..."), "我会试着改一版。");
    await user.click(within(item as HTMLElement).getByRole("button", { name: /回复/ }));

    await waitFor(() => {
      expect(createCourseQuestionReply).toHaveBeenCalledWith({
        questionId: "question-1",
        authorId: "user-1",
        body: "我会试着改一版。",
        isAnonymous: false,
      });
    });
  });
});
