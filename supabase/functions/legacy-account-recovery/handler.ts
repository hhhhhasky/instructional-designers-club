type Target = { user_id: string; email: string; phone: string };
export type Dependencies = {
  digest: (value: string) => Promise<string>;
  token: () => string;
  submit: (phone: string, email: string, note: string) => Promise<boolean>;
  administrator: (authorization: string) => Promise<string | null>;
  prepare: (id: string, admin: string, digest: string) => Promise<Target | { error: string }>;
  claim: (id: string, digest: string) => Promise<Target | null>;
  finish: (id: string, digest: string, success: boolean) => Promise<void>;
  send: (target: Target, id: string, token: string) => Promise<void>;
  update: (target: Target, password: string) => Promise<boolean>;
};
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply = (status: number, payload: Record<string, unknown>) => Response.json(payload, { status, headers });

export function makeLegacyRecoveryHandler(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: '请求方法不支持' });
    try {
      const body = await request.json().catch(() => null);
      if (body?.action === 'submit') {
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const note = typeof body.note === 'string' ? body.note.trim() : '';
        if (!/^1[3-9]\d{9}$/.test(phone) || email.length > 254 ||
            !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email) ||
            /@(phone|isd)\.local$/.test(email) || note.length > 50) {
          return reply(400, { error: '请填写正确的注册手机号和可收信的邮箱，备注最多50字' });
        }
        if (!await deps.submit(phone, email, note)) return reply(429, { error: '申请过于频繁，请稍后再试或直接联系哈老师' });
        return reply(200, { ok: true });
      }
      const id = body?.request_id;
      if (typeof id !== 'string' || !uuid.test(id)) return reply(400, { error: '请求无效' });
      if (body.action === 'approve' || body.action === 'resend') {
        const admin = await deps.administrator(request.headers.get('Authorization') ?? '');
        if (!admin) return reply(403, { error: '仅管理员可以处理邮箱找回申请' });
        const token = deps.token();
        const digest = await deps.digest(`${id}:${token}`);
        const target = await deps.prepare(id, admin, digest);
        if ('error' in target) return reply(409, { error: target.error });
        try {
          await deps.send(target, id, token);
        } catch {
          await deps.finish(id, digest, false);
          return reply(502, { error: '验证邮件发送失败，原账号未改变；请稍后点击重新发送' });
        }
        return reply(200, { ok: true, email_sent: true });
      }
      if (body.action !== 'complete' || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token) ||
          typeof body.password !== 'string' || body.password.length < 6 || new TextEncoder().encode(body.password).length > 72) {
        return reply(400, { error: '链接无效，或密码长度不符合要求（至少6位，最多72字节）' });
      }
      const digest = await deps.digest(`${id}:${body.token}`);
      const target = await deps.claim(id, digest);
      if (!target) return reply(400, { error: '验证链接无效、已过期或已使用，请联系哈老师重新发送' });
      let updated = false;
      try { updated = await deps.update(target, body.password); } catch { /* The credential remains consumed. */ }
      if (!updated) {
        await deps.finish(id, digest, false);
        return reply(409, { error: '暂未完成绑定和改密，邮箱可能已被使用或账号状态发生变化；请联系哈老师核对并重新发送邮件' });
      }
      // Auth is authoritative. Failure to record the receipt must not falsely report a failed password change.
      try { await deps.finish(id, digest, true); } catch { console.error('legacy recovery: could not record completion'); }
      return reply(200, { ok: true });
    } catch {
      console.error('legacy recovery: request failed');
      return reply(503, { error: '找回服务暂不可用，请稍后重试' });
    }
  };
}
