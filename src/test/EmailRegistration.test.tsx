import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import RegisterPage from '@/pages/RegisterPage';
const auth = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

it('collects phone and email and waits for mailbox confirmation before continuing', async () => {
  auth.signUp.mockResolvedValue({ error: null, requiresConfirmation: true });
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13900000000' } });
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'teacher@example.com' } });
  fireEvent.change(screen.getByLabelText('昵称（网站内显示）'), { target: { value: '王老师' } });
  fireEvent.change(screen.getByLabelText('密码（至少6位）'), { target: { value: 'password1' } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: '注册' }));
  expect(await screen.findByText(/请查收邮箱中的验证邮件/)).toBeInTheDocument();
  expect(auth.signUp).toHaveBeenCalledWith('13900000000', 'password1', '王老师', 'teacher@example.com');
});
