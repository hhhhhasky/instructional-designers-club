const STORAGE_KEY = 'course-access';

export function isCourseAccessible(): boolean {
  const secret = import.meta.env.VITE_COURSE_PASSWORD;
  if (!secret) return true; // 未配置密码则不限制
  return sessionStorage.getItem(STORAGE_KEY) === secret;
}

export function verifyCoursePassword(input: string): boolean {
  const secret = import.meta.env.VITE_COURSE_PASSWORD;
  if (!secret) return true;
  if (input === secret) {
    sessionStorage.setItem(STORAGE_KEY, input);
    return true;
  }
  return false;
}
