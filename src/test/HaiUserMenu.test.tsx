import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HaiUserMenu from '@/components/hai/HaiUserMenu';
import HaiWorkShell from '@/components/hai/HaiWorkShell';
import { archiveHaiMemory, createHaiMemory, getHaiMemories, type HaiUsageSummary } from '@/db/hai-api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'teacher-1' }, profile: { nickname: '林老师' } }) }));
vi.mock('@/db/hai-api', () => ({ getHaiMemories: vi.fn(), createHaiMemory: vi.fn(), archiveHaiMemory: vi.fn(), getHaiAccessStatus: vi.fn() }));
const usage = { quota_mode: 'points', current_points: 150, consumed_points: 20 } as HaiUsageSummary;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHaiMemories).mockResolvedValue([]);
  vi.mocked(createHaiMemory).mockResolvedValue({} as never);
  vi.mocked(archiveHaiMemory).mockResolvedValue(undefined as never);
});

describe('HAI 顶部积分与记忆设置', () => {
  it('展示积分与购买入口，只在点击后读取记忆，支持保存与归档', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><HaiUserMenu usage={usage} /></MemoryRouter>);
    expect(screen.getByTitle('当前积分')).toHaveTextContent('150 积分');
    expect(screen.getByRole('link', { name: '购买积分' })).toHaveAttribute('href', '/hai/points');
    expect(getHaiMemories).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '记忆设置' }));
    const dialog = within(screen.getByRole('dialog'));
    await dialog.findByText('暂无记忆');
    vi.mocked(getHaiMemories).mockResolvedValue([{ id: 'memory-1', category: 'constraint', content: '每课40分钟' }] as never);
    await user.selectOptions(dialog.getByLabelText('记忆分类'), 'constraint');
    await user.type(dialog.getByLabelText('用户记忆内容'), '每课40分钟');
    await user.click(dialog.getByRole('button', { name: '保存记忆' }));
    expect(createHaiMemory).toHaveBeenCalledWith({ userId: 'teacher-1', category: 'constraint', content: '每课40分钟' });
    await dialog.findByText('每课40分钟');
    await user.click(dialog.getByRole('button', { name: '归档记忆' }));
    expect(archiveHaiMemory).toHaveBeenCalledWith('memory-1');
    await dialog.findByText('暂无记忆');
  });

  it('保存失败时保留输入，给出明确反馈', async () => {
    vi.mocked(createHaiMemory).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<MemoryRouter><HaiUserMenu usage={usage} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: '记忆设置' }));
    await screen.findByText('暂无记忆');
    await user.type(screen.getByLabelText('用户记忆内容'), '需要小组合作');
    await user.click(screen.getByRole('button', { name: '保存记忆' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('记忆未能保存');
    expect(screen.getByLabelText('用户记忆内容')).toHaveValue('需要小组合作');
  });

  it('Work 顶部提供记忆入口', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/hai/work']}><HaiWorkShell usage={usage} sidebar={<p>历史任务</p>}>开始工作</HaiWorkShell></MemoryRouter>);
    expect(screen.queryByRole('button', { name: '打开历史版本' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记忆设置' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('林老师');
    expect(await screen.findByText('用户记忆')).toBeInTheDocument();
  });
  it('记忆入口位于顶部，记录抽屉中不重复显示', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/hai/work']}><HaiWorkShell usage={usage} sidebar={<p>历史任务</p>}>开始工作</HaiWorkShell></MemoryRouter>);
    expect(screen.getByRole('button', { name: '记忆设置' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '打开任务记录' }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: '记忆设置' })).not.toBeInTheDocument();
  });

});
