import { supabase } from '@/db/supabase';

type SignupDetails = { email: string; phone: string; nickname: string };

export async function requestClubSignup(
  body: SignupDetails & ({ action: 'start' } | { action: 'confirm'; attemptId: string; code: string; password: string }),
): Promise<{ attemptId?: string; registered?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('club-email-signup', { body });
  if (!error && data) return data;
  const payload = error?.context instanceof Response ? await error.context.json().catch(() => null) : null;
  return { error: typeof payload?.error === 'string' ? payload.error : '注册服务暂不可用，请稍后重试。' };
}
