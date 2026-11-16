import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import RegisterPage from '@/pages/RegisterPage';

const requestClubSignup = vi.hoisted(() => vi.fn());
vi.mock('@/db/club-email-signup', () => ({ requestClubSignup }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

beforeEach(() => requestClubSignup.mockReset());

function fillAndSend(phone: string) {
  fireEvent.change(screen.getByLabelText('手机号'), { target: { value: phone } });
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'teacher@example.com' } });
  fireEvent.change(screen.getByLabelText('昵称（网站内显示）'), { target: { value: '王老师' } });
  fireEvent.change(screen.getByLabelText('密码（至少6位）'), { target: { value: 'password1' } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: '发送验证邮件' }));
}

it('sends mail for the submitted phone and completes only after a separate code verification', async () => {
  requestClubSignup.mockResolvedValueOnce({ attemptId: 'first' }).mockResolvedValueOnce({ registered: true });
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  fillAndSend('13900000000');
  expect(await screen.findByText(/尾号 0000/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: '去查看邮件' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: /验证码 10 分钟内有效.*过期后请重新提交注册/ })).toBeInTheDocument();
  expect(screen.queryByText(/注册已完成/)).not.toBeInTheDocument();
  expect(requestClubSignup).toHaveBeenNthCalledWith(1, {
    action: 'start', phone: '13900000000', nickname: '王老师', email: 'teacher@example.com',
  });
  fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '12345678' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并完成注册' }));
  expect(await screen.findByText(/注册已完成/)).toBeInTheDocument();
  expect(requestClubSignup).toHaveBeenNthCalledWith(2, {
    action: 'confirm', attemptId: 'first', phone: '13900000000', nickname: '王老师',
    email: 'teacher@example.com', password: 'password1', code: '12345678',
  });
});

it('replaces the submitted phone and verification state when the form is resubmitted', async () => {
  requestClubSignup.mockResolvedValueOnce({ attemptId: 'old' }).mockResolvedValueOnce({ attemptId: 'latest' })
    .mockResolvedValueOnce({ error: '验证码错误，请使用最新一封邮件。' });
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  fillAndSend('13900000001');
  expect(await screen.findByText(/尾号 0001/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '12345678' } });
  fireEvent.click(screen.getByRole('button', { name: '修改资料或重新发送' }));
  fillAndSend('13900000002');
  expect(await screen.findByText(/尾号 0002/)).toBeInTheDocument();
  expect(screen.getByLabelText('邮箱验证码')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '87654321' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并完成注册' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('请使用最新一封邮件');
  expect(requestClubSignup).toHaveBeenLastCalledWith(expect.objectContaining({
    action: 'confirm', attemptId: 'latest', phone: '13900000002', code: '87654321',
  }));
  expect(screen.queryByText(/注册已完成/)).not.toBeInTheDocument();
});
