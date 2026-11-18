import { makeLegacyRecoveryHandler, type Dependencies } from './handler.ts';

function assert(value: unknown, message = 'assertion failed'): asserts value { if (!value) throw new Error(message); }
const id = '11111111-1111-4111-8111-111111111111';
const target = { user_id: '22222222-2222-4222-8222-222222222222', email: 'teacher@example.com', phone: '13900000000' };
const token = 'a'.repeat(64);
const req = (body: unknown, authorization = '') => new Request('https://example.test', { method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body) });
function setup(overrides: Partial<Dependencies> = {}) {
  const calls: string[] = [];
  const deps: Dependencies = {
    digest: (v) => Promise.resolve(v), token: () => token,
    submit: () => { calls.push('submit'); return Promise.resolve(true); },
    administrator: (auth) => Promise.resolve(auth === 'Bearer admin' ? 'admin-id' : null),
    prepare: () => { calls.push('prepare'); return Promise.resolve(target); },
    claim: () => { calls.push('claim'); return Promise.resolve(target); },
    finish: (_id, _digest, success) => { calls.push(`finish:${success}`); return Promise.resolve(); },
    send: () => { calls.push('send'); return Promise.resolve(); },
    update: (value, password) => { assert(value.user_id === target.user_id && password === 'new-password'); calls.push('update'); return Promise.resolve(true); },
    ...overrides,
  };
  return { handler: makeLegacyRecoveryHandler(deps), calls };
}
Deno.test('public submission normalizes email, ignores forged approval fields and never changes Auth', async () => {
  const { handler, calls } = setup({ submit: (phone, email, note) => {
    assert(phone === target.phone && email === target.email && note === '老学员'); return Promise.resolve(true);
  } });
  const response = await handler(req({ action: 'submit', phone: target.phone, email: ' Teacher@Example.com ', note: ' 老学员 ', user_id: 'victim', status: 'approved' }));
  assert(response.status === 200 && calls.length === 0);
});
Deno.test('invalid mailbox and excessive submissions never send mail', async () => {
  const { handler, calls } = setup({ submit: () => Promise.resolve(false) });
  assert((await handler(req({ action: 'submit', phone: target.phone, email: '13900000000@phone.local' }))).status === 400);
  assert((await handler(req({ action: 'submit', phone: target.phone, email: target.email }))).status === 429);
  assert(calls.length === 0);
});
Deno.test('non-admin cannot approve or resend mail', async () => {
  const { handler, calls } = setup();
  for (const action of ['approve', 'resend']) assert((await handler(req({ action, request_id: id }, 'Bearer member'))).status === 403);
  assert(calls.length === 0);
});
Deno.test('approval sends a credential but does not bind email or set password', async () => {
  const { handler, calls } = setup();
  const response = await handler(req({ action: 'approve', request_id: id }, 'Bearer admin'));
  assert(response.status === 200 && calls.join(',') === 'prepare,send');
  assert(!JSON.stringify(await response.json()).includes(token));
});
Deno.test('SQL eligibility failure cannot trigger email delivery', async () => {
  const { handler, calls } = setup({ prepare: () => Promise.resolve({ error: '邮箱已被使用' }) });
  assert((await handler(req({ action: 'approve', request_id: id }, 'Bearer admin'))).status === 409);
  assert(!calls.includes('send'));
});
Deno.test('SMTP failure invalidates this credential and supports a fresh administrator resend', async () => {
  const { handler, calls } = setup({ send: () => Promise.reject(new Error('smtp')) });
  assert((await handler(req({ action: 'resend', request_id: id }, 'Bearer admin'))).status === 502);
  assert(calls.join(',') === 'prepare,finish:false');
});
Deno.test('unapproved, expired or replayed credential cannot change password', async () => {
  const { handler, calls } = setup({ claim: () => Promise.resolve(null) });
  assert((await handler(req({ action: 'complete', request_id: id, token, password: 'new-password' }))).status === 400);
  assert(!calls.includes('update'));
});
Deno.test('mail possession updates only the approved account and records completion', async () => {
  const { handler, calls } = setup();
  assert((await handler(req({ action: 'complete', request_id: id, token, password: 'new-password', user_id: 'victim', email: 'other@example.com' }))).status === 200);
  assert(calls.join(',') === 'claim,update,finish:true');
});
Deno.test('failed Auth update consumes the link and tells the member to contact administrator', async () => {
  const { handler, calls } = setup({ update: () => Promise.resolve(false) });
  assert((await handler(req({ action: 'complete', request_id: id, token, password: 'new-password' }))).status === 409);
  assert(calls.join(',') === 'claim,finish:false');
});
Deno.test('malformed credential or overlong multibyte password cannot consume a valid link', async () => {
  const { handler, calls } = setup();
  for (const body of [{ token: 'bad', password: 'new-password' }, { token, password: '汉'.repeat(25) }]) {
    assert((await handler(req({ action: 'complete', request_id: id, ...body }))).status === 400);
  }
  assert(calls.length === 0);
});
Deno.test('receipt failure after successful Auth update does not claim password reset failed', async () => {
  const { handler } = setup({ finish: () => Promise.reject(new Error('offline')) });
  assert((await handler(req({ action: 'complete', request_id: id, token, password: 'new-password' }))).status === 200);
});
