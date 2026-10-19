import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getDaofaLessonMedia } from '@/db/daofa-media';
import DaofaLessonPage from '@/pages/DaofaLessonPage';

const access = vi.hoisted(() => ({ allowed: true }));

vi.mock('@/db/daofa-media', () => ({
  getDaofaLessonMedia: vi.fn().mockResolvedValue('https://signed.example.test/media'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'member-1' },
    profile: { role: 'member' },
    courseAccessCodes: ['daofa-textbook'],
    loading: false,
  }),
}));

vi.mock('@/lib/access-control', () => ({
  canAccessCourse: () => access.allowed,
}));

vi.mock('@/components/layout/Header', () => ({ default: () => <div data-testid="global-header" /> }));
vi.mock('@/components/common/Footer', () => ({ default: () => <div data-testid="global-footer" /> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));
describe('道法三元对齐画布', () => {
  it('独立占满学习视图，只提供返回目录入口', async () => {
    render(<MemoryRouter initialEntries={['/courses/daofa/alignment-canvas']}>
      <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
    </MemoryRouter>);

    expect(screen.getByRole('link', { name: '返回课程目录' })).toHaveAttribute('href', '/courses/daofa');
    expect(screen.queryByTestId('global-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('global-footer')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '道法课程目录' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTitle('课标素养、内容要求与教材单元三元对齐画布')).toHaveClass('h-full', 'w-full', 'border-0'));
    expect(screen.getByTitle('课标素养、内容要求与教材单元三元对齐画布')).toHaveAttribute('src', 'https://signed.example.test/media');
    expect(getDaofaLessonMedia).toHaveBeenCalledWith('alignment-canvas');
  });


});

it('旧固定单课地址返回数据库目录，不再调用独立讲义接口', async () => {
  vi.mocked(getDaofaLessonMedia).mockClear();
  render(<MemoryRouter initialEntries={['/courses/daofa/grade-9-up']}>
    <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /><Route path="/courses/daofa" element={<div>数据库课程目录</div>} /></Routes>
  </MemoryRouter>);
  expect(await screen.findByText('数据库课程目录')).toBeInTheDocument();
  expect(getDaofaLessonMedia).not.toHaveBeenCalled();
});

it('无权限时画布继续阻止读取私有媒体', () => {
  access.allowed = false;
  vi.mocked(getDaofaLessonMedia).mockClear();
  render(<MemoryRouter initialEntries={['/courses/daofa/alignment-canvas']}>
    <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
  </MemoryRouter>);
  expect(screen.getByText('尚未开通道法教材解读课')).toBeInTheDocument();
  expect(getDaofaLessonMedia).not.toHaveBeenCalled();
  access.allowed = true;
});
