import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { supabase } from '@/db/supabase';
import { requestLegacyRecovery } from '@/db/legacy-account-recovery';

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete';

export default function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const legacyLink = useRef<{ id: string; token: string } | null>(null);
  const recoveryCheck = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    if (!recoveryCheck.current) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const isRecovery = params.get('type') === 'recovery';
      const id = params.get('legacy_request');
      const token = params.get('token');
      if (id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) && token && /^[a-f0-9]{64}$/.test(token)) {
        legacyLink.current = { id, token };
      }
      // Tokens should not remain in the address bar or browser history.
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      recoveryCheck.current = legacyLink.current ? Promise.resolve(true) : isRecovery && accessToken && refreshToken
        ? supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => !error && Boolean(data.session))
          .catch(() => false)
        : Promise.resolve(false);
    }
    void recoveryCheck.current.then((valid) => { if (active) setState(valid ? 'ready' : 'invalid'); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (password.length < 6) { setMessage('密码至少需要 6 位'); return; }
    if (new TextEncoder().encode(password).length > 72) { setMessage('密码过长，请控制在72字节以内'); return; }
    if (password !== confirmation) { setMessage('两次输入的密码不一致'); return; }
    setSaving(true);
    setMessage('');
    try {
      const legacy = legacyLink.current;
      if (legacy) {
        const result = await requestLegacyRecovery({ action: 'complete', request_id: legacy.id, token: legacy.token, password });
        if (result.error || !result.ok) { setMessage(result.error || '操作未完成，请联系哈老师核对'); return; }
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { setMessage('修改失败，请重新申请重置邮件后再试'); return; }
      }
      setPassword('');
      setConfirmation('');
      setState('complete');
    } catch {
      setMessage('网络连接失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <PageMeta title="重置密码" description="" noIndex />
      <div className="w-full max-w-sm rounded-ds-lg border border-bd bg-white p-8 shadow-ds-sm">
        <h1 className="text-3xl font-bold text-tx mb-4">重置密码</h1>
        {state === 'checking' && <p>正在验证链接，请稍候…</p>}
        {state === 'invalid' && <p>链接无效或已过期，请重新申请重置邮件。</p>}
        {state === 'complete' && <p>{legacyLink.current ? '邮箱已验证并绑定，密码已设置成功。可以使用原手机号或邮箱和新密码登录，原有课程和学习记录保留。' : '密码已修改成功，可以使用新密码登录。'}</p>}
        {state === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {legacyLink.current && <p className="text-sm text-txs">设置新密码后，此邮箱将绑定到你的原账号。链接仅可使用一次，30分钟内有效。</p>}
            <label className="block text-sm">新密码
              <input className="mt-1 w-full h-12 px-4 border border-bd rounded-ds-lg" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm">确认新密码
              <input className="mt-1 w-full h-12 px-4 border border-bd rounded-ds-lg" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {message && <p role="alert" className="text-sm text-red-500">{message}</p>}
            <Button type="submit" disabled={saving} className="w-full">{saving ? '保存中…' : legacyLink.current ? '验证邮箱并设置新密码' : '保存新密码'}</Button>
          </form>
        )}
        {state !== 'checking' && state !== 'ready' && <Link to={state === 'invalid' ? '/forgot-password' : '/login'} className="inline-block mt-4 text-ac hover:underline">{state === 'invalid' ? '重新申请' : '返回登录'}</Link>}
      </div>
    </main>
  );
}
