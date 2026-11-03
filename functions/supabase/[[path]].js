const UPSTREAM = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const PREFIX = '/supabase';
const AUTH_PATHS = new Set(['/auth/v1/signup', '/auth/v1/token', '/auth/v1/user', '/auth/v1/logout', '/auth/v1/recover', '/auth/v1/verify', '/auth/v1/resend', '/auth/v1/settings']);
const PUBLIC_PREFIXES = ['/rest/v1/', '/storage/v1/', '/functions/v1/', '/realtime/v1/'];

async function parseLoginBody(request) {
  const reader = request.clone().body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { void reader.cancel().catch(() => {}); throw new Error('Login request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

async function resolvePhoneLogin(body, secret, needsEmail = true) {
  const match = typeof body?.email === 'string' && /^(1[3-9]\d{9})@phone\.local$/i.exec(body.email);
  if (!match) return body;
  const headers = { apikey: secret, authorization: `Bearer ${secret}`, 'user-agent': 'idclub-auth-proxy/1.0' };
  const query = new URL('/rest/v1/profiles', UPSTREAM);
  query.searchParams.set('select', 'id');
  query.searchParams.set('phone', `eq.${match[1]}`);
  const profileResponse = await fetch(query, { headers });
  if (!profileResponse.ok) throw new Error('Account lookup failed');
  const profiles = await profileResponse.json();
  if (!Array.isArray(profiles) || profiles.length === 0) return { body, id: null };
  if (profiles.length !== 1 || typeof profiles[0].id !== 'string' || !/^[0-9a-f-]{36}$/i.test(profiles[0].id)) throw new Error('Invalid account lookup');
  if (!needsEmail) return { body, id: profiles[0].id };
  const userResponse = await fetch(`${UPSTREAM}/auth/v1/admin/users/${profiles[0].id}`, { headers });
  if (!userResponse.ok) throw new Error('Account lookup failed');
  const user = await userResponse.json();
  if (typeof user.email !== 'string' || !user.email) throw new Error('Account has no email');
  return { body: user.email === body.email ? body : { ...body, email: user.email }, id: profiles[0].id };
}

async function rejectDuplicatePhoneSignup(body, secret) {
  // 手机号不再是认证邮箱，GoTrue 不会对它查重；撞上 profiles.phone 唯一约束
  // 会让注册以 5xx 收场并被前端误报为网络失败。在这里先查重，返回与 GoTrue
  // 原生邮箱重复一致的 422 形状，前端因此显示"手机号或邮箱已被使用"。
  const phone = typeof body?.data?.phone === 'string' ? body.data.phone.trim() : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) return null;
  const headers = { apikey: secret, authorization: `Bearer ${secret}`, 'user-agent': 'idclub-auth-proxy/1.0' };
  const query = new URL('/rest/v1/profiles', UPSTREAM);
  query.searchParams.set('select', 'id');
  query.searchParams.set('phone', `eq.${phone}`);
  const profileResponse = await fetch(query, { headers });
  // 查重失败不阻塞注册：触发器唯一约束仍是兜底。
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  if (Array.isArray(profiles) && profiles.length > 0) {
    return Response.json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, { status: 422, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  return null;
}

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
  for (const key of ['sb-forwarded-for', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'cf-connecting-ip', 'forwarded', 'cookie', 'host']) headers.delete(key);
  if (auth) {
    // Only Auth endpoints receive this key. Never allow callers to choose the
    // forwarded IP or pass the key to REST, Storage, Functions, or the response.
    const ip = request.headers.get('cf-connecting-ip');
    if (!env.SUPABASE_AUTH_PROXY_SECRET?.startsWith('sb_secret_') || !ip) return new Response('认证服务暂不可用', { status: 503 });
    // Email links are opened by the browser without an Authorization header;
    // Supabase verifies their one-time token. All other Auth requests keep the
    // existing header requirement.
    const emailLink = path === '/auth/v1/verify' && request.method === 'GET';
    if (!emailLink && !/^Bearer\s+\S+$/i.test(headers.get('authorization') || '')) return new Response('Unauthorized', { status: 401 });
    // The secret is used by this server, not by the originating browser.
    headers.set('user-agent', 'idclub-auth-proxy/1.0');
    headers.set('apikey', env.SUPABASE_AUTH_PROXY_SECRET);
    headers.set('sb-forwarded-for', ip);
  }
  try {
    let upstream;
    if (path === '/auth/v1/signup' && request.method === 'POST') {
      const body = await parseLoginBody(request);
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const duplicate = await rejectDuplicatePhoneSignup(body, env.SUPABASE_AUTH_PROXY_SECRET);
        if (duplicate) return duplicate;
      }
    }
    if (path === '/auth/v1/token' && incoming.searchParams.get('grant_type') === 'password' && request.method === 'POST') {
      const body = await parseLoginBody(request);
      if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.email === 'string' && /^(1[3-9]\d{9})@phone\.local$/i.test(body.email)) {
        // Auth runs first, so its per-IP rate limit also protects the lookup.
        upstream = await fetch(new Request(new Request(target.toString(), request.clone()), { headers, redirect: 'manual' }));
        const result = await upstream.clone().json().catch(() => null);
        // GoTrue 的新错误格式（x-supabase-api-version 请求头触发）把 code 设为字符串且没有 error_code 字段；
        // 浏览器里的 supabase-js 会带上该请求头，两种形状都必须识别，否则手机号登录重写不会发生。
        const invalidCredentials = result?.error_code === 'invalid_credentials' || result?.code === 'invalid_credentials';
        if (upstream.ok || (upstream.status === 400 && invalidCredentials)) {
          const resolved = await resolvePhoneLogin(body, env.SUPABASE_AUTH_PROXY_SECRET, !upstream.ok);
          if (upstream.ok && result?.user?.id !== resolved.id) return new Response('认证服务暂不可用', { status: 503, headers: { 'cache-control': 'no-store' } });
          if (!upstream.ok && resolved.body !== body) {
          headers.delete('content-length');
            upstream = await fetch(new Request(target.toString(), { method: request.method, headers, body: JSON.stringify(resolved.body), redirect: 'manual' }));
          }
        }
      }
    }
    if (!upstream) upstream = await fetch(new Request(new Request(target.toString(), request), { headers, redirect: 'manual' }));
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
