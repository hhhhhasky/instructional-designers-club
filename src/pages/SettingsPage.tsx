import { proxiedSupabaseUrl } from "@/lib/supabase-url";
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, GraduationCap, Home, Lock, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import PageBackBar from '@/components/common/PageBackBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { changePassword, updateAvatar, updateNickname } from '@/lib/access-control';

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
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
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
        <PageBackBar />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <PageBackBar />
        <main className="flex-1 flex items-center justify-center pt-4 px-4">
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
        <PageBackBar />
        <main className="flex-1 flex items-center justify-center pt-4 px-4">
          <div className="text-center max-w-sm">
            <p className="text-tx font-ds-semibold mb-2">账号已登录，用户资料暂未准备好</p>
            <p className="text-txs text-sm mb-4">请点击“重新加载”再试一次；如果仍无法显示，请联系管理员。</p>
            <Button onClick={refreshProfile}>重新加载</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <PageMeta title="账号设置" description="" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <PageBackBar />
      <main className="flex-1 pt-4 pb-12 px-4">
        <div className="max-w-lg mx-auto pt-8 animate-fade-in">
          {/* 返回 */}


          {/* 用户信息卡片 */}
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 mb-6 hover-lift">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-ds-full bg-acl flex items-center justify-center overflow-hidden ring-2 ring-acl/40">
                  {profile.avatar_url ? (
                    <img src={proxiedSupabaseUrl(profile.avatar_url)} alt="" className="w-full h-full object-cover" />
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
                <h2 className="text-2xl font-bold text-tx">{profile.nickname}</h2>
                <p className="text-ds-sm text-txs mt-0.5">{profile.phone}</p>
              </div>
            </div>
          </div>

          {/* 修改昵称 */}
          <div className="bg-white rounded-ds-lg shadow-ds-md border border-bd p-6 mb-6 hover-lift">
            <h3 className="text-lg font-semibold text-tx mb-4 flex items-center gap-2">
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
            <h3 className="text-lg font-semibold text-tx mb-4 flex items-center gap-2">
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

          <div className="mt-6 flex flex-col gap-2 rounded-ds-lg border border-bd bg-white p-3">
            <button type="button" onClick={() => navigate('/')} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-txs hover:bg-[var(--paper)] hover:text-ac"><Home className="h-4 w-4" />返回主页</button>
            <button type="button" onClick={async () => { await signOut(); navigate('/'); }} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />退出登录</button>
          </div>

          {/* 底部 */}
          <div className="flex items-center justify-center gap-2 mt-10 opacity-40">
            <GraduationCap className="w-4 h-4 text-txs" />
            <span className="text-ds-xs text-txt">哈老师聊教学设计</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
}
