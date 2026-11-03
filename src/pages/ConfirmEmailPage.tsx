import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import { supabase } from '@/db/supabase';

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'checking' | 'success' | 'invalid'>('checking');
  const check = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    let active = true;
    if (!check.current) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get('access_token');
      const refresh = params.get('refresh_token');
      const type = params.get('type');
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      check.current = type === 'signup' && token && refresh
        ? supabase.auth.setSession({ access_token: token, refresh_token: refresh })
          .then(({ data, error }) => !error && Boolean(data.session))
          .catch(() => false)
        : Promise.resolve(false);
    }
    void check.current.then((ok) => { if (active) setStatus(ok ? 'success' : 'invalid'); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-cream flex items-center justify-center p-4">
    <PageMeta title="邮箱验证" description="" noIndex />
    <div className="w-full max-w-sm rounded-ds-lg border border-bd bg-white p-8 shadow-ds-sm">
      <h1 className="text-2xl font-bold mb-4">邮箱验证</h1>
      {status === 'checking' && <p>正在验证，请稍候…</p>}
      {status === 'success' && <><p>邮箱验证成功，欢迎开始学习。</p><Link className="inline-block mt-4 text-ac hover:underline" to="/">进入首页</Link></>}
      {status === 'invalid' && <><p>验证链接无效或已过期，请重新注册或联系管理员。</p><Link className="inline-block mt-4 text-ac hover:underline" to="/login">返回登录</Link></>}
    </div>
  </main>;
}
