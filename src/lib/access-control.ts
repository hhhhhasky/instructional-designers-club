import type { Session, User } from '@supabase/supabase-js';
import { clearLearningDataCache } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { LearningRecord, MembershipType, Profile } from '@/types/types';

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

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error || '');
}

function isAuthNetworkFailure(error: unknown): boolean {
  const message = getAuthErrorMessage(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : '';
  return (
    name.includes('fetch') ||
    name.includes('network') ||
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('fetch failed')
  );
}

function getSignUpErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  if (message.includes('already registered') || message.includes('User already registered')) {
    return '该手机号已注册';
  }
  if (isAuthNetworkFailure(error)) {
    return '注册失败：网络请求失败，请检查网络连接后重试';
  }
  return `注册失败：${message || '请稍后重试'}`;
}

function getSignInErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  if (message.includes('Invalid login credentials')) {
    return '手机号或密码错误';
  }
  if (message.includes('Email not confirmed')) {
    return '账号未完成验证。请在 Supabase Auth 设置中关闭邮箱确认，手机号登录才能直接使用。';
  }
  if (isAuthNetworkFailure(error)) {
    return '登录失败：网络请求失败，请检查网络连接后重试';
  }
  return `登录失败：${message || '请稍后重试'}`;
}

export async function signUpWithPhone(
  phone: string,
  password: string,
  nickname: string,
): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  try {
    const { error, data } = await supabase.auth.signUp({
      email: phoneToFakeEmail(phone),
      password,
      options: {
        data: { phone, nickname },
      },
    });

    if (error) {
      console.error('signUp error:', error.message, error.status);
      return { error: getSignUpErrorMessage(error), session: null, user: null };
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
  } catch (error) {
    console.error('signUp exception:', error);
    return { error: getSignUpErrorMessage(error), session: null, user: null };
  }
}

export async function signInWithPhone(
  phone: string,
  password: string,
): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  try {
    const { error, data } = await supabase.auth.signInWithPassword({
      email: phoneToFakeEmail(phone),
      password,
    });

    if (error) {
      return { error: getSignInErrorMessage(error), session: null, user: null };
    }

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileError) {
        console.error('signIn profile status check error:', profileError.message);
      }
      if (profile?.status === 'banned') {
        await supabase.auth.signOut();
        clearProfileCache(data.user.id);
        return { error: '该账号已停用，请联系管理员', session: null, user: null };
      }
    }

    return { error: null, session: data.session, user: data.user };
  } catch (error) {
    console.error('signIn exception:', error);
    return { error: getSignInErrorMessage(error), session: null, user: null };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  clearProfileCache();
}

// ==================== 用户资料 ====================

const PROFILE_CACHE_TTL_MS = 60 * 1000;
const profileCache = new Map<string, { expiresAt: number; data: Profile }>();
const profileRequests = new Map<string, Promise<Profile | null>>();

function getCachedProfile(userId: string): Profile | null {
  const entry = profileCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    profileCache.delete(userId);
    return null;
  }
  return entry.data;
}

function writeProfileCache(profile: Profile): void {
  profileCache.set(profile.id, {
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    data: profile,
  });
}

export function clearProfileCache(userId?: string): void {
  if (userId) {
    profileCache.delete(userId);
    profileRequests.delete(userId);
    return;
  }
  profileCache.clear();
  profileRequests.clear();
}

async function fetchProfile(userId: string): Promise<Profile | null> {
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

export async function getProfile(userId: string, options: { fresh?: boolean } = {}): Promise<Profile | null> {
  if (!options.fresh) {
    const cached = getCachedProfile(userId);
    if (cached) return cached;
    const pending = profileRequests.get(userId);
    if (pending) return pending;
  } else {
    clearProfileCache(userId);
  }

  const request = fetchProfile(userId);
  profileRequests.set(userId, request);
  try {
    const profile = await request;
    if (profile) writeProfileCache(profile);
    return profile;
  } finally {
    if (profileRequests.get(userId) === request) {
      profileRequests.delete(userId);
    }
  }
}

export async function updateNickname(userId: string, nickname: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', userId);
  clearProfileCache(userId);
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

  clearProfileCache(userId);
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
  const { error } = await supabase.rpc('record_course_visit', {
    p_user_id: userId,
    p_course_id: courseId,
  });
  if (error) {
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
  clearLearningDataCache(userId);
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
  clearLearningDataCache(userId);
}

export async function getUserLearningRecords(userId: string): Promise<LearningRecord[]> {
  const { data } = await supabase
    .from('learning_records')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}
