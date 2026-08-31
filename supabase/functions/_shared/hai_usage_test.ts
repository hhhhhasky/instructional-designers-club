import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type HaiProviderUsage, normalizeProviderUsage, streamDeepSeek } from "./hai.ts";

Deno.test("normalizeProviderUsage preserves DeepSeek cache and reasoning counters", () => {
  assertEquals(normalizeProviderUsage({
    prompt_tokens: 3948,
    prompt_cache_hit_tokens: 3000,
    prompt_cache_miss_tokens: 948,
    completion_tokens: 1200,
    completion_tokens_details: { reasoning_tokens: 400 },
    total_tokens: 5148,
  }, "req-1"), {
    promptTokens: 3948,
    cacheHitTokens: 3000,
    cacheMissTokens: 948,
    completionTokens: 1200,
    reasoningTokens: 400,
    visibleOutputTokens: 800,
    totalTokens: 5148,
    providerRequestId: "req-1",
  });
});

Deno.test("normalizeProviderUsage returns null when provider sends no usage", () => {
  assertEquals(normalizeProviderUsage(null), null);
  assertEquals(normalizeProviderUsage({ prompt_tokens: 10 })?.promptTokens, 10);
  assertEquals(normalizeProviderUsage({ prompt_tokens: 10 })?.totalTokens, null);
});

Deno.test("normalizeProviderUsage maps Zhipu cached_tokens to hit/miss counters", () => {
  const usage = normalizeProviderUsage({
    prompt_tokens: 1000,
    prompt_tokens_details: { cached_tokens: 760 },
    completion_tokens: 240,
    total_tokens: 1240,
  });
  assertEquals(usage?.cacheHitTokens, 760);
  assertEquals(usage?.cacheMissTokens, 240);
});

Deno.test("streamDeepSeek receives reasoning deltas without mixing them into content", async () => {
  const previousKey = Deno.env.get("DEEPSEEK_API_KEY");
  const previousBaseUrl = Deno.env.get("DEEPSEEK_BASE_URL");
  Deno.env.set("DEEPSEEK_API_KEY", "test-key");
  Deno.env.set("DEEPSEEK_BASE_URL", "https://example.test");
  let requestBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    requestBody = JSON.parse(String((init as { body?: unknown } | undefined)?.body ?? "{}"));
    const body = [
      'data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}',
      'data: {"choices":[{"delta":{"content":"# 教案"}}]}',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":4,"completion_tokens_details":{"reasoning_tokens":2},"total_tokens":14},"choices":[]}',
      "data: [DONE]",
      "",
    ].join("\n\n");
    return Promise.resolve(new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));
  };

  try {
    const reasoning: string[] = [];
    const content: string[] = [];
    const usages: HaiProviderUsage[] = [];
    for await (const token of streamDeepSeek(
      [{ role: "user", content: "生成教案" }],
      {
        model: "deepseek-v4-pro",
        thinkingEnabled: true,
        reasoningEffort: "high",
        onReasoningDelta: (delta) => { reasoning.push(delta); },
        onUsage: (value) => { usages.push(value); },
      },
    )) content.push(token);

    assertEquals(reasoning, ["先分析"]);
    assertEquals(content, ["# 教案"]);
    assertEquals(requestBody.thinking, { type: "enabled" });
    assertEquals(requestBody.reasoning_effort, "high");
    assertEquals(usages[0]?.reasoningTokens, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) Deno.env.delete("DEEPSEEK_API_KEY");
    else Deno.env.set("DEEPSEEK_API_KEY", previousKey);
    if (previousBaseUrl === undefined) Deno.env.delete("DEEPSEEK_BASE_URL");
    else Deno.env.set("DEEPSEEK_BASE_URL", previousBaseUrl);
  }
});
