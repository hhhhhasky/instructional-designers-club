import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { supabase } from '@/db/supabase';

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete';

export default function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const recoveryCheck = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    if (!recoveryCheck.current) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const isRecovery = params.get('type') === 'recovery';
      // Tokens should not remain in the address bar or browser history.
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      recoveryCheck.current = isRecovery && accessToken && refreshToken
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
    if (password.length < 6) { setMessage('密码至少需要 6 位'); return; }
    if (password !== confirmation) { setMessage('两次输入的密码不一致'); return; }
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setMessage('修改失败，请重新申请重置邮件后再试'); return; }
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
        {state === 'complete' && <p>密码已修改成功，可以使用新密码登录。</p>}
        {state === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm">新密码
              <input className="mt-1 w-full h-12 px-4 border border-bd rounded-ds-lg" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm">确认新密码
              <input className="mt-1 w-full h-12 px-4 border border-bd rounded-ds-lg" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {message && <p role="alert" className="text-sm text-red-500">{message}</p>}
            <Button type="submit" disabled={saving} className="w-full">{saving ? '保存中…' : '保存新密码'}</Button>
          </form>
        )}
        {state !== 'checking' && state !== 'ready' && <Link to={state === 'invalid' ? '/forgot-password' : '/login'} className="inline-block mt-4 text-ac hover:underline">{state === 'invalid' ? '重新申请' : '返回登录'}</Link>}
      </div>
    </main>
  );
}
