import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Save, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import InlineConfirmButton from "@/components/common/InlineConfirmButton";
import { Button } from "@/components/ui/button";
import { adminUpsertSiteContent, getAdminSiteContent } from "@/db/admin-api";

/**
 * 单例区块表单：自动加载 site_content[sectionKey]，提供 data/setData/save。
 * 用于 Hero / 介绍 / 价值观 / 创始人 / 数据 等区块。
 */
export default function SiteContentForm({
  sectionKey,
  sectionLabel,
  description,
  children,
}: {
  sectionKey: string;
  sectionLabel: string;
  description?: string;
  children: (ctx: {
    data: Record<string, unknown>;
    setField: (key: string, value: unknown) => void;
    /** 直接替换整个 data（用于复杂结构） */
    setData: (data: Record<string, unknown>) => void;
  }) => ReactNode;
}) {
  const [data, setDataState] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const row = await getAdminSiteContent(sectionKey);
      setDataState(row?.data ?? {});
      setLoaded(true);
    } catch {
      toast.error("加载区块内容失败");
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: string, value: unknown) => {
    setDataState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminUpsertSiteContent(sectionKey, sectionLabel, data);
      toast.success("已保存，前台刷新即生效");
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingOverlay message="正在加载区块内容..." />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-ds-lg font-ds-bold text-tx">{sectionLabel}</h3>
        {description && <p className="text-ds-sm text-txs mt-1">{description}</p>}
      </div>

      <div className="bg-white rounded-ds-lg border border-bd p-4 md:p-6 shadow-ds-xs space-y-4">
        {loaded &&
          children({
            data,
            setField,
            setData: setDataState,
          })}

        <div className="flex justify-end pt-2 border-t border-bdl">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== 数组编辑器（嵌套结构通用） ====================

/** 字符串段落列表（如介绍的多段欢迎语） */
export function ParagraphListEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const update = (i: number, v: string) => onChange(value.map((x, idx) => (idx === i ? v : x)));
  const add = () => onChange([...value, ""]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-ds-xs text-txs">
          {label}
          {hint && <span className="text-txt">（{hint}）</span>}
        </p>
        <button
          type="button"
          onClick={add}
          className="text-ds-xs text-ac hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> 添加一段
        </button>
      </div>
      <div className="space-y-2">
        {value.map((p, i) => (
          <div key={i} className="flex gap-2">
            <textarea
              value={p}
              onChange={(e) => update(i, e.target.value)}
              rows={2}
              placeholder="一段文字，可用 **文字** 加粗"
              className="flex-1 px-3 py-2 text-ds-sm border border-bd rounded-ds-md bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac resize-y"
            />
            <InlineConfirmButton
              title="删除此段"
              onConfirm={() => remove(i)}
            />
          </div>
        ))}
        {value.length === 0 && <p className="text-ds-xs text-txt">暂无内容。</p>}
      </div>
    </div>
  );
}

/**
 * 对象数组编辑器：用于价值观 / 创始人标签 / 数据指标 等列表项。
 * 每项由 renderItem(item, update) 渲染字段，支持增删与上下移动。
 */
export function ObjectListEditor<T extends object>({
  label,
  hint,
  items,
  onChange,
  newItem,
  addLabel,
  renderItem,
}: {
  label: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  addLabel?: string;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const update = (i: number, patch: Partial<T>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-ds-xs text-txs">
          {label}
          {hint && <span className="text-txt">（{hint}）</span>}
        </p>
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="text-ds-xs text-ac hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> {addLabel ?? "添加一项"}
        </button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-ds-md border border-bdl bg-bgs/40 p-3">
            <div className="flex justify-end gap-1 mb-2">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 rounded hover:bg-warm text-txs disabled:opacity-30"
                title="上移"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="p-1 rounded hover:bg-warm text-txs disabled:opacity-30"
                title="下移"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <InlineConfirmButton
                title="删除"
                size={14}
                onConfirm={() => remove(i)}
              />
            </div>
            {renderItem(it, (patch) => update(i, patch))}
          </div>
        ))}
        {items.length === 0 && <p className="text-ds-xs text-txt">暂无内容。</p>}
      </div>
    </div>
  );
}
