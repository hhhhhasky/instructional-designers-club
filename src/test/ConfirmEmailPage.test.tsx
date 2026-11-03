import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ConfirmEmailPage from '@/pages/ConfirmEmailPage';

const setSession = vi.hoisted(() => vi.fn());
vi.mock('@/db/supabase', () => ({ supabase: { auth: { setSession } } }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

beforeEach(() => { setSession.mockReset(); window.history.replaceState(null, '', '/auth/confirm'); });

it('accepts a signup callback and removes its tokens from the address bar', async () => {
  window.history.replaceState(null, '', '/auth/confirm#type=signup&access_token=a&refresh_token=b');
  setSession.mockResolvedValue({ data: { session: {} }, error: null });
  render(<StrictMode><MemoryRouter><ConfirmEmailPage /></MemoryRouter></StrictMode>);
  expect(await screen.findByText(/邮箱验证成功/)).toBeInTheDocument();
  expect(setSession).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe('');
});

it('does not accept a recovery link as signup confirmation', async () => {
  window.history.replaceState(null, '', '/auth/confirm#type=recovery&access_token=a&refresh_token=b');
  render(<MemoryRouter><ConfirmEmailPage /></MemoryRouter>);
  expect(await screen.findByText(/验证链接无效或已过期/)).toBeInTheDocument();
  expect(setSession).not.toHaveBeenCalled();
});
