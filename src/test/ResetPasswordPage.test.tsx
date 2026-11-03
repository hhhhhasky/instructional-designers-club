import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

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
