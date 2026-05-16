import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS 头配置 - 允许所有域名访问
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 获取环境变量
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 创建 Supabase 客户端（使用 service role key，绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 解析请求体
    const { visitor_uuid } = await req.json();

    if (!visitor_uuid) {
      return new Response(
        JSON.stringify({ error: 'visitor_uuid is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[Edge Function] 记录访问，visitor_uuid:', visitor_uuid);

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc('record_visit', {
      p_visitor_uuid: visitor_uuid
    });

    if (error) {
      console.error('[Edge Function] RPC 调用失败:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[Edge Function] 访问记录成功:', data);

    // 返回统计数据
    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Edge Function] 处理请求失败:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        unique_visitors: 0,
        total_visits: 0
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
