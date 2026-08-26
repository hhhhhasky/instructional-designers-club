import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWithPhone, signUpWithPhone, updateLearningProgress } from '@/lib/access-control';
import { supabase } from '@/db/supabase';

vi.mock('@/db/api', () => ({
  clearLearningDataCache: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('phone auth error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps Supabase signUp Load failed errors to a readable registration message', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: Object.assign(new Error('Load failed'), {
        name: 'AuthRetryableFetchError',
        status: 0,
      }),
    } as never);

    const result = await signUpWithPhone('19900000001', 'password1', '新学员');

    expect(result).toEqual({
      error: '注册失败：网络请求失败，请检查网络连接后重试',
      session: null,
      user: null,
    });
  });

  it('returns a registration error instead of throwing when signUp rejects', async () => {
    vi.mocked(supabase.auth.signUp).mockRejectedValue(new TypeError('Load failed'));

    const result = await signUpWithPhone('19900000002', 'password1', '新学员');

    expect(result.error).toBe('注册失败：网络请求失败，请检查网络连接后重试');
    expect(result.session).toBeNull();
    expect(result.user).toBeNull();
  });

  it('maps login network failures without exposing raw Load failed text', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: Object.assign(new Error('Load failed'), {
        name: 'AuthRetryableFetchError',
        status: 0,
      }),
    } as never);

    const result = await signInWithPhone('19900000003', 'password1');

    expect(result.error).toBe('登录失败：网络请求失败，请检查网络连接后重试');
  });

  it('signs out and rejects a banned account after credential verification', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'banned-user' }, session: { access_token: 'token' } },
      error: null,
    } as never);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'banned' }, error: null }),
        })),
      })),
    } as never);

    const result = await signInWithPhone('19900000004', 'password1');

    expect(result).toEqual({ error: '该账号已停用，请联系管理员', session: null, user: null });
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });
});

describe('learning progress persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts by user and course so the first progress write cannot silently miss', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await updateLearningProgress('user-1', 'course-1', 31.5, 'in_progress');

    expect(supabase.from).toHaveBeenCalledWith('learning_records');
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        course_id: 'course-1',
        progress: 31.5,
        status: 'in_progress',
        last_watched_at: expect.any(String),
      },
      { onConflict: 'user_id,course_id' },
    );
  });

  it('surfaces Supabase write errors so the page can retry later', async () => {
    const writeError = new Error('progress write failed');
    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: writeError }),
    } as never);

    await expect(updateLearningProgress('user-1', 'course-1', 42, 'in_progress')).rejects.toBe(writeError);
  });
});
