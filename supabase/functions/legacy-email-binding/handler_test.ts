import { makeLegacyEmailBindingHandler } from './handler.ts';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

Deno.test('legacy user must verify password and new mailbox before changing email', async () => {
  let saved = '';
  let mailed = '';
  let updated = '';
  let verified = false;
  const handler = makeLegacyEmailBindingHandler({
    getUser: () => Promise.resolve({ id: 'user1', email: '13900000000@phone.local' }),
    getProfile: () => Promise.resolve({ data: { phone: '13900000000', status: 'active' }, error: null }),
    reservePasswordCheck: () => Promise.resolve({ data: true, error: null }),
    clearPasswordChecks: () => Promise.resolve(),
    checkPassword: (_e, password) => Promise.resolve(password === 'correct'),
    digest: (id, code) => Promise.resolve(`${id}:${code}`),
    generateCode: () => '12345678',
    start: (_id, email, digest) => { saved = `${email}:${digest}`; return Promise.resolve({ data: true, error: null }); },
    consume: (id, digest) => {
      if (!verified && saved === `new@example.com:${digest}` && id === 'user1') { verified = true; return Promise.resolve({ data: 'new@example.com', error: null }); }
      return Promise.resolve({ data: null, error: null });
    },
    send: (email, code) => { mailed = `${email}:${code}`; return Promise.resolve(); },
    updateEmail: (_id, email) => { updated = email; return Promise.resolve({ data: true, error: null }); },
  });
  const req = (body: object) => new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify(body) });
  assert((await handler(req({ action: 'send', email: 'new@example.com', password: 'wrong' }))).status === 401, 'must verify password');
  assert(!mailed && !updated, 'wrong password must not send or update');
  assert((await handler(req({ action: 'send', email: 'new@example.com', password: 'correct' }))).status === 200, 'send verification');
  assert(mailed === 'new@example.com:12345678' && !updated, 'do not update before verification');
  assert((await handler(req({ action: 'verify', code: '99999999' }))).status === 400 && !updated, 'wrong code rejected');
  assert((await handler(req({ action: 'verify', code: '12345678' }))).status === 200 && updated === 'new@example.com', 'valid code updates original account');
  assert((await handler(req({ action: 'verify', code: '12345678' }))).status === 400, 'code cannot be reused');
});

Deno.test('an account with a real email cannot use the legacy binding route', async () => {
  let touched = false;
  const handler = makeLegacyEmailBindingHandler({
    getUser: () => Promise.resolve({ id: 'user1', email: 'real@example.com' }),
    getProfile: () => Promise.resolve({ data: { phone: '13900000000', status: 'active' }, error: null }),
    reservePasswordCheck: () => Promise.resolve({ data: true, error: null }), clearPasswordChecks: () => Promise.resolve(),
    checkPassword: () => Promise.resolve(true), digest: () => Promise.resolve('x'), generateCode: () => '12345678',
    start: () => { touched = true; return Promise.resolve({ data: true, error: null }); },
    consume: () => Promise.resolve({ data: null, error: null }), send: () => Promise.resolve(),
    updateEmail: () => Promise.resolve({ data: true, error: null }),
  });
  const response = await handler(new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify({ action: 'send' }) }));
  assert(response.status === 403 && !touched, 'do not bypass normal email-change verification');
});
