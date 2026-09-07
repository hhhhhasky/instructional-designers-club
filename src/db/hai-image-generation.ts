import { supabase } from "@/db/supabase";

export const HAI_IMAGE_GENERATION_POINTS = 20;
export const HAI_IMAGE_SIZES = ["16:9", "1:1", "3:4", "4:3", "9:16"] as const;
export const HAI_IMAGE_STYLES = [
  "卡通", "写真", "3D", "教育扁平插画", "水彩", "杂志拼贴",
  "手绘绘本", "国风水墨", "科技未来", "黏土定格", "扁平信息图", "黑板粉笔", "纸艺拼贴", "漫画分镜",
] as const;
export const HAI_IMAGE_TYPES = [
  "概念图", "素材图", "海报", "学习单", "课堂插图", "流程图", "思维导图", "知识卡片", "活动任务卡", "板书设计", "题目讲解图", "课前导入图",
] as const;
export const HAI_MAX_REFERENCE_IMAGES = 6;
export const HAI_MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
export type HaiImageSize = (typeof HAI_IMAGE_SIZES)[number];
export type HaiImageStyle = (typeof HAI_IMAGE_STYLES)[number];
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
  error_message: string | null;
  metadata: Record<string, unknown>;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type ImageDb = {
  from: (table: string) => any;
};
const imageDb = supabase as unknown as ImageDb;

export async function getHaiImageGenerationTasks() {
  const { data, error } = await imageDb
    .from("hai_image_generation_tasks")
    .select("*")
    .eq("status", "active")
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

export async function generateHaiImage(params: {
  prompt: string;
  size: HaiImageSize;
  style: HaiImageStyle;
  imageType: HaiImageType;
  referenceFiles?: File[];
  referenceRunIds?: string[];
  taskId?: string;
  parentRunId?: string;
  clientRequestId?: string;
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("缺少 VITE_SUPABASE_URL。");
  const body = new FormData();
  body.set("prompt", params.prompt);
  body.set("size", params.size);
  body.set("style", params.style);
  body.set("imageType", params.imageType);
  if (params.taskId) body.set("taskId", params.taskId);
  if (params.parentRunId) body.set("parentRunId", params.parentRunId);
  body.set("clientRequestId", params.clientRequestId || crypto.randomUUID());
  if (params.referenceRunIds?.length) body.set("referenceRunIds", JSON.stringify(params.referenceRunIds.slice(0, 6)));
  for (const file of params.referenceFiles ?? []) body.append("reference_images", file, file.name);
  const response = await fetch(`${baseUrl}/functions/v1/hai-image-generation`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; task?: HaiImageGenerationTask; run?: HaiImageGenerationRun; image?: { url: string; key: string }; points?: number; replayed?: boolean };
  if (!response.ok) throw new Error(payload.error || "图片生成失败，请稍后重试。");
  if (!payload.task || !payload.run) throw new Error("图片生成返回数据不完整。");
  return payload;
}

export async function downloadHaiImage(runId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("请先登录。");
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/functions/v1/hai-image-generation`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "download", runId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || "图片下载失败。");
  }
  return response.blob();
}
