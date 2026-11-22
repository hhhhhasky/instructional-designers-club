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

  it('访客首先看到新版公开课，购买沿用通识课的两个入口', async () => {
    open();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByRole('link', { name: '搞定公开课 2027 版' })).toHaveAttribute('href', '/course/gaoding-gongkaike-2027');
    expect(within(cards[0]).getByText(/正在研发中，预计 2027 年初全面上线/)).toBeInTheDocument();
    expect(within(cards[0]).getByText(/升级版.*可先学习旧版/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '教学通识课 2025 版' })).toHaveAttribute('href', '/course/teaching-general-2025');
    expect(screen.getByRole('link', { name: '教师 AI 课' })).toHaveAttribute('href', '/course/teacher-ai');
    expect(screen.getByRole('link', { name: '道法教材解读课' })).toHaveAttribute('href', '/course/daofa');
    const buyButtons = screen.getAllByRole('button', { name: /购买/ });
    expect(buyButtons).toHaveLength(4);
    const user = userEvent.setup();
    const expectedHrefs = ['https://xhslink.com/m/5JAHDTqPSdk', 'https://xhslink.com/m/5JAHDTqPSdk', 'https://xhslink.com/m/4neOp7EhPHm', 'https://xhslink.com/m/277IB24mn8I'];
    for (let i = 0; i < buyButtons.length; i += 1) {
      await user.click(buyButtons[i]);
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getByRole('link', { name: /小红书支付/ })).toHaveAttribute('href', expectedHrefs[i]);
      if (i < 2) {
        await user.click(dialog.getByRole('button', { name: '微信支付' }));
        expect(dialog.getByRole('img')).toHaveAttribute('src', '/images/course-purchase/general-wechat.png');
      }
      await user.keyboard('{Escape}');
    }
  });

  it('公开课、通识课与 AI 课卡片标注包含 HAI 使用权限，道法教材解读课标注不含 HAI', () => {
    open();
    const gongding = screen.getByRole('link', { name: '搞定公开课 2027 版' }).closest('article')!;
    const general = screen.getByRole('link', { name: '教学通识课 2025 版' }).closest('article')!;
    const ai = screen.getByRole('link', { name: '教师 AI 课' }).closest('article')!;
    const daofa = screen.getByRole('link', { name: '道法教材解读课' }).closest('article')!;
    expect(within(gongding).getByText('包含 HAI 使用权限')).toBeInTheDocument();
    expect(within(general).getByText('包含 HAI 使用权限')).toBeInTheDocument();
    expect(within(ai).getByText('包含 HAI 使用权限')).toBeInTheDocument();
    expect(within(daofa).getByText('不含 HAI')).toBeInTheDocument();
  });

  it.each([
    { access: ['teaching-general-v1'] as const, hasNewEdition: false },
    { access: ['teaching-general-v1', 'gongding-gongkaike'] as const, hasNewEdition: true },
  ])('已开通筛选按服务端返回的观看范围显示新旧课程（$access）', async ({ access, hasNewEdition }) => {
    auth.user = { id: 'teacher' };
    auth.courseAccessCodes = [...access];
    open();
    await userEvent.setup().click(screen.getByRole('button', { name: '已开通' }));
    expect(screen.getAllByRole('article')).toHaveLength(hasNewEdition ? 2 : 1);
    const general = screen.getByRole('link', { name: '教学通识课 2025 版' }).closest('article')!;
    expect(within(general).getByText('已开通 · 可观看')).toBeInTheDocument();
    expect(within(general).queryByRole('button', { name: /购买/ })).not.toBeInTheDocument();
    if (hasNewEdition) {
      const newEdition = screen.getByRole('link', { name: '搞定公开课 2027 版' }).closest('article')!;
      expect(within(newEdition).getByText('已开通 · 可查看目录')).toBeInTheDocument();
      expect(within(newEdition).queryByRole('button', { name: /购买/ })).not.toBeInTheDocument();
    } else {
      expect(screen.queryByRole('link', { name: '搞定公开课 2027 版' })).not.toBeInTheDocument();
    }
  });

  it('仅给已开通课程显示可观看，筛选只保留有权限的一门', async () => {
    auth.user = { id: 'teacher' }; auth.courseAccessCodes = ['teacher-ai'];
    open();
    const ai = screen.getByRole('link', { name: '教师 AI 课' }).closest('article')!;
    expect(within(ai).getByText('已开通 · 可观看')).toBeInTheDocument();
    expect(within(ai).queryByRole('button', { name: /购买/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /购买/ })).toHaveLength(3);
    await userEvent.setup().click(screen.getByRole('button', { name: '已开通' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '教师 AI 课' })).toBeInTheDocument();
  });

  it('权限加载时不显示未开通或购买按钮，避免误导已有课程的用户', () => {
    auth.loading = true; open();
    expect(screen.queryByRole('button', { name: /购买/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('正在确认观看权限…')).toHaveLength(4);
  });

  it('管理员可进入所有现有课程', () => {
    auth.user = { id: 'admin' }; auth.profile = { role: 'admin' }; open();
    expect(screen.getAllByText('已开通 · 可观看')).toHaveLength(3);
    expect(screen.getByText('已开通 · 可查看目录')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /购买/ })).not.toBeInTheDocument();
  });
});
