import { supabase } from '@/db/supabase';

type RecoveryRequest =
  | { action: 'submit'; phone: string; email: string; note: string }
  | { action: 'approve' | 'resend'; request_id: string }
  | { action: 'complete'; request_id: string; token: string; password: string };

export async function requestLegacyRecovery(body: RecoveryRequest): Promise<{ ok?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('legacy-account-recovery', { body });
  if (!error && data) return data;
  const payload = error?.context instanceof Response ? await error.context.json().catch(() => null) : null;
  return { error: typeof payload?.error === 'string' ? payload.error : '找回服务暂不可用，请稍后重试' };
}
