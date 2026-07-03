import { handleCors, jsonResponse, requireUser } from "../_shared/hai.ts";

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    const { userClient } = await requireUser(request);
    const { data, error } = await userClient.rpc("hai_access_status");
    if (error) throw error;

    const { data: usage } = await userClient.rpc("hai_usage_summary");
    return jsonResponse({ access: data, usage: usage ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 HAI 权限失败。";
    return jsonResponse({ message }, 500);
  }
});

