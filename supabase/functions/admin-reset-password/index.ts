import { createClient } from "npm:@supabase/supabase-js@2.103.1";

// ============================================================
// admin-reset-password
// 管理员审核「忘记密码」申请：
//   action=approve → 反查用户 → 生成临时密码 → service role 重置 → 回填申请行 → 返回临时密码
//   action=reject  → 标记 rejected
// 鉴权：请求头 Authorization + is_admin() RPC
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// 生成 10 位随机临时密码：大小写字母 + 数字，剔除易混淆字符（0/O/o/1/I/l）
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateTempPassword(length = 10): string {
  let pwd = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    pwd += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return pwd;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "请先登录管理员账号" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment is not configured");
    }

    // 用用户 token 建 client 做鉴权
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError || !isAdmin) {
      return jsonResponse({ error: "仅管理员可以处理密码重置申请" }, 403);
    }

    // 当前管理员 uid（用于 resolved_by 回填）
    const { data: adminUser } = await userClient.auth.getUser();
    const adminId = adminUser?.user?.id ?? null;

    const body = await request.json().catch(() => null) as
      | { request_id?: string; action?: string }
      | null;
    const requestId = body?.request_id;
    const action = body?.action;
    if (!requestId || !["approve", "reject"].includes(action ?? "")) {
      return jsonResponse({ error: "参数错误：需要 request_id 和 action(approve/reject)" }, 400);
    }

    // 用 service role client 操作（绕过 RLS、调用 auth.admin）
    if (!serviceRoleKey) {
      return jsonResponse({ error: "服务端未配置 SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 取申请行
    const { data: reqRow, error: reqError } = await admin
      .from("password_reset_requests")
      .select("id, phone, user_id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (reqError) throw reqError;
    if (!reqRow) {
      return jsonResponse({ error: "找不到该申请" }, 404);
    }
    if (reqRow.status !== "pending") {
      return jsonResponse({ error: "该申请已处理" }, 409);
    }

    // ---- 拒绝 ----
    if (action === "reject") {
      const { error: updError } = await admin
        .from("password_reset_requests")
        .update({
          status: "rejected",
          resolved_at: new Date().toISOString(),
          resolved_by: adminId,
        })
        .eq("id", requestId);
      if (updError) throw updError;
      return jsonResponse({ ok: true, status: "rejected" });
    }

    // ---- 通过 ----
    // 反查用户 id（若申请行已有 user_id 直接用，否则按 phone 查 profiles）
    let userId: string | null = reqRow.user_id ?? null;
    if (!userId) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", reqRow.phone)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        // 手机号未注册：标记 rejected，提示管理员该手机号不存在
        await admin
          .from("password_reset_requests")
          .update({
            status: "rejected",
            note: `${reqRow.phone} 未注册`,
            resolved_at: new Date().toISOString(),
            resolved_by: adminId,
          })
          .eq("id", requestId);
        return jsonResponse({ error: `手机号 ${reqRow.phone} 未注册，无法重置` }, 404);
      }
      userId = profile.id;
    }

    const tempPassword = generateTempPassword();

    const { error: resetError } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (resetError) {
      throw new Error(`重置失败：${resetError.message}`);
    }

    const { error: updError } = await admin
      .from("password_reset_requests")
      .update({
        status: "approved",
        user_id: userId,
        temp_password: tempPassword,
        resolved_at: new Date().toISOString(),
        resolved_by: adminId,
      })
      .eq("id", requestId)
      .eq("status", "pending"); // 并发保护：仅当仍为 pending 时更新
    if (updError) throw updError;

    return jsonResponse({ ok: true, status: "approved", temp_password: tempPassword });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return jsonResponse({ error: `处理失败：${message}` }, 500);
  }
});
