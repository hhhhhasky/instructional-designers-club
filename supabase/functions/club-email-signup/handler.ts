type SignupDetails = { email: string; phone: string; nickname: string };
type Attempt = { addressKey: string; id: string; digest: string };
type StartResult = 'send' | 'phone_taken' | 'email_unavailable' | 'rate_limited' | 'finishing';

export type Dependencies = {
  digest: (value: string) => Promise<string>;
  code: () => string;
  start: (attempt: Attempt, details: SignupDetails) => Promise<StartResult>;
  claim: (attempt: Attempt) => Promise<boolean>;
  clear: (attempt: Attempt, retry: boolean) => Promise<void>;
  send: (details: SignupDetails, code: string) => Promise<void>;
  create: (details: SignupDetails, password: string) => Promise<'created' | 'duplicate' | 'retry'>;
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const mailboxPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

function reply(status: number, payload: Record<string, unknown>) {
  return Response.json(payload, { status, headers });
}

export function makeClubSignupHandler(deps: Dependencies) {
  async function release(attempt: Attempt, retry: boolean) {
    try {
      await deps.clear(attempt, retry);
    } catch {
      // Failed cleanup cannot transfer a code to a newer attempt. The lease expires.
      console.error('club signup: could not clear attempt');
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply(405, { error: '请求方法不支持。' });
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
    if (email.length > 254 || !mailboxPattern.test(email) || /@(phone|isd)\.local$/.test(email) ||
        !/^1[3-9]\d{9}$/.test(phone) || nickname.length < 2 || nickname.length > 20) {
      return reply(400, { error: '请填写有效的邮箱、手机号和昵称。' });
    }
    const details = { email, phone, nickname };

    try {
      const addressKey = await deps.digest(JSON.stringify(['email', email]));
      const digest = (id: string, code: string) => deps.digest(JSON.stringify(['code', id, email, phone, nickname, code]));
      if (body.action === 'start') {
        const id = crypto.randomUUID();
        const code = deps.code();
        const attempt = { addressKey, id, digest: await digest(id, code) };
        const result = await deps.start(attempt, details);
        if (result === 'phone_taken') return reply(409, { error: '该手机号已注册，请直接登录。' });
        if (result === 'rate_limited') return reply(429, { error: '验证码请求过多，请稍后再试。' });
        if (result === 'finishing') return reply(409, { error: '这次注册正在处理，请稍后再试。' });
        // Match Auth's existing response for an occupied email to avoid exposing email membership.
        if (result === 'email_unavailable') return reply(200, { attemptId: id });
        try {
          await deps.send(details, code);
        } catch {
          await release(attempt, false);
          return reply(502, { error: '验证邮件暂时无法发送，请稍后重试。' });
        }
        return reply(200, { attemptId: id });
      }

      if (body.action !== 'confirm') return reply(400, { error: '请求无效。' });
      const { attemptId: id, code, password } = body;
      if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ||
          typeof code !== 'string' || !/^\d{8}$/.test(code) || typeof password !== 'string' ||
          password.length < 6 || new TextEncoder().encode(password).length > 72) {
        return reply(400, { error: '请填写 8 位验证码和有效的注册密码。' });
      }
      const attempt = { addressKey, id, digest: await digest(id, code) };
      if (!await deps.claim(attempt)) return reply(400, { error: '验证码错误、已过期或已被新提交替换，请使用最新一封邮件。' });
      const created = await deps.create(details, password);
      await release(attempt, created === 'retry');
      if (created === 'duplicate') return reply(409, { error: '手机号或邮箱已注册，请登录或更换注册信息。' });
      if (created === 'retry') return reply(503, { error: '暂时无法创建账号，请稍后重试。' });
      return reply(200, { registered: true });
    } catch {
      console.error('club signup: request failed');
      return reply(503, { error: '注册服务暂不可用，请稍后重试。' });
    }
  };
}
