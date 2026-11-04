import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CoursePurchaseSection from '@/components/pricing/CoursePurchaseSection';
import { HOME_LANDING_DEFAULTS } from '@/lib/home-landing-content';

describe('course purchase links', () => {
  it.each([
    ['教学通识课', '/courses', 'https://xhslink.com/m/5JAHDTqPSdk'],
    ['教师 AI 课', '/teacher-ai-courses', 'https://xhslink.com/m/4neOp7EhPHm'],
    ['道法教材解读课', '/courses/daofa', 'https://xhslink.com/m/277IB24mn8I'],
  ])('opens the matching %s product', async (name, cataloguePath, purchaseUrl) => {
    const user = userEvent.setup();
    render(<MemoryRouter><CoursePurchaseSection /></MemoryRouter>);

    const card = screen.getByRole('heading', { name }).closest('article');
    expect(card).not.toBeNull();
    expect(within(card!).getByRole('link', { name: '查看课程目录' })).toHaveAttribute('href', cataloguePath);
    await user.click(within(card!).getByRole('button', { name: `购买${name}` }));

    const dialog = screen.getByRole('dialog');
    const xhsLink = within(dialog).getByRole('link', { name: /小红书支付/ });
    expect(xhsLink).toHaveAttribute('href', purchaseUrl);
    expect(xhsLink).toHaveAttribute('target', '_blank');
    expect(xhsLink).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(within(dialog).getByRole('button', { name: '微信支付' }));
    expect(within(dialog).getByAltText(`${name}微信小店购买二维码`)).toBeInTheDocument();
  });

  it('takes an entitled learner into the course instead of showing a purchase button', () => {
    render(<MemoryRouter><CoursePurchaseSection accessCodes={['teacher-ai']} /></MemoryRouter>);

    const card = screen.getByRole('heading', { name: '教师 AI 课' }).closest('article');
    expect(within(card!).getByRole('link', { name: '进入教师 AI 课' })).toHaveAttribute('href', '/teacher-ai-courses');
    expect(within(card!).queryByRole('button', { name: '购买教师 AI 课' })).not.toBeInTheDocument();
    expect(within(card!).getByText('已开通')).toBeInTheDocument();
    const otherCard = screen.getByRole('heading', { name: '教学通识课' }).closest('article');
    expect(within(otherCard!).getByText('未开通')).toBeInTheDocument();
  });

  it('shows course entry instead of purchase to an administrator', () => {
    render(<MemoryRouter><CoursePurchaseSection isAdmin /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: '购买教师 AI 课' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入教师 AI 课' })).toHaveAttribute('href', '/teacher-ai-courses');
    expect(screen.getAllByText('可直接学习')).toHaveLength(3);
    expect(screen.queryByText('已开通')).not.toBeInTheDocument();
  });

  it('waits for permissions before showing status or purchase actions', () => {
    render(<MemoryRouter><CoursePurchaseSection isLoading /></MemoryRouter>);
    expect(screen.queryByText('未开通')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '购买教师 AI 课' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '查看课程目录' })).toHaveLength(3);
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
