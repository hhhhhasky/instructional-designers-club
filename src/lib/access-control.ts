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
