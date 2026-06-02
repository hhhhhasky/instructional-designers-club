import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowLeft, User, Lock, Camera } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { updateNickname, updateAvatar, changePassword } from '@/lib/access-control';

const nicknameSchema = z.object({
  nickname: z.string().min(2, '昵称至少2个字符').max(20, '昵称最多20个字符'),
});

type NicknameForm = z.infer<typeof nicknameSchema>;

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, '密码至少6位'),
    confirmPassword: z.string().min(6, '请确认密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次密码不一致',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSuccess, setNicknameSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const nicknameForm = useForm<NicknameForm>({
    resolver: zodResolver(nicknameSchema),
    defaultValues: { nickname: profile?.nickname || '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const handleNicknameSubmit = async (data: NicknameForm) => {
    setNicknameError('');
    setNicknameSuccess(false);
    if (!profile) return;

    const ok = await updateNickname(profile.id, data.nickname);
    if (ok) {
      await refreshProfile();
      setNicknameSuccess(true);
    } else {
      setNicknameError('修改失败，请重试');
    }
  };

  const handlePasswordSubmit = async (data: PasswordForm) => {
    setPasswordError('');
    setPasswordSuccess(false);

    const result = await changePassword(data.newPassword);
    if (result.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(true);
      passwordForm.reset();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setAvatarUploading(true);
    const url = await updateAvatar(profile.id, file);
    if (url) {
      await refreshProfile();
    }
    setAvatarUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center">
            <p className="text-txs mb-4">请先登录</p>
            <Button onClick={() => navigate('/login')}>前往登录</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <p className="text-tx font-ds-semibold mb-2">账号已登录，用户资料暂未准备好</p>
            <p className="text-txs text-sm mb-4">请稍后刷新；如果一直出现，请检查 profiles 表触发器是否已执行。</p>
            <Button onClick={refreshProfile}>重新加载</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const accessLabel =
    profile.access_level === 'pro'
      ? 'Pro 专家版'
      : profile.access_level === 'plus'
        ? 'Plus 会员版'
        : '免费版';

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="max-w-lg mx-auto pt-8 animate-fade-in">
          {/* 返回 */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            返回
          </button>

          {/* 用户信息卡片 */}
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 mb-6 hover-lift">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-ds-full bg-acl flex items-center justify-center overflow-hidden ring-2 ring-acl/40">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-ds-bold text-ac">{profile.nickname[0]}</span>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ac text-white flex items-center justify-center cursor-pointer hover:bg-acd transition-colors shadow-ds-sm">
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={avatarUploading}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <h2 className="text-lg font-ds-bold text-tx">{profile.nickname}</h2>
                <p className="text-ds-sm text-txs mt-0.5">{profile.phone}</p>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-ds-pill text-xs font-ds-semibold bg-acl text-ac">
                  {accessLabel}
                </span>
              </div>
            </div>
          </div>

          {/* 修改昵称 */}
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 mb-6 hover-lift">
            <h3 className="text-ds-base font-ds-bold text-tx mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-ac inline-block"></span>
              <User className="w-4 h-4 text-ac" />
              修改昵称
            </h3>
            <form onSubmit={nicknameForm.handleSubmit(handleNicknameSubmit)} className="space-y-3">
              <input
                type="text"
                maxLength={20}
                {...nicknameForm.register('nickname')}
                className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
              />
              {nicknameForm.formState.errors.nickname && (
                <p className="text-ds-xs text-error-tx flex items-center gap-1">{nicknameForm.formState.errors.nickname.message}</p>
              )}
              {nicknameError && <p className="text-ds-xs text-error-tx flex items-center gap-1">{nicknameError}</p>}
              {nicknameSuccess && <p className="text-ds-xs text-tl flex items-center gap-1">✓ 昵称修改成功</p>}
              <Button
                type="submit"
                disabled={nicknameForm.formState.isSubmitting}
                size="sm"
                className="btn-super-cta !text-white rounded-ds-lg px-6"
              >
                保存
              </Button>
            </form>
          </div>

          {/* 修改密码 */}
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 hover-lift">
            <h3 className="text-ds-base font-ds-bold text-tx mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-tl inline-block"></span>
              <Lock className="w-4 h-4 text-tl" />
              修改密码
            </h3>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-3">
              <input
                type="password"
                placeholder="新密码（至少6位）"
                {...passwordForm.register('newPassword')}
                className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-tl focus:ring-2 focus:ring-tl/20 transition-all"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-ds-xs text-error-tx">{passwordForm.formState.errors.newPassword.message}</p>
              )}
              <input
                type="password"
                placeholder="确认新密码"
                {...passwordForm.register('confirmPassword')}
                className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-tl focus:ring-2 focus:ring-tl/20 transition-all"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-ds-xs text-error-tx">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
              {passwordError && <p className="text-ds-xs text-error-tx">{passwordError}</p>}
              {passwordSuccess && <p className="text-ds-xs text-tl flex items-center gap-1">✓ 密码修改成功</p>}
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
                size="sm"
                className="btn-super-cta !text-white rounded-ds-lg px-6"
              >
                修改密码
              </Button>
            </form>
          </div>

          {/* 底部 */}
          <div className="flex items-center justify-center gap-2 mt-10 opacity-40">
            <GraduationCap className="w-4 h-4 text-txs" />
            <span className="text-ds-xs text-txt">教学设计师俱乐部</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
