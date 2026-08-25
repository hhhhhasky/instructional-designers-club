import { useMemo, useState } from "react";
import { Plus, Tags, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LIVE_AUDIENCE_MODE_LABELS,
  LIVE_PARTICIPANT_TAG_PRESETS,
  normalizeLiveTag,
  type LiveAdminParticipant,
  type LiveAudienceMode,
} from "@/lib/live";

interface LiveAudienceFieldsProps {
  mode: LiveAudienceMode;
  targetUserIds: string[];
  targetTags: string[];
  participants: LiveAdminParticipant[];
  availableTags: string[];
  onlineUserIds: string[];
  disabled?: boolean;
  onModeChange: (mode: LiveAudienceMode) => void;
  onTargetUserIdsChange: (userIds: string[]) => void;
  onTargetTagsChange: (tags: string[]) => void;
}

export default function LiveAudienceFields({
  mode,
  targetUserIds,
  targetTags,
  participants,
  availableTags,
  onlineUserIds,
  disabled = false,
  onModeChange,
  onTargetUserIdsChange,
  onTargetTagsChange,
}: LiveAudienceFieldsProps) {
  const [tagInput, setTagInput] = useState("");
  const onlineSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const suggestedTags = useMemo(() => Array.from(new Set([
    ...LIVE_PARTICIPANT_TAG_PRESETS,
    ...availableTags,
  ])).filter((tag) => !targetTags.includes(tag)), [availableTags, targetTags]);

  const addTag = (rawTag: string) => {
    const tag = normalizeLiveTag(rawTag);
    if (!tag || targetTags.includes(tag) || targetTags.length >= 12) return;
    onTargetTagsChange([...targetTags, tag]);
    setTagInput("");
  };

  const toggleUser = (userId: string) => {
    onTargetUserIdsChange(targetUserIds.includes(userId)
      ? targetUserIds.filter((id) => id !== userId)
      : [...targetUserIds, userId]);
  };

  return (
    <section className="rounded-ds-xl border border-bd bg-bg/60 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-ds-lg bg-acl text-ac">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-ds-sm font-ds-bold text-tx">发送对象</h3>
          <p className="mt-1 text-ds-xs leading-5 text-txs">定向模式下，指定学员与标签按并集匹配；非目标学员不会看到题目。</p>
        </div>
      </div>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2" disabled={disabled}>
        {(Object.keys(LIVE_AUDIENCE_MODE_LABELS) as LiveAudienceMode[]).map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-ds-lg border px-3 py-3 text-ds-sm transition-colors ${
              mode === value ? "border-ac bg-acl text-ac" : "border-bd bg-white text-txs hover:border-ac/50"
            }`}
          >
            <input
              type="radio"
              name="live-audience-mode"
              value={value}
              checked={mode === value}
              onChange={() => onModeChange(value)}
              className="mr-2 accent-[var(--ac)]"
            />
            <span className="font-ds-bold">{LIVE_AUDIENCE_MODE_LABELS[value]}</span>
            <span className="mt-1 block pl-6 text-ds-xs font-normal opacity-75">
              {value === "all" ? "当前房间内所有登录学员" : "指定个人，或命中任一标签的学员"}
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "targeted" ? (
        <div className="mt-4 grid gap-4">
          <div className="rounded-ds-lg border border-bd bg-white p-3">
            <div className="flex items-center gap-2 text-ds-xs font-ds-bold text-tx"><Tags className="h-4 w-4 text-ac" />按标签发送</div>
            {targetTags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {targetTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-ds-pill bg-tll px-2.5 py-1 text-ds-xs font-ds-bold text-tl">
                    {tag}
                    <button type="button" aria-label={`移除目标标签 ${tag}`} disabled={disabled} onClick={() => onTargetTagsChange(targetTags.filter((item) => item !== tag))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            ) : <p className="mt-2 text-ds-xs text-txt">尚未选择标签。</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestedTags.map((tag) => (
                <button key={tag} type="button" disabled={disabled || targetTags.length >= 12} onClick={() => addTag(tag)} className="rounded-ds-pill border border-bd px-2.5 py-1 text-ds-xs text-txs hover:border-ac hover:text-ac disabled:opacity-40">+ {tag}</button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag(tagInput);
                  }
                }}
                disabled={disabled || targetTags.length >= 12}
                maxLength={32}
                placeholder="输入新的目标标签"
                className="h-9 min-w-0 flex-1 rounded-ds-md border border-bd bg-bg px-3 text-ds-xs text-tx focus:border-ac focus:outline-none"
              />
              <Button type="button" variant="outline" size="sm" disabled={disabled || !normalizeLiveTag(tagInput)} onClick={() => addTag(tagInput)}><Plus className="h-3.5 w-3.5" />添加</Button>
            </div>
          </div>

          <div className="rounded-ds-lg border border-bd bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-ds-xs font-ds-bold text-tx"><Users className="h-4 w-4 text-ac" />指定学员</div>
              <span className="text-ds-xs text-txt">已选 {targetUserIds.length} 人</span>
            </div>
            {participants.length === 0 ? (
              <p className="mt-3 rounded-ds-md bg-warm px-3 py-3 text-ds-xs leading-5 text-txs">学员进入房间后才会出现在这里。也可以先按标签设置题目，再为在线学员添加对应标签。</p>
            ) : (
              <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {participants.map((participant) => (
                  <label key={participant.user_id} className="flex cursor-pointer items-start gap-2 rounded-ds-md border border-transparent px-2.5 py-2 hover:border-bd hover:bg-bg">
                    <input type="checkbox" checked={targetUserIds.includes(participant.user_id)} onChange={() => toggleUser(participant.user_id)} disabled={disabled} className="mt-0.5 h-4 w-4 accent-[var(--ac)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-ds-xs font-ds-bold text-tx"><span className={`h-2 w-2 rounded-full ${onlineSet.has(participant.user_id) ? "bg-emerald-500" : "bg-bd"}`} />{participant.nickname}</span>
                      <span className="mt-1 block truncate text-[10px] text-txt">{participant.tags.length > 0 ? participant.tags.join(" · ") : `ID ${participant.user_id.slice(0, 8)}`}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
