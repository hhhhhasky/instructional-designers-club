import { supabase } from "@/db/supabase";

export const HAI_IMAGE_GENERATION_POINTS = 20;
export const HAI_IMAGE_SIZES = ["16:9", "1:1", "3:4", "4:3", "9:16"] as const;
export type {
  ImageGenerationStyle as HaiImageStyle,
  ImageGenerationSubject as HaiImageSubject,
} from "../../supabase/functions/_shared/hai_image_styles.ts";
export {
  getRecommendedImageStyles,
  IMAGE_GENERATION_STYLES as HAI_IMAGE_STYLES,
  IMAGE_GENERATION_SUBJECTS as HAI_IMAGE_SUBJECTS,
  imageStyleLabel,
  isImageSubject,
} from "../../supabase/functions/_shared/hai_image_styles.ts";

import type { ImageGenerationStyle as HaiImageStyle, ImageGenerationSubject as HaiImageSubject } from "../../supabase/functions/_shared/hai_image_styles.ts";
export const HAI_IMAGE_TYPES = ["课件 PPT", "海报", "学习单", "思维导图"] as const;
export const HAI_IMAGE_DELIVERY_TIMEOUT_MS = 150_000;
export const HAI_IMAGE_POLL_INTERVAL_MS = 10_000;
export const HAI_IMAGE_FAILURE_MESSAGE = "本次生成失败，本轮未扣积分，请再次尝试。";
function deadlineSignal(deadlineAt?: number) {
  if (!deadlineAt || !Number.isFinite(deadlineAt)) return undefined;
  const remaining = Math.floor(deadlineAt - Date.now());
  if (remaining <= 0) throw new Error(HAI_IMAGE_FAILURE_MESSAGE);
  return AbortSignal.timeout(remaining);
}
export const HAI_MAX_REFERENCE_IMAGES = 6;
export const HAI_MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
export type HaiImageSize = (typeof HAI_IMAGE_SIZES)[number];
export type HaiImageType = (typeof HAI_IMAGE_TYPES)[number];

export interface HaiReferenceImage {
  url: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
}

export interface HaiImageGenerationTask {
  id: string;
  ppt_deck_id?: string | null;
  user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface HaiImageGenerationRun {
  id: string;
  task_id: string;
  user_id: string;
  parent_run_id: string | null;
  client_request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  prompt: string;
  composed_prompt: string;
  image_size: HaiImageSize;
  art_style: HaiImageStyle;
  image_type: HaiImageType;
  reference_images: HaiReferenceImage[];
  provider: string | null;
  model: string | null;
  provider_task_id: string | null;
  source_url: string | null;
  r2_key: string | null;
  image_url: string | null;
  access_url?: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  delivery_deadline_at?: string | null;
  delivered_at?: string | null;
}

type ImageDb = {
  from: (table: string) => any;
};
const imageDb = supabase as unknown as ImageDb;

export async function getHaiImageGenerationTasks(titleKeyword?: string) {
  let query = imageDb
    .from("hai_image_generation_tasks")
    .select("*")
    .eq("status", "active");
  if (titleKeyword?.trim()) query = query.ilike("title", `%${titleKeyword.trim().replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as HaiImageGenerationTask[];
}

export async function getHaiImageGenerationRuns(taskId?: string) {
  let query = imageDb.from("hai_image_generation_runs").select("*").order("created_at", { ascending: true }).limit(100);
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as HaiImageGenerationRun[];
}

// Local manual testing runs the same handler without deploying an Edge Function.
function imageFunctionUrl(baseUrl: string) {
  return import.meta.env.DEV && import.meta.env.VITE_HAI_IMAGE_FUNCTION_URL
    ? String(import.meta.env.VITE_HAI_IMAGE_FUNCTION_URL)
    : `${baseUrl}/functions/v1/hai-image-generation`;
}

export async function generateHaiImage(params: {
  prompt: string;
  size: HaiImageSize;
  style: HaiImageStyle;
  imageType: HaiImageType;
  subject?: HaiImageSubject | "";
  referenceFiles?: File[];
  referenceRunIds?: string[];
  taskId?: string;
  parentRunId?: string;
  clientRequestId?: string;
  deadlineAt?: number;
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("缺少 VITE_SUPABASE_URL。");
  const clientRequestId = params.clientRequestId || crypto.randomUUID();
  const body = new FormData();
  body.set("prompt", params.prompt);
  body.set("size", params.size);
  body.set("style", params.style);
  if (params.subject) body.set("subject", params.subject);
  body.set("imageType", params.imageType);
  if (params.taskId) body.set("taskId", params.taskId);
  if (params.parentRunId) body.set("parentRunId", params.parentRunId);
  body.set("clientRequestId", clientRequestId);
  if (params.referenceRunIds?.length) body.set("referenceRunIds", JSON.stringify(params.referenceRunIds.slice(0, 6)));
  for (const file of params.referenceFiles ?? []) body.append("reference_images", file, file.name);
  try {
    const response = await fetch(imageFunctionUrl(baseUrl), {
      method: "POST", headers: { authorization: `Bearer ${token}` }, body, signal: deadlineSignal(params.deadlineAt),
    });
    const payload = await response.json() as HaiImageGenerationResponse;
    if (!response.ok) throw new Error(payload.error || "图片生成请求失败。");
    if (!payload.task || !payload.run) throw new Error("图片生成返回数据不完整。");
    return payload;
  } catch (error) {
    // A lost HTTP response must not cause a second paid generation. Recover
    // the existing request via owner-only RLS, then continue status polling.
    const saved = await imageDb.from("hai_image_generation_runs")
      .select("*, task:hai_image_generation_tasks(*)").eq("client_request_id", clientRequestId).maybeSingle();
    if (saved.data?.task) return { task: saved.data.task, run: saved.data } as HaiImageGenerationResponse;
    throw error;
  }
}

export interface HaiImageGenerationResponse {
  error?: string;
  task?: HaiImageGenerationTask;
  run?: HaiImageGenerationRun;
  points?: number;
  replayed?: boolean;
  pending?: boolean;
  message?: string;
}

async function imageAction(action: string, runId: string, deadlineAt?: number, stage?: string): Promise<HaiImageGenerationResponse> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(imageFunctionUrl(baseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ action, runId, stage }), signal: deadlineSignal(Number.isFinite(deadlineAt) ? deadlineAt : Date.now() + (action === "status" ? 130_000 : 30_000)),
  });
  const payload = await response.json() as HaiImageGenerationResponse;
  if (!response.ok || !payload.run) throw new Error(payload.error || "暂时未取到图片结果，请稍后继续取回。");
  return payload;
}

export const refreshHaiImage = (runId: string, deadlineAt?: number) => imageAction("status", runId, deadlineAt);
export const acknowledgeHaiImage = (runId: string, deadlineAt?: number) => imageAction("acknowledge", runId, deadlineAt);
export const failHaiImage = (runId: string, stage = "client_deadline") => imageAction("fail", runId, Date.now() + 10_000, stage);

export async function downloadHaiImage(runId: string, deadlineAt?: number) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(imageFunctionUrl(baseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "download", runId }), signal: deadlineSignal(deadlineAt),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || "图片下载失败。");
  }
  return response.blob();
}

// Owner-scoped expiring links. Preview requests create/reuse a small WebP;
// original links and the download endpoint continue to serve the full image.
export async function getHaiImageAccessUrls(runIds: string[], variant: "original" | "preview" = "original"): Promise<Record<string, string>> {
  if (!runIds.length) return {};
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(imageFunctionUrl(baseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "access", runIds, ...(variant === "preview" ? { variant } : {}) }), signal: deadlineSignal(Date.now() + 30_000),
  });
  const payload = await response.json().catch(() => ({})) as { access?: Record<string, string>; error?: string };
  if (!response.ok) throw new Error(payload.error || "暂时未取到图片链接，请稍后重试。");
  return payload.access ?? {};
}
