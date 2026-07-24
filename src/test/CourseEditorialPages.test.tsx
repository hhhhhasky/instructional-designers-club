import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeacherAiCoursesPage from '@/pages/TeacherAiCoursesPage';
import PlusTrackPage from '@/pages/PlusTrackPage';
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

  it('Plus 篇章以卷册目录呈现，并标记当前篇章与单课入口', async () => {
    const course = makeCourse({
      id: 'plus-1',
      title: '学习科学导论',
      category: '学习科学篇',
      membership_type: 'plus',
      plus_lesson_order: 1,
    });
    vi.mocked(getCourseCatalogSnapshot).mockResolvedValue({
      plus_courses: [course],
      plus_tracks: [PLUS_TRACKS[0]],
      pro_courses: [],
      pro_categories: [],
      pro_category_tags: {},
      generated_at: null,
      source_updated_at: null,
      source: 'rest-fallback',
    });

    render(
      <MemoryRouter initialEntries={['/courses/plus/theory']}>
        <Routes>
          <Route path="/courses/plus/:trackId" element={<PlusTrackPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByRole('heading', { level: 1, name: '理论篇' })).toBeInTheDocument();
    expect(screen.getByText('PLUS VOLUME · 教学通识课卷册')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '教学通识课篇章' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /理论篇/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: '理论基石目录导航' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '打开课程：学习科学导论' })).not.toHaveLength(0);
  });
});
