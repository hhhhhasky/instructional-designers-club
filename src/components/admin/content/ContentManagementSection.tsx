import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import SiteContentForm from "./SiteContentForm";
import { TextField, NumberField, TextAreaField } from "./fields";
import {
  HeroEditor,
  IntroductionEditor,
  ClubValuesEditor,
  FounderEditor,
  StatsEditor,
} from "./editors/SiteContentEditors";
import {
  MemberProfilesEditor,
  TestimonialsEditor,
  FaqsEditor,
  AnnouncementsEditor,
  ActivitiesEditor,
  ResourcesEditor,
} from "./editors/CollectionEditors";

type TabKey =
  | "hero"
  | "introduction"
  | "club_values"
  | "founder"
  | "stats"
  | "members"
  | "testimonials"
  | "faq"
  | "announcements"
  | "activities"
  | "resources";

const TABS: { key: TabKey; label: string }[] = [
  { key: "hero", label: "首页主视觉" },
  { key: "introduction", label: "俱乐部介绍" },
  { key: "club_values", label: "教学价值观" },
  { key: "founder", label: "创始人" },
  { key: "stats", label: "俱乐部数据" },
  { key: "members", label: "会员风采" },
  { key: "testimonials", label: "会员评价" },
  { key: "faq", label: "FAQ" },
  { key: "announcements", label: "动态/公告" },
  { key: "activities", label: "活动/直播" },
  { key: "resources", label: "资源文章" },
];

const asStr = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const asNum = (v: unknown): number | null =>
  typeof v === "number" && !Number.isNaN(v) ? v : null;

export default function ContentManagementSection() {
  const [tab, setTab] = useState<TabKey>("hero");

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-ds-lg bg-gradient-to-br from-ac/5 to-am/5 border border-bd p-4">
        <div className="w-9 h-9 rounded-ds-full bg-acl flex items-center justify-center flex-shrink-0">
          <LayoutDashboard className="w-5 h-5 text-ac" />
        </div>
        <div className="text-ds-sm text-txs leading-relaxed">
          <p className="font-ds-semibold text-tx mb-0.5">内容运营后台</p>
          在这里用表单维护首页与资源中心的全部可变内容，保存后<strong className="text-tx">前台刷新即生效</strong>，全程无需改代码。
          「下架」仅在前台隐藏（数据保留）；「永久删除」需输入确认词二次确认。
        </div>
      </div>

      {/* 子导航 */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-bd">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-ds-sm rounded-ds-pill whitespace-nowrap transition-colors flex-shrink-0 ${
              tab === t.key
                ? "bg-ac text-white font-ds-semibold"
                : "bg-warm text-txs hover:text-ac"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div>{renderTab(tab)}</div>
    </div>
  );
}

function renderTab(tab: TabKey) {
  switch (tab) {
    case "hero":
      return <HeroEditor />;
    case "introduction":
      return <IntroductionEditor />;
    case "club_values":
      return <ClubValuesEditor />;
    case "founder":
      return <FounderEditor />;
    case "stats":
      return <StatsEditor />;
    case "members":
      return <MembersView />;
    case "testimonials":
      return <TestimonialsView />;
    case "faq":
      return <FaqsView />;
    case "announcements":
      return <AnnouncementsEditor />;
    case "activities":
      return <ActivitiesEditor />;
    case "resources":
      return <ResourcesEditor />;
    default:
      return null;
  }
}

// ---------- 会员风采：区块标题 + 列表 ----------
function MembersView() {
  return (
    <div className="space-y-6">
      <SiteContentForm
        sectionKey="members"
        sectionLabel="会员风采 · 区块设置"
        description="区块标题、副标题、脚注与底部报名按钮。"
      >
        {({ data, setField }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField label="区块标题" value={asStr(data.section_title)} onChange={(v) => setField("section_title", v)} />
            <TextField label="副标题" value={asStr(data.subtitle)} onChange={(v) => setField("subtitle", v)} />
            <div className="md:col-span-2">
              <TextAreaField label="脚注文案" rows={2} value={asStr(data.footnote)} onChange={(v) => setField("footnote", v)} />
            </div>
            <TextField label="按钮文字" value={asStr(data.cta_text)} onChange={(v) => setField("cta_text", v)} />
            <TextField label="按钮链接" value={asStr(data.cta_link)} onChange={(v) => setField("cta_link", v)} />
            <div className="md:col-span-2">
              <TextField label="按钮下方提示" value={asStr(data.cta_hint)} onChange={(v) => setField("cta_hint", v)} />
            </div>
          </div>
        )}
      </SiteContentForm>
      <MemberProfilesEditor />
    </div>
  );
}

// ---------- 会员评价：区块设置 + 列表 ----------
function TestimonialsView() {
  return (
    <div className="space-y-6">
      <SiteContentForm
        sectionKey="testimonials"
        sectionLabel="会员评价 · 区块设置"
        description="区块标题、轮播间隔与脚注。"
      >
        {({ data, setField }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField label="区块标题" value={asStr(data.section_title)} onChange={(v) => setField("section_title", v)} />
            <NumberField label="轮播间隔（毫秒）" hint="如 5000 = 5 秒" value={asNum(data.autoplay_ms)} onChange={(v) => setField("autoplay_ms", v)} min={0} />
            <div className="md:col-span-2">
              <TextAreaField label="脚注文案" rows={2} value={asStr(data.footnote)} onChange={(v) => setField("footnote", v)} />
            </div>
          </div>
        )}
      </SiteContentForm>
      <TestimonialsEditor />
    </div>
  );
}

// ---------- FAQ：区块设置 + 列表 ----------
function FaqsView() {
  return (
    <div className="space-y-6">
      <SiteContentForm
        sectionKey="faq"
        sectionLabel="FAQ · 区块设置"
        description="区块标题。具体问答在下方列表维护。"
      >
        {({ data, setField }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField label="区块标题" value={asStr(data.section_title)} onChange={(v) => setField("section_title", v)} />
          </div>
        )}
      </SiteContentForm>
      <FaqsEditor />
    </div>
  );
}
