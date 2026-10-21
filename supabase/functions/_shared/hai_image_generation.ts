import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.1048.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1048.0";

import { imageStyleLabel, imageStylePrompt } from "./hai_image_styles.ts";
export {
  IMAGE_GENERATION_STYLES,
  IMAGE_GENERATION_SUBJECTS,
} from "./hai_image_styles.ts";
export type {
  ImageGenerationStyle,
  ImageGenerationSubject,
} from "./hai_image_styles.ts";

export type ImageGenerationSize = "16:9" | "1:1" | "3:4" | "4:3" | "9:16";
export const IMAGE_GENERATION_TYPES = [
  "课件 PPT",
  "海报",
  "学习单",
  "思维导图",
] as const;
export type ImageGenerationType = (typeof IMAGE_GENERATION_TYPES)[number];
export const IMAGE_GENERATION_POINTS = 20;
export const IMAGE_DELIVERY_TIMEOUT_MS = 150_000;
export const IMAGE_FAILURE_MESSAGE = "本次生成失败，本轮未扣积分，请再次尝试。";
// A businessId-only run (submit receipt lost) whose provider definitively
// returns 404 has no provider task behind it, so polling can never succeed.
// Keep a grace window in case a just-accepted task is not yet visible.
export const IMAGE_SUBMIT_NOTFOUND_GRACE_MS = 600_000;
// ToAPIs async image tasks expire after 24 hours; bound our runs alike.
export const IMAGE_PROVIDER_ASYNC_MAX_AGE_MS = 24 * 60 * 60_000;

export function submitUnconfirmedExpired(params: {
  businessIdOnly: boolean;
  httpStatus: number | null;
  unconfirmedAt?: string | null;
  startedAt?: string | null;
  now?: number;
}) {
  if (!params.businessIdOnly || params.httpStatus !== 404) return false;
  const since = Date.parse(params.unconfirmedAt || params.startedAt || "");
  if (!Number.isFinite(since)) return false;
  return (params.now ?? Date.now()) - since >= IMAGE_SUBMIT_NOTFOUND_GRACE_MS;
}

export function providerRunExpired(createdAt: string, now = Date.now()) {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) &&
    now - created >= IMAGE_PROVIDER_ASYNC_MAX_AGE_MS;
}
export const MAX_REFERENCE_IMAGES = 6;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

export function composeImageGenerationPrompt(
  prompt: string,
  size: string,
  style: string,
  imageType: string,
  hasReferences = false,
  subject = "",
) {
  return [
    "图片尺寸：" + size,
    ...(subject ? ["学科：" + subject + "。"] : []),
    "视觉风格：" + imageStyleLabel(style) + "。" + imageStylePrompt(style),
    "生成图类型：" + imageType + "。",
    ...(hasReferences
      ? ["参考图片：按用户要求修改，保留未指定修改的内容。"]
      : []),
    "\n用户原始要求：\n" + prompt,
  ].join("\n");
}

export class ImageDeliveryTimeout extends Error {}
export function imageBudgetSignal(
  deadlineAt = Date.now() + IMAGE_DELIVERY_TIMEOUT_MS,
  capMs = IMAGE_DELIVERY_TIMEOUT_MS,
) {
  const remaining = Math.floor(Math.min(capMs, deadlineAt - Date.now()));
  if (remaining <= 0) {
    throw new ImageDeliveryTimeout("Image delivery deadline exceeded");
  }
  return AbortSignal.timeout(remaining);
}

export class ImageGenerationTaskError extends Error {
  taskId?: string;
  providerResponse?: unknown;

  constructor(message: string, taskId?: string, providerResponse?: unknown) {
    super(message);
    this.name = "ImageGenerationTaskError";
    this.taskId = taskId;
    this.providerResponse = providerResponse;
  }
}

export type StoredReferenceImage = {
  url: string;
  key: string;
  name: string;
  contentType: string;
  size: number | null;
};

type Raw = Record<string, unknown>;
function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Raw
    : {};
}
function text(value: unknown, fallback = "", limit = 500) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : fallback;
}

export function readImageProviderConfig(
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
) {
  const config = {
    provider: text(getEnv("HAI_COURSEWARE_IMAGE_PROVIDER"), "", 40),
    apiKey: text(getEnv("HAI_COURSEWARE_IMAGE_API_KEY"), "", 500),
    baseUrl: text(getEnv("HAI_COURSEWARE_IMAGE_BASE_URL"), "", 500).replace(
      /\/$/,
      "",
    ),
    model: text(getEnv("HAI_COURSEWARE_IMAGE_MODEL"), "", 120),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map((
    [key],
  ) => key);
  if (missing.length) {
    throw new Error(`生图服务缺少配置：${missing.join("、")}。`);
  }
  if (config.provider.toLowerCase() !== "toapis") {
    throw new Error(`暂不支持生图服务 ${config.provider}。`);
  }
  return config;
}

function providerUrl(payload: unknown) {
  const raw = record(payload);
  const result = record(raw.result);
  const lists = [raw.data, result.data].filter(Array.isArray) as unknown[][];
  for (const list of lists) {
    const url = text(record(list[0]).url, "", 2000);
    if (url) return url;
  }
  return text(raw.url || result.url, "", 2000);
}
function providerTaskId(payload: unknown) {
  const raw = record(payload);
  return text(raw.id || raw.task_id || raw.taskId, "", 200);
}
function providerErrorMessage(payload: unknown) {
  const raw = record(payload);
  const result = record(raw.result);
  const error = raw.error ?? result.error ?? raw.failure_reason ??
    result.failure_reason ?? raw.message ?? result.message;
  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 300);
  }
  const errorRecord = record(error);
  const nested = errorRecord.message ?? errorRecord.detail ?? errorRecord.code;
  return typeof nested === "string" && nested.trim()
    ? nested.trim().slice(0, 300)
    : "生图任务失败。";
}

export class ImageGenerationPending extends ImageGenerationTaskError {}

export class ImageProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly providerResponse?: unknown,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

async function providerResponse(response: Response) {
  // Gateways may return plain text/HTML errors. Preserve the HTTP status
  // instead of turning a definitive rejection into a lost-receipt retry.
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ImageProviderHttpError(
      response.status,
      payload
        ? providerErrorMessage(payload)
        : `生图服务请求失败（HTTP ${response.status}）。`,
      payload,
      response.headers.has("retry-after")
        ? Math.max(
          0,
          Number(response.headers.get("retry-after")) * 1000 ||
            Date.parse(response.headers.get("retry-after")!) - Date.now() || 0,
        )
        : undefined,
    );
  }
  if (!payload) throw new Error("生图服务返回了无法解析的响应。");
  return payload;
}

function pendingProviderError(
  error: unknown,
  taskId: string,
  submitting = false,
) {
  const httpStatus = error instanceof ImageProviderHttpError
    ? error.status
    : null;
  const message = httpStatus === 404
    ? "生图服务暂未找到原任务（HTTP 404），结果尚未确认；本次图片积分尚未扣除，可稍后继续取回。"
    : httpStatus === 429
    ? "生图服务查询限流（HTTP 429），稍后自动继续取回。"
    : httpStatus
    ? `生图服务暂不可用（HTTP ${httpStatus}），结果尚未确认，可稍后继续取回。`
    : submitting
    ? "提交回执暂未收到，结果尚未确认；正在查询原任务，本次图片积分尚未扣除。"
    : "暂时无法连接生图服务，结果尚未确认，可稍后继续取回。";
  return new ImageGenerationPending(message, taskId, {
    http_status: httpStatus,
    ...(error instanceof ImageProviderHttpError && error.retryAfterMs
      ? { retry_after_ms: error.retryAfterMs }
      : {}),
    ...(error instanceof ImageProviderHttpError
      ? { response: error.providerResponse }
      : { error: error instanceof Error ? error.message : "unknown" }),
  });
}

export type ImageProviderResult = {
  taskId?: string;
  url?: string;
  providerResponse: unknown;
};
export type ImageParams = {
  prompt: string;
  size: ImageGenerationSize;
  providerTaskId?: string;
  businessId?: string;
  referenceImageUrls?: string[];
  deadlineAt?: number;
};

// Persist businessId BEFORE calling this. ToAPIs accepts it in the same lookup
// route as the returned task ID, including when the POST response is lost.
export async function submitImage(
  config: ReturnType<typeof readImageProviderConfig>,
  params: ImageParams,
  fetcher: typeof fetch = fetch,
): Promise<ImageProviderResult> {
  try {
    const created = await providerResponse(
      await fetcher(config.baseUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          prompt: params.prompt,
          n: 1,
          size: params.size,
          resolution: "1k",
          response_format: "url",
          ...(params.businessId
            ? { client_business_id: params.businessId }
            : {}),
          ...(params.referenceImageUrls?.length
            ? {
              image_urls: params.referenceImageUrls.slice(
                0,
                MAX_REFERENCE_IMAGES,
              ),
            }
            : {}),
        }),
        signal: imageBudgetSignal(params.deadlineAt, 60_000),
      }),
    );
    const taskId = providerTaskId(created) || params.businessId;
    const url = providerUrl(created) || undefined;
    if (!taskId && !url) throw new Error("生图服务没有返回任务标识。");
    return { taskId, url, providerResponse: created };
  } catch (error) {
    // A network failure or gateway error does not mean generation failed.
    // Never resubmit: the original task may already be generating/billable.
    if (
      params.businessId &&
      (!(error instanceof ImageProviderHttpError) || error.status >= 500 ||
        error.status === 408)
    ) {
      throw pendingProviderError(error, params.businessId, true);
    }
    throw error;
  }
}

export async function pollImage(
  config: ReturnType<typeof readImageProviderConfig>,
  taskId: string,
  fetcher: typeof fetch = fetch,
  deadlineAt?: number,
): Promise<ImageProviderResult> {
  let payload: unknown;
  try {
    payload = await providerResponse(
      await fetcher(`${config.baseUrl}/${encodeURIComponent(taskId)}`, {
        headers: { authorization: `Bearer ${config.apiKey}` },
        signal: imageBudgetSignal(deadlineAt, 15_000),
      }),
    );
  } catch (error) {
    // Includes a briefly missing business ID, rate limiting and network errors.
    throw pendingProviderError(error, taskId);
  }
  const status = text(
    record(payload).status || record(record(payload).result).status,
    "",
    40,
  ).toLowerCase();
  if (
    ["failed", "failure", "error", "cancelled", "canceled"].includes(status)
  ) {
    throw new ImageGenerationTaskError(
      providerErrorMessage(payload),
      providerTaskId(payload) || taskId,
      payload,
    );
  }
  return {
    taskId: providerTaskId(payload) || taskId,
    url: providerUrl(payload) || undefined,
    providerResponse: payload,
  };
}

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("R2 图片存储配置不完整。");
  }
  return {
    bucket,
    publicUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}
function extension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return null;
}
export async function persistImage(
  params: {
    sourceUrl: string;
    userId: string;
    taskId: string;
    runId: string;
    deadlineAt?: number;
  },
) {
  const response = await fetch(params.sourceUrl, {
    signal: imageBudgetSignal(params.deadlineAt),
  });
  if (!response.ok) throw new Error(`下载生成图片失败（${response.status}）。`);
  const contentType = (response.headers.get("content-type") || "").split(";")[0]
    .toLowerCase();
  const ext = extension(contentType);
  if (!ext) {
    throw new Error(
      `生图服务返回了不支持的文件类型：${contentType || "unknown"}。`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) {
    throw new Error("生成图片为空或超过 25MB。");
  }
  const { bucket, publicUrl, client } = r2Config();
  const key =
    `hai-image-generation/${params.userId}/${params.taskId}/${params.runId}.${ext}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { abortSignal: imageBudgetSignal(params.deadlineAt) },
  );
  return { key, url: `${publicUrl}/${key}`, contentType, bytes: bytes.length };
}

export function publicStoredImageUrl(key: string) {
  const { publicUrl } = r2Config();
  return `${publicUrl}/${key}`;
}

async function referenceAccessSignature(key: string, expiresAt: number) {
  const secret = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!secret) throw new Error("R2 图片签名配置不完整。");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(`${key}\n${expiresAt}`),
    ),
  );
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(
    /\//g,
    "_",
  ).replace(/=+$/g, "");
}

export async function getStoredImageAccessUrl(key: string, expiresIn = 900) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    const { bucket, client } = r2Config();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  }
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = await referenceAccessSignature(key, expiresAt);
  const url = new URL(`${supabaseUrl}/functions/v1/hai-image-reference`);
  url.searchParams.set("key", key);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature);
  return url.toString();
}

export async function verifyStoredImageAccessSignature(
  key: string,
  expiresAt: number,
  signature: string,
) {
  if (
    !key || key.includes("..") || key.startsWith("/") ||
    !key.startsWith("hai-image-generation/")
  ) return false;
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Math.floor(Date.now() / 1000) ||
    expiresAt > Math.floor(Date.now() / 1000) + 3_600
  ) return false;
  const expected = await referenceAccessSignature(key, expiresAt);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

function referenceExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return null;
}

function safeFileName(value: string) {
  const name = value.replace(/[\\/\u0000-\u001f]+/g, "-").trim().slice(0, 160);
  return name || "参考图片";
}

export async function persistReferenceImages(
  params: {
    files: File[];
    userId: string;
    taskId: string;
    runId: string;
    deadlineAt?: number;
  },
) {
  if (params.files.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`最多只能上传 ${MAX_REFERENCE_IMAGES} 张参考图片。`);
  }
  if (!params.files.length) return [] as StoredReferenceImage[];
  const { bucket, publicUrl, client } = r2Config();
  const stored: StoredReferenceImage[] = [];
  try {
    for (const [index, file] of params.files.entries()) {
      const contentType = (file.type || "").toLowerCase();
      const ext = referenceExtension(contentType);
      if (!ext) {
        throw new Error(
          `参考图片“${
            safeFileName(file.name)
          }”格式不支持，请上传 PNG、JPG、WEBP 或 GIF。`,
        );
      }
      if (file.size <= 0 || file.size > MAX_REFERENCE_IMAGE_BYTES) {
        throw new Error(`参考图片“${safeFileName(file.name)}”必须小于 10MB。`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const key =
        `hai-image-generation/${params.userId}/${params.taskId}/references/${params.runId}-${
          index + 1
        }.${ext}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
          // S3 metadata becomes HTTP headers; raw Chinese/emoji filenames
          // fail transport validation. Keep the display name in the run record.
          Metadata: {
            originalName: encodeURIComponent(
              safeFileName(file.name).toWellFormed(),
            ),
            originalNameEncoding: "percent-encoding",
          },
        }),
        { abortSignal: imageBudgetSignal(params.deadlineAt) },
      );
      stored.push({
        url: `${publicUrl}/${key}`,
        key,
        name: safeFileName(file.name),
        contentType,
        size: bytes.byteLength,
      });
    }
    return stored;
  } catch (error) {
    await Promise.allSettled(
      stored.map((image) =>
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: image.key }))
      ),
    );
    throw error;
  }
}

export function validateStoredReferenceImages(value: unknown, userId: string) {
  if (value === undefined || value === null) {
    return [] as StoredReferenceImage[];
  }
  if (!Array.isArray(value) || value.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`最多只能使用 ${MAX_REFERENCE_IMAGES} 张参考图片。`);
  }
  const { publicUrl } = r2Config();
  const expectedPrefix = `hai-image-generation/${userId}/`;
  return value.map((item, index) => {
    const raw = record(item);
    const url = text(raw.url, "", 2_000);
    const key = text(raw.key, "", 500);
    const name = text(raw.name, `参考图片 ${index + 1}`, 160);
    const contentType = text(raw.contentType, "", 80).toLowerCase();
    const size = Number(raw.size ?? 0);
    if (
      !url || !key || !key.startsWith(expectedPrefix) || key.includes("..") ||
      !Number.isFinite(size) || size <= 0 || size > MAX_REFERENCE_IMAGE_BYTES
    ) throw new Error("参考图片标识不正确，请重新上传。");
    try {
      const parsedUrl = new URL(url);
      const expectedUrl = `${publicUrl}/${key}`;
      if (parsedUrl.toString() !== expectedUrl) {
        throw new Error("参考图片 URL 不正确，请重新上传。");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("参考图片 URL")) {
        throw error;
      }
      throw new Error("参考图片 URL 不正确，请重新上传。");
    }
    if (!referenceExtension(contentType)) {
      throw new Error("参考图片格式不支持，请重新上传。");
    }
    return { url, key, name, contentType, size } satisfies StoredReferenceImage;
  });
}

export async function readStoredImage(key: string, deadlineAt?: number) {
  const { bucket, client } = r2Config();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
  const response = await fetch(url, { signal: imageBudgetSignal(deadlineAt) });
  if (!response.ok) throw new Error(`图片读取失败（${response.status}）。`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType:
      (response.headers.get("content-type") || "image/png").split(";")[0],
  };
}
