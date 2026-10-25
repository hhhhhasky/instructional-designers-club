import { saveHaiFile } from "@/lib/hai-file-save";
import { Download, FileText, Loader2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UnitFile } from "@/lib/hai-unit-design";

export async function saveUnitFile(file: UnitFile) {
  try {
    await saveHaiFile(file.filename, () => new Blob([file.markdown], { type: "text/markdown;charset=utf-8" }));
  } catch {
    toast.error("文件保存失败，请重试。");
  }
}

export default function UnitArtifactFiles({ files, selected, onSelect, title, version, compact = false }: {
  files: UnitFile[]; selected?: UnitFile; onSelect: (file: UnitFile) => void; title: string; version: number; compact?: boolean;
}) {
  const [packing, setPacking] = useState(false);
  async function downloadAll() {
    if (packing) return;
    setPacking(true);
    try {
      await saveHaiFile(`${title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}-v${version}.zip`, async () => {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const file of files) zip.file(file.filename, file.markdown);
        return zip.generateAsync({ type: "blob" });
      });
    } catch {
      toast.error("整套下载失败，请重试或逐份下载。");
    } finally { setPacking(false); }
  }
  return <nav aria-label="本次任务文件" className={`rounded-ds-xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] print:hidden ${compact ? "p-3" : "mb-7 p-4 md:p-5"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="editorial-kicker">本次交付 · v{version}</p><h2 className={`mt-2 font-serif font-black text-tx ${compact ? "text-sm" : "text-lg"}`}>1 份整体设计 · {files.filter((file) => file.kind === "lesson").length} 份课时教案</h2></div>
      <Button size="sm" variant="outline" className="rounded-ds-md" disabled={packing} onClick={() => void downloadAll()}>{packing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}下载整套文件</Button>
    </div>
    {(["unit", "lesson"] as const).map((kind) => <section key={kind} className="mt-4">
      <h3 className="mb-2 text-xs font-bold text-txs">{kind === "unit" ? "单元整体设计" : "课时设计 · 按授课顺序"}</h3>
      <div className={kind === "lesson" && !compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
        {files.filter((file) => file.kind === kind).map((file) => <div key={file.filename} className={`flex min-w-0 items-center rounded-ds-md border bg-[var(--paper)] ${selected?.filename === file.filename ? "border-ac ring-1 ring-ac/20" : "border-bd"}`}>
          <button type="button" aria-label={`预览 ${file.title}`} aria-pressed={selected?.filename === file.filename} onClick={() => onSelect(file)} className="flex min-w-0 flex-1 items-center gap-2 p-3 text-left text-sm font-bold text-tx"><FileText className="h-4 w-4 shrink-0 text-ac" /><span className="min-w-0"><span className="block truncate">{file.title}</span><span className="mt-1 block truncate text-xs font-normal text-txt">{file.filename}</span></span></button>
          <button type="button" aria-label={`下载 ${file.title}`} onClick={() => saveUnitFile(file)} className="m-1 rounded p-2 text-txs hover:bg-[var(--paper-deep)] hover:text-ac"><Download className="h-4 w-4" /></button>
        </div>)}
      </div>
    </section>)}
    <p className="mt-4 text-xs text-txs">点击文件预览；上方工具栏可复制、下载或导出当前文件。追改后整套文件保留为新版本。</p>
  </nav>;
}
