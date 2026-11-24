// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { loadPublishedHomeContent } from "../../scripts/load-published-home-content";
// @ts-expect-error Pages Functions are JavaScript outside the TypeScript project.
import { onRequestPost } from "../../functions/publish-home-content.js";

const hook = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test";
const signedIn = new Request("https://idclub.hasky.top/publish-home-content", {
  method: "POST",
  headers: { authorization: "Bearer user-session", apikey: "sb_publishable_test" },
});

afterEach(() => vi.unstubAllGlobals());

it("allows an authenticated administrator to request a build without forwarding credentials", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json(true))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await onRequestPost({ request: signedIn, env: { HOME_CONTENT_DEPLOY_HOOK_URL: hook } });
  expect(response.status).toBe(202);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ authorization: "Bearer user-session" });
  expect(String(fetchMock.mock.calls[1][0])).toBe(hook);
  expect(fetchMock.mock.calls[1][1]).not.toHaveProperty("headers");
  expect(await response.text()).not.toContain(hook);
});

it("keeps the build endpoint closed to visitors and ordinary members", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(false));
  vi.stubGlobal("fetch", fetchMock);
  const env = { HOME_CONTENT_DEPLOY_HOOK_URL: hook };
  const anonymous = new Request(signedIn.url, { method: "POST" });
  expect((await onRequestPost({ request: anonymous, env })).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await onRequestPost({ request: signedIn, env })).status).toBe(403);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("distinguishes missing configuration from a request rejected by the host", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json(true))
    .mockResolvedValueOnce(Response.json(true))
    .mockResolvedValueOnce(new Response(null, { status: 429 }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await onRequestPost({ request: signedIn, env: {} })).status).toBe(503);
  expect((await onRequestPost({ request: signedIn, env: { HOME_CONTENT_DEPLOY_HOOK_URL: hook } })).status).toBe(502);
});

it("builds the homepage from the saved public copy and surfaces a failed read", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json([
      { section_key: "home_hero", data: { title_line1: "新标题" } },
      { section_key: "founder", data: { avatar_alt: "新头像" } },
    ]))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const env = { VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
  const result = await loadPublishedHomeContent(env);
  expect(result.landing.home_hero.title_line1).toBe("新标题");
  expect(result.founder?.data?.avatar_alt).toBe("新头像");
  expect(fetchMock.mock.calls[0][0].pathname).toBe("/rest/v1/site_content");
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ apikey: "sb_publishable_test" });
  await expect(loadPublishedHomeContent(env)).rejects.toThrow("HTTP 503");
});
