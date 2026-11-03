import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import EmailBindingCard from '@/components/common/EmailBindingCard';
const api = vi.hoisted(() => ({ invoke: vi.fn(), refresh: vi.fn() }));
vi.mock('@/db/supabase', () => ({ supabase: { functions: { invoke: api.invoke }, auth: { refreshSession: api.refresh } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });

it('asks a legacy user to verify both their password and email before displaying success', async () => {
  api.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  api.refresh.mockResolvedValue({ data: {}, error: null });
  render(<EmailBindingCard currentEmail="13900000000@phone.local" />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'teacher@example.com' } });
  fireEvent.change(screen.getByLabelText('当前账号密码'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
  expect(await screen.findByText(/验证码已发送至/)).toBeInTheDocument();
  expect(api.invoke).toHaveBeenCalledWith('legacy-email-binding', { body: { action: 'send', email: 'teacher@example.com', password: 'password1' } });
  expect(screen.queryByText(/邮箱绑定成功/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('8 位验证码'), { target: { value: '12345678' } });
  fireEvent.click(screen.getByRole('button', { name: '确认绑定' }));
  expect(await screen.findByText(/邮箱绑定成功/)).toBeInTheDocument();
  await waitFor(() => expect(api.refresh).toHaveBeenCalledOnce());
  expect(api.invoke).toHaveBeenLastCalledWith('legacy-email-binding', { body: { action: 'verify', code: '12345678' } });
});

it('does not offer the legacy flow to accounts with a real email', () => {
  render(<EmailBindingCard currentEmail="teacher@example.com" />);
  expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '发送验证码' })).not.toBeInTheDocument();
});

it('restores the pending code step after a full page reload', () => {
  sessionStorage.setItem('idclub-email-binding-pending', JSON.stringify({ email: 'teacher@example.com' }));
  render(<EmailBindingCard currentEmail="13900000000@phone.local" />);
  expect(screen.getByText(/验证码已发送至 teacher@example.com/)).toBeInTheDocument();
  expect(screen.getByLabelText('8 位验证码')).toBeInTheDocument();
  expect(screen.queryByLabelText('当前账号密码')).not.toBeInTheDocument();
});
