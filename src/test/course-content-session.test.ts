import { afterEach, describe, expect, it, vi } from 'vitest';

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock('@/db/supabase', () => ({ supabase: { functions: { invoke }, auth: { getSession } } }));

import { getCourseProtectedContent } from '@/db/api';

describe('课程内容的登录状态核验', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

  function rejectCourseAccess() {
    invoke.mockResolvedValue({ error: { message: 'Forbidden', context: new Response(JSON.stringify({ code: 'COURSE_ACCESS_REQUIRED' }), { status: 403 }) } });
    getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
  }

  it('会话已被撤销时提示重新登录', async () => {
    rejectCourseAccess();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'session_not_found' }), { status: 403 })));
    await expect(getCourseProtectedContent('course-1')).rejects.toMatchObject({ code: 'SESSION_EXPIRED', status: 401 });
  });

  it('会话有效时保留课程权限不足的判断', async () => {
    rejectCourseAccess();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(getCourseProtectedContent('course-1')).rejects.toMatchObject({ code: 'COURSE_ACCESS_REQUIRED', status: 403 });
  });

  it('认证服务故障时不误称没有课程权限', async () => {
    rejectCourseAccess();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(getCourseProtectedContent('course-1')).rejects.toMatchObject({ code: 'AUTH_CHECK_FAILED', status: 503 });
  });
});
