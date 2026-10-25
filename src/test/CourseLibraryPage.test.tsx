import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseLibraryPage from '@/pages/CourseLibraryPage';
import type { CourseAccessCode } from '@/lib/course-entitlements';

const auth = vi.hoisted(() => ({ user: null as { id: string } | null, profile: null as { role: string } | null, courseAccessCodes: [] as CourseAccessCode[], loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

function open() { render(<MemoryRouter><CourseLibraryPage /></MemoryRouter>); }

describe('课程选课首页', () => {
  beforeEach(() => { auth.user = null; auth.profile = null; auth.courseAccessCodes = []; auth.loading = false; });

  it('访客可浏览三门课程，卡片仍进入原目录，购买入口分别对应商品', () => {
    open();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '教学通识课' })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: '教师 AI 课' })).toHaveAttribute('href', '/teacher-ai-courses');
    expect(screen.getByRole('link', { name: '道法教材解读课' })).toHaveAttribute('href', '/courses/daofa');
    const links = screen.getAllByRole('link', { name: /购买.*小红书/ });
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://xhslink.com/m/5JAHDTqPSdk', 'https://xhslink.com/m/4neOp7EhPHm', 'https://xhslink.com/m/277IB24mn8I']);
    expect(screen.getByRole('link', { name: '返回官网首页' })).toHaveAttribute('href', '/');
  });

  it('仅给已开通课程显示可观看，筛选只保留有权限的一门', async () => {
    auth.user = { id: 'teacher' }; auth.courseAccessCodes = ['teacher-ai'];
    open();
    const ai = screen.getByRole('link', { name: '教师 AI 课' }).closest('article')!;
    expect(within(ai).getByText('已开通 · 可观看')).toBeInTheDocument();
    expect(within(ai).queryByRole('link', { name: /购买/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /购买.*小红书/ })).toHaveLength(2);
    await userEvent.setup().click(screen.getByRole('button', { name: '已开通' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '教师 AI 课' })).toBeInTheDocument();
  });

  it('权限加载时不显示未开通或购买按钮，避免误导已有课程的用户', () => {
    auth.loading = true; open();
    expect(screen.queryByRole('link', { name: /购买.*小红书/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('正在确认观看权限…')).toHaveLength(3);
  });

  it('管理员可进入所有现有课程', () => {
    auth.user = { id: 'admin' }; auth.profile = { role: 'admin' }; open();
    expect(screen.getAllByText('已开通 · 可观看')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /购买.*小红书/ })).not.toBeInTheDocument();
  });
});
