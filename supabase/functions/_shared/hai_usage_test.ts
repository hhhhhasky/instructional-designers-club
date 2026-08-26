import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeProviderUsage } from "./hai.ts";

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
