import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { requestClubSignup } from '@/db/club-email-signup';
import PageMeta from '@/components/common/PageMeta';

const registerSchema = z
  .object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号'),
    email: z.string().trim().email('请输入有效的邮箱地址'),
    password: z.string().min(6, '密码至少6位'),
    confirmPassword: z.string().min(6, '请确认密码'),
    nickname: z
      .string().trim()
      .min(2, '昵称至少2个字符')
      .max(20, '昵称最多20个字符'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码不一致',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [attempt, setAttempt] = useState<(Omit<RegisterForm, 'confirmPassword'> & { id: string }) | null>(null);
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [registered, setRegistered] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setServerError('');
    try {
      const { phone, nickname, password } = data;
      const email = data.email.toLowerCase();
      const result = await requestClubSignup({ action: 'start', phone, nickname, email });
      if (!result.attemptId) {
        setServerError(result.error ?? '暂时无法发送验证邮件，请稍后重试。');
        return;
      }
      setAttempt({ id: result.attemptId, phone, nickname, email, password });
      setCode('');
    } catch {
      setServerError('注册失败：网络请求失败，请检查网络连接后重试');
    }
  };

  const confirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attempt || confirming || !/^\d{8}$/.test(code)) return;
    setConfirming(true);
    setServerError('');
    try {
      const { id, phone, nickname, email, password } = attempt;
      const result = await requestClubSignup({ action: 'confirm', attemptId: id, phone, nickname, email, password, code });
      if (result.registered) {
        setRegistered(true);
        setAttempt(null);
        setCode('');
        reset();
      } else {
        setServerError(result.error ?? '暂时无法完成注册，请稍后重试。');
      }
    } catch {
      setServerError('网络请求失败，请检查网络连接后重试。');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <PageMeta title="注册" description="" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm animate-fade-in" style={{ animation: 'fade-in 0.6s ease-out' }}>
          <div className="bg-white rounded-ds-lg shadow-ds-sm border border-bd p-8">
            {/* 头部 */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-ds-full bg-acl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-ac" />
              </div>
              <h1
                className="text-3xl font-bold text-tx mb-2"
                style={{ fontFamily: 'var(--fd)' }}
              >
                {registered ? '注册完成' : attempt ? '去查看邮件' : '创建账号'}
              </h1>
              {attempt ? (
                <h2 className="text-lg font-bold leading-snug text-tx">
                  验证码 10 分钟内有效<br />过期后请重新提交注册
                </h2>
              ) : !registered && <p className="text-ds-sm text-txs">验证邮箱后即可开始学习</p>}
            </div>

            {/* 表单 */}
            {registered ? (
              <p className="text-ds-sm text-txs" role="status">邮箱验证成功，注册已完成。现在可以用手机号或邮箱登录。</p>
            ) : attempt ? (
              <form onSubmit={confirm} className="space-y-4">
                <p className="text-ds-sm text-txs leading-relaxed" role="status">请查收 {attempt.email} 的验证邮件，输入最新一封邮件里的验证码，完成尾号 {attempt.phone.slice(-4)} 的手机号注册。如果邮箱已注册，可直接登录。</p>
                <input
                  aria-label="邮箱验证码"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="8 位邮箱验证码"
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  className="h-12 w-full rounded-ds-lg border border-bd bg-bg px-4 text-base"
                  autoFocus
                />
                {serverError && <p className="text-sm text-red-500" role="alert">{serverError}</p>}
                <Button type="submit" disabled={confirming || code.length !== 8} className="h-12 w-full btn-super-cta !text-white">
                  {confirming ? '正在验证…' : '验证并完成注册'}
                </Button>
                <Button type="button" variant="ghost" disabled={confirming} className="w-full" onClick={() => {
                  setAttempt(null);
                  setServerError('');
                }}>修改资料或重新发送</Button>
              </form>
            ) : <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <input
                  type="tel"
                  aria-label="手机号"
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

              <div>
                <input type="email" aria-label="邮箱" placeholder="邮箱（用于验证和找回密码）" autoComplete="email" {...register('email')} className="w-full h-12 px-4 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all" />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <input
                  type="text"
                  aria-label="昵称（网站内显示）"
                  placeholder="昵称（网站内显示）"
                  maxLength={20}
                  {...register('nickname')}
                  className="w-full h-12 px-4 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                />
                {errors.nickname && (
                  <p className="text-sm text-red-500 mt-1">{errors.nickname.message}</p>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="密码（至少6位）"
                  placeholder="密码（至少6位）"
                  {...register('password')}
                  className="w-full h-12 px-4 pr-12 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-txt hover:text-tx transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="确认密码"
                  placeholder="确认密码"
                  {...register('confirmPassword')}
                  className="w-full h-12 px-4 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-sm text-red-500 animate-fade-in">{serverError}</p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-ds-bold btn-super-cta !text-white rounded-ds-lg"
              >
                {isSubmitting ? '正在发送…' : '发送验证邮件'}
              </Button>
            </form>}

            {/* 底部链接 */}
            <div className="mt-6 pt-4 border-t border-bdl text-center">
              <p className="text-xs text-txt">
                已有账号？
                <Link to="/login" className="text-ac hover:underline ml-1">
                  立即登录
                </Link>
              </p>
            </div>
          </div>

          {/* Logo 底部 */}
          <div className="flex items-center justify-center gap-2 mt-6 opacity-50">
            <GraduationCap className="w-4 h-4 text-txs" />
            <span className="text-xs text-txt">哈老师聊教学设计</span>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
