import { toast } from "sonner";

type SaveHandle = {
  createWritable(): Promise<{
    write(blob: Blob): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
};
type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveHandle>;
};

/** Call directly from the click handler; defer fetching/rendering until after picking. */
export async function saveHaiFile(filename: string, makeBlob: () => Blob | Promise<Blob>): Promise<boolean> {
  const pickerWindow = window as SavePickerWindow;
  let handle: SaveHandle | undefined;
  if (pickerWindow.showSaveFilePicker) {
    try {
      handle = await pickerWindow.showSaveFilePicker({ suggestedName: filename });
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return false;
      throw error;
    }
  } else {
    toast.info("当前浏览器不支持选择保存位置。请在浏览器下载设置中开启“下载前询问保存位置”。");
  }
  const blob = await makeBlob();
  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return true;
}

/** PNG export keeps the suggested extension correct even before the image is fetched. */
export async function haiImageAsPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片导出失败，请重试。");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => png ? resolve(png) : reject(new Error("图片导出失败，请重试。")), "image/png");
    });
  } finally {
    bitmap.close();
  }
}
