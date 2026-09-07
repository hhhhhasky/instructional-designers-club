import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1048.0";

export type ImageGenerationSize = "16:9" | "1:1" | "3:4" | "4:3" | "9:16";
export type ImageGenerationStyle = "卡通" | "写真" | "3D" | "教育扁平插画" | "水彩" | "杂志拼贴";
export type ImageGenerationType = "概念图" | "素材图" | "海报" | "学习单";

export const IMAGE_GENERATION_POINTS = 20;
export const MAX_REFERENCE_IMAGES = 6;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

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
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}
function text(value: unknown, fallback = "", limit = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : fallback;
}

export function readImageProviderConfig(getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)) {
  const config = {
    provider: text(getEnv("HAI_COURSEWARE_IMAGE_PROVIDER"), "", 40),
    apiKey: text(getEnv("HAI_COURSEWARE_IMAGE_API_KEY"), "", 500),
    baseUrl: text(getEnv("HAI_COURSEWARE_IMAGE_BASE_URL"), "", 500).replace(/\/$/, ""),
    model: text(getEnv("HAI_COURSEWARE_IMAGE_MODEL"), "", 120),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`生图服务缺少配置：${missing.join("、")}。`);
  if (config.provider.toLowerCase() !== "toapis") throw new Error(`暂不支持生图服务 ${config.provider}。`);
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
  const error = raw.error ?? result.error ?? raw.failure_reason ?? result.failure_reason ?? raw.message ?? result.message;
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 300);
  const errorRecord = record(error);
  const nested = errorRecord.message ?? errorRecord.detail ?? errorRecord.code;
  return typeof nested === "string" && nested.trim() ? nested.trim().slice(0, 300) : "生图任务失败。";
}
async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(record(payload).error || record(payload).message, `生图服务请求失败（${response.status}）。`, 300));
  return payload;
}

export async function generateImage(
  config: ReturnType<typeof readImageProviderConfig>,
  params: { prompt: string; size: ImageGenerationSize; providerTaskId?: string; referenceImageUrls?: string[] },
  options: { fetcher?: typeof fetch; wait?: (ms: number) => Promise<void>; maxWaitMs?: number } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let taskId = text(params.providerTaskId, "", 200);
  if (!taskId) {
    const created = await responseJson(await fetcher(config.baseUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        prompt: params.prompt,
        n: 1,
        size: params.size,
        resolution: "1K",
        ...(params.referenceImageUrls?.length ? { image_urls: params.referenceImageUrls.slice(0, MAX_REFERENCE_IMAGES) } : {}),
        response_format: "url",
      }),
      // The provider may spend time mirroring reference images before it
      // returns the task id. Keep this request open long enough to avoid
      // abandoning a provider task that is already being created.
      signal: AbortSignal.timeout(90_000),
    }));
    const immediateUrl = providerUrl(created);
    taskId = providerTaskId(created);
    if (immediateUrl) return { taskId: taskId || undefined, url: immediateUrl, providerResponse: created };
  }
  if (!taskId) throw new Error("生图服务没有返回任务标识。");
  const deadline = Date.now() + (options.maxWaitMs ?? 140_000);
  while (Date.now() < deadline) {
    await wait(3000);
    const payload = await responseJson(await fetcher(`${config.baseUrl}/${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    }));
    const url = providerUrl(payload);
    if (url) return { taskId, url, providerResponse: payload };
    const status = text(record(payload).status || record(record(payload).result).status, "", 40).toLowerCase();
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new ImageGenerationTaskError(providerErrorMessage(payload), taskId, payload);
    }
  }
  throw new ImageGenerationTaskError("生图任务等待超时，可稍后重试。", taskId);
}

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) throw new Error("R2 图片存储配置不完整。");
  return { bucket, publicUrl, client: new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }) };
}
function extension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return null;
}
export async function persistImage(params: { sourceUrl: string; userId: string; taskId: string; runId: string }) {
  const response = await fetch(params.sourceUrl, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`下载生成图片失败（${response.status}）。`);
  const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const ext = extension(contentType);
  if (!ext) throw new Error(`生图服务返回了不支持的文件类型：${contentType || "unknown"}。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("生成图片为空或超过 25MB。");
  const { bucket, publicUrl, client } = r2Config();
  const key = `hai-image-generation/${params.userId}/${params.taskId}/${params.runId}.${ext}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return { key, url: `${publicUrl}/${key}`, contentType, bytes: bytes.length };
}

export function publicStoredImageUrl(key: string) {
  const { publicUrl } = r2Config();
  return `${publicUrl}/${key}`;
}

async function referenceAccessSignature(key: string, expiresAt: number) {
  const secret = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!secret) throw new Error("R2 图片签名配置不完整。");
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${key}\n${expiresAt}`)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function getStoredImageAccessUrl(key: string, expiresIn = 900) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    const { bucket, client } = r2Config();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
  }
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = await referenceAccessSignature(key, expiresAt);
  const url = new URL(`${supabaseUrl}/functions/v1/hai-image-reference`);
  url.searchParams.set("key", key);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature);
  return url.toString();
}

export async function verifyStoredImageAccessSignature(key: string, expiresAt: number, signature: string) {
  if (!key || key.includes("..") || key.startsWith("/") || !key.startsWith("hai-image-generation/")) return false;
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000) || expiresAt > Math.floor(Date.now() / 1000) + 3_600) return false;
  const expected = await referenceAccessSignature(key, expiresAt);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
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

export async function persistReferenceImages(params: { files: File[]; userId: string; taskId: string; runId: string }) {
  if (params.files.length > MAX_REFERENCE_IMAGES) throw new Error(`最多只能上传 ${MAX_REFERENCE_IMAGES} 张参考图片。`);
  if (!params.files.length) return [] as StoredReferenceImage[];
  const { bucket, publicUrl, client } = r2Config();
  const stored: StoredReferenceImage[] = [];
  try {
    for (const [index, file] of params.files.entries()) {
      const contentType = (file.type || "").toLowerCase();
      const ext = referenceExtension(contentType);
      if (!ext) throw new Error(`参考图片“${safeFileName(file.name)}”格式不支持，请上传 PNG、JPG、WEBP 或 GIF。`);
      if (file.size <= 0 || file.size > MAX_REFERENCE_IMAGE_BYTES) throw new Error(`参考图片“${safeFileName(file.name)}”必须小于 10MB。`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const key = `hai-image-generation/${params.userId}/${params.taskId}/references/${params.runId}-${index + 1}.${ext}`;
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { originalName: safeFileName(file.name) },
      }));
      stored.push({ url: `${publicUrl}/${key}`, key, name: safeFileName(file.name), contentType, size: bytes.byteLength });
    }
    return stored;
  } catch (error) {
    await Promise.allSettled(stored.map((image) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: image.key }))));
    throw error;
  }
}

export function validateStoredReferenceImages(value: unknown, userId: string) {
  if (value === undefined || value === null) return [] as StoredReferenceImage[];
  if (!Array.isArray(value) || value.length > MAX_REFERENCE_IMAGES) throw new Error(`最多只能使用 ${MAX_REFERENCE_IMAGES} 张参考图片。`);
  const { publicUrl } = r2Config();
  const expectedPrefix = `hai-image-generation/${userId}/`;
  return value.map((item, index) => {
    const raw = record(item);
    const url = text(raw.url, "", 2_000);
    const key = text(raw.key, "", 500);
    const name = text(raw.name, `参考图片 ${index + 1}`, 160);
    const contentType = text(raw.contentType, "", 80).toLowerCase();
    const size = Number(raw.size ?? 0);
    if (!url || !key || !key.startsWith(expectedPrefix) || key.includes("..") || !Number.isFinite(size) || size <= 0 || size > MAX_REFERENCE_IMAGE_BYTES) throw new Error("参考图片标识不正确，请重新上传。");
    try {
      const parsedUrl = new URL(url);
      const expectedUrl = `${publicUrl}/${key}`;
      if (parsedUrl.toString() !== expectedUrl) throw new Error("参考图片 URL 不正确，请重新上传。");
    } catch (error) {
      if (error instanceof Error && error.message.includes("参考图片 URL")) throw error;
      throw new Error("参考图片 URL 不正确，请重新上传。");
    }
    if (!referenceExtension(contentType)) throw new Error("参考图片格式不支持，请重新上传。");
    return { url, key, name, contentType, size } satisfies StoredReferenceImage;
  });
}

export async function readStoredImage(key: string) {
  const { bucket, client } = r2Config();
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`图片读取失败（${response.status}）。`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: (response.headers.get("content-type") || "image/png").split(";")[0] };
}
