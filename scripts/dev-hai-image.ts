// Run with: deno run --allow-env --allow-net --allow-read --allow-sys --env-file=.env.production
//   --env-file=.env --env-file=.env.upload --env-file=supabase/functions/.env scripts/dev-hai-image.ts
// Only the image handler runs locally; existing Auth, database, provider and R2 are used.
import { handleImageGeneration } from "../supabase/functions/hai-image-generation/handler.ts";

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`本地生图服务缺少配置：${name}`);
  return value;
}

Deno.env.set("SUPABASE_URL", required("VITE_SUPABASE_URL"));
Deno.env.set(
  "SUPABASE_PUBLISHABLE_KEYS",
  JSON.stringify({ default: required("VITE_SUPABASE_PUBLISHABLE_KEY") }),
);
Deno.env.set(
  "SUPABASE_SECRET_KEYS",
  JSON.stringify({ default: required("SUPABASE_SECRET_KEY") }),
);
for (
  const key of [
    "HAI_COURSEWARE_IMAGE_API_KEY",
    "HAI_COURSEWARE_IMAGE_BASE_URL",
    "HAI_COURSEWARE_IMAGE_MODEL",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ]
) required(key);

const background = new Set<Promise<unknown>>();
(globalThis as unknown as {
  EdgeRuntime: { waitUntil: (work: Promise<unknown>) => void };
}).EdgeRuntime = {
  waitUntil(work) {
    background.add(work);
    void work.catch(() =>
      console.error("本地生图后台任务失败，请查看轮次记录。")
    ).finally(() => background.delete(work));
  },
};

Deno.serve({ hostname: "127.0.0.1", port: 54329 }, handleImageGeneration);
