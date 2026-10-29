import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('Supabase browser URLs', () => {
  it('uses same-origin URLs and rewrites only this project’s old storage links', async () => {
    vi.stubEnv('VITE_SUPABASE_PROXY_ENABLED', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://isjflmyhbvdlmcsaewbq.supabase.co');
    const { supabaseBaseUrl, proxiedSupabaseUrl, canonicalSupabaseStorageUrl } = await import('@/lib/supabase-url');
    expect(supabaseBaseUrl).toBe(`${window.location.origin}/supabase`);
    expect(proxiedSupabaseUrl('https://isjflmyhbvdlmcsaewbq.supabase.co/storage/v1/object/public/avatars/a.png?t=1')).toBe(`${window.location.origin}/supabase/storage/v1/object/public/avatars/a.png?t=1`);
    expect(canonicalSupabaseStorageUrl(`${window.location.origin}/supabase/storage/v1/object/public/avatars/a.png?t=1`)).toBe('https://isjflmyhbvdlmcsaewbq.supabase.co/storage/v1/object/public/avatars/a.png?t=1');
    expect(proxiedSupabaseUrl('https://other.example/storage/v1/a.png')).toBe('https://other.example/storage/v1/a.png');
    expect(proxiedSupabaseUrl('https://isjflmyhbvdlmcsaewbq.supabase.co/rest/v1/profiles')).toBe('https://isjflmyhbvdlmcsaewbq.supabase.co/rest/v1/profiles');
  });
  it('keeps direct URLs in development without the proxy switch', async () => {
    vi.stubEnv('VITE_SUPABASE_PROXY_ENABLED', 'false');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://isjflmyhbvdlmcsaewbq.supabase.co');
    const { supabaseBaseUrl, proxiedSupabaseUrl } = await import('@/lib/supabase-url');
    const url = 'https://isjflmyhbvdlmcsaewbq.supabase.co/storage/v1/object/public/avatars/a.png';
    expect(supabaseBaseUrl).toBe('https://isjflmyhbvdlmcsaewbq.supabase.co');
    expect(proxiedSupabaseUrl(url)).toBe(url);
  });
});
