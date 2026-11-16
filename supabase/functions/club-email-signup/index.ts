import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { accountCodeDigest, accountMailer, generateAccountCode } from '../_shared/account-email.ts';
import { getSupabaseSecretKey } from '../_shared/supabase-keys.ts';
import { makeClubSignupHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const smtpPassword = Deno.env.get('ACCOUNT_SMTP_PASSWORD');
if (!url || !smtpPassword) throw new Error('Club signup service is not configured');
const secret = getSupabaseSecretKey();
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const mail = accountMailer(smtpPassword);

Deno.serve(makeClubSignupHandler({
  digest: accountCodeDigest(secret, 'idclub-email-signup-v1'),
  code: generateAccountCode,
  start: async ({ addressKey, id, digest }, { email, phone }) => {
    const { data, error } = await admin.rpc('start_club_email_signup', {
      p_address_key: addressKey, p_attempt_id: id, p_code_digest: digest, p_email: email, p_phone: phone,
    });
    if (error) throw error;
    return data;
  },
  claim: async ({ addressKey, id, digest }) => {
    const { data, error } = await admin.rpc('claim_club_email_signup', {
      p_address_key: addressKey, p_attempt_id: id, p_code_digest: digest,
    });
    if (error) throw error;
    return data === true;
  },
  clear: async ({ addressKey, id }, retry) => {
    const { error } = await admin.rpc('clear_club_email_signup', {
      p_address_key: addressKey, p_attempt_id: id, p_retry: retry,
    });
    if (error) throw error;
  },
  send: ({ email, phone }, code) => mail(
    email,
    '注册账号邮箱验证码',
    `你好，你正在为手机号尾号 ${phone.slice(-4)} 注册哈老师聊教学设计账号。验证码为 ${code}，10 分钟内有效。请在本次注册页面输入验证码。如果不是你本人操作，请忽略这封邮件。`,
  ),
  create: async ({ email, phone, nickname }, password) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { phone, nickname },
    });
    if (data.user?.email_confirmed_at) return 'created';
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return 'duplicate';
    const { data: profile } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (profile) return 'duplicate';
    return 'retry';
  },
}));
