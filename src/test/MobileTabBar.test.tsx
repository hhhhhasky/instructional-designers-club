import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MobileTabBar from '@/components/navigation/MobileTabBar';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileTabBar />
    </MemoryRouter>,
  );
}

describe('MobileTabBar — 课程详情路由', () => {
  it('在精确课程详情路由隐藏五标签导航', () => {
    renderAt('/courses/course-123');

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('首页')).not.toBeInTheDocument();
  });

  it.each(['/courses', '/courses/plus/scenarios'])('在 %s 保留五标签导航', (path) => {
    renderAt(path);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('首页')).toBeInTheDocument();
  });
});
