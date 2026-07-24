import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("缺少Supabase配置信息");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * 新代码优先使用这个有数据库契约的别名；旧数据层仍在逐个收紧，
 * 避免一次性用断言掩盖历史 RPC 与远端 schema 的真实漂移。
 */
export const typedSupabase = supabase as SupabaseClient<Database>;
