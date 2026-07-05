import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PageMeta from '@/components/common/PageMeta';

const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号'),
  password: z.string().min(6, '密码至少6位'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const from = (location.state as { from?: string })?.from || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    const result = await signIn(data.phone, data.password);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <>
      <PageMeta title="登录" description="" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <main className="flex-1 flex items-center justify-center pt-20 pb-12 px-4">
        <div className="w-full max-w-sm animate-fade-in" style={{ animation: 'fade-in 0.6s ease-out' }}>
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-8">
            {/* 头部 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-ds-full bg-acl flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-ac" />
              </div>
              <h1
                className="text-2xl font-ds-bold text-tx mb-2"
                style={{ fontFamily: 'var(--fd)' }}
              >
                欢迎回来
              </h1>
              <p className="text-ds-sm text-txs">登录你的账号继续学习</p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <input
                  type="tel"
                  placeholder="手机号"
                  maxLength={11}
                  {...register('phone')}
                  className="w-full h-12 px-4 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  autoFocus
                />
                {errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码"
                  {...register('password')}
                  className="w-full h-12 px-4 pr-12 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-txt hover:text-tx transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="text-xs text-txs hover:text-ac transition-colors">
                  忘记密码？
                </Link>
              </div>

              {serverError && (
                <p className="text-sm text-red-500 animate-fade-in">{serverError}</p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-ds-bold btn-super-cta !text-white rounded-ds-lg"
              >
                {isSubmitting ? '登录中...' : '登录'}
              </Button>
            </form>

            {/* 底部链接 */}
            <div className="mt-6 pt-4 border-t border-bdl text-center">
              <p className="text-xs text-txt">
                还没有账号？
                <Link to="/register" className="text-ac hover:underline ml-1">
                  立即注册
                </Link>
              </p>
            </div>
          </div>

          {/* Logo 底部 */}
          <div className="flex items-center justify-center gap-2 mt-6 opacity-50">
            <GraduationCap className="w-4 h-4 text-txs" />
            <span className="text-xs text-txt">教学设计师俱乐部</span>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
