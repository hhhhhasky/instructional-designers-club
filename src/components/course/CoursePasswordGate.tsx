import { useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CoursePasswordGateProps {
  courseTitle: string;
  membershipLabel: string;
  checking: boolean;
  error: string | null;
  onVerify: (password: string) => Promise<void> | void;
  onBack: () => void;
  onLogin: () => void;
}

export default function CoursePasswordGate({
  courseTitle,
  membershipLabel,
  checking,
  error,
  onVerify,
  onBack,
  onLogin,
}: CoursePasswordGateProps) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || checking) return;
    void onVerify(password);
  };

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-14 pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(42,122,110,0.12),transparent_34%),radial-gradient(circle_at_88%_76%,rgba(196,93,62,0.10),transparent_30%)]" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-bd bg-bc shadow-ds-elegant">
        <div className="h-1.5 bg-gradient-to-r from-ac via-tl to-am" />
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-acl text-ac ring-1 ring-ac/15">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-ds-xs font-ds-bold uppercase tracking-[0.18em] text-ac">受邀试看</p>
              <h1 className="mt-1 font-serif text-2xl font-black leading-tight text-tx sm:text-3xl">
                输入单课访问密码
              </h1>
            </div>
          </div>

          <p className="text-ds-sm leading-6 text-txs">
            这是一节 {membershipLabel} 课程。拿到老师分享的密码后，无需开通会员也可以试看本节内容。
          </p>
          <p className="mt-2 line-clamp-2 text-ds-sm font-ds-semibold text-tx">《{courseTitle}》</p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="course-preview-password" className="mb-2 block text-ds-xs font-ds-semibold text-tx">
                试看密码
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt" />
                <input
                  id="course-preview-password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'course-preview-password-error' : undefined}
                  placeholder="请输入本节课的试看密码"
                  className="h-12 w-full rounded-ds-lg border border-bd bg-bg pl-10 pr-12 text-ds-sm text-tx outline-none transition focus:border-ac focus:ring-2 focus:ring-ac/20"
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-txt transition hover:bg-bgs hover:text-tx"
                  aria-label={visible ? '隐藏密码' : '显示密码'}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p id="course-preview-password-error" role="alert" className="mt-2 text-ds-xs text-am">
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full btn-super-cta btn-press" disabled={!password.trim() || checking}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {checking ? '正在验证…' : '验证并试看'}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 border-t border-bdl pt-5 sm:flex-row">
            <Button type="button" variant="ghost" className="flex-1" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回课程目录
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onLogin}>
              <LogIn className="mr-2 h-4 w-4" />
              会员登录
            </Button>
          </div>
          <p className="mt-4 text-center text-[12px] leading-5 text-txt">
            密码仅解锁当前课程试看，不会开通会员权益、记录学习进度或发放学分。
          </p>
        </div>
      </section>
    </main>
  );
}
