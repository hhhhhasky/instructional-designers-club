import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseManagementSection from '@/components/admin/CourseManagementSection';
import {
  adminCreateCourse,
  adminCreateCourseCategory,
  adminDeleteCourseAttachment,
  adminUpdateCourse,
  adminUpdateCourseCategory,
  getAdminCourseAttachments,
  getAdminCourseCategories,
  getAdminCourseList,
} from '@/db/admin-api';
import { getPlusCourseStructure } from '@/db/api';
import { uploadCourseFile } from '@/db/course-media';
import type { PlusTrackConfig } from '@/lib/plusCourseStructure';
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
  adminCreateCourseCategory: vi.fn(),
  adminDeleteCourseAttachment: vi.fn(),
  adminUpdateCourse: vi.fn(),
  adminUpdateCourseCategory: vi.fn(),
  getAdminCourseAttachments: vi.fn(),
  getAdminCourseCategories: vi.fn(),
  getAdminCourseList: vi.fn(),
}));

vi.mock('@/db/api', () => ({
  getPlusCourseStructure: vi.fn(),
}));

vi.mock('@/db/course-media', () => ({
  uploadCourseFile: vi.fn(),
}));

const testTracks: PlusTrackConfig[] = [
  {
    id: 'theory',
    title: '理论篇',
    shortTitle: '理论篇',
    subtitle: '',
    description: '',
    audience: '',
    icon: BookOpen,
    accent: 'from-[#2a7a6e] to-[#c45d3e]',
    modules: [
      {
        id: '学习科学篇',
        title: '学习科学篇',
        description: '',
        order: 1,
        categoryNames: ['学习科学篇'],
        representativeTitles: [],
      },
    ],
  },
  {
    id: 'scenarios',
    title: '场景篇',
    shortTitle: '场景篇',
    subtitle: '',
    description: '',
    audience: '',
    icon: BookOpen,
    accent: 'from-[#2a7a6e] to-[#c45d3e]',
    modules: [
      {
        id: '说课篇',
        title: '说课篇',
        description: '',
        order: 1,
        categoryNames: ['说课篇'],
        representativeTitles: [],
      },
      {
        id: '公开课篇',
        title: '公开课篇',
        description: '',
        order: 2,
        categoryNames: ['公开课篇'],
        representativeTitles: [],
      },
    ],
  },
];

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: 'course-1',
  title: 'Plus 示例课程',
  description: '课程描述',
  instructor: '哈老师',
  category_id: 'cat-shuoke',
  category: '说课篇',
  level: '入门',
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
    vi.mocked(getAdminCourseCategories).mockResolvedValue([
      { id: 'cat-shuoke', name: '说课篇', sort_order: 1, is_active: true, plus_track_id: 'theory' },
      { id: 'cat-learning', name: '学习科学篇', sort_order: 2, is_active: true, plus_track_id: 'theory' },
      { id: 'cat-open', name: '公开课篇', sort_order: 3, is_active: true, plus_track_id: 'scenarios' },
    ]);
    vi.mocked(getAdminCourseAttachments).mockResolvedValue([]);
    vi.mocked(adminDeleteCourseAttachment).mockResolvedValue();
    vi.mocked(uploadCourseFile).mockResolvedValue({
      id: 'att-1',
      course_id: 'course-1',
      file_name: '任务单.docx',
      file_url: 'https://cdn.example.com/course-files/course-1/task.docx',
      storage_key: 'course-files/course-1/task.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      file_size: 1024,
      file_type: 'document',
      sort_order: 0,
      is_active: true,
      uploaded_by: 'admin-1',
      created_at: '2026-07-12T00:00:00Z',
      updated_at: '2026-07-12T00:00:00Z',
    });
    vi.mocked(getPlusCourseStructure).mockResolvedValue(testTracks);
    vi.mocked(adminUpdateCourseCategory).mockResolvedValue({
      id: 'cat-shuoke',
      name: '说课篇',
      sort_order: 1,
      is_active: true,
      plus_track_id: 'scenarios',
    });
    vi.mocked(adminUpdateCourse).mockResolvedValue(makeCourse());
    vi.mocked(adminCreateCourseCategory).mockResolvedValue({
      id: 'cat-new',
      name: '新增系列课',
      sort_order: 4,
      is_active: true,
      plus_track_id: 'scenarios',
    });
    vi.mocked(adminCreateCourse).mockResolvedValue(makeCourse({
      id: 'created-course',
      title: '新系列第一课',
      category_id: 'cat-new',
      category: '新增系列课',
    }));
  });

  it('updates category plus_track_id without sending old course module fields', async () => {
    const user = userEvent.setup();

    render(<CourseManagementSection />);

    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    await user.selectOptions(await screen.findByLabelText('分类所属篇章'), 'scenarios');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(adminUpdateCourseCategory).toHaveBeenCalledWith('cat-shuoke', {
        plus_track_id: 'scenarios',
      });
    });
    const updatePayload = vi.mocked(adminUpdateCourse).mock.calls[0]?.[1] ?? {};
    expect(updatePayload).not.toHaveProperty('plus_track_id');
    expect(updatePayload).not.toHaveProperty('plus_module_id');
    expect(updatePayload).not.toHaveProperty('plus_module_order');
  });

  it('uploads downloadable course files for an existing course', async () => {
    const user = userEvent.setup();

    render(<CourseManagementSection />);

    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    await screen.findByText('下载文件');

    const file = new File(['hello'], '任务单.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await user.upload(screen.getByLabelText('上传文件'), file);

    await waitFor(() => {
      expect(uploadCourseFile).toHaveBeenCalledWith('course-1', file);
    });
    expect(await screen.findByText('任务单.docx')).toBeInTheDocument();
  });

  it('filters the admin list by Plus track derived from course category', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'theory-course',
        title: '学习科学导论',
        category_id: 'cat-learning',
        category: '学习科学篇',
      }),
      makeCourse({
        id: 'shuoke-course',
        title: '说课篇01：整体结构',
        category_id: 'cat-shuoke',
        category: '说课篇',
      }),
      makeCourse({
        id: 'open-class-course',
        title: '公开课任务情境导入',
        category_id: 'cat-open',
        category: '公开课篇',
      }),
      makeCourse({
        id: 'pro-course',
        title: 'AI 工具课',
        membership_type: 'pro',
        category_id: null,
        category: 'AI工具',
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
  });

  it('filters the admin list by category, level, and membership type together', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'target-course',
        title: '目标单元课程',
        category: '单元一',
        level: '中级',
      }),
      makeCourse({
        id: 'wrong-category',
        title: '其他单元课程',
        category: '单元二',
        level: '中级',
      }),
      makeCourse({
        id: 'wrong-level',
        title: '初级同类课程',
        category: '单元一',
        level: '初级',
      }),
      makeCourse({
        id: 'wrong-type',
        title: 'Pro 同单元课程',
        category: '单元一',
        level: '中级',
        membership_type: 'pro',
      }),
    ]);
    vi.mocked(getAdminCourseCategories).mockResolvedValue([
      { id: 'cat-1', name: '单元一', sort_order: 1, is_active: true, plus_track_id: null },
      { id: 'cat-2', name: '单元二', sort_order: 2, is_active: true, plus_track_id: null },
    ]);

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

  it('creates a new category with its Plus track before creating a course', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([]);

    render(<CourseManagementSection />);

    await screen.findByText('没有匹配的课程');
    await user.click(screen.getByRole('button', { name: '添加课程' }));
    await user.type(screen.getByPlaceholderText('请输入课程名称'), '新系列第一课');
    await user.click(screen.getByRole('button', { name: '创建新分类' }));
    await user.type(screen.getByPlaceholderText('输入新分类名称'), '新增系列课');
    await user.selectOptions(screen.getByLabelText('分类所属篇章'), 'scenarios');
    await user.click(screen.getByRole('button', { name: '创建课程' }));

    await waitFor(() => {
      expect(adminCreateCourseCategory).toHaveBeenCalledWith('新增系列课', 'scenarios');
    });
    expect(adminCreateCourse).toHaveBeenCalledWith(expect.objectContaining({
      title: '新系列第一课',
      category_id: 'cat-new',
      category: '新增系列课',
    }));
    const createPayload = vi.mocked(adminCreateCourse).mock.calls[0]?.[0] ?? {};
    expect(createPayload).not.toHaveProperty('plus_track_id');
    expect(createPayload).not.toHaveProperty('plus_module_id');
    expect(createPayload).not.toHaveProperty('plus_module_order');
  });

  it('opens the current Plus track preview from active filters', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({
        id: 'shuoke-course',
        title: '说课篇01：整体结构',
        category: '说课篇',
      }),
    ]);

    render(<CourseManagementSection />);

    await screen.findByText('说课篇01：整体结构');
    await user.selectOptions(screen.getByLabelText('筛选 Plus 篇章'), 'scenarios');
    await user.click(screen.getByRole('button', { name: '预览结构' }));

    expect(openSpy).toHaveBeenCalledWith('/courses/plus/scenarios', '_blank');
  });
});
