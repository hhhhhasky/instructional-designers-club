import { canonicalSupabaseStorageUrl } from "@/lib/supabase-url";
import type { Session, User } from '@supabase/supabase-js';
import { clearLearningDataCache } from '@/db/api';
import { supabase, typedSupabase } from '@/db/supabase';
import { getMembershipCourseAccessCodes } from '@/lib/course-entitlements';
import type { CourseAccessCode, LearningRecord, MembershipType, Profile } from '@/types/types';

// ==================== 访问控制 ====================

const LEVEL_HIERARCHY: Record<MembershipType, number> = {
  free: 0,
  plus2025: 1,
  plus: 1,
  pro: 2,
};

export type CourseAccessSubject = MembershipType | readonly CourseAccessCode[];
export type CourseAccessRequirement = MembershipType | CourseAccessCode | null | undefined;

function requirementToProductCode(requirement: CourseAccessRequirement): CourseAccessCode | null {
  if (!requirement || requirement === 'free') return null;
  if (requirement === 'pro') return 'teacher-ai';
  if (requirement === 'plus' || requirement === 'plus2025') return 'teaching-general-v1';
  return requirement;
}

export function canAccessCourse(
  userAccess: CourseAccessSubject,
  courseRequirement: CourseAccessRequirement,
): boolean {
  if (Array.isArray(userAccess)) {
    // Signed-in callers receive viewing scopes calculated by the server.
    const productCode = requirementToProductCode(courseRequirement);
    return productCode === null || userAccess.includes(productCode);
  }
  if (
    courseRequirement === 'teaching-general-v1' ||
    courseRequirement === 'teaching-general-legacy' ||
    courseRequirement === 'teaching-general-v2' ||
    courseRequirement === 'gongding-gongkaike' ||
    courseRequirement === 'teacher-ai' ||
    courseRequirement === 'daofa-textbook'
  ) {
    return getMembershipCourseAccessCodes(userAccess as MembershipType).includes(courseRequirement);
  }
  return LEVEL_HIERARCHY[userAccess as MembershipType] >= LEVEL_HIERARCHY[courseRequirement ?? 'free'];
}

export async function getUserCourseAccessCodes(): Promise<CourseAccessCode[]> {
  const { data, error } = await typedSupabase.rpc('get_my_course_viewing_codes');

  // 权限读取失败时仍可登录，受保护课程由服务端校验。
  if (error) {
    console.warn('getUserCourseAccessCodes:', error.message);
    return [];
  }

  return (data ?? []) as CourseAccessCode[];
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

function getSignInErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  if ((typeof error === 'object' && error !== null && 'code' in error && error.code === 'user_banned') ||
    message === 'User is banned') {
    return '该账号已停用，请联系管理员';
  }
  if (message.includes('Invalid login credentials')) {
    return '手机号、邮箱或密码错误';
  }
  if (message.includes('Email not confirmed')) {
    return '邮箱尚未验证，请先查收验证邮件。';
  }
  if (isAuthNetworkFailure(error)) {
    return '登录失败：网络请求失败，请检查网络连接后重试';
  }
  return `登录失败：${message || '请稍后重试'}`;
}

export async function signInWithIdentifier(
  identifier: string,
  password: string,
): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  const account = identifier.trim();
  if (account.includes('@')) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: account.toLowerCase(), password });
      if (error) return { error: getSignInErrorMessage(error), session: null, user: null };
      return await checkSignedInProfile(data.user, data.session);
    } catch (error) {
      return { error: getSignInErrorMessage(error), session: null, user: null };
    }
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToFakeEmail(account), password });
    if (error) return { error: getSignInErrorMessage(error), session: null, user: null };
    return await checkSignedInProfile(data.user, data.session);
  } catch (error) {
    return { error: getSignInErrorMessage(error), session: null, user: null };
  }
}

async function checkSignedInProfile(user: User | null, session: Session | null): Promise<{ error: string | null; session: Session | null; user: User | null }> {
  if (!user || !session) return { error: '登录失败，请稍后重试', session: null, user: null };
  const { data: profile, error } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle();
  if (error || !profile || profile.status === 'banned') {
    await supabase.auth.signOut();
    clearProfileCache(user.id);
    return { error: profile?.status === 'banned' ? '该账号已停用，请联系管理员' : '暂时无法确认账号状态，请重试', session: null, user: null };
  }
  return { error: null, session, user };
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
    .update({ avatar_url: `${canonicalSupabaseStorageUrl(avatarUrl)}?t=${Date.now()}` })
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
  const { error } = await supabase
    .from('learning_records')
    .upsert({
      user_id: userId,
      course_id: courseId,
      progress,
      status,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' });
  if (error) throw error;
  clearLearningDataCache(userId);
}

export async function getUserLearningRecords(userId: string): Promise<LearningRecord[]> {
  const { data } = await supabase
    .from('learning_records')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}
