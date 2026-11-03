import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/db/supabase', () => ({ supabase: { auth: { resetPasswordForEmail: send } } }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

beforeEach(() => { send.mockReset(); });

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
