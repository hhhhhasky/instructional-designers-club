import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';

// 刷新或误操作后直接回到输码步骤，避免重发验证码；服务端验证码 10 分钟内有效。
const PENDING_STORAGE_KEY = 'idclub-email-binding-pending';

function readPendingEmail(): string {
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { email?: unknown };
    return typeof parsed.email === 'string' ? parsed.email : '';
  } catch { return ''; }
}

export default function EmailBindingCard({ currentEmail }: { currentEmail: string | undefined }) {
  const [email, setEmail] = useState(readPendingEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(() => readPendingEmail() !== '');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const legacy = currentEmail?.endsWith('@phone.local');

  async function run(action: 'send' | 'verify') {
    setPending(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('legacy-email-binding', {
        body: action === 'send' ? { action, email, password } : { action, code },
      });
      if (invokeError) {
        let reason = '操作失败，请稍后重试';
        if ('context' in invokeError && invokeError.context instanceof Response) {
          const response = await invokeError.context.json().catch(() => null);
          if (typeof response?.error === 'string') reason = response.error;
        }
        setError(reason);
        return;
      }
      if (!data?.ok) { setError('操作失败，请稍后重试'); return; }
      if (action === 'send') {
        setSent(true);
        setPassword('');
        sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify({ email }));
      } else {
        setDone(true);
        setCode('');
        sessionStorage.removeItem(PENDING_STORAGE_KEY);
        await supabase.auth.refreshSession();
      }
    } catch { setError('网络连接失败，请稍后重试'); }
    finally { setPending(false); }
  }

  return <section className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 mb-6">
    <h3 className="text-lg font-semibold text-tx mb-3">账号邮箱</h3>
    {done ? <p className="text-ds-sm text-tl">邮箱绑定成功，以后可用邮箱找回密码。</p>
      : !legacy ? <p className="text-ds-sm text-txs">{currentEmail || '暂无邮箱'}</p>
      : <div className="space-y-3">
        <p className="text-ds-sm text-txs">绑定邮箱后，忘记密码时可以自己重置。原有手机号仍可用于登录。</p>
        {!sent ? <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run('send'); }}>
          <label className="block text-ds-sm">邮箱<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full h-11 px-4 border border-bd rounded-ds-lg" /></label>
          <label className="block text-ds-sm">当前账号密码<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full h-11 px-4 border border-bd rounded-ds-lg" /></label>
          <Button type="submit" disabled={pending}>{pending ? '发送中…' : '发送验证码'}</Button>
        </form> : <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run('verify'); }}>
          <p className="text-ds-sm text-txs">验证码已发送至 {email}，请检查收件箱和垃圾邮件。</p>
          <label className="block text-ds-sm">8 位验证码<input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full h-11 px-4 border border-bd rounded-ds-lg" /></label>
          <Button type="submit" disabled={pending}>{pending ? '验证中…' : '确认绑定'}</Button>
          <button type="button" className="ml-3 text-sm text-ac hover:underline" onClick={() => { setSent(false); setCode(''); setError(''); sessionStorage.removeItem(PENDING_STORAGE_KEY); }}>重新发送或更换邮箱</button>
        </form>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>}
  </section>;
}
