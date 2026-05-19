import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GraduationCap, Lock, Eye, EyeOff } from 'lucide-react';
import { verifyCoursePassword } from '@/lib/course-auth';

interface PasswordGateProps {
  gateType: 'pro' | 'plus';
  onSuccess: () => void;
}

export default function PasswordGate({ gateType, onSuccess }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    if (verifyCoursePassword(password, gateType)) {
      onSuccess();
      return;
    }

    setError('密码错误，请重试');
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <main className="flex-1 flex items-center justify-center pt-20 pb-12 px-4">
        <div
          className={`w-full max-w-sm animate-fade-in ${isShaking ? 'animate-shake' : ''}`}
          style={{
            animation: isShaking
              ? 'shake 0.5s ease-in-out'
              : 'fade-in 0.6s ease-out',
          }}
        >
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-8">
            {/* 头部 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-ds-full bg-acl flex items-center justify-center">
                <Lock className="w-8 h-8 text-ac" />
              </div>
              <h1
                className="text-2xl font-ds-bold text-tx mb-2"
                style={{ fontFamily: 'var(--fd)' }}
              >
                会员课程
              </h1>
              <p className="text-ds-sm text-txs">
                输入密码即可查看课程内容
              </p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="请输入访问密码"
                  className="w-full h-12 px-4 pr-12 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-txt hover:text-tx transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-500 animate-fade-in">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-ds-bold btn-super-cta !text-white rounded-ds-lg"
              >
                解锁课程
              </Button>
            </form>

            {/* 底部提示 */}
            <div className="mt-6 pt-4 border-t border-bdl text-center">
              <p className="text-xs text-txt">
                还没有密码？
                <a
                  href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ac hover:underline ml-1"
                >
                  申请加入俱乐部
                </a>
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

      {/* shake 动画 */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
