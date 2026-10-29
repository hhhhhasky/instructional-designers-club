// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
// Pages Functions run as JavaScript modules; exercise the actual handler.
// @ts-expect-error The Pages function is JavaScript outside the TypeScript project.
import { onRequest } from '../../functions/supabase/[[path]].js';

const env = { SUPABASE_AUTH_PROXY_SECRET: 'sb_secret_test_only' };
const incoming = (path: string, init: RequestInit = {}) => new Request(`https://idclub.hasky.top/supabase${path}`, init);

afterEach(() => vi.unstubAllGlobals());

describe('Supabase same-origin proxy', () => {
  it('forwards signup with the Cloudflare client IP and never forwards a forged IP', async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = incoming('/auth/v1/signup', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile', 'sb-forwarded-for': '198.51.100.1', authorization: 'Bearer user-token', apikey: 'public-key' }, body: '{"email":"example"}' });
    const response = await onRequest({ request: req, env });
    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe('https://isjflmyhbvdlmcsaewbq.supabase.co/auth/v1/signup');
    expect(forwarded.headers.get('sb-forwarded-for')).toBe('203.0.113.1');
    expect(forwarded.headers.get('apikey')).toBe(env.SUPABASE_AUTH_PROXY_SECRET);
    expect(forwarded.headers.get('user-agent')).toBe('idclub-auth-proxy/1.0');
    expect(forwarded.headers.get('authorization')).toBe('Bearer user-token');
    expect(await forwarded.text()).toBe('{"email":"example"}');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not give the secret to database and function requests', async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/rest/v1/profiles?id=eq.123', { headers: { apikey: 'public-key', authorization: 'Bearer user-token', 'sb-forwarded-for': 'spoofed' } }), env });
    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0][0] as Request;
    expect(forwarded.headers.get('apikey')).toBe('public-key');
    expect(forwarded.headers.get('authorization')).toBe('Bearer user-token');
    expect(forwarded.headers.has('sb-forwarded-for')).toBe(false);
    expect(forwarded.url).toContain('/rest/v1/profiles?id=eq.123');
  });

  it('blocks auth administration and fails closed if rate-limit forwarding is unavailable', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await onRequest({ request: incoming('/auth/v1/admin/users'), env })).status).toBe(404);
    expect((await onRequest({ request: incoming('/auth/v1/token'), env: {} })).status).toBe(503);
    expect((await onRequest({ request: incoming('/auth/v1/token'), env })).status).toBe(503);
    expect((await onRequest({ request: incoming('/auth/v1/token', { headers: { 'cf-connecting-ip': '203.0.113.1' } }), env })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rewrites upstream storage redirects to the same origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_request: Request) => new Response(null, { status: 302, headers: { location: 'https://isjflmyhbvdlmcsaewbq.supabase.co/storage/v1/object/public/avatars/a.png?x=1' } })));
    const response = await onRequest({ request: incoming('/storage/v1/object/public/avatars/a.png'), env });
    expect(response.headers.get('location')).toBe('https://idclub.hasky.top/supabase/storage/v1/object/public/avatars/a.png?x=1');
  });
});
