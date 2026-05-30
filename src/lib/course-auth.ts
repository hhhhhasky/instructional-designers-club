const PRO_KEY = 'course-access';
const PLUS_KEY = 'plus-course-access';

function getSecret(gateType: 'pro' | 'plus'): string {
  return gateType === 'pro' ? PRO_KEY : PLUS_KEY;
}

export function isCourseAccessible(type: 'pro' | 'plus'): boolean {
  const key = type === 'pro' ? PRO_KEY : PLUS_KEY;
  const secret = getSecret(type);
  return sessionStorage.getItem(key) === secret;
}

export async function verifyCoursePassword(input: string, type: 'pro' | 'plus'): Promise<boolean> {
  try {
    const res = await fetch('/api/verify-course-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input, gateType: type }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.valid) {
      sessionStorage.setItem(getSecret(type), getSecret(type));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function needsGate(membershipType: string): 'pro' | 'plus' | null {
  if (membershipType === 'pro') return 'pro';
  if (membershipType === 'plus') return 'plus';
  return null;
}
