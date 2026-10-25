import { useWarnOnUnsavedChanges } from "@/components/admin/hai/HaiConfigWorkspace";
import { useEffect, useMemo, useState } from "react";
import { Image, RotateCcw, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";
import {
  IMAGE_PROMPT_CATALOG,
  configuredImagePrompt,
  imagePromptVariables,
  renderImagePrompt,
  validateImagePrompt,
  type ImagePromptOverrides,
} from "../../../supabase/functions/_shared/hai_image_prompt_catalog";

type ConfigRow = { key: string; value: string; enabled: boolean; updated_at: string };
const groups = ["全部", "通用生图", "视觉风格", "图片 PPT", "课件配图"];
const examples: Record<string, string | number> = {
  size: "16:9",
  subject_line: "学科：道德与法治。\n",
  style_label: "教育扁平插画",
  style_prompt: "采用清晰的教育插画。",
  image_type: "课件 PPT",
  reference_line: "",
  prompt: "为四年级学生画一张校园公共生活情境图。",
  topic: "校园里的规则",
  length: "compact",
  visual_design: "蓝绿配色，清晰插画",
  subject: "道德与法治",
  grade: "四年级",
  requirements: "简洁，适合投屏",
  flow: "观察校园情境，讨论规则的作用。",
  feedback: "减少封面文字",
  outline: "# 校园里的规则\n观察校园场景。",
  course: '{"topic":"校园里的规则"}',
  page_number: 2,
  total: 8,
  settings: '{"canvas":"16:9","navigation_label":"校园里的规则"}',
  title: "校园里的规则",
  page_content: "本页学生投屏文字：你发现了哪些规则？",
  navigation: "校园里的规则",
  content_markdown: "## 学生看到的文字\n你发现了哪些规则？\n## 配图\n学生在校园中有序活动。",
  text: "你发现了哪些规则？",
  image_description: "学生在校园中有序活动",
  layout: "左图右文",
  section: "情境观察",
  illustration_style: "教育主题插画",
  palette: "蓝绿、橙色",
  lighting: "柔和",
  texture: "细腻克制",
  realism: "半写实",
  slide_title: "观察校园生活",
  role: "内容页",
  style: "统一画风与色板",
  description: "课间学生有序活动",
  image_prompt: "一张16:9课堂页面，展示校园生活情境。",
};
export default function HaiImagePromptManagement() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [selectedKey, setSelectedKey] = useState(IMAGE_PROMPT_CATALOG[0].key);
  // Drafts survive navigation between prompts and configuration categories.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("全部");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState(false);
  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("hai_runtime_settings")
        .select("key,value,enabled,updated_at")
        .like("key", "image_prompt.%");
      if (error) throw error;
      setRows(data ?? []);
    } catch (error) {
      setLoadError(true);
      setStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const definition = IMAGE_PROMPT_CATALOG.find((item) => item.key === selectedKey)!;
  const row = rows.find((item) => item.key === selectedKey);
  const saved =
    row?.enabled !== false && typeof row?.value === "string" ? row.value : definition.defaultValue;
  const value = drafts[selectedKey] ?? saved;
  const dirty = value !== saved;
  useWarnOnUnsavedChanges(
    Object.entries(drafts).some(([key, draft]) => {
      const savedRow = rows.find((item) => item.key === key);
      const original =
        savedRow?.enabled !== false && typeof savedRow?.value === "string"
          ? savedRow.value
          : IMAGE_PROMPT_CATALOG.find((item) => item.key === key)?.defaultValue;
      return draft !== original;
    }),
  );
  const validation = validateImagePrompt(selectedKey, value);
  const filtered = IMAGE_PROMPT_CATALOG.filter(
    (item) =>
      (group === "全部" || item.group === group) &&
      `${item.label} ${item.description}`.includes(query.trim()),
  );
  const overrides = useMemo(
    () =>
      Object.fromEntries(
        rows.filter((item) => item.enabled !== false).map((item) => [item.key, item.value]),
      ) as ImagePromptOverrides,
    [rows],
  );
  const preview = useMemo(() => {
    if (validation) return validation;
    try {
      const pending = { ...overrides, [selectedKey]: value };
      return definition.group === "通用生图" || definition.group === "视觉风格"
        ? configuredImagePrompt(
            {
              prompt: String(examples.prompt),
              size: "16:9",
              style:
                definition.group === "视觉风格"
                  ? selectedKey.replace("image_prompt.style.", "")
                  : "教育扁平插画",
              imageType: "课件 PPT",
              hasReferences: true,
              subject: "道德与法治",
            },
            pending,
          )
        : renderImagePrompt(selectedKey, examples, pending);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, [selectedKey, value, overrides, validation, definition.group]);
  async function save() {
    if (validation || saving || loadError) return;
    setSaving(true);
    setStatus("");
    try {
      const { data, error } = await supabase
        .from("hai_runtime_settings")
        .upsert(
          {
            key: definition.key,
            label: definition.label,
            description: definition.description,
            category: "image_prompts",
            value,
            default_value: definition.defaultValue,
            value_type: "string",
            enabled: true,
          },
          { onConflict: "key" },
        )
        .select("key,value,enabled,updated_at")
        .single();
      if (error || !data) throw error || new Error("未返回保存结果");
      setRows((current) => [...current.filter((item) => item.key !== selectedKey), data]);
      setDrafts((current) => {
        const next = { ...current };
        delete next[selectedKey];
        return next;
      });
      setStatus(`已保存“${definition.label}”，后续新生成使用此配置。`);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="min-w-0">
      <header className="mb-5 flex items-start gap-3">
        <Image className="mt-1 h-5 w-5 text-ac" />
        <div>
          <h2 className="text-lg font-bold text-tx">生图提示词</h2>
          <p className="mt-1 text-xs leading-relaxed text-txs">
            统一管理 {IMAGE_PROMPT_CATALOG.length}{" "}
            项模板与风格。保存后用于新生成；已提交图片和历史结果保留原有内容。
          </p>
          <p className="mt-1 text-xs text-txs">
            图片 PPT 的主文档在「Work 工具」对应 Skill 中维护；AI 课件的学科主文档与参考材料在「AI
            课件」维护。
          </p>
        </div>
      </header>
      {status && (
        <p role="status" className="mb-4 border-l-2 border-ac bg-bg px-3 py-2 text-sm">
          {status}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-sm text-txs">正在读取生图提示词…</p>
      ) : loadError ? (
        <Button variant="outline" onClick={() => void load()}>
          重新加载
        </Button>
      ) : (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <label className="flex items-center gap-2 border-b border-bd pb-2">
              <Search className="h-4 w-4 text-txs" />
              <input
                aria-label="搜索生图提示词"
                placeholder="搜索名称或用途"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              aria-label="提示词分类"
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className="my-3 h-9 w-full rounded border border-bd bg-white px-2 text-xs"
            >
              {groups.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2 xl:max-h-[650px] xl:grid-cols-1">
              {filtered.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  aria-pressed={selectedKey === item.key}
                  className={`min-w-0 border-l-2 px-3 py-2 text-left text-sm ${selectedKey === item.key ? "border-ac bg-ac/5 font-bold text-ac" : "border-transparent text-tx hover:bg-bg"}`}
                >
                  <span className="block truncate">
                    {item.label}
                    {drafts[item.key] !== undefined &&
                    drafts[item.key] !==
                      (rows.find((row) => row.key === item.key)?.value ?? item.defaultValue)
                      ? " · 未保存"
                      : ""}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-txs">{item.group}</span>
                </button>
              ))}
            </div>
            {!filtered.length && <p className="py-4 text-xs text-txs">没有匹配的提示词</p>}
          </aside>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-tx">{definition.label}</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-txs">{definition.description}</p>
                <p className="mt-2 text-xs text-txs">
                  {row?.updated_at
                    ? `上次保存：${new Date(row.updated_at).toLocaleString("zh-CN")}`
                    : "当前使用默认内容"}
                  {dirty ? " · 有未保存修改" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    setDrafts((current) => ({ ...current, [selectedKey]: definition.defaultValue }))
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  恢复默认
                </Button>
                <Button
                  size="sm"
                  disabled={saving || !dirty || Boolean(validation)}
                  onClick={() => void save()}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "保存中…" : "保存提示词"}
                </Button>
              </div>
            </div>
            <label className="block text-xs text-txs">
              提示词正文
              <textarea
                aria-label="提示词正文"
                value={value}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [selectedKey]: event.target.value }))
                }
                spellCheck={false}
                rows={15}
                className="mt-2 w-full resize-y rounded border border-bd bg-white p-4 text-sm leading-7 text-tx focus:border-ac focus:outline-none"
              />
            </label>
            {imagePromptVariables(definition.defaultValue).length > 0 && (
              <p className="text-xs leading-6 text-txs">
                请保留变量：
                {imagePromptVariables(definition.defaultValue).map((name) => (
                  <code key={name} className="mr-2 inline-block text-ac">{`{{${name}}}`}</code>
                ))}
                。系统会自动填入本次请求的内容。
              </p>
            )}
            {validation && (
              <p role="alert" className="text-xs text-red-700">
                {validation}
              </p>
            )}
            <details className="border-t border-bd pt-3">
              <summary className="cursor-pointer text-xs font-bold text-txs">
                查看拼装示例（示例内容，不调用模型）
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words bg-bg p-4 text-xs leading-6 text-tx">
                {preview}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
