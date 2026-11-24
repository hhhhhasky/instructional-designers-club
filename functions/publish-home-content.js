const ADMIN_CHECK_URL = "https://isjflmyhbvdlmcsaewbq.supabase.co/rest/v1/rpc/is_admin";

function reply(status, message) {
  return Response.json({ message }, { status, headers: { "cache-control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const authorization = request.headers.get("authorization");
  const apikey = request.headers.get("apikey");
  if (!/^Bearer \S+$/.test(authorization ?? "") || !apikey) {
    return reply(401, "请重新登录后发布首页");
  }

  try {
    const check = await fetch(ADMIN_CHECK_URL, {
      method: "POST",
      headers: { authorization, apikey, "content-type": "application/json" },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    if (check.status === 401) return reply(401, "请重新登录后发布首页");
    if (check.status === 403) return reply(403, "需要管理员权限");
    if (!check.ok) return reply(502, "暂时无法核验管理员权限");
    if (await check.json() !== true) return reply(403, "需要管理员权限");
  } catch {
    return reply(502, "暂时无法核验管理员权限");
  }

  const hook = URL.canParse(env.HOME_CONTENT_DEPLOY_HOOK_URL)
    ? new URL(env.HOME_CONTENT_DEPLOY_HOOK_URL)
    : null;
  if (hook?.origin !== "https://api.cloudflare.com" || hook.username || hook.password) {
    return reply(503, "当前环境尚未配置首页发布服务");
  }

  try {
    const build = await fetch(hook, { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (build.ok) return reply(202, "已提交首页构建");
  } catch {
    return reply(502, "首页构建请求超时，请稍后检查或重试");
  }
  return reply(502, "Cloudflare 未接受首页构建请求");
}
