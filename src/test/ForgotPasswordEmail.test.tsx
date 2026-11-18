import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';

const send = vi.hoisted(() => vi.fn());
const recovery = vi.hoisted(() => vi.fn());
vi.mock('@/db/legacy-account-recovery', () => ({ requestLegacyRecovery: recovery }));
vi.mock('@/db/supabase', () => ({ supabase: { auth: { resetPasswordForEmail: send } } }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

beforeEach(() => { send.mockReset(); recovery.mockReset(); });

it('requests an email reset and gives the same response without revealing whether an account exists', async () => {
  send.mockResolvedValue({ error: null });
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('已绑定的邮箱'), { target: { value: 'teacher@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '发送重置邮件' }));
  expect(await screen.findByText(/如果邮箱已绑定账号/)).toBeInTheDocument();
  expect(send).toHaveBeenCalledWith('teacher@example.com', {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  expect(screen.getByRole('button', { name: /还没有绑定邮箱/ })).toBeInTheDocument();
});

it('submits the original phone and new mailbox for review without requesting a password', async () => {
  recovery.mockResolvedValue({ ok: true });
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /还没有绑定邮箱/ }));
  expect(screen.queryByLabelText(/密码/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('注册时使用的手机号'), { target: { value: '13900000000' } });
  fireEvent.change(screen.getByLabelText('准备绑定的邮箱'), { target: { value: 'teacher@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '提交重置申请' }));
  expect(await screen.findByText('申请已提交')).toBeInTheDocument();
  expect(recovery).toHaveBeenCalledWith({ action: 'submit', phone: '13900000000', email: 'teacher@example.com', note: '' });
  expect(screen.getByText(/验证邮件将发送至/)).toHaveTextContent('teacher@example.com');
  expect(screen.queryByText(/临时密码/)).not.toBeInTheDocument();
});

it('rejects a missing mailbox before submitting a manual recovery request', async () => {
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /还没有绑定邮箱/ }));
  fireEvent.change(screen.getByLabelText('注册时使用的手机号'), { target: { value: '13900000000' } });
  fireEvent.click(screen.getByRole('button', { name: '提交重置申请' }));
  expect(await screen.findByText('请输入可收信的邮箱')).toBeInTheDocument();
  expect(recovery).not.toHaveBeenCalled();
});
