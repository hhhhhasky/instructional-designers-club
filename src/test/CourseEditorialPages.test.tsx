import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeacherAiCoursesPage from '@/pages/TeacherAiCoursesPage';
import CoursesPage from '@/pages/CoursesPage';
import { getCourseCatalogSnapshot } from '@/db/api';
import { PLUS_TRACKS } from '@/lib/plusCourseStructure';
import type { Course } from '@/types/types';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'member-1' },
    accessLevel: 'pro',
  }),
}));

vi.mock('@/db/api', () => ({
  getCourseCatalogSnapshot: vi.fn(),
  getCourseDetailSnapshot: vi.fn(() => Promise.resolve(null)),
  subscribeToCourseCatalogUpdates: vi.fn(() => () => {}),
}));

vi.mock('@/lib/access-control', () => ({
  canAccessCourse: vi.fn(() => true),
}));

vi.mock('@/components/layout/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('@/components/common/Footer', () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock('@/components/common/LoadingOverlay', () => ({
  default: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('@/components/common/PageMeta', () => ({
  default: () => null,
}));

vi.mock('@/components/common/UpgradePopup', () => ({
  default: () => null,
}));

function makeCourse(overrides: Partial<Course>): Course {
  return {
    id: 'course-1',
    title: '测试课程',
    description: '课程简介',
    instructor: '哈老师',
    category_id: null,
    category: 'AI 科普',
    level: '入门',
    duration: 30,
    credits: '1',
    status: 'published',
    membership_type: 'pro',
    course_type: 'article',
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
    ...overrides,
  };
}

describe('课程核心页面 — 教研编辑部信息层级', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('教师 AI 课以系列卷册目录呈现，并为课程入口提供可访问名称', async () => {
    const course = makeCourse({ id: 'pro-1', title: 'AI 导论' });
    vi.mocked(getCourseCatalogSnapshot).mockResolvedValue({
      plus_courses: [],
      plus_tracks: [],
      pro_courses: [course],
      pro_categories: ['AI 科普'],
      pro_category_tags: {
        'AI 科普': {
          applicable_audience: ['一线教师'],
          applicable_scenarios: ['备课'],
          content_types: ['专题课'],
        },
      },
      generated_at: null,
      source_updated_at: null,
      source: 'rest-fallback',
    });

    render(
      <MemoryRouter initialEntries={['/teacher-ai-courses']}>
        <TeacherAiCoursesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByRole('heading', { level: 1, name: '教师 AI 课' })).toBeInTheDocument();
    expect(screen.getByText('PRO CATALOGUE · 教师 AI 专题刊')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '系列卷册导航' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '打开课程：AI 导论' })).not.toHaveLength(0);
  });

  it('教学通识课主页以左侧系列课目录呈现三个篇章与单课入口', async () => {
    const course = makeCourse({
      id: 'plus-1',
      title: '学习科学导论',
      category: '学习科学篇',
      membership_type: 'plus',
      plus_lesson_order: 1,
    });
    vi.mocked(getCourseCatalogSnapshot).mockResolvedValue({
      plus_courses: [course],
      plus_tracks: PLUS_TRACKS,
      pro_courses: [],
      pro_categories: [],
      pro_category_tags: {},
      generated_at: null,
      source_updated_at: null,
      source: 'rest-fallback',
    });

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <CoursesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByRole('heading', { level: 1, name: '教学通识课' })).toBeInTheDocument();
    expect(screen.getByText('PLUS CATALOGUE · 教学通识课')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '系列课导航' })).toBeInTheDocument();
    expect(screen.getAllByText('理论篇').length).toBeGreaterThan(0);
    expect(screen.getAllByText('教学设计原理篇').length).toBeGreaterThan(0);
    expect(screen.getAllByText('场景篇').length).toBeGreaterThan(0);
    expect(screen.getAllByText('学习科学').length).toBeGreaterThan(0);
    expect(screen.getAllByText('说课篇').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '打开课程：学习科学导论' })).not.toHaveLength(0);
  });

  it('教师 AI 课支持在手机和桌面共用的图文/视频筛选', async () => {
    const articleCourse = makeCourse({ id: 'pro-article', title: '图文入门', course_type: 'article' });
    const videoCourse = makeCourse({ id: 'pro-video', title: '视频入门', course_type: 'video', has_video: true });
    vi.mocked(getCourseCatalogSnapshot).mockResolvedValue({
      plus_courses: [],
      plus_tracks: [],
      pro_courses: [articleCourse, videoCourse],
      pro_categories: ['AI 科普'],
      pro_category_tags: {},
      generated_at: null,
      source_updated_at: null,
      source: 'rest-fallback',
    });

    render(
      <MemoryRouter initialEntries={['/teacher-ai-courses']}>
        <TeacherAiCoursesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    const catalog = screen.getByRole('region', { name: '系列卷册课程目录' });
    expect(within(catalog).getByLabelText('课程类型筛选')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '筛选课程类型：视频' }));

    expect(screen.queryAllByRole('button', { name: '打开课程：图文入门' })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: '打开课程：视频入门' }).length).toBeGreaterThan(0);
  });

  it('教学通识课按后端课程类型筛选单课', async () => {
    const articleCourse = makeCourse({
      id: 'plus-article',
      title: '图文通识课',
      category: '学习科学篇',
      membership_type: 'plus',
      course_type: 'article',
      plus_lesson_order: 1,
    });
    const videoCourse = makeCourse({
      id: 'plus-video',
      title: '视频通识课',
      category: '学习科学篇',
      membership_type: 'plus',
      course_type: 'video',
      has_video: true,
      plus_lesson_order: 2,
    });
    vi.mocked(getCourseCatalogSnapshot).mockResolvedValue({
      plus_courses: [articleCourse, videoCourse],
      plus_tracks: PLUS_TRACKS,
      pro_courses: [],
      pro_categories: [],
      pro_category_tags: {},
      generated_at: null,
      source_updated_at: null,
      source: 'rest-fallback',
    });

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <CoursesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    const catalog = screen.getByRole('region', { name: '系列课课程目录' });
    expect(within(catalog).getByLabelText('课程类型筛选')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '筛选课程类型：图文' }));

    expect(screen.getAllByRole('button', { name: '打开课程：图文通识课' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: '打开课程：视频通识课' })).toHaveLength(0);
  });
});
