import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CoursePurchaseSection from '@/components/pricing/CoursePurchaseSection';
import { HOME_LANDING_DEFAULTS } from '@/lib/home-landing-content';

describe('course purchase links', () => {
  it.each([
    ['教学通识课', '/courses', 'https://xhslink.com/m/5JAHDTqPSdk'],
    ['教师 AI 课', '/teacher-ai-courses', 'https://xhslink.com/m/4neOp7EhPHm'],
    ['道法教材解读课', '/courses/daofa', 'https://xhslink.com/m/277IB24mn8I'],
  ])('opens the matching %s product', (name, cataloguePath, purchaseUrl) => {
    render(<MemoryRouter><CoursePurchaseSection /></MemoryRouter>);

    const card = screen.getByRole('heading', { name }).closest('article');
    expect(card).not.toBeNull();
    const buyLink = within(card!).getByRole('link', { name: `购买${name}` });
    expect(buyLink).toHaveAttribute('href', purchaseUrl);
    expect(buyLink).toHaveAttribute('target', '_blank');
    expect(buyLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(card!).getByRole('link', { name: '查看课程目录' })).toHaveAttribute('href', cataloguePath);
  });

  it('takes an entitled learner into the course instead of showing a purchase button', () => {
    render(<MemoryRouter><CoursePurchaseSection accessCodes={['teacher-ai']} /></MemoryRouter>);

    const card = screen.getByRole('heading', { name: '教师 AI 课' }).closest('article');
    expect(within(card!).getByRole('link', { name: '进入教师 AI 课' })).toHaveAttribute('href', '/teacher-ai-courses');
    expect(within(card!).queryByRole('link', { name: '购买教师 AI 课' })).not.toBeInTheDocument();
  });

  it('shows course entry instead of purchase to an administrator', () => {
    render(<MemoryRouter><CoursePurchaseSection isAdmin /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: '购买教师 AI 课' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入教师 AI 课' })).toHaveAttribute('href', '/teacher-ai-courses');
  });

  it('renders course descriptions edited in the content database', () => {
    const content = {
      ...HOME_LANDING_DEFAULTS.home_courses,
      items: HOME_LANDING_DEFAULTS.home_courses.items.map((item) => item.code === 'teacher-ai'
        ? { ...item, audience: '我手写的适合人群' }
        : item),
    };
    render(<MemoryRouter><CoursePurchaseSection content={content} /></MemoryRouter>);
    const card = screen.getByRole('heading', { name: '教师 AI 课' }).closest('article');
    expect(within(card!).getByText('我手写的适合人群')).toBeInTheDocument();
  });
});
