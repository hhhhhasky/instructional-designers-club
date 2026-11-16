import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ConfirmEmailPage from '@/pages/ConfirmEmailPage';

const { setSession, getProfile } = vi.hoisted(() => ({ setSession: vi.fn(), getProfile: vi.fn() }));
vi.mock('@/db/supabase', () => ({ supabase: { auth: { setSession } } }));
vi.mock('@/lib/access-control', () => ({ getProfile }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

beforeEach(() => {
  setSession.mockReset();
  getProfile.mockReset();
  window.history.replaceState(null, '', '/auth/confirm');
});

const confirmedSession = {
  user: { id: 'member', email_confirmed_at: '2026-11-16T09:48:00Z' },
};

it('accepts a signup callback and removes its tokens from the address bar', async () => {
  window.history.replaceState(null, '', '/auth/confirm#type=signup&access_token=a&refresh_token=b');
  setSession.mockResolvedValue({ data: { session: confirmedSession }, error: null });
  getProfile.mockResolvedValue({ status: 'active' });
  render(<StrictMode><MemoryRouter><ConfirmEmailPage /></MemoryRouter></StrictMode>);
  expect(await screen.findByText(/邮箱验证成功/)).toBeInTheDocument();
  expect(setSession).toHaveBeenCalledTimes(1);
  expect(getProfile).toHaveBeenCalledWith('member', { fresh: true });
  expect(window.location.hash).toBe('');
});

it('does not confirm registration if the club profile is missing', async () => {
  window.history.replaceState(null, '', '/auth/confirm#type=signup&access_token=a&refresh_token=b');
  setSession.mockResolvedValue({ data: { session: confirmedSession }, error: null });
  getProfile.mockResolvedValue(null);
  render(<MemoryRouter><ConfirmEmailPage /></MemoryRouter>);
  expect(await screen.findByText(/暂时无法确认注册状态/)).toBeInTheDocument();
  expect(screen.queryByText(/注册已完成/)).not.toBeInTheDocument();
});

it('does not accept a recovery link as signup confirmation', async () => {
  window.history.replaceState(null, '', '/auth/confirm#type=recovery&access_token=a&refresh_token=b');
  render(<MemoryRouter><ConfirmEmailPage /></MemoryRouter>);
  expect(await screen.findByText(/验证链接无效或已过期/)).toBeInTheDocument();
  expect(setSession).not.toHaveBeenCalled();
});
