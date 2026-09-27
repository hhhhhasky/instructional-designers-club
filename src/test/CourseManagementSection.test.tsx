import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseManagementSection from '@/components/admin/CourseManagementSection';
import {
  adminCreateCourse,
  adminCreateCourseCategory,
  adminDeleteCourseAttachment,
  adminSetCourseAccessPassword,
  adminUpdateCourse,
  adminUpdateCourseCategory,
  adminUpdateCourseTrack,
  getAdminCourseAttachments,
  getAdminCourseCategories,
  getAdminCourseTracks,
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
  adminSetCourseAccessPassword: vi.fn(),
  adminUpdateCourse: vi.fn(),
  adminUpdateCourseCategory: vi.fn(),
  adminUpdateCourseTrack: vi.fn(),
  getAdminCourseAttachments: vi.fn(),
  getAdminCourseCategories: vi.fn(),
  getAdminCourseTracks: vi.fn(),
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
  access_product_code: 'teaching-general-v1',
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(getAdminCourseList).mockResolvedValue([makeCourse()]);
    vi.mocked(getAdminCourseCategories).mockResolvedValue([
      { id: 'cat-shuoke', name: '说课篇', sort_order: 1, is_active: true, plus_track_id: 'theory', access_product_code: 'teaching-general-v1' },
      { id: 'cat-learning', name: '学习科学篇', sort_order: 2, is_active: true, plus_track_id: 'theory', access_product_code: 'teaching-general-v1' },
      { id: 'cat-open', name: '公开课篇', sort_order: 3, is_active: true, plus_track_id: 'scenarios', access_product_code: 'teaching-general-v1' },
      { id: 'cat-ai', name: 'AI工具', sort_order: 1, is_active: true, plus_track_id: null, access_product_code: 'teacher-ai' },
      { id: 'cat-daofa', name: '道法总论', sort_order: 1, is_active: true, plus_track_id: null, access_product_code: 'daofa-textbook' },
    ]);
    vi.mocked(getAdminCourseTracks).mockResolvedValue([
      { id: 'theory', title: '理论篇', sort_order: 1, is_active: true },
      { id: 'scenarios', title: '场景篇', sort_order: 2, is_active: true },
    ]);
    vi.mocked(getAdminCourseAttachments).mockResolvedValue([]);
    vi.mocked(adminDeleteCourseAttachment).mockResolvedValue();
    vi.mocked(adminSetCourseAccessPassword).mockResolvedValue(true);
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
      access_product_code: 'teaching-general-v1',
    });
    vi.mocked(adminUpdateCourseTrack).mockResolvedValue({
      id: 'theory', title: '理论篇', sort_order: 5, is_active: true,
    });
    vi.mocked(adminUpdateCourse).mockResolvedValue(makeCourse());
    vi.mocked(adminCreateCourseCategory).mockResolvedValue({
      id: 'cat-new',
      name: '新增系列课',
      sort_order: 4,
      is_active: true,
      plus_track_id: 'scenarios',
      access_product_code: 'teaching-general-v1',
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
        sort_order: 1,
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

  it('sets a custom preview password for the selected Plus course', async () => {
    const user = userEvent.setup();

    render(<CourseManagementSection />);

    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    await user.type(screen.getByLabelText('设置试看密码'), 'plus-demo-2026');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(adminSetCourseAccessPassword).toHaveBeenCalledWith('course-1', 'plus-demo-2026');
    });
  });

  it('clears an existing course preview password without exposing the old password', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({ password_access_enabled: true }),
    ]);

    render(<CourseManagementSection />);

    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    expect(screen.getByLabelText('更换试看密码')).toHaveValue('');
    await user.click(screen.getByLabelText('清除当前试看密码'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(adminSetCourseAccessPassword).toHaveBeenCalledWith('course-1', null);
    });
  });

  it('filters courses by product and shows the requested list columns', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({ id: 'general', title: '教学通识单课' }),
      makeCourse({ id: 'ai', title: 'AI 工具课', category_id: 'cat-ai', category: 'AI工具', membership_type: 'pro', access_product_code: 'teacher-ai' }),
      makeCourse({ id: 'daofa', title: '道法课程', category_id: 'cat-daofa', category: '道法总论', access_product_code: 'daofa-textbook' }),
    ]);
    render(<CourseManagementSection />);
    await screen.findByText('教学通识单课');

    expect(screen.queryByLabelText('筛选课程类型')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('筛选 Plus 篇章')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '所属课程' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '添加时间' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '修改时间' })).toBeInTheDocument();
    for (const heading of ['分类', 'Plus篇章', '类型', '等级', '排序']) {
      expect(screen.queryByRole('columnheader', { name: heading })).not.toBeInTheDocument();
    }

    await user.selectOptions(screen.getByLabelText('筛选课程产品'), 'teacher-ai');
    expect(screen.getByText('AI 工具课')).toBeInTheDocument();
    expect(screen.queryByText('教学通识单课')).not.toBeInTheDocument();
    expect(screen.queryByText('道法课程')).not.toBeInTheDocument();
    expect(screen.getByLabelText('筛选课程分类')).toHaveTextContent('AI工具');
    expect(screen.getByLabelText('筛选课程分类')).not.toHaveTextContent('说课篇');
  });

  it('combines product, category and level filters', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([
      makeCourse({ id: 'target', title: '目标单课', category: '说课篇', level: '中级' }),
      makeCourse({ id: 'other-category', title: '其他系列单课', category: '学习科学篇', level: '中级' }),
      makeCourse({ id: 'other-level', title: '初级单课', category: '说课篇', level: '初级' }),
      makeCourse({ id: 'other-product', title: 'AI 同名课程', category: 'AI工具', category_id: 'cat-ai', membership_type: 'pro', access_product_code: 'teacher-ai', level: '中级' }),
    ]);
    render(<CourseManagementSection />);
    await screen.findByText('目标单课');
    await user.selectOptions(screen.getByLabelText('筛选课程产品'), 'teaching-general-v1');
    await user.selectOptions(screen.getByLabelText('筛选课程分类'), '说课篇');
    await user.selectOptions(screen.getByLabelText('筛选课程等级'), '中级');
    expect(screen.getByText('目标单课')).toBeInTheDocument();
    expect(screen.queryByText('其他系列单课')).not.toBeInTheDocument();
    expect(screen.queryByText('初级单课')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 同名课程')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(screen.getByText('AI 同名课程')).toBeInTheDocument();
  });

  it('creates a series category in the selected product and chapter', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([]);
    render(<CourseManagementSection />);
    await screen.findByText('没有匹配的课程');
    await user.click(screen.getByRole('button', { name: '添加课程' }));
    expect(screen.queryByLabelText('课程分类')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('课程权限产品'), 'teaching-general-v1');
    await user.type(screen.getByPlaceholderText('请输入课程名称'), '新系列第一课');
    await user.click(screen.getByRole('button', { name: '创建新分类' }));
    await user.type(screen.getByPlaceholderText('输入新分类名称'), '新增系列课');
    await user.selectOptions(screen.getByLabelText('分类所属篇章'), 'scenarios');
    await user.clear(screen.getByLabelText('系列课前端显示顺序'));
    await user.type(screen.getByLabelText('系列课前端显示顺序'), '4');
    await user.click(screen.getByRole('button', { name: '创建课程' }));
    await waitFor(() => expect(adminCreateCourseCategory).toHaveBeenCalledWith('新增系列课', 'teaching-general-v1', 'scenarios', 4));
    expect(adminCreateCourse).toHaveBeenCalledWith(expect.objectContaining({ category_id: 'cat-new', access_product_code: 'teaching-general-v1' }));
  });

  it('scopes the editor categories when changing products', async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminCourseList).mockResolvedValue([]);
    render(<CourseManagementSection />);
    await screen.findByText('没有匹配的课程');
    await user.click(screen.getByRole('button', { name: '添加课程' }));
    expect(screen.queryByText('兼容会员栏目')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('课程权限产品'), 'teacher-ai');
    const category = screen.getByLabelText('课程分类');
    expect(category).toHaveTextContent('AI工具');
    expect(category).not.toHaveTextContent('说课篇');
    await user.selectOptions(screen.getByLabelText('课程权限产品'), 'daofa-textbook');
    expect(screen.getByLabelText('课程分类')).toHaveTextContent('道法总论');
    expect(screen.getByLabelText('课程分类')).not.toHaveTextContent('AI工具');
    expect(screen.queryByText('Plus篇章归属')).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('请输入课程名称'), '道法总论课');
    await user.click(screen.getByRole('button', { name: '创建课程' }));
    await waitFor(() => expect(adminCreateCourse).toHaveBeenCalledWith(expect.objectContaining({
      access_product_code: 'daofa-textbook', category_id: 'cat-daofa', membership_type: 'plus', plus_lesson_order: null,
    })));
  });

  it('saves a series order from the course editor', async () => {
    const user = userEvent.setup();
    render(<CourseManagementSection />);
    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    await user.clear(screen.getByLabelText('系列课前端显示顺序'));
    await user.type(screen.getByLabelText('系列课前端显示顺序'), '7');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(adminUpdateCourseCategory).toHaveBeenCalledWith('cat-shuoke', {
      sort_order: 7, plus_track_id: 'theory',
    }));
  });

  it('saves teaching-general chapter order from the course editor', async () => {
    const user = userEvent.setup();
    render(<CourseManagementSection />);
    await screen.findByText('Plus 示例课程');
    await user.click(screen.getByTitle('编辑'));
    await user.clear(screen.getByLabelText('篇章前端显示顺序'));
    await user.type(screen.getByLabelText('篇章前端显示顺序'), '5');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(adminUpdateCourseTrack).toHaveBeenCalledWith('theory', { sort_order: 5 }));
  });

  it('previews the selected product catalog', async () => {
    const user = userEvent.setup();
    render(<CourseManagementSection />);
    await screen.findByText('Plus 示例课程');
    await user.selectOptions(screen.getByLabelText('筛选课程产品'), 'teacher-ai');
    await user.click(screen.getByRole('button', { name: '预览结构' }));
    expect(window.open).toHaveBeenCalledWith('/teacher-ai-courses', '_blank');
  });
});
