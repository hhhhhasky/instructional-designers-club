type User = { id: string; email: string | null };
type Result<T> = { data: T; error: unknown };
type Dependencies = {
  getUser: (authorization: string) => Promise<User | null>;
  getProfile: (userId: string) => Promise<Result<{ phone: string; status: string } | null>>;
  checkPassword: (email: string, password: string, userId: string) => Promise<boolean>;
  reservePasswordCheck: (phone: string) => Promise<Result<boolean>>;
  clearPasswordChecks: (phone: string) => Promise<unknown>;
  digest: (userId: string, code: string) => Promise<string>;
  generateCode: () => string;
  start: (userId: string, email: string, digest: string) => Promise<Result<boolean>>;
  consume: (userId: string, digest: string) => Promise<Result<string | null>>;
  send: (email: string, code: string) => Promise<void>;
  updateEmail: (userId: string, email: string) => Promise<Result<boolean>>;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const json = (value: object, status: number) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export function makeLegacyEmailBindingHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: '请求方式不支持' }, 405);
    try {
      const authorization = request.headers.get('Authorization') ?? '';
      if (!authorization.startsWith('Bearer ')) return json({ error: '请先登录' }, 401);
      const user = await deps.getUser(authorization);
      if (!user) return json({ error: '请重新登录' }, 401);
      const profile = await deps.getProfile(user.id);
      if (profile.error) return json({ error: '暂时无法验证账号，请稍后重试' }, 503);
      if (!profile.data || profile.data.status !== 'active' || user.email !== `${profile.data.phone}@phone.local`) return json({ error: '当前账号不能使用此绑定方式' }, 403);
      const body = await request.json();
      if (body.action === 'send') {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email) || email.length > 254 || email.endsWith('@phone.local') || !password || password.length > 1024) return json({ error: '请检查邮箱和密码' }, 400);
        const reserved = await deps.reservePasswordCheck(profile.data.phone);
        if (reserved.error) return json({ error: '暂时无法验证账号，请稍后重试' }, 503);
        if (!reserved.data) return json({ error: '尝试次数过多，请稍后重试' }, 429);
        if (!await deps.checkPassword(user.email, password, user.id)) return json({ error: '账号密码不正确' }, 401);
        await deps.clearPasswordChecks(profile.data.phone);
        const code = deps.generateCode();
        const started = await deps.start(user.id, email, await deps.digest(user.id, code));
        if (started.error) return json({ error: '暂时无法发送，请稍后重试' }, 503);
        if (!started.data) return json({ error: '发送太频繁，请稍后再试' }, 429);
        await deps.send(email, code);
        return json({ ok: true }, 200);
      }
      if (body.action === 'verify') {
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        if (!/^\d{8}$/.test(code)) return json({ error: '请输入8位验证码' }, 400);
        const result = await deps.consume(user.id, await deps.digest(user.id, code));
        if (result.error) return json({ error: '暂时无法验证，请稍后重试' }, 503);
        if (!result.data) return json({ error: '验证码错误或已失效，请重新获取' }, 400);
        const changed = await deps.updateEmail(user.id, result.data);
        if (changed.error || !changed.data) return json({ error: '绑定未成功，邮箱可能已被使用；请检查后重新获取验证码' }, 400);
        return json({ ok: true }, 200);
      }
      return json({ error: '请求参数有误' }, 400);
    } catch {
      return json({ error: '操作失败，请稍后重试' }, 503);
    }
  };
}
