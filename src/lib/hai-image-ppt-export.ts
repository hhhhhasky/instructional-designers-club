import { saveHaiFile } from "@/lib/hai-file-save";
import {
  acknowledgeHaiImage,
  downloadHaiImage,
} from "@/db/hai-image-generation";
import type { ImagePptResult } from "@/db/hai-image-ppt";
function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("图片读取失败。"));
    r.readAsDataURL(blob);
  });
}
export async function exportImagePpt(
  result: ImagePptResult,
  format: "zip" | "pptx",
  progress: (n: number) => void = () => {},
) {
  const title = (result.deck.course.topic || "课堂课件").replace(/[\\/:*?"<>|]/g, "-");
  return saveHaiFile(format === "zip" ? `${title}-图片课件.zip` : `${title}.pptx`, async () => {
    const images: Array<
      { data: string; blob: Blob; title: string; index: number }
    > = [];
    for (const [index, page] of result.deck.outline.entries()) {
      const row = result.pages.find((p) => p.page_id === page.id);
      const run = result.runs.find((r) => r.id === row?.current_run_id);
      if (!run?.r2_key || run.status === "failed") {
        throw Error(`第${index + 1}页尚未生成成功，请完成后下载整套。`);
      }
      const blob = await downloadHaiImage(run.id);
      const ack = await acknowledgeHaiImage(run.id);
      if (ack.run?.status !== "completed") {
        throw Error(`第${index + 1}页交付未完成，请刷新后重试。`);
      }
      images.push({ data: await dataUrl(blob), blob, title: page.title, index });
      progress(index + 1);
    }
    if (format === "zip") {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const item of images) {
        zip.file(
          `${String(item.index + 1).padStart(2, "0")}-${
            item.title.replace(/[\\/:*?"<>|]/g, "-")
          }.${
            item.blob.type.includes("png")
              ? "png"
              : item.blob.type.includes("webp")
              ? "webp"
              : "jpg"
          }`,
          item.blob,
        );
      }
      return zip.generateAsync({ type: "blob" });
    } else {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.title = title;
      pptx.subject = "HAI图片课件";
      for (const item of images) {
        const slide = pptx.addSlide();
        slide.addImage({ data: item.data, x: 0, y: 0, w: 13.333333, h: 7.5 });
      }
      return await pptx.write({ outputType: "blob" }) as Blob;
    }
  });
}
