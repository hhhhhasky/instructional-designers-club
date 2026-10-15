import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgeHaiImage, downloadHaiImage, generateHaiImage, refreshHaiImage } from "@/db/hai-image-generation";

vi.mock("@/db/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } } }) } },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("VITE_HAI_IMAGE_FUNCTION_URL", "");
  fetchMock.mockReset().mockImplementation(async () => Response.json({ task: { id: "task" }, run: { id: "run" } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("image request options", () => {
  it("sends the original prompt, subject, unified style and reference file together", async () => {
    const file = new File(["image"], "课堂.png", { type: "image/png" });
    const prompt = '标题“文化传承”\n只参考配色';
    await generateHaiImage({ prompt, size: "16:9", style: "非遗国潮", subject: "思想政治", imageType: "课件 PPT", referenceFiles: [file] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://db.example.test/functions/v1/hai-image-generation");
    expect(init.headers.authorization).toBe("Bearer user-token");
    expect(init.body.get("prompt")).toBe(prompt);
    expect(init.body.has("remainingMs")).toBe(false);
    expect(init.body.get("subject")).toBe("思想政治");
    expect(init.body.get("style")).toBe("非遗国潮");
    expect(init.body.get("reference_images").name).toBe("课堂.png");
  });

  it("omits an empty subject for compatibility with existing requests", async () => {
    await generateHaiImage({ prompt: "水循环", size: "16:9", style: "教育扁平插画", imageType: "课件 PPT" });
    expect(fetchMock.mock.calls[0][1].body.has("subject")).toBe(false);
  });

  it("routes generation, polling, acknowledgement and download through the same local handler", async () => {
    vi.stubEnv("VITE_HAI_IMAGE_FUNCTION_URL", "http://127.0.0.1:54329");
    await generateHaiImage({ prompt: "水循环", size: "16:9", style: "自然博物", subject: "科学", imageType: "课件 PPT" });
    await refreshHaiImage("run");
    await acknowledgeHaiImage("run");
    fetchMock.mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/png" })));
    await downloadHaiImage("run");
    expect(fetchMock.mock.calls).toHaveLength(4);
    expect(fetchMock.mock.calls.every(([url]) => url === "http://127.0.0.1:54329")).toBe(true);
  });

  it("ignores the local endpoint override in production", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_HAI_IMAGE_FUNCTION_URL", "http://127.0.0.1:54329");
    await refreshHaiImage("run");
    expect(fetchMock.mock.calls[0][0]).toBe("https://db.example.test/functions/v1/hai-image-generation");
  });
});
