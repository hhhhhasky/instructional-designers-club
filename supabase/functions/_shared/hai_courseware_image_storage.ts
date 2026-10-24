import { GetObjectCommand, PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1048.0";

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) throw new Error("R2 图片存储配置不完整。");
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

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return null;
}

export async function persistCoursewareImage(params: {
  sourceUrl: string;
  userId: string;
  deckId: string;
  slideId: string;
  fetcher?: typeof fetch;
}) {
  const response = await (params.fetcher ?? fetch)(params.sourceUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`下载生成图片失败（${response.status}）。`);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
  const extension = imageExtension(contentType);
  if (!extension) throw new Error(`生图服务返回了不支持的文件类型：${contentType || "unknown"}。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("生成图片为空或超过 25MB。");
  const { bucket, publicUrl, client } = r2Config();
  const key = `hai-courseware/${params.userId}/${params.deckId}/${params.slideId}/${crypto.randomUUID()}.${extension}`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { url: `${publicUrl}/${key}`, key, contentType, bytes: bytes.length };
}

export async function signCoursewareImageUrl(key: string, expiresIn = 6 * 60 * 60) {
  const { bucket, client } = r2Config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function readCoursewareImage(key: string) {
  // Read through the presigned URL instead of AWS SDK's `transformToByteArray`.
  // The latter may route R2's CRC32 metadata through a Node Buffer polyfill in
  // the Edge runtime, where signed 32-bit CRC values throw an out-of-range
  // exception. Native fetch returns the object bytes without that conversion.
  const response = await fetch(await signCoursewareImageUrl(key));
  if (!response.ok) throw new Error(`课件图片文件读取失败（${response.status}）。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("课件图片为空或超过 25MB。");
  const contentType = (response.headers.get("content-type") || "image/png").split(";")[0].toLowerCase();
  return { bytes, contentType };
}

export async function hydrateCoursewareImageUrls(deckValue: unknown) {
  const deck = structuredClone(deckValue) as { slides?: Array<{ image?: { status?: string; assetKey?: string; url?: string } }> };
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  await Promise.all(slides.map(async (slide) => {
    if (slide.image?.status !== "ready" || !slide.image.assetKey) return;
    slide.image.url = await signCoursewareImageUrl(slide.image.assetKey);
  }));
  return deck;
}
