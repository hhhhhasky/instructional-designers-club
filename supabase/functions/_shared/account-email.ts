import nodemailer from 'npm:nodemailer@10.3.1';

export function accountMailer(smtpPassword: string) {
  const transport = nodemailer.createTransport({
    host: 'smtpdm.aliyun.com',
    port: 465,
    secure: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: 'noreply@mail.hasky.top', pass: smtpPassword },
  });
  return async (to: string, subject: string, text: string) => {
    await transport.sendMail({ from: '哈老师聊教学设计 <noreply@mail.hasky.top>', to, subject, text });
  };
}

export function accountCodeDigest(secret: string, purpose: string) {
  const encoder = new TextEncoder();
  const hmacKey = crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey'])
    .then((key) => crypto.subtle.deriveKey({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: encoder.encode(purpose),
    }, key, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']));
  return async (value: string) => {
    const signature = await crypto.subtle.sign('HMAC', await hmacKey, encoder.encode(value));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
}

export function generateAccountCode() {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4_200_000_000);
  return String(value[0] % 100_000_000).padStart(8, '0');
}
