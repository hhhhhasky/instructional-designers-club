import { supabase } from '@/db/supabase';
import type { Profile, LearningRecord, MembershipType } from '@/types/types';
import type { Session, User } from '@supabase/supabase-js';

// ==================== 访问控制 ====================

const LEVEL_HIERARCHY: Record<MembershipType, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

export function canAccessCourse(userLevel: MembershipType, courseLevel: MembershipType): boolean {
  return LEVEL_HIERARCHY[userLevel] >= LEVEL_HIERARCHY[courseLevel];
}

// ==================== 认证 ====================

function phoneToFakeEmail(phone: string): string {
  return `${phone}@phone.local`;
}

export async function signUpWithPhone(
  phone: string,
  password: string,
  nickname: string,
): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  const { error, data } = await supabase.auth.signUp({
    email: phoneToFakeEmail(phone),
    password,
    options: {
      data: { phone, nickname },
    },
  });

  if (error) {
    console.error('signUp error:', error.message, error.status);
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      return { error: '该手机号已注册', session: null, user: null };
    }
    return { error: `注册失败：${error.message}`, session: null, user: null };
  }

  console.log('signUp success:', data.user?.id);

  if (!data.session) {
    const signInResult = await signInWithPhone(phone, password);
    if (signInResult.error) {
      return {
        error: '注册成功，但当前项目未自动登录。请确认 Supabase 已关闭邮箱验证后再重试登录。',
        session: null,
        user: data.user,
      };
    }
    return signInResult;
  }

  return { error: null, session: data.session, user: data.user };
}

export async function signInWithPhone(
  phone: string,
  password: string,
): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  const { error, data } = await supabase.auth.signInWithPassword({
    email: phoneToFakeEmail(phone),
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: '手机号或密码错误', session: null, user: null };
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: '账号未完成验证。请在 Supabase Auth 设置中关闭邮箱确认，手机号登录才能直接使用。', session: null, user: null };
    }
    return { error: `登录失败：${error.message}`, session: null, user: null };
  }

  return { error: null, session: data.session, user: data.user };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ==================== 用户资料 ====================

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('getProfile error:', error.message);
  }
  return data;
}

export async function updateNickname(userId: string, nickname: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', userId);
  return !error;
}

export async function updateAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (uploadError) return null;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = data.publicUrl;

  await supabase
    .from('profiles')
    .update({ avatar_url: `${avatarUrl}?t=${Date.now()}` })
    .eq('id', userId);

  return avatarUrl;
}

export async function changePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: '密码修改失败，请重试' };
  return { error: null };
}

// ==================== 学习记录 ====================

// 首次进入课程：创建记录并 watch_count +1
export async function recordCourseVisit(
  userId: string,
  courseId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('learning_records')
    .select('watch_count')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('learning_records')
      .update({
        watch_count: existing.watch_count + 1,
        last_watched_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('course_id', courseId);
  } else {
    await supabase.from('learning_records').insert({
      user_id: userId,
      course_id: courseId,
      status: 'in_progress',
      watch_count: 1,
      last_watched_at: new Date().toISOString(),
    });
  }
}

// 更新进度（不增加 watch_count）
export async function updateLearningProgress(
  userId: string,
  courseId: string,
  progress: number,
  status: 'in_progress' | 'completed',
): Promise<void> {
  await supabase
    .from('learning_records')
    .update({
      progress,
      status,
      last_watched_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('course_id', courseId);
}

export async function getUserLearningRecords(userId: string): Promise<LearningRecord[]> {
  const { data } = await supabase
    .from('learning_records')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}
