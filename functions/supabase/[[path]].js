const UPSTREAM = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const PREFIX = '/supabase';
const AUTH_PATHS = new Set(['/auth/v1/signup', '/auth/v1/token', '/auth/v1/user', '/auth/v1/logout', '/auth/v1/recover', '/auth/v1/verify', '/auth/v1/resend', '/auth/v1/settings']);
const PUBLIC_PREFIXES = ['/rest/v1/', '/storage/v1/', '/functions/v1/', '/realtime/v1/'];

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url);
  const path = incoming.pathname.slice(PREFIX.length);
  const auth = AUTH_PATHS.has(path);
  if (!incoming.pathname.startsWith(`${PREFIX}/`) || (!auth && !PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)))) {
    return new Response('Not found', { status: 404 });
  }
  const target = new URL(path + incoming.search, UPSTREAM);
  if (target.origin !== UPSTREAM || target.pathname !== path) return new Response('Not found', { status: 404 });
  const headers = new Headers(request.headers);
  for (const key of ['sb-forwarded-for', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'forwarded', 'cookie', 'host']) headers.delete(key);
  if (auth) {
    // Only Auth endpoints receive this key. Never allow callers to choose the
    // forwarded IP or pass the key to REST, Storage, Functions, or the response.
    const ip = request.headers.get('cf-connecting-ip');
    if (!env.SUPABASE_AUTH_PROXY_SECRET?.startsWith('sb_secret_') || !ip) return new Response('认证服务暂不可用', { status: 503 });
    if (!/^Bearer\s+\S+$/i.test(headers.get('authorization') || '')) return new Response('Unauthorized', { status: 401 });
    headers.set('apikey', env.SUPABASE_AUTH_PROXY_SECRET);
    headers.set('sb-forwarded-for', ip);
  }
  try {
    const upstream = await fetch(new Request(new Request(target.toString(), request), { headers, redirect: 'manual' }));
    if (upstream.status === 101) return upstream;
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('cache-control', 'no-store');
    const location = responseHeaders.get('location');
    if (location) {
      const redirect = new URL(location, target);
      if (redirect.origin === UPSTREAM) responseHeaders.set('location', `${incoming.origin}${PREFIX}${redirect.pathname}${redirect.search}${redirect.hash}`);
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return new Response('服务暂不可用，请稍后重试', { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
