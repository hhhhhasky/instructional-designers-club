import { useEffect, useState } from "react";
import type { HaiFeatureModule, HaiModelProvider } from "@/db/hai-api";

/**
 * 功能模块的「前端展示 + 生成参数」编辑控件。
 * 由「功能模块与生成参数」（chat 模块）与「Work 工具中心」（work 模块）共用，
 * 保证两处字段集始终一致。注意：这里只编辑生成参数，不含 is_enabled 开关——
 * work 模块的可见性由后端 hai_recompute_work_module_enabled 按 Skill 状态自动维护。
 */
export default function ModuleParamFields({
  module,
  onPatch,
  providers = [],
}: {
  module: HaiFeatureModule;
  onPatch: (updates: Partial<HaiFeatureModule>) => void;
  providers?: HaiModelProvider[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-ds-sm">
      <TextInput label="前端名称" value={module.name} onChange={(value) => onPatch({ name: value })} />
      <NumberInput label="前端排序" value={module.sort_order} onChange={(value) => onPatch({ sort_order: value })} />
      <div className="col-span-2">
        <TextInput label="入口说明" value={module.description} onChange={(value) => onPatch({ description: value })} />
      </div>
      {providers.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-ds-xs text-txs">模型</span>
          <select
            value={module.model_provider_id ?? ""}
            onChange={(event) => {
              const providerId = event.target.value || null;
              const provider = providerId ? providers.find((p) => p.id === providerId) : null;
              onPatch({
                model_provider_id: providerId,
                default_model: provider?.model_name ?? module.default_model,
              });
            }}
            className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
          >
            <option value="">-- 环境变量默认 --</option>
            {providers.filter((p) => p.is_enabled).map((p) => (
              <option key={p.id} value={p.id}>{p.label} ({p.model_name})</option>
            ))}
          </select>
        </label>
      ) : (
        <TextInput label="模型" value={module.default_model} onChange={(value) => onPatch({ default_model: value })} />
      )}
      <NumberInput label="温度" value={Number(module.default_temperature)} step={0.05} onChange={(value) => onPatch({ default_temperature: value })} />
      <OptionalNumberInput label="Top P" value={module.default_top_p} step={0.05} min={0.01} max={1} onChange={(value) => onPatch({ default_top_p: value })} />
      <NumberInput label="输出" value={module.default_max_output_tokens} onChange={(value) => onPatch({ default_max_output_tokens: value })} />
      <SelectInput label="思考模式" value={module.thinking_enabled ? "enabled" : "disabled"} options={[["disabled", "关闭"], ["enabled", "开启"]]} onChange={(value) => onPatch({ thinking_enabled: value === "enabled" })} />
      <SelectInput label="推理强度" value={module.reasoning_effort ?? "high"} options={[["high", "High"], ["max", "Max"]]} onChange={(value) => onPatch({ reasoning_effort: value as HaiFeatureModule["reasoning_effort"] })} />
      <SelectInput label="输出格式" value={module.response_format ?? "text"} options={[["text", "Text"], ["json_object", "JSON"]]} onChange={(value) => onPatch({ response_format: value as HaiFeatureModule["response_format"] })} />
      <StopSequencesInput value={module.stop_sequences ?? []} onChange={(value) => onPatch({ stop_sequences: value })} />
      <NumberInput label="历史条数" value={module.history_message_limit ?? 20} onChange={(value) => onPatch({ history_message_limit: value })} />
      <NumberInput label="记忆条数" value={module.memory_limit ?? 20} onChange={(value) => onPatch({ memory_limit: value })} />
      <NumberInput label="素材召回" value={module.material_match_count ?? 8} onChange={(value) => onPatch({ material_match_count: value })} />
      <NumberInput label="知识召回" value={module.knowledge_match_count ?? 6} onChange={(value) => onPatch({ knowledge_match_count: value })} />
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = local.trim();
          if (next && next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        type="number"
        step={step}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = Number(local);
          if (Number.isFinite(next) && next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

export function OptionalNumberInput({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number | null) => void;
}) {
  const [local, setLocal] = useState(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setLocal(value === null || value === undefined ? "" : String(value));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder="默认"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          if (!local.trim()) {
            if (value !== null) onChange(null);
            return;
          }
          let next = Number(local);
          if (!Number.isFinite(next)) return;
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          if (next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

export function StopSequencesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [local, setLocal] = useState(value.join("\\n"));

  useEffect(() => {
    setLocal(value.join("\\n"));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">停止序列</span>
      <input
        value={local}
        placeholder="用 \\n 分隔"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = local.split("\\n").map((item) => item.trim()).filter(Boolean).slice(0, 16);
          if (next.join("\\n") !== value.join("\\n")) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}
