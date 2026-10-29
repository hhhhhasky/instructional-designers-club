import { supabaseBaseUrl } from "@/lib/supabase-url";
import { supabase } from "@/db/supabase";
import type {
  PptCourse,
  PptPage,
  PptSettings,
} from "../../supabase/functions/_shared/hai_image_ppt";
export type { PptCourse, PptPage, PptSettings };
export type ImagePptDeck = {
  id: string;
  image_task_id: string;
  source_artifact_id: string | null;
  source_version: number;
  requirements: string;
  course: PptCourse;
  outline: PptPage[];
  outline_markdown?: string;
  outline_feedback?: string;
  preview_approved?: boolean;
  preview_page_id?: string | null;
  art_style: string | null;
  settings: PptSettings | Record<string, never>;
  status:
    | "planning"
    | "outline"
    | "style"
    | "styling"
    | "generating"
    | "completed"
    | "paused"
    | "failed";
  revision: number;
  error_message: string | null;
};
export type ImagePptRun = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  r2_key: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};
export type ImagePptResult = {
  deck: ImagePptDeck;
  pages: Array<
    {
      page_id: string;
      page_index: number;
      current_run_id: string | null;
      attempt: number;
    }
  >;
  runs: ImagePptRun[];
};
export async function imagePptRequest(
  action: string,
  body: Record<string, unknown> = {},
): Promise<ImagePptResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw Error("请先登录。");
  const response = await fetch(
    `${
      String(supabaseBaseUrl).replace(/\/$/, "")
    }/functions/v1/hai-image-ppt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${data.session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.deck) {
    throw Error(result.error || "课件请求失败，请重试。");
  }
  return result;
}
