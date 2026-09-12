import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildV2ImportDictionary,
  parseV2CourseWorkbook,
  type V2ImportParseResult,
  type V2ImportPayload,
} from "@/components/admin/v2-course-import";
import { Button } from "@/components/ui/button";
import { getV2Dictionaries, importV2CourseWorkbook } from "@/db/v2-api";

interface V2CourseWorkbookImportProps {
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export default function V2CourseWorkbookImport({ onClose, onImported }: V2CourseWorkbookImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<V2ImportParseResult | null>(null);
  const [payload, setPayload] = useState<V2ImportPayload | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Excel 文件不能超过 10 MB");
      return;
    }
    setFileName(file.name);
    setReading(true);
    setResult(null);
    setPayload(null);
    try {
      const [buffer, dictionaries] = await Promise.all([file.arrayBuffer(), getV2Dictionaries()]);
      const parsed = await parseV2CourseWorkbook(buffer, buildV2ImportDictionary(dictionaries.groups, dictionaries.items));
      setResult(parsed);
      setPayload(parsed.payload);
      if (parsed.issues.length) toast.error(`发现 ${parsed.issues.length} 个模板问题，请修正后重新上传`);
      else toast.success(`已读取 ${parsed.lessonCount} 节课程，等待确认导入`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Excel 读取失败");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!payload || !result || result.issues.length) return;
    setImporting(true);
    try {
      const imported = await importV2CourseWorkbook(payload);
      toast.success(`批量导入完成：${imported.lesson_count} 节课已创建为草稿`);
      await onImported();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "批量导入失败，未创建课程");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-ac/25 bg-acl/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-ds-bold text-tx"><FileSpreadsheet className="h-4 w-4 text-ac" />Excel 批量创建课程</p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-txs">下载模板后按工作表填写。导入只创建草稿；系统会先校验数据，确认后在一个事务中创建整套课程。</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-txs hover:bg-white hover:text-tx" aria-label="关闭 Excel 导入"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/templates/v2-course-import-template.xlsx" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-bdl bg-white px-3 text-xs font-ds-bold text-tx hover:border-ac hover:text-ac"><Download className="h-4 w-4" />下载 Excel 模板</a>
        <Button onClick={() => inputRef.current?.click()} disabled={reading || importing} className="bg-[#173d39] text-white hover:bg-[#24554e]"><Upload className="h-4 w-4" />{reading ? "读取中…" : "选择填写好的 Excel"}</Button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      </div>

      {fileName && <p className="mt-3 text-[11px] text-txs">当前文件：<span className="font-ds-bold text-tx">{fileName}</span></p>}

      {result && (
        <div className="mt-4 rounded-xl border border-bdl bg-white/70 p-3">
          <div className="grid gap-2 text-[11px] text-txs sm:grid-cols-5">
            <Summary label="课程" value={result.lessonCount} />
            <Summary label="资源" value={result.resourceCount} />
            <Summary label="知识卡" value={result.cardCount} />
            <Summary label="评估区块" value={result.assessmentCount} />
            <Summary label="评估题" value={result.itemCount} />
          </div>
          {result.issues.length ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3">
              <p className="flex items-center gap-1.5 text-xs font-ds-bold text-red-700"><AlertTriangle className="h-3.5 w-3.5" />请修正以下问题后重新上传</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] leading-5 text-red-700">
                {result.issues.slice(0, 60).map((issue, index) => <li key={`${issue.sheet}-${issue.row}-${index}`}>{issue.sheet} 第 {issue.row} 行：{issue.message}</li>)}
                {result.issues.length > 60 && <li>其余 {result.issues.length - 60} 个问题未展开。</li>}
              </ul>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ac/20 bg-bgs/50 p-3">
              <p className="text-[11px] leading-5 text-txs">校验通过。确认后将按 Unit → Lesson 创建 {result.lessonCount} 节草稿课程；任一步失败都会整体回滚。</p>
              <Button onClick={() => void confirmImport()} disabled={importing} className="bg-[#173d39] text-white hover:bg-[#24554e]">{importing ? "导入中…" : "确认批量创建"}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-bgs/60 px-3 py-2"><span className="text-txs">{label}</span><strong className="ml-2 text-tx">{value}</strong></div>;
}
