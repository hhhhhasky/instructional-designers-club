import { afterEach, describe, expect, it, vi } from "vitest";
import { saveHaiFile, haiImageAsPng } from "@/lib/hai-file-save";

vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

describe("HAI 保存位置选择", () => {
  it("先选路径再生成文件，并写入用户选择的文件", async () => {
    const blob = new Blob(["教案"]);
    const write = vi.fn();
    const close = vi.fn();
    let choose!: (value: unknown) => void;
    const picker = vi.fn(() => new Promise((resolve) => { choose = resolve; }));
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const makeBlob = vi.fn(() => blob);
    const saving = saveHaiFile("教案.docx", makeBlob);
    expect(picker).toHaveBeenCalledWith({ suggestedName: "教案.docx" });
    expect(makeBlob).not.toHaveBeenCalled();
    choose({ createWritable: async () => ({ write, close, abort: vi.fn() }) });
    expect(await saving).toBe(true);
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });

  it("取消选择后不生成、不获取文件", async () => {
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn().mockRejectedValue(new DOMException("取消", "AbortError")) });
    const makeBlob = vi.fn();
    expect(await saveHaiFile("教案.md", makeBlob)).toBe(false);
    expect(makeBlob).not.toHaveBeenCalled();
  });

  it("选择器被拒绝时报告错误，不悄悄下载到默认路径", async () => {
    const error = new DOMException("拒绝", "SecurityError");
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn().mockRejectedValue(error) });
    const makeBlob = vi.fn();
    await expect(saveHaiFile("教案.md", makeBlob)).rejects.toBe(error);
    expect(makeBlob).not.toHaveBeenCalled();
  });

  it("写入失败时撤销写入，保留原错误", async () => {
    const error = new Error("磁盘空间不足");
    const abort = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    vi.stubGlobal("window", { showSaveFilePicker: async () => ({ createWritable: async () => ({ write: vi.fn().mockRejectedValue(error), close, abort }) }) });
    await expect(saveHaiFile("教案.md", () => new Blob())).rejects.toBe(error);
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it("不支持选择器时提示用户，并保留浏览器下载", async () => {
    const { toast } = await import("sonner");
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
    const click = vi.fn();
    const link = { href: "", download: "", click, remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn() } });
    await saveHaiFile("教案.md", () => new Blob());
    expect(toast.info).toHaveBeenCalled();
    expect(link.download).toBe("教案.md");
    expect(click).toHaveBeenCalledOnce();
  });

  it("PNG 原图不做重复转换", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    expect(await haiImageAsPng(blob)).toBe(blob);
  });

  it("非 PNG 图片导出为 PNG，扩展名和实际格式一致", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const bitmap = { width: 1920, height: 1080, close: vi.fn() };
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (done: (blob: Blob) => void, type: string) => { expect(type).toBe("image/png"); done(png); } };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", { createElement: () => canvas });
    expect(await haiImageAsPng(new Blob(["jpg"], { type: "image/jpeg" }))).toBe(png);
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

});
