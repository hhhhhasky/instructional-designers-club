const PRO_KEY = 'course-access';
const PLUS_KEY = 'plus-course-access';

const PRO_SECRET = import.meta.env.VITE_PRO_COURSE_PASSWORD || 'club2025';
const PLUS_SECRET = import.meta.env.VITE_PLUS_COURSE_PASSWORD || '739281';

export function isCourseAccessible(type: 'pro' | 'plus'): boolean {
  const key = type === 'pro' ? PRO_KEY : PLUS_KEY;
  const secret = type === 'pro' ? PRO_SECRET : PLUS_SECRET;
  return sessionStorage.getItem(key) === secret;
}

export function verifyCoursePassword(input: string, type: 'pro' | 'plus'): boolean {
  const key = type === 'pro' ? PRO_KEY : PLUS_KEY;
  const secret = type === 'pro' ? PRO_SECRET : PLUS_SECRET;
  if (input === secret) {
    sessionStorage.setItem(key, input);
    return true;
  }
  return false;
}

export function needsGate(membershipType: string): 'pro' | 'plus' | null {
  if (membershipType === 'pro') return 'pro';
  if (membershipType === 'plus') return 'plus';
  return null;
}
