// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
// Pages Functions run as JavaScript modules; exercise the actual handler.
// @ts-expect-error The Pages function is JavaScript outside the TypeScript project.
import { onRequest } from '../../functions/supabase/[[path]].js';

const env = { SUPABASE_AUTH_PROXY_SECRET: 'sb_secret_test_only' };
const incoming = (path: string, init: RequestInit = {}) => new Request(`https://idclub.hasky.top/supabase${path}`, init);

afterEach(() => vi.unstubAllGlobals());

describe('Supabase same-origin proxy', () => {
  it('resolves a phone login on the server, and forwards the real client IP to Auth', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const seen: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      seen.push(req);
      if (req.url.includes('/rest/v1/profiles')) return Response.json([{ id: userId }]);
      if (req.url.includes('/auth/v1/admin/users/')) return Response.json({ id: userId, email: 'private@example.com' });
      if (req.url.includes('/auth/v1/token') && seen.length === 1) return Response.json({ error_code: 'invalid_credentials' }, { status: 400 });
      return Response.json({ access_token: 'token' });
    }));
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'test' }) }), env });
    expect(response.status).toBe(200);
    expect((await response.text())).not.toContain('private@example.com');
    expect(seen).toHaveLength(4);
    expect(seen[1].headers.get('apikey')).toBe(env.SUPABASE_AUTH_PROXY_SECRET);
    expect(seen[3].headers.get('sb-forwarded-for')).toBe('203.0.113.1');
    expect((await seen[3].json()).email).toBe('private@example.com');
  });

  it('also resolves phone logins when Auth returns the new error shape sent to supabase-js clients', async () => {
    // 浏览器里的 supabase-js 发送 x-supabase-api-version 头，GoTrue 因此返回
    // { code: 'invalid_credentials', message } 而不是 { error_code, msg }。
    const userId = '11111111-1111-4111-8111-111111111111';
    const seen: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      seen.push(req);
      if (req.url.includes('/rest/v1/profiles')) return Response.json([{ id: userId }]);
      if (req.url.includes('/auth/v1/admin/users/')) return Response.json({ id: userId, email: 'private@example.com' });
      if (req.url.includes('/auth/v1/token') && seen.length === 1) return Response.json({ code: 'invalid_credentials', message: 'Invalid login credentials' }, { status: 400 });
      return Response.json({ access_token: 'token' });
    }));
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'test' }) }), env });
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(4);
    expect((await seen[3].json()).email).toBe('private@example.com');
  });

  it('keeps existing phone-only logins and checks the authenticated user belongs to that phone', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn(async (input: Request | URL | string) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.includes('/rest/v1/profiles') ? Response.json([{ id: userId }]) : Response.json({ user: { id: userId }, access_token: 'token' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'test' }) }), env });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never returns a session if the authenticated account does not own that phone', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: Request | URL | string) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.includes('/rest/v1/profiles') ? Response.json([{ id: '11111111-1111-4111-8111-111111111111' }]) : Response.json({ user: { id: '22222222-2222-4222-8222-222222222222' }, access_token: 'private-token' });
    }));
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'test' }) }), env });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-token');
  });

  it('fails closed if phone lookup fails and never returns the secret', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ++calls === 1 ? Response.json({ error_code: 'invalid_credentials' }, { status: 400 }) : new Response('failure', { status: 503 })));
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'test' }) }), env });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(env.SUPABASE_AUTH_PROXY_SECRET);
  });

  it('passes real email login straight through and does not expose the input to account lookup', async () => {
    const fetchMock = vi.fn(async (_request: Request) => Response.json({ error: 'invalid' }, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'person@example.com', password: 'wrong' }) }), env });
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await (fetchMock.mock.calls[0][0] as Request).json()).email).toBe('person@example.com');
  });

  it('rejects excessive password request bodies before lookup', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'x'.repeat(10000) }) }), env });
    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not perform privileged account lookups after Auth rate-limits the client', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error_code: 'over_request_rate_limit' }, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', authorization: 'Bearer public-key', 'content-type': 'application/json' }, body: JSON.stringify({ email: '13900000000@phone.local', password: 'wrong' }) }), env });
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards signup with the Cloudflare client IP and never forwards a forged IP', async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = incoming('/auth/v1/signup', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.1', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile', 'sb-forwarded-for': '198.51.100.1', authorization: 'Bearer user-token', apikey: 'public-key' }, body: '{"email":"example"}' });
    const response = await onRequest({ request: req, env });
    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe('https://isjflmyhbvdlmcsaewbq.supabase.co/auth/v1/signup');
    expect(forwarded.headers.get('sb-forwarded-for')).toBe('203.0.113.1');
    expect(forwarded.headers.has('cf-connecting-ip')).toBe(false);
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

  it('forwards a one-time email verification link without requiring a browser Authorization header', async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response(null, { status: 302, headers: { location: 'https://idclub.hasky.top/auth/confirm#access_token=test' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({ request: incoming('/auth/v1/verify?token=one-time&type=signup', { headers: { 'cf-connecting-ip': '203.0.113.1' } }), env });
    expect(response.status).toBe(302);
    const forwarded = fetchMock.mock.calls[0][0] as Request;
    expect(forwarded.headers.get('apikey')).toBe(env.SUPABASE_AUTH_PROXY_SECRET);
    expect(forwarded.headers.get('sb-forwarded-for')).toBe('203.0.113.1');
    expect(response.headers.get('location')).toContain('idclub.hasky.top/auth/confirm');
  });

  it('rewrites upstream storage redirects to the same origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_request: Request) => new Response(null, { status: 302, headers: { location: 'https://isjflmyhbvdlmcsaewbq.supabase.co/storage/v1/object/public/avatars/a.png?x=1' } })));
    const response = await onRequest({ request: incoming('/storage/v1/object/public/avatars/a.png'), env });
    expect(response.headers.get('location')).toBe('https://idclub.hasky.top/supabase/storage/v1/object/public/avatars/a.png?x=1');
  });
});
