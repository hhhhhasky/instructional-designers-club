import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseTypeTabs from '@/components/course/CourseTypeTabs';

const auth = vi.hoisted(() => ({
  profile: { role: 'user', status: 'active' },
  courseAccessCodes: [] as string[],
  loading: false,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

describe('course navigation access states', () => {
  beforeEach(() => {
    auth.profile.role = 'user';
    auth.courseAccessCodes = [];
    auth.loading = false;
  });

  it('distinguishes the current page from access to each course', () => {
    auth.courseAccessCodes = ['teacher-ai', 'daofa-textbook'];
    render(<MemoryRouter initialEntries={['/courses']}><CourseTypeTabs /></MemoryRouter>);
    const current = screen.getByRole('link', { name: /教学通识课/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(current).getByText('未开通')).toBeInTheDocument();
    for (const name of [/教师 AI 课/, /道法教材解读课/]) {
      const link = screen.getByRole('link', { name });
      expect(link).not.toHaveAttribute('aria-current');
      expect(within(link).getByText('已开通')).toBeInTheDocument();
    }
  });

  it('shows all courses as unopened when no courses are granted', () => {
    render(<MemoryRouter><CourseTypeTabs /></MemoryRouter>);
    expect(screen.getAllByText('未开通')).toHaveLength(3);
    expect(screen.queryByText('已开通')).not.toBeInTheDocument();
  });

  it('does not present administrator access as a purchase', () => {
    auth.profile.role = 'admin';
    render(<MemoryRouter><CourseTypeTabs /></MemoryRouter>);
    expect(screen.getAllByText('可直接学习')).toHaveLength(4);
    expect(screen.queryByText('已开通')).not.toBeInTheDocument();
  });

  it('avoids showing unopened status while permissions are loading', () => {
    auth.loading = true;
    render(<MemoryRouter><CourseTypeTabs /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByText('未开通')).not.toBeInTheDocument();
  });
});
