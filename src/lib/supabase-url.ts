const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

// 开发环境仍可直接连接；代理由构建配置显式启用。
export function getSupabaseBaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_PROXY_ENABLED === 'true' && typeof window !== 'undefined'
    ? `${window.location.origin}/supabase`
    : String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
}
export const supabaseBaseUrl = getSupabaseBaseUrl();

export function proxiedSupabaseUrl(value: string): string {
  if (supabaseBaseUrl === configuredUrl || !configuredUrl) return value;
  try {
    const url = new URL(value);
    const upstream = new URL(configuredUrl);
    if (url.origin === upstream.origin && url.pathname.startsWith('/storage/v1/')) {
      return `${supabaseBaseUrl}${url.pathname}${url.search}${url.hash}`;
    }
  } catch { /* 不改动相对地址和无效地址 */ }
  return value;
}

// 数据库仍保存项目原地址，避免预览环境域名被永久写入用户资料。
export function canonicalSupabaseStorageUrl(value: string): string {
  if (supabaseBaseUrl === configuredUrl || !configuredUrl) return value;
  try {
    const url = new URL(value);
    const proxy = new URL(supabaseBaseUrl);
    if (url.origin === proxy.origin && url.pathname.startsWith(`${proxy.pathname}/storage/v1/`)) {
      return `${configuredUrl}${url.pathname.slice(proxy.pathname.length)}${url.search}${url.hash}`;
    }
  } catch { /* 原样保留 */ }
  return value;
}
