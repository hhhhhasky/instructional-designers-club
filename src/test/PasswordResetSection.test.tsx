import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PasswordResetSection from '@/components/admin/PasswordResetSection';

const api = vi.hoisted(() => ({ recovery: vi.fn(), list: vi.fn() }));
vi.mock('@/db/legacy-account-recovery', () => ({ requestLegacyRecovery: api.recovery }));
vi.mock('@/db/supabase', () => ({ supabase: { from: () => ({ select: () => ({ order: api.list }) }) } }));
vi.mock('@/components/common/LoadingOverlay', () => ({ default: () => <p>加载中</p> }));
const pending = {
  id: 'request', phone: '13900000000', note: '老学员', user_id: null, status: 'pending',
  recovery_email: 'teacher@example.com', recovery_completed_at: null, temp_password: null,
  created_at: '2026-11-18T00:00:00Z', resolved_at: null,
};
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue({ data: [pending] }); });
afterEach(() => vi.restoreAllMocks());

it('requires administrator identity confirmation and sends mail through the email recovery service', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.recovery.mockResolvedValue({ ok: true });
  render(<PasswordResetSection />);
  fireEvent.click(await screen.findByRole('button', { name: '核实并发送邮件' }));
  await waitFor(() => expect(api.recovery).toHaveBeenCalledWith({ action: 'approve', request_id: 'request' }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('teacher@example.com'));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('13900000000'));
  expect(screen.queryByText(/临时密码/)).not.toBeInTheDocument();
});
it('canceling the identity confirmation leaves the account and email untouched', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<PasswordResetSection />);
  fireEvent.click(await screen.findByRole('button', { name: '核实并发送邮件' }));
  expect(api.recovery).not.toHaveBeenCalled();
});
it('allows resending an approved recovery and hides resend after completion', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.recovery.mockResolvedValue({ ok: true });
  api.list.mockResolvedValueOnce({ data: [{ ...pending, status: 'approved' }] })
    .mockResolvedValue({ data: [{ ...pending, status: 'approved', recovery_completed_at: '2026-11-18T01:00:00Z' }] });
  render(<PasswordResetSection />);
  fireEvent.click(await screen.findByRole('button', { name: '重新发送验证邮件' }));
  await waitFor(() => expect(api.recovery).toHaveBeenCalledWith({ action: 'resend', request_id: 'request' }));
  expect(await screen.findByText('已完成邮箱绑定和改密')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重新发送验证邮件' })).not.toBeInTheDocument();
});
