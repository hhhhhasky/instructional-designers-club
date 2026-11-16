import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { getSupabasePublishableKey, getSupabaseSecretKey } from '../_shared/supabase-keys.ts';
import { accountCodeDigest, accountMailer, generateAccountCode } from '../_shared/account-email.ts';
import { makeLegacyEmailBindingHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const smtpPassword = Deno.env.get('ACCOUNT_SMTP_PASSWORD');
if (!url || !smtpPassword) throw new Error('Email binding service is not configured');
const publishableKey = getSupabasePublishableKey();
const secretKey = getSupabaseSecretKey();
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const send = accountMailer(smtpPassword);
const digest = accountCodeDigest(secretKey, 'idclub-legacy-email-binding-v1');

Deno.serve(makeLegacyEmailBindingHandler({
  getUser: async (authorization) => {
    const client = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser();
    return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
  },
  getProfile: async (id) => await admin.from('profiles').select('phone, status').eq('id', id).maybeSingle(),
  checkPassword: async (email, password, id) => {
    const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    const matches = !error && data.user?.id === id;
    if (data.session) await client.auth.signOut({ scope: 'local' });
    return matches;
  },
  reservePasswordCheck: async (phone) => {
    const { data, error } = await admin.rpc('reserve_phone_login_attempt', { p_phone: phone });
    return { data: data === true, error };
  },
  clearPasswordChecks: async (phone) => await admin.rpc('clear_phone_login_attempts', { p_phone: phone }),
  digest: (userId, code) => digest(`${userId}:${code}`),
  generateCode: generateAccountCode,
  start: async (userId, email, digest) => {
    const { data, error } = await admin.rpc('start_legacy_email_binding', { p_user: userId, p_email: email, p_digest: digest });
    return { data: data === true, error };
  },
  consume: async (userId, digest) => await admin.rpc('consume_legacy_email_binding', { p_user: userId, p_digest: digest }),
  send: (email, code) => send(email, '绑定账号邮箱验证码', `你好，你正在为哈老师聊教学设计账号绑定邮箱。验证码：${code}。验证码 10 分钟内有效。如果不是你本人操作，请忽略此邮件。`),
  updateEmail: async (userId, email) => {
    const { data, error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    return { data: data.user?.id === userId, error };
  },
}));
