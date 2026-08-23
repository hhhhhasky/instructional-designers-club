import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getV2Dictionaries,
  saveV2DictionaryGroup,
  saveV2DictionaryItem,
  type V2DictionaryGroup,
  type V2DictionaryItem,
} from "@/db/v2-api";
import {
  getV2DictionaryField,
  V2_DICTIONARY_FIELD_CATALOG,
} from "@/components/admin/v2-dictionary-catalog";

export default function V2DictionaryPanel() {
  const [groups, setGroups] = useState<V2DictionaryGroup[]>([]);
  const [items, setItems] = useState<V2DictionaryItem[]>([]);
  const [selectedFieldKey, setSelectedFieldKey] = useState("objective_type");
  const [groupName, setGroupName] = useState("");
  const [presetKey, setPresetKey] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getV2Dictionaries();
      setGroups(result.groups);
      setItems(result.items);
    } catch (error) {
      console.error(error);
      toast.error("字典加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const field = getV2DictionaryField(selectedFieldKey) ?? V2_DICTIONARY_FIELD_CATALOG[0];
  const group = groups.find((row) => row.key === selectedFieldKey);
  const groupItems = useMemo(
    () => (group ? items.filter((item) => item.group_id === group.id) : []),
    [group, items],
  );

  useEffect(() => {
    setGroupName(group?.name ?? field.name);
    setEditingItemId(null);
    setPresetKey("");
    setItemKey("");
    setItemLabel("");
    setEnglishName("");
  }, [field.name, group?.id, group?.name]);

  function choosePreset(key: string) {
    setPresetKey(key);
    const preset = field.items.find((item) => item.key === key);
    if (!preset) {
      setItemKey("");
      setItemLabel("");
      setEnglishName("");
      return;
    }
    setItemKey(preset.key);
    setItemLabel(preset.label);
    setEnglishName(preset.englishName);
  }

  async function saveGroup() {
    if (!groupName.trim()) {
      toast.error("请填写类型组中文名称");
      return;
    }
    setSaving(true);
    try {
      await saveV2DictionaryGroup(
        {
          key: field.key,
          name: groupName.trim(),
          description: `${field.description} 字段：${field.fieldPath}`,
          is_active: true,
          sort_order: V2_DICTIONARY_FIELD_CATALOG.findIndex((row) => row.key === field.key) * 10 + 10,
        },
        group?.id,
      );
      toast.success(group ? "类型组已更新" : "类型组已启用");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("类型组保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    if (!group) {
      toast.error("请先启用当前字段类型组");
      return;
    }
    if (!itemKey.trim() || !itemLabel.trim()) {
      toast.error("类型 Key 和中文名称不能为空");
      return;
    }
    setSaving(true);
    try {
      await saveV2DictionaryItem(
        {
          group_id: group.id,
          key: itemKey.trim(),
          label: itemLabel.trim(),
          description: englishName.trim() || null,
          metadata: {
            english_name: englishName.trim() || null,
            catalog_preset: Boolean(field.items.some((item) => item.key === itemKey.trim())),
          },
          sort_order: editingItemId
            ? (groupItems.find((item) => item.id === editingItemId)?.sort_order ?? 0)
            : groupItems.length * 10 + 10,
          is_active: true,
        },
        editingItemId ?? undefined,
      );
      toast.success(editingItemId ? "类型项已更新" : "类型项已添加");
      setEditingItemId(null);
      setPresetKey("");
      setItemKey("");
      setItemLabel("");
      setEnglishName("");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("类型项保存失败，请检查 Key 是否重复");
    } finally {
      setSaving(false);
    }
  }

  function editItem(item: V2DictionaryItem) {
    setEditingItemId(item.id);
    setPresetKey(field.items.some((preset) => preset.key === item.key) ? item.key : "custom");
    setItemKey(item.key);
    setItemLabel(item.label);
    const metadataName = item.metadata?.english_name;
    setEnglishName(typeof metadataName === "string" ? metadataName : item.description ?? "");
  }

  async function toggleItem(item: V2DictionaryItem) {
    try {
      await saveV2DictionaryItem({ ...item, is_active: !item.is_active }, item.id);
      toast.success(item.is_active ? "类型项已停用" : "类型项已启用");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("类型项状态更新失败");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-bdl bg-white/65 p-5">
        <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">FIELD CATALOG</p>
        <h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">选择要配置的字段</h3>
        <p className="mt-2 text-xs leading-5 text-txs">
          无需记忆数据库 Key。选择字段后，系统会自动带出对应类型组和推荐选项。
        </p>
        <div className="mt-4 space-y-2">
          {V2_DICTIONARY_FIELD_CATALOG.map((catalogField) => {
            const enabled = groups.some((row) => row.key === catalogField.key && row.is_active);
            return (
              <button
                key={catalogField.key}
                type="button"
                onClick={() => setSelectedFieldKey(catalogField.key)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedFieldKey === catalogField.key
                    ? "border-[#173d39] bg-[#173d39] text-white"
                    : "border-bdl bg-white/60 text-tx hover:border-ac"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-ds-bold">
                  <Settings2 className="h-4 w-4" />
                  {catalogField.name}
                  {enabled && <Check className="ml-auto h-3.5 w-3.5" />}
                </span>
                <code className={`mt-1 block text-[10px] ${selectedFieldKey === catalogField.key ? "text-white/60" : "text-txs"}`}>
                  {catalogField.fieldPath}
                </code>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-bdl bg-white/65 p-5">
        <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">TYPE SETTINGS</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl font-ds-black text-tx">{field.name}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-txs">{field.description}</p>
          </div>
          <code className="rounded-lg bg-bgs px-2 py-1 text-[10px] text-ac">{field.key}</code>
        </div>

        <div className="mt-5 rounded-2xl border border-bdl bg-bgs/35 p-4">
          <label className="text-xs text-txs">
            类型组中文名称
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac"
            />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => void saveGroup()} disabled={saving} variant="outline" className="border-bdl bg-white text-tx">
              {group ? "更新类型组" : "启用这个字段组"}
            </Button>
            <span className="text-[10px] text-txs">Key 由系统固定：{field.key}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#efb393]/35 bg-[#fffaf2] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-ds-bold text-tx">{editingItemId ? "编辑类型项" : "新增类型项"}</p>
            {editingItemId && (
              <button type="button" onClick={() => { setEditingItemId(null); choosePreset(""); }} className="text-[10px] font-ds-bold text-ac hover:underline">
                改为新增
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-txs sm:col-span-2">
              从推荐类型选择
              <select
                value={presetKey}
                onChange={(event) => choosePreset(event.target.value)}
                className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none"
              >
                <option value="">选择后自动填充名称和 Key</option>
                {field.items.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label} / {preset.englishName}</option>
                ))}
                <option value="custom">自定义类型</option>
              </select>
            </label>
            <DictionaryField label="中文名称" value={itemLabel} onChange={setItemLabel} placeholder="例如：分析目标" />
            <DictionaryField label="英文名称" value={englishName} onChange={setEnglishName} placeholder="Analysis objective" />
            <DictionaryField label="Key" value={itemKey} onChange={setItemKey} placeholder="analysis" />
          </div>
          <Button onClick={() => void saveItem()} disabled={saving || !group} className="mt-3 bg-[#173d39] text-white hover:bg-[#24554e]">
            <Plus className="h-4 w-4" />{editingItemId ? "保存修改" : "添加类型"}
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {groupItems.map((item) => {
            const metadataName = item.metadata?.english_name;
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-bdl bg-white/60 px-3 py-3">
                <span className="text-xs font-ds-bold text-tx">{item.label}</span>
                <span className="text-[10px] text-txs">{typeof metadataName === "string" ? metadataName : item.description}</span>
                <code className="rounded bg-bgs px-1.5 py-0.5 text-[10px] text-ac">{item.key}</code>
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => editItem(item)} className="inline-flex items-center gap-1 text-[10px] font-ds-bold text-ac hover:underline">
                    <Pencil className="h-3 w-3" />编辑
                  </button>
                  <button type="button" onClick={() => void toggleItem(item)} className="text-[10px] font-ds-bold text-txs hover:text-ac">
                    {item.is_active ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            );
          })}
          {group && groupItems.length === 0 && <p className="py-6 text-center text-xs text-txs">当前字段还没有类型项。</p>}
        </div>
      </section>
    </div>
  );
}

function DictionaryField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs text-txs">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac"
      />
    </label>
  );
}
