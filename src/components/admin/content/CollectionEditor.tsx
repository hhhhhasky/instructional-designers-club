import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Plus, Edit2, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import InlineConfirmButton from "@/components/common/InlineConfirmButton";
import {
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  ToggleField,
  IconSelect,
  ColorSelect,
  FieldLabel,
} from "./fields";
import { cn } from "@/lib/utils";

// ==================== 字段配置 ====================

export type FieldSpec = {
  key: string;
  label: string;
  full?: boolean;
  hint?: string;
  required?: boolean;
} & (
  | { type: "text"; placeholder?: string }
  | { type: "textarea"; rows?: number; placeholder?: string }
  | { type: "number"; min?: number; placeholder?: string }
  | { type: "select"; options: { value: string; label: string }[] }
  | { type: "toggle" }
  | { type: "icon" }
  | { type: "color" }
  | { type: "datetime"; placeholder?: string }
  | { type: "links" } // 资源链接：[{label,url}]
);

export interface ColumnSpec<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface CollectionConfig<T extends { id: string; is_active: boolean; sort_order: number }> {
  title: string;
  description?: string;
  itemName: string; // 单条名称，如「会员」「FAQ」
  fields: FieldSpec[];
  columns: ColumnSpec<T>[];
  list: () => Promise<T[]>;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  toggle: (id: string, active: boolean) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  defaultForm: () => Record<string, unknown>;
  /** 永久删除时需要输入的确认词；不传则使用普通二次确认 */
  deleteConfirmWord?: string;
}

// ==================== 工具 ====================

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ==================== 主组件 ====================

export default function CollectionEditor<T extends { id: string; is_active: boolean; sort_order: number }>({
  config,
}: {
  config: CollectionConfig<T>;
}) {
  const { title, description, itemName, fields, columns } = config;

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await config.list();
      setRows(data);
    } catch {
      setError(`加载${itemName}列表失败，请刷新重试`);
    } finally {
      setLoading(false);
    }
  }, [config, itemName]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(config.defaultForm());
    setDialogOpen(true);
  };

  const handleEdit = (row: T) => {
    setEditingId(row.id);
    const initial: Record<string, unknown> = {};
    for (const f of fields) {
      const v = (row as Record<string, unknown>)[f.key];
      if (f.type === "links") {
        initial[f.key] = Array.isArray(v) ? (v as unknown[]).map((x) => ({ ...(x as object) })) : [];
      } else if (f.type === "datetime") {
        initial[f.key] = toDatetimeLocal(v as string);
      } else {
        initial[f.key] = v ?? (f.type === "toggle" ? false : "");
      }
    }
    setForm(initial);
    setDialogOpen(true);
  };

  const validate = (): string | null => {
    for (const f of fields) {
      if (!f.required) continue;
      const v = form[f.key];
      if (f.type === "links") {
        const arr = (v as { label?: string; url?: string }[]) ?? [];
        const hasValid = arr.some((l) => {
          const url = l?.url ?? "";
          return url.trim().length > 0;
        });
        if (!hasValid) {
          return `${f.label}至少需要一条有效链接`;
        }
      } else if (v === null || v === undefined || String(v).trim() === "") {
        return `${f.label}不能为空`;
      }
    }
    return null;
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key];
      if (f.type === "datetime") {
        payload[f.key] = fromDatetimeLocal((v as string) || "") ?? null;
      } else if (f.type === "links") {
        const arr = ((v as { label?: string; url?: string }[]) ?? []).filter((l) => (l.url ?? "").trim());
        payload[f.key] = arr.map((l) => ({
          label: (l.label || "阅读全文").trim(),
          url: (l.url ?? "").trim(),
        }));
      } else if (f.type === "number") {
        payload[f.key] = v === null || v === undefined || v === "" ? null : Number(v);
      } else if (f.type === "toggle") {
        payload[f.key] = Boolean(v);
      } else {
        payload[f.key] = (v as string)?.trim() ? (v as string).trim() : null;
      }
    }
    return payload;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload();
      if (editingId) {
        await config.update(editingId, payload);
        toast.success(`${itemName}已更新`);
      } else {
        // 新建时自动放到列表末尾
        const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
        payload.sort_order = maxSort + 1;
        payload.is_active = payload.is_active ?? true;
        await config.create(payload);
        toast.success(`${itemName}已创建`);
      }
      setDialogOpen(false);
      await load();
    } catch {
      toast.error(editingId ? `更新${itemName}失败` : `创建${itemName}失败`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: T) => {
    try {
      await config.toggle(row.id, !row.is_active);
      toast.success(row.is_active ? `已下架（隐藏）` : `已上架（显示）`);
      await load();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleMove = async (row: T, delta: number) => {
    const idx = rows.findIndex((r) => r.id === row.id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= rows.length) return;
    const other = rows[target];
    try {
      await Promise.all([
        config.update(row.id, { sort_order: other.sort_order }),
        config.update(other.id, { sort_order: row.sort_order }),
      ]);
      await load();
    } catch {
      toast.error("调整顺序失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await config.remove(deleteTarget.id);
      toast.success(`${itemName}已永久删除`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(`删除${itemName}失败`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingOverlay message={`正在加载${itemName}数据...`} />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-txs mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="text-ac hover:underline">
          刷新页面
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-ds-lg font-ds-bold text-tx">{title}</h3>
          {description && <p className="text-ds-sm text-txs mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ds-sm text-txs">共 {rows.length} 条</span>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            添加{itemName}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-bd bg-warm">
                <th className="text-center px-2 py-3 font-ds-semibold text-tx w-20">排序</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left px-4 py-3 font-ds-semibold text-tx",
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-ds-semibold text-tx w-24">状态</th>
                <th className="text-center px-3 py-3 font-ds-semibold text-tx w-36">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-bdl hover:bg-bgs/50 transition-colors align-middle">
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMove(row, -1)}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-bgs disabled:opacity-30 text-txs"
                        title="上移"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-txs w-6 text-center">{row.sort_order ?? 0}</span>
                      <button
                        onClick={() => handleMove(row, 1)}
                        disabled={i === rows.length - 1}
                        className="p-1 rounded hover:bg-bgs disabled:opacity-30 text-txs"
                        title="下移"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-txs", col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    {row.is_active ? (
                      <span className="inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold bg-mint-soft text-tl">
                        显示中
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold bg-warm text-txs">
                        已隐藏
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMove(row, -1)}
                        disabled={i === 0}
                        className="p-1.5 rounded-ds-md hover:bg-warm text-txs lg:hidden disabled:opacity-30"
                        title="上移"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(row)}
                        className="p-1.5 rounded-ds-md hover:bg-warm text-txs hover:text-ac"
                        title={row.is_active ? "下架（隐藏）" : "上架（显示）"}
                      >
                        {row.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(row)}
                        className="p-1.5 rounded-ds-md hover:bg-warm text-txs hover:text-ac"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded-ds-md hover:bg-warm text-txs hover:text-error-tx"
                        title="永久删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 3} className="px-4 py-12 text-center text-txs">
                    暂无{itemName}，点击右上角「添加{itemName}」开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-ds-xs text-txt">
        提示：「下架」仅在前台隐藏，数据保留；「永久删除」不可恢复，需二次确认。建议优先用下架管理。
      </p>

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? `编辑${itemName}` : `添加${itemName}`}
            </DialogTitle>
            <DialogDescription>
              {editingId ? `修改这条${itemName}的内容` : `填写内容以创建一条新的${itemName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <FormFields fields={fields} form={form} setField={setField} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : editingId ? "保存修改" : `创建${itemName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 永久删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`永久删除这条${itemName}？`}
        description={
          config.deleteConfirmWord
            ? `此操作不可恢复。请输入确认词以删除。`
            : `此操作不可恢复。若只想在前台隐藏，请改用「下架」。`
        }
        confirmWord={config.deleteConfirmWord}
        confirmText={deleting ? "删除中..." : "确认删除"}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ==================== 表单字段渲染 ====================

function FormFields({
  fields,
  form,
  setField,
}: {
  fields: FieldSpec[];
  form: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map((f) => {
        const full = "full" in f && f.full;
        const wrapperClass = full ? "md:col-span-2" : "";
        return (
          <div key={f.key} className={wrapperClass}>
            <FieldRenderer field={f} form={form} setField={setField} />
          </div>
        );
      })}
    </div>
  );
}

function FieldRenderer({
  field,
  form,
  setField,
}: {
  field: FieldSpec;
  form: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}) {
  const value = form[field.key];
  switch (field.type) {
    case "text":
      return (
        <TextField
          label={field.label}
          required={field.required}
          hint={field.hint}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          label={field.label}
          required={field.required}
          hint={field.hint}
          rows={field.rows}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "number":
      return (
        <NumberField
          label={field.label}
          hint={field.hint}
          min={field.min}
          placeholder={field.placeholder}
          value={(value as number | null) ?? null}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "select":
      return (
        <SelectField
          label={field.label}
          required={field.required}
          hint={field.hint}
          options={field.options}
          value={(value as string) ?? field.options[0]?.value ?? ""}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "toggle":
      return (
        <ToggleField
          label={field.label}
          hint={field.hint}
          checked={Boolean(value)}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "icon":
      return (
        <IconSelect
          label={field.label}
          value={(value as string) ?? "Sparkles"}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "color":
      return (
        <ColorSelect
          label={field.label}
          value={(value as string) ?? "ac"}
          onChange={(v) => setField(field.key, v)}
        />
      );
    case "datetime":
      return (
        <div>
          <FieldLabel label={field.label} hint={field.hint} />
          <input
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => setField(field.key, e.target.value)}
            className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          />
        </div>
      );
    case "links":
      return (
        <LinksEditor
          label={field.label}
          hint={field.hint}
          value={(value as { label?: string; url?: string }[]) ?? []}
          onChange={(v) => setField(field.key, v)}
        />
      );
    default:
      return null;
  }
}

function LinksEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: { label?: string; url?: string }[];
  onChange: (v: { label?: string; url?: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ label: string; url: string }>) => {
    const next = value.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    onChange(next);
  };
  const add = () => onChange([...value, { label: "阅读全文", url: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-1">
        <FieldLabel label={label} required hint={hint} />
        <button
          type="button"
          onClick={add}
          className="text-ds-xs text-ac hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> 添加链接
        </button>
      </div>
      <div className="space-y-2">
        {value.length === 0 && (
          <p className="text-ds-xs text-txt">还没有链接，点击「添加链接」。</p>
        )}
        {value.map((link, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={link.label ?? ""}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="按钮文字（如 阅读全文）"
              className="w-40 px-3 text-ds-sm border border-bd rounded-ds-md bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac"
            />
            <input
              type="url"
              value={link.url ?? ""}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https:// 链接地址"
              className="flex-1 px-3 text-ds-sm border border-bd rounded-ds-md bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac"
            />
            <InlineConfirmButton
              title="删除此链接"
              onConfirm={() => remove(i)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
