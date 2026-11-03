import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  getProfile: vi.fn(),
  getCourseCodes: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  supabase: { auth: { getSession: api.getSession, onAuthStateChange: api.onAuthStateChange } },
}));
vi.mock('@/lib/access-control', () => ({
  getProfile: api.getProfile,
  getUserCourseAccessCodes: api.getCourseCodes,
  signInWithIdentifier: vi.fn(),
  signUpWithEmailAndPhone: vi.fn(),
  signOut: api.signOut,
}));
vi.mock('@/db/api', () => ({ clearAllLearningDataCaches: vi.fn() }));

const session = {
  user: { id: 'u1', email: '13900000000@phone.local' },
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
} as unknown as Session;
const profile = { id: 'u1', status: 'active' } as never;

let authListener: ((event: string, s: Session | null) => void) | null = null;

function setup() {
  vi.resetAllMocks();
  authListener = null;
  api.getSession.mockResolvedValue({ data: { session } });
  // 用真实宏任务延迟模拟资料加载，保证加载门有可渲染的时间窗口。
  api.getProfile.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return profile;
  });
  api.getCourseCodes.mockResolvedValue([]);
  api.onAuthStateChange.mockImplementation((callback: (event: string, s: Session | null) => void) => {
    authListener = callback;
    return { data: { subscription: { unsubscribe: () => {} } } };
  });
  const seen: boolean[] = [];
  function Probe() {
    const { loading, user } = useAuth();
    seen.push(loading);
    return <div>{loading ? 'loading' : `ready:${user?.email ?? 'none'}`}</div>;
  }
  return { seen, renderProvider: () => render(<AuthProvider><Probe /></AuthProvider>) };
}

it('keeps the page mounted when the same user token refreshes in the background', async () => {
  const { seen, renderProvider } = setup();
  renderProvider();
  await waitFor(() => expect(screen.getByText('ready:13900000000@phone.local')).toBeInTheDocument());
  expect(api.getProfile).toHaveBeenCalledTimes(1);
  const settledAt = seen.length;

  // 切回标签页时 auth-js 以同一用户发出 SIGNED_IN；定时续期发出 TOKEN_REFRESHED。
  authListener?.('SIGNED_IN', session);
  await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(2));
  authListener?.('TOKEN_REFRESHED', session);
  await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(3));

  expect(seen.slice(settledAt)).not.toContain(true);
  // 静默路径仍后台复检资料（保留封禁复检语义）。
  expect(api.getProfile).toHaveBeenCalledTimes(3);
  expect(screen.getByText('ready:13900000000@phone.local')).toBeInTheDocument();
});

it('still shows the loading gate when a different identity signs in', async () => {
  const { seen, renderProvider } = setup();
  renderProvider();
  await waitFor(() => expect(screen.getByText('ready:13900000000@phone.local')).toBeInTheDocument());
  const settledAt = seen.length;

  // 真实登录必然跨异步加载资料：加载门必须出现，页面内容必须被替换。
  const otherSession = {
    ...session,
    user: { id: 'u2', email: 'teacher@example.com' },
  } as unknown as Session;
  authListener?.('SIGNED_IN', otherSession);
  await waitFor(() => expect(screen.getByText('ready:teacher@example.com')).toBeInTheDocument());

  expect(seen.slice(settledAt)).toContain(true);
  expect(api.getProfile).toHaveBeenCalledTimes(2);
});
