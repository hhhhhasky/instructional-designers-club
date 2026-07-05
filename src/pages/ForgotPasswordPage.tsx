import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';

const forgotSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号'),
  note: z
    .string()
    .max(50, '备注最多50字')
    .optional(),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    // 防止同手机号短期内重复提交：查最近一条未处理/已通过的申请
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from('password_reset_requests')
      .select('id, status')
      .eq('phone', data.phone)
      .in('status', ['pending', 'approved'])
      .gte('created_at', tenMinAgo)
      .limit(1);

    if (!recentError && recent && recent.length > 0) {
      toast.error('你已有一条待处理的申请，请耐心等待管理员处理');
      return;
    }

    const { error } = await supabase.from('password_reset_requests').insert({
      phone: data.phone,
      note: data.note?.trim() || '',
    });

    if (error) {
      toast.error('提交失败，请稍后重试');
      return;
    }

    setSubmittedPhone(data.phone);
    setSubmitted(true);
    toast.success('重置申请已提交');
  };

  return (
    <>
      <PageMeta title="忘记密码" description="" noIndex />
      <div className="min-h-screen bg-cream flex flex-col">
        <main className="flex-1 flex items-center justify-center pt-20 pb-12 px-4">
          <div className="w-full max-w-sm animate-fade-in" style={{ animation: 'fade-in 0.6s ease-out' }}>
            <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-8">
              {/* 头部 */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-ds-full bg-acl flex items-center justify-center">
                  <KeyRound className="w-8 h-8 text-ac" />
                </div>
                <h1
                  className="text-2xl font-ds-bold text-tx mb-2"
                  style={{ fontFamily: 'var(--fd)' }}
                >
                  忘记密码
                </h1>
                <p className="text-ds-sm text-txs">
                  {submitted
                    ? '申请已提交，请耐心等待'
                    : '填写手机号，管理员会尽快处理并通过微信联系你'}
                </p>
              </div>

              {submitted ? (
                /* 提交成功状态 */
                <div className="space-y-6">
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="w-12 h-12 text-tl mb-3" />
                    <p className="text-tx font-ds-bold text-ds-lg mb-1">申请已提交</p>
                    <p className="text-ds-sm text-txs leading-relaxed">
                      手机号 <span className="text-tx">{submittedPhone}</span> 的重置申请已收到。
                      <br />
                      管理员处理后会通过微信把临时密码发给你，
                      请留意微信消息。
                    </p>
                  </div>
                  <Button
                    onClick={() => setSubmitted(false)}
                    variant="outline"
                    className="w-full h-11 rounded-ds-lg"
                  >
                    再提交一条
                  </Button>
                  <div className="text-center">
                    <Link to="/login" className="text-ds-sm text-ac hover:underline">
                      返回登录
                    </Link>
                  </div>
                </div>
              ) : (
                /* 表单 */
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <input
                      type="tel"
                      placeholder="注册时使用的手机号"
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
                    <input
                      type="text"
                      placeholder="备注（选填，如昵称，便于管理员辨认）"
                      maxLength={50}
                      {...register('note')}
                      className="w-full h-12 px-4 text-base border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    />
                    {errors.note && (
                      <p className="text-sm text-red-500 mt-1">{errors.note.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-ds-bold btn-super-cta !text-white rounded-ds-lg"
                  >
                    {isSubmitting ? '提交中...' : '提交重置申请'}
                  </Button>
                </form>
              )}

              {/* 底部链接 */}
              <div className="mt-6 pt-4 border-t border-bdl text-center">
                <p className="text-xs text-txt">
                  想起密码了？
                  <Link to="/login" className="text-ac hover:underline ml-1">
                    返回登录
                  </Link>
                </p>
              </div>
            </div>

            {/* Logo 底部 */}
            <div className="flex items-center justify-center gap-2 mt-6 opacity-50">
              <KeyRound className="w-4 h-4 text-txs" />
              <span className="text-xs text-txt">教学设计师俱乐部</span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
