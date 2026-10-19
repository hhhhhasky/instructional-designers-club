import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DaofaLessonPage from '@/pages/DaofaLessonPage';
import { getDaofaLessonMedia } from '@/db/daofa-media';

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

  it('总论视频从授权接口获得播放地址', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/courses/daofa/introduction']}>
      <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
    </MemoryRouter>);

    await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', 'https://signed.example.test/media'));
    expect(getDaofaLessonMedia).toHaveBeenCalledWith('introduction');
  });
});

describe('道法八年级图文讲义', () => {
  it.each(['up', 'down'])('八年级%s册经授权接口载入独立沙箱讲义', async (semester) => {
    render(<MemoryRouter initialEntries={[`/courses/daofa/grade-8-${semester}`]}>
      <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
    </MemoryRouter>);
    const frame = await screen.findByTitle(/图文讲义$/);
    expect(frame).toHaveAttribute('src', 'https://signed.example.test/media');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    expect(getDaofaLessonMedia).toHaveBeenCalledWith(`grade-8-${semester}-handout`);
    fireEvent(window, new MessageEvent('message', { source: window, data: { type: 'daofa-handout-height', height: 12345 } }));
    expect(frame).toHaveStyle({ height: '900px' });
    fireEvent(window, new MessageEvent('message', { source: (frame as HTMLIFrameElement).contentWindow, data: { type: 'daofa-handout-height', height: 12345 } }));
    expect(frame).toHaveStyle({ height: '12345px' });
  });

  it('未上线讲义的册次不请求讲义资源', async () => {
    vi.mocked(getDaofaLessonMedia).mockClear();
    render(<MemoryRouter initialEntries={['/courses/daofa/grade-7-up']}>
      <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
    </MemoryRouter>);
    expect(screen.queryByRole('region', { name: '图文讲义' })).not.toBeInTheDocument();
    expect(getDaofaLessonMedia).not.toHaveBeenCalled();
  });
});

it('无课程权限时不请求或嵌入八年级讲义', () => {
  access.allowed = false;
  vi.mocked(getDaofaLessonMedia).mockClear();
  render(<MemoryRouter initialEntries={['/courses/daofa/grade-8-up']}>
    <Routes><Route path="/courses/daofa/:lessonId" element={<DaofaLessonPage />} /></Routes>
  </MemoryRouter>);
  expect(screen.getByText('尚未开通道法教材解读课')).toBeInTheDocument();
  expect(screen.queryByTitle(/图文讲义$/)).not.toBeInTheDocument();
  expect(getDaofaLessonMedia).not.toHaveBeenCalled();
  access.allowed = true;
});
