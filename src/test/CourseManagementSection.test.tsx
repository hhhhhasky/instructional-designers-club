import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseManagementSection from '@/components/admin/CourseManagementSection';
import { adminUpdateCourse, getAdminCourseList } from '@/db/admin-api';
import { getCourseCategories, getPlusCourseStructure } from '@/db/api';
import type { Course } from '@/types/types';

vi.mock('@/components/admin/MarkdownEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="markdown-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/db/admin-api', () => ({
  adminArchiveCourse: vi.fn(),
  adminCreateCourse: vi.fn(),
  adminUpdateCourse: vi.fn(),
  getAdminCourseList: vi.fn(),
}));

vi.mock('@/db/api', () => ({
  getCourseCategories: vi.fn(),
  getPlusCourseStructure: vi.fn(),
}));

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: 'course-1',
  title: 'Plus 示例课程',
  description: '课程描述',
  instructor: '哈老师',
  category_id: null,
  category: '说课篇',
  level: '入门',
  semester: null,
  duration: 60,
  credits: '1',
  status: 'published',
  membership_type: 'plus',
  is_trial: false,
  image_url: null,
  video_url: null,
  audio_url: null,
  body: null,
  essence: null,
  images: [],
  plus_track_id: 'theory',
  plus_module_id: 'learning-science',
  plus_module_order: 10,
  plus_lesson_order: 1,
  plus_representative: false,
  meeting_url: null,
  sort_order: 1,
  view_count: 0,
  created_at: '2026-06-16T00:00:00Z',
  updated_at: '2026-06-16T00:00:00Z',
  ...overrides,
});

describe('CourseManagementSection', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(getAdminCourseList).mockResolvedValue([makeCourse()]);
    vi.mocked(getCourseCategories).mockResolvedValue(['全部', '说课篇']);
    vi.mocked(getPlusCourseStructure).mockResolvedValue([]);
    vi.mocked(adminUpdateCourse).mockResolvedValue(makeCourse({
      plus_track_id: 'scenarios',
      plus_module_id: 'review-lesson',
    }));
  });

  it('updates plus_track_id and plus_module_id through the admin course form', async () => {
    const user = userEvent.setup();

    render(<CourseManagementSection />);

    await screen.findByText('Plus 示例课程');

    await user.click(screen.getByTitle('编辑'));

    const trackInput = await screen.findByPlaceholderText('scenarios');
    const moduleInput = await screen.findByPlaceholderText('shuoke');

    await user.clear(trackInput);
    await user.type(trackInput, 'scenarios');
    await user.clear(moduleInput);
    await user.type(moduleInput, 'review-lesson');

    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(adminUpdateCourse).toHaveBeenCalledWith(
        'course-1',
        expect.objectContaining({
          plus_track_id: 'scenarios',
          plus_module_id: 'review-lesson',
        })
      );
    });
  });

  it('filters the admin list by Plus track and module', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'theory-course',
        title: '学习科学导论',
        category: '学习科学篇',
        plus_track_id: 'theory',
        plus_module_id: 'learning-science',
        plus_module_order: 10,
        plus_lesson_order: 1,
      }),
      makeCourse({
        id: 'shuoke-course',
        title: '说课篇01：整体结构',
        category: '教学原理篇',
        plus_track_id: 'scenarios',
        plus_module_id: 'shuoke',
        plus_module_order: 20,
        plus_lesson_order: 1,
      }),
      makeCourse({
        id: 'open-class-course',
        title: '公开课任务情境导入',
        category: '任务情境篇',
        plus_track_id: 'scenarios',
        plus_module_id: 'open-class',
        plus_module_order: 30,
        plus_lesson_order: 1,
      }),
      makeCourse({
        id: 'pro-course',
        title: 'AI 工具课',
        membership_type: 'pro',
        category: 'AI工具',
        plus_track_id: null,
        plus_module_id: null,
        plus_module_order: null,
        plus_lesson_order: null,
      }),
    ]);

    render(<CourseManagementSection />);

    await screen.findByText('学习科学导论');
    expect(screen.getByText('说课篇01：整体结构')).toBeInTheDocument();
    expect(screen.getByText('公开课任务情境导入')).toBeInTheDocument();
    expect(screen.getByText('AI 工具课')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('筛选 Plus 篇章'), 'scenarios');

    expect(screen.queryByText('学习科学导论')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 工具课')).not.toBeInTheDocument();
    expect(screen.getByText('说课篇01：整体结构')).toBeInTheDocument();
    expect(screen.getByText('公开课任务情境导入')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('筛选 Plus 模块'), 'shuoke');

    expect(screen.getByText('说课篇01：整体结构')).toBeInTheDocument();
    expect(screen.queryByText('公开课任务情境导入')).not.toBeInTheDocument();
  });

  it('filters the admin list by category, level, and membership type together', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'target-course',
        title: '目标单元课程',
        category: '单元一',
        level: '中级',
        membership_type: 'plus',
        plus_track_id: 'scenarios',
        plus_module_id: 'shuoke',
      }),
      makeCourse({
        id: 'wrong-category',
        title: '其他单元课程',
        category: '单元二',
        level: '中级',
        membership_type: 'plus',
        plus_track_id: 'scenarios',
        plus_module_id: 'shuoke',
      }),
      makeCourse({
        id: 'wrong-level',
        title: '初级同类课程',
        category: '单元一',
        level: '初级',
        membership_type: 'plus',
        plus_track_id: 'scenarios',
        plus_module_id: 'shuoke',
      }),
      makeCourse({
        id: 'wrong-type',
        title: 'Pro 同单元课程',
        category: '单元一',
        level: '中级',
        membership_type: 'pro',
        plus_track_id: null,
        plus_module_id: null,
        plus_module_order: null,
        plus_lesson_order: null,
      }),
    ]);
    vi.mocked(getCourseCategories).mockResolvedValue(['全部', '单元一', '单元二']);

    render(<CourseManagementSection />);

    await screen.findByText('目标单元课程');
    await user.selectOptions(screen.getByLabelText('筛选课程分类'), '单元一');
    await user.selectOptions(screen.getByLabelText('筛选课程等级'), '中级');
    await user.selectOptions(screen.getByLabelText('筛选课程类型'), 'plus');

    expect(screen.getByText('目标单元课程')).toBeInTheDocument();
    expect(screen.queryByText('其他单元课程')).not.toBeInTheDocument();
    expect(screen.queryByText('初级同类课程')).not.toBeInTheDocument();
    expect(screen.queryByText('Pro 同单元课程')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    expect(screen.getByText('其他单元课程')).toBeInTheDocument();
    expect(screen.getByText('初级同类课程')).toBeInTheDocument();
    expect(screen.getByText('Pro 同单元课程')).toBeInTheDocument();
  });

  it('opens the current Plus structure preview from active filters', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'shuoke-course',
        title: '说课篇01：整体结构',
        category: '教学原理篇',
        plus_track_id: 'scenarios',
        plus_module_id: 'shuoke',
        plus_module_order: 20,
      }),
    ]);

    render(<CourseManagementSection />);

    await screen.findByText('说课篇01：整体结构');
    await user.selectOptions(screen.getByLabelText('筛选 Plus 篇章'), 'scenarios');
    await user.selectOptions(screen.getByLabelText('筛选 Plus 模块'), 'shuoke');
    await user.click(screen.getByRole('button', { name: '预览结构' }));

    expect(openSpy).toHaveBeenCalledWith('/courses/plus/scenarios#shuoke', '_blank');
  });

  it('batch updates selected Plus courses to a target module and lesson order', async () => {
    const user = userEvent.setup();
    const courses = [
      makeCourse({
        id: 'course-a',
        title: '待调整课程 A',
        plus_track_id: 'theory',
        plus_module_id: 'learning-science',
        plus_module_order: 10,
        plus_lesson_order: 1,
      }),
      makeCourse({
        id: 'course-b',
        title: '待调整课程 B',
        plus_track_id: 'theory',
        plus_module_id: 'learning-science',
        plus_module_order: 10,
        plus_lesson_order: 2,
      }),
      makeCourse({
        id: 'course-pro',
        title: 'Pro 不可批量调整',
        membership_type: 'pro',
        plus_track_id: null,
        plus_module_id: null,
        plus_module_order: null,
        plus_lesson_order: null,
      }),
    ];
    vi.mocked(getAdminCourseList).mockResolvedValue(courses);
    vi.mocked(adminUpdateCourse).mockImplementation(async (courseId, updates) => ({
      ...courses.find((course) => course.id === courseId)!,
      ...updates,
      updated_at: '2026-06-16T01:00:00Z',
    }));

    render(<CourseManagementSection />);

    await screen.findByText('待调整课程 A');
    await user.click(screen.getByLabelText('选择 待调整课程 A'));
    await user.click(screen.getByLabelText('选择 待调整课程 B'));
    expect(screen.getByLabelText('选择 Pro 不可批量调整')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('批量目标篇章'), 'scenarios');
    await user.selectOptions(screen.getByLabelText('批量目标模块'), 'open-class');
    await user.clear(screen.getByLabelText('批量模块排序'));
    await user.type(screen.getByLabelText('批量模块排序'), '30');
    await user.clear(screen.getByLabelText('批量单课起始序号'));
    await user.type(screen.getByLabelText('批量单课起始序号'), '5');
    await user.click(screen.getByRole('button', { name: '批量保存' }));

    await waitFor(() => {
      expect(adminUpdateCourse).toHaveBeenCalledTimes(2);
    });
    expect(adminUpdateCourse).toHaveBeenNthCalledWith(1, 'course-a', expect.objectContaining({
      plus_track_id: 'scenarios',
      plus_module_id: 'open-class',
      plus_module_order: 30,
      plus_lesson_order: 5,
    }));
    expect(adminUpdateCourse).toHaveBeenNthCalledWith(2, 'course-b', expect.objectContaining({
      plus_track_id: 'scenarios',
      plus_module_id: 'open-class',
      plus_module_order: 30,
      plus_lesson_order: 6,
    }));
  });
});
