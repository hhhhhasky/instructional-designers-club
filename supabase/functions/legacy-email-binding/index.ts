import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import nodemailer from 'npm:nodemailer@10.3.1';
import { getSupabasePublishableKey, getSupabaseSecretKey } from '../_shared/supabase-keys.ts';
import { makeLegacyEmailBindingHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const smtpPassword = Deno.env.get('ACCOUNT_SMTP_PASSWORD');
if (!url || !smtpPassword) throw new Error('Email binding service is not configured');
const publishableKey = getSupabasePublishableKey();
const secretKey = getSupabaseSecretKey();
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const transporter = nodemailer.createTransport({ host: 'smtpdm.aliyun.com', port: 465, secure: true, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, auth: { user: 'noreply@mail.hasky.top', pass: smtpPassword } });
const hmacKey = crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), 'HKDF', false, ['deriveKey'])
  .then((key) => crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('idclub-legacy-email-binding-v1') }, key, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']));

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
  digest: async (userId, code) => {
    const signed = await crypto.subtle.sign('HMAC', await hmacKey, new TextEncoder().encode(`${userId}:${code}`));
    return Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('');
  },
  generateCode: () => {
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= 4_200_000_000);
    return String(value[0] % 100_000_000).padStart(8, '0');
  },
  start: async (userId, email, digest) => {
    const { data, error } = await admin.rpc('start_legacy_email_binding', { p_user: userId, p_email: email, p_digest: digest });
    return { data: data === true, error };
  },
  consume: async (userId, digest) => await admin.rpc('consume_legacy_email_binding', { p_user: userId, p_digest: digest }),
  send: async (email, code) => {
    await transporter.sendMail({ from: '哈老师聊教学设计 <noreply@mail.hasky.top>', to: email, subject: '绑定账号邮箱验证码', text: `你好，你正在为哈老师聊教学设计账号绑定邮箱。验证码：${code}。验证码 10 分钟内有效。如果不是你本人操作，请忽略此邮件。` });
  },
  updateEmail: async (userId, email) => {
    const { data, error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    return { data: data.user?.id === userId, error };
  },
}));
