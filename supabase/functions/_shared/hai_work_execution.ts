import {
  buildChatCompletionOptions,
  type HaiProviderUsage,
  streamDeepSeek,
} from "./hai.ts";
import { HAI_WORK_PROVIDER_TIMEOUT_MS } from "./hai_work.ts";

export async function collectWorkModelOutput(params: {
  system: string;
  user: string;
  module: { model_provider_id: string | null; slug: string };
  completionOptions: ReturnType<typeof buildChatCompletionOptions>;
  userId: string;
  admin: any;
}) {
  const startedAt = new Date();
  const model = params.completionOptions.model;
  console.log(
    "[hai-work] calling DeepSeek with model:",
    model,
    "providerId:",
    params.module.model_provider_id,
    "moduleSlug:",
    params.module.slug,
  );
  let output = "";
  let usage: HaiProviderUsage | null = null;
  let providerCode = "deepseek";
  let reasoningChars = 0;
  let firstReasoningAt: string | null = null;
  let firstContentAt: string | null = null;
  try {
    for await (
      const token of streamDeepSeek([
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ], {
        ...params.completionOptions,
        userId: params.userId,
        admin: params.admin,
        modelProviderId: params.module.model_provider_id,
        timeoutMs: HAI_WORK_PROVIDER_TIMEOUT_MS,
        onUsage: (value) => {
          usage = value;
        },
        onProviderResolved: (value) => {
          providerCode = value;
        },
        onReasoningDelta: (value) => {
          if (!firstReasoningAt) firstReasoningAt = new Date().toISOString();
          reasoningChars += value.length;
        },
        onContentDelta: () => {
          if (!firstContentAt) firstContentAt = new Date().toISOString();
        },
      })
    ) output += token;
    const finishedAt = new Date();
    return {
      output,
      started_at: startedAt.toISOString(),
      completed_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      usage,
      provider_code: providerCode,
      reasoning_chars: reasoningChars,
      first_reasoning_at: firstReasoningAt,
      first_content_at: firstContentAt,
    };
  } catch (error) {
    const failedAt = new Date();
    const timedOut = error instanceof Error && (
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      /timed?\s*out|timeout|aborted/i.test(error.message)
    );
    return {
      output,
      started_at: startedAt.toISOString(),
      completed_at: failedAt.toISOString(),
      duration_ms: failedAt.getTime() - startedAt.getTime(),
      usage,
      provider_code: providerCode,
      reasoning_chars: reasoningChars,
      first_reasoning_at: firstReasoningAt,
      first_content_at: firstContentAt,
      error: timedOut
        ? "HAI 模型生成超过 140 秒，本次已停止。请直接重试；若持续超时，请改用 Flash 模型。"
        : error instanceof Error
        ? error.message
        : "模型调用失败。",
    };
  }
}

export function normalizeWorkMarkdown(raw: string) {
  let markdown = raw.replace(/^```(?:markdown|md)?\s*\n?/, "").replace(
    /\n?```\s*$/,
    "",
  )
    .replace(/【思考】[\s\S]*?【\/思考】/g, "")
    .replace(/【思考过程】[\s\S]*?【\/思考过程】/g, "").trim();
  const heading = markdown.match(/^#\s+/m);
  if (heading && heading.index! > 0) markdown = markdown.slice(heading.index!);
  return markdown;
}
