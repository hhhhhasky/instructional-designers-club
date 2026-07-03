import { handleCors, jsonResponse, requireUser } from "../_shared/hai.ts";

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return jsonResponse({ message: "只支持 POST。" }, 405);
    const { userClient } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    if (!code) return jsonResponse({ message: "请输入邀请码。" }, 400);

    const { data, error } = await userClient.rpc("hai_redeem_invite_code", {
      p_code: code,
    });
    if (error) throw error;

    const { data: usage } = await userClient.rpc("hai_usage_summary");
    return jsonResponse({ access: data, usage: usage ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "邀请码兑换失败。";
    return jsonResponse({ message }, 400);
  }
});

