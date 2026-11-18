import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

const recovery = vi.hoisted(() => vi.fn());
vi.mock('@/db/legacy-account-recovery', () => ({ requestLegacyRecovery: recovery }));
const auth = vi.hoisted(() => ({ setSession: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/db/supabase', () => ({ supabase: { auth } }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

describe('password recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, '', '/reset-password');
  });

  it('does not allow a password change without a recovery link', async () => {
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
    expect(await screen.findByText(/链接无效或已过期/)).toBeInTheDocument();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('新密码')).not.toBeInTheDocument();
  });

  it('rejects an expired recovery session', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=expired&refresh_token=expired&type=recovery');
    auth.setSession.mockResolvedValue({ data: { session: null }, error: { message: 'expired' } });
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
    expect(await screen.findByText(/链接无效或已过期/)).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('accepts a recovery session once in StrictMode and updates only matching passwords', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=a&refresh_token=b&type=recovery');
    auth.setSession.mockResolvedValue({ data: { session: {} }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    render(<StrictMode><MemoryRouter><ResetPasswordPage /></MemoryRouter></StrictMode>);
    const password = await screen.findByLabelText('新密码');
    expect(auth.setSession).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
    fireEvent.change(password, { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));
    expect(screen.getByRole('alert')).toHaveTextContent('两次输入的密码不一致');
    expect(auth.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'password1' }));
    expect(await screen.findByText(/密码已修改成功/)).toBeInTheDocument();
  });
});

describe('administrator assisted mailbox recovery', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const token = 'a'.repeat(64);
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, '', `/reset-password#legacy_request=${id}&token=${token}`);
  });
  it('keeps mail possession separate from any logged-in session and submits the original credential once', async () => {
    recovery.mockResolvedValue({ ok: true });
    render(<StrictMode><MemoryRouter><ResetPasswordPage /></MemoryRouter></StrictMode>);
    fireEvent.change(await screen.findByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password' } });
    expect(window.location.hash).toBe('');
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '验证邮箱并设置新密码' }));
    expect(await screen.findByText(/邮箱已验证并绑定/)).toBeInTheDocument();
    expect(recovery).toHaveBeenCalledTimes(1);
    expect(recovery).toHaveBeenCalledWith({ action: 'complete', request_id: id, token, password: 'new-password' });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('shows expiration errors without reporting successful binding', async () => {
    recovery.mockResolvedValue({ error: '验证链接已过期，请联系哈老师重新发送' });
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: '验证邮箱并设置新密码' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('验证链接已过期');
    expect(screen.queryByText(/邮箱已验证并绑定/)).not.toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
