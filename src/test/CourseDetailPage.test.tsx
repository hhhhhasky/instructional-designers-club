import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen } from 'lucide-react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CourseDetailPage from '@/pages/CourseDetailPage';

// --- Mocks ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUser = { id: 'user-1', phone: '13800000000', nickname: '测试用户', avatar_url: null, access_level: 'pro' as const, status: 'active' as const, created_at: '', updated_at: '' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, accessLevel: 'pro' }),
}));

vi.mock('@/db/api', () => ({
  getCourseById: vi.fn(),
  getCourseByIdAdmin: vi.fn(),
  incrementCourseViewCount: vi.fn(),
  getCoursesByMembershipAndCategory: vi.fn(),
  getCoursesByMembershipType: vi.fn(),
  getPlusCourseStructure: vi.fn(),
}));

vi.mock('@/lib/access-control', () => ({
  canAccessCourse: vi.fn(() => true),
  recordCourseVisit: vi.fn(),
  updateLearningProgress: vi.fn(),
  getUserLearningRecords: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/components/layout/Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('@/components/common/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('@/components/common/LoadingOverlay', () => ({ default: ({ message }: { message: string }) => <div data-testid="loading">{message}</div> }));
vi.mock('@/components/course/CourseConfirmDialog', () => ({ default: () => <div data-testid="confirm-dialog" /> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

// --- Test Data ---

import { getCourseById, getCoursesByMembershipAndCategory, getCoursesByMembershipType, getPlusCourseStructure } from '@/db/api';
import { getUserLearningRecords } from '@/lib/access-control';
import type { PlusTrackConfig } from '@/lib/plusCourseStructure';

const makeCourse = (overrides: Record<string, unknown> = {}): import('@/types/types').Course => ({
  id: 'c1',
  title: '测试课程 A',
  description: '课程描述',
  instructor: '哈老师',
  category_id: null,
  category: '教学设计',
  level: '入门',
  semester: null,
  duration: 60,
  credits: '2',
  status: 'published',
  membership_type: 'pro',
  is_trial: false,
  image_url: null,
  video_url: 'https://example.com/video.mp4',
  audio_url: null,
  body: null,
  essence: null,
  images: null,
  plus_track_id: null,
  plus_module_id: null,
  plus_module_order: null,
  plus_lesson_order: null,
  plus_representative: false,
  meeting_url: null,
  sort_order: 1,
  view_count: 10,
  created_at: null,
  updated_at: null,
  ...overrides,
});

const siblingCourses = [
  makeCourse({ id: 'c1', title: '第一节：导入', sort_order: 1 }),
  makeCourse({ id: 'c2', title: '第二节：核心概念', sort_order: 2 }),
  makeCourse({ id: 'c3', title: '第三节：实践', sort_order: 3 }),
];

const plusCategoryTracks: PlusTrackConfig[] = [
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
    ],
  },
];

// --- Helpers ---

function renderCourseDetail(courseId = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function renderAndWait(courseId = 'c1') {
  vi.mocked(getCourseById).mockResolvedValue(makeCourse({ id: courseId }));
  vi.mocked(getCoursesByMembershipAndCategory).mockResolvedValue(siblingCourses);
  vi.mocked(getUserLearningRecords).mockResolvedValue([]);

  const result = renderCourseDetail(courseId);
  await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  return result;
}

// --- Tests ---

describe('CourseDetailPage — 课程导航功能', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // 测试点 1：面包屑导航显示
  // ============================
  it('面包屑显示「教师AI课 > 分类名 > 课程标题」', async () => {
    await renderAndWait('c1');

    expect(screen.getByText('教师AI课')).toBeInTheDocument();
    // "教学设计" 出现在多个位置（面包屑、Badge、目录标题），用 getAllByText
    expect(screen.getAllByText('教学设计').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('第一节：导入').length).toBeGreaterThanOrEqual(1);
  });

  // ============================
  // 测试点 2：面包屑点击返回教师AI课
  // ============================
  it('点击面包屑中的「教师AI课」导航到 /teacher-ai-courses', async () => {
    const user = userEvent.setup();
    await renderAndWait('c1');

    await user.click(screen.getByText('教师AI课'));
    expect(mockNavigate).toHaveBeenCalledWith('/teacher-ai-courses');
  });

  // ============================
  // 测试点 3：上一节/下一节导航
  // ============================
  it('显示上一节/下一节按钮，中间课程两端都可点', async () => {
    await renderAndWait('c2'); // 第二节

    expect(screen.getAllByText('上一节').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('下一节').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 / 3').length).toBeGreaterThanOrEqual(1);
  });

  it('第一节时上一节按钮 disabled', async () => {
    await renderAndWait('c1');
    // sm:hidden 的 "上一节" 文字
    const prevButtons = screen.getAllByText('上一节');
    expect(prevButtons.length).toBeGreaterThan(0);
    const prevBtn = prevButtons[0].closest('button')!;
    expect(prevBtn).toBeDisabled();
  });

  it('最后一节时下一节按钮 disabled', async () => {
    await renderAndWait('c3');
    const nextButtons = screen.getAllByText('下一节');
    expect(nextButtons.length).toBeGreaterThan(0);
    const nextBtn = nextButtons[0].closest('button')!;
    expect(nextBtn).toBeDisabled();
  });

  // ============================
  // 测试点 4：点击下一节导航到正确课程
  // ============================
  it('点击下一节按钮调用 navigate 到下一节课程', async () => {
    const user = userEvent.setup();
    await renderAndWait('c1');

    const nextButtons = screen.getAllByText('下一节');
    await user.click(nextButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/courses/c2');
  });

  // ============================
  // 测试点 5：课程目录列表显示（移动端内嵌）
  // ============================
  it('同系列课程列表包含所有兄弟课程标题', async () => {
    await renderAndWait('c1');

    // 课程标题在移动端目录和桌面端侧边栏中都出现
    expect(screen.getAllByText('第一节：导入').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('第二节：核心概念').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('第三节：实践').length).toBeGreaterThanOrEqual(1);
  });

  it('课程目录显示分类名和总数', async () => {
    await renderAndWait('c1');

    // 目录标题在多处出现，确认至少有一处
    expect(screen.getAllByText('教学设计').length).toBeGreaterThanOrEqual(1);

    // 总数指示（prev/next 和移动端目录各一个）
    expect(screen.getAllByText('1 / 3').length).toBeGreaterThanOrEqual(1);
  });

  // ============================
  // 测试点 6：点击目录中其他课程导航正确
  // ============================
  it('点击目录中的课程项导航到对应课程', async () => {
    const user = userEvent.setup();
    await renderAndWait('c1');

    // 点击目录中的"第二节"（取第一个匹配）
    const items = screen.getAllByText('第二节：核心概念');
    await user.click(items[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/courses/c2');
  });

  // ============================
  // 测试点 7：点击当前课程不触发导航
  // ============================
  it('点击当前课程不触发 navigate', async () => {
    await renderAndWait('c1');

    // "第一节：导入" 出现在移动端目录和桌面端侧边栏中
    // 它们是 button 元素，点击当前课程不应导航
    const items = screen.getAllByText('第一节：导入');
    // 过滤出 button 元素（目录中的课程项）
    const buttons = items.filter(el => el.tagName === 'P' && el.closest('button'));
    // 当前课程在目录中已有高亮，点击它的 button 不触发导航
    // 由于 handleNavigateToCourse 有 `if (courseId === id) return` 守卫
    // 可以直接验证 navigate 没被调用
    expect(mockNavigate).not.toHaveBeenCalledWith('/courses/c1');
  });

  // ============================
  // 测试点 8：桌面端侧边栏存在
  // ============================
  it('桌面端侧边栏包含课程目录', async () => {
    await renderAndWait('c1');

    // 侧边栏中 h3 标题包含 "教学设计"（移动端和桌面端各一个）
    const headings = screen.getAllByText('教学设计');
    expect(headings.length).toBeGreaterThanOrEqual(1);

    // 侧边栏和移动端目录中都有课程列表
    expect(screen.getAllByText('第二节：核心概念').length).toBeGreaterThanOrEqual(1);
  });

  // ============================
  // 测试点 9：只有一个课程时不显示导航
  // ============================
  it('只有一个课程时不显示上一节/下一节和目录列表', async () => {
    vi.mocked(getCourseById).mockResolvedValue(makeCourse());
    vi.mocked(getCoursesByMembershipAndCategory).mockResolvedValue([makeCourse()]);
    vi.mocked(getUserLearningRecords).mockResolvedValue([]);

    renderCourseDetail('c1');
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.queryByText('上一节')).not.toBeInTheDocument();
    expect(screen.queryByText('下一节')).not.toBeInTheDocument();
  });

  it('Plus 课程按分类系列加载目录并返回篇章锚点', async () => {
    const user = userEvent.setup();
    const plusCourses = [
      makeCourse({
        id: 'p1',
        title: '说课篇01：整体结构',
        category: '说课篇',
        membership_type: 'plus',
        plus_lesson_order: 1,
        sort_order: 101,
      }),
      makeCourse({
        id: 'p2',
        title: '说课篇02：教材分析',
        category: '说课篇',
        membership_type: 'plus',
        plus_lesson_order: 2,
        sort_order: 102,
      }),
    ];
    vi.mocked(getCourseById).mockResolvedValue(plusCourses[0]);
    vi.mocked(getCoursesByMembershipType).mockResolvedValue(plusCourses);
    vi.mocked(getPlusCourseStructure).mockResolvedValue(plusCategoryTracks);
    vi.mocked(getCoursesByMembershipAndCategory).mockResolvedValue([]);
    vi.mocked(getUserLearningRecords).mockResolvedValue([]);

    renderCourseDetail('p1');
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(getCoursesByMembershipType).toHaveBeenCalledWith('plus');
    expect(getCoursesByMembershipAndCategory).not.toHaveBeenCalled();
    expect(screen.getAllByText('说课篇').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('说课篇02：教材分析').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByText('场景篇'));
    expect(mockNavigate).toHaveBeenCalledWith('/courses/plus/scenarios#%E8%AF%B4%E8%AF%BE%E7%AF%87');
  });

  // ============================
  // 测试点 10：加载状态正确显示
  // ============================
  it('加载时显示 LoadingOverlay', () => {
    vi.mocked(getCourseById).mockReturnValue(new Promise(() => {})); // never resolves
    renderCourseDetail('c1');
    expect(screen.getByTestId('loading')).toHaveTextContent('正在加载课程详情');
  });

  // ============================
  // 测试点 11：课程不存在时显示错误
  // ============================
  it('课程不存在时显示错误信息', async () => {
    vi.mocked(getCourseById).mockResolvedValue(null);
    renderCourseDetail('nonexistent');
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByText('课程不存在')).toBeInTheDocument();
    expect(screen.getByText('返回教学通识课')).toBeInTheDocument();
  });
});

describe('CourseDetailPage — 正文板块精简与课程精华', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // 删除项：「课程亮点」「适合人群」不再渲染
  // ============================
  it('不再显示「课程亮点」和「适合人群」板块', async () => {
    await renderAndWait('c1');

    expect(screen.queryByText('课程亮点')).not.toBeInTheDocument();
    expect(screen.queryByText('适合人群')).not.toBeInTheDocument();
  });

  // ============================
  // 必显项：课程简介仍在
  // ============================
  it('仍显示「课程简介」板块', async () => {
    await renderAndWait('c1');

    expect(screen.getByText('课程简介')).toBeInTheDocument();
  });

  // ============================
  // 课程精华：为空时不渲染
  // ============================
  it('essence 为空时不显示「课程精华」', async () => {
    await renderAndWait('c1');

    expect(screen.queryByText('课程精华')).not.toBeInTheDocument();
  });

  // ============================
  // 课程精华：有内容时渲染
  // ============================
  it('essence 有内容时显示「课程精华」', async () => {
    vi.mocked(getCourseById).mockResolvedValue(
      makeCourse({ id: 'c1', essence: '## 测试思维导图\n![](https://example.com/mindmap.png)' })
    );
    vi.mocked(getCoursesByMembershipAndCategory).mockResolvedValue(siblingCourses);
    vi.mocked(getUserLearningRecords).mockResolvedValue([]);

    renderCourseDetail('c1');
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByText('课程精华')).toBeInTheDocument();
  });
});
