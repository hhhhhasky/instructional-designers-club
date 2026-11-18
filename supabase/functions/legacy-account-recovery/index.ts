import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { accountCodeDigest, accountMailer } from '../_shared/account-email.ts';
import { getSupabasePublishableKey, getSupabaseSecretKey } from '../_shared/supabase-keys.ts';
import { makeLegacyRecoveryHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const smtpPassword = Deno.env.get('ACCOUNT_SMTP_PASSWORD');
if (!url || !smtpPassword) throw new Error('Account recovery service is not configured');
const secret = getSupabaseSecretKey();
const publishable = getSupabasePublishableKey();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const mail = accountMailer(smtpPassword);
// Reuse the existing email credential protection; never store a usable recovery link in the request list.
const digest = accountCodeDigest(secret, 'idclub-legacy-account-recovery-v1');
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}

Deno.serve(makeLegacyRecoveryHandler({
  digest,
  token: () => (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', ''),
  submit: (phone, email, note) => rpc('submit_legacy_account_recovery', { p_phone: phone, p_email: email, p_note: note }),
  administrator: async (authorization) => {
    if (!authorization.startsWith('Bearer ')) return null;
    const client = createClient(url, publishable, { ...options, global: { headers: { Authorization: authorization } } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile, error: profileError } = await admin.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle();
    return !profileError && profile?.role === 'admin' && profile.status === 'active' ? data.user.id : null;
  },
  prepare: (id, user, digest) => rpc('prepare_legacy_account_recovery', { p_request: id, p_admin: user, p_digest: digest }),
  claim: (id, digest) => rpc('claim_legacy_account_recovery', { p_request: id, p_digest: digest }),
  finish: async (id, digest, success) => { await rpc('finish_legacy_account_recovery', { p_request: id, p_digest: digest, p_success: success }); },
  send: (target, id, token) => {
    // Fixed trusted origin: a caller cannot redirect a recovery email to another site.
    const link = `https://idclub.hasky.top/reset-password#legacy_request=${id}&token=${token}`;
    return mail(target.email, '验证邮箱并设置新密码',
      `你好，手机号尾号 ${target.phone.slice(-4)} 的老学员账号找回申请已由管理员核实。请打开下面的链接，验证此邮箱并设置新密码：\n\n${link}\n\n链接30分钟内有效，仅可使用一次。提交新密码后，邮箱才会绑定到原账号，原有课程和学习记录保留。如果不是你本人申请，请忽略本邮件并联系哈老师。`);
  },
  update: async (target, password) => {
    const { data: current, error } = await admin.auth.admin.getUserById(target.user_id);
    const { data: profile, error: profileError } = await admin.from('profiles').select('phone,status,role').eq('id', target.user_id).maybeSingle();
    if (error || profileError || current.user?.email !== `${target.phone}@phone.local` ||
        profile?.phone !== target.phone || profile.status !== 'active' || profile.role === 'admin') return false;
    const { data, error: updateError } = await admin.auth.admin.updateUserById(target.user_id, {
      email: target.email, email_confirm: true, password,
    });
    return !updateError && data.user?.id === target.user_id && data.user.email === target.email && Boolean(data.user.email_confirmed_at);
  },
}));
