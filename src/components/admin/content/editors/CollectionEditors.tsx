import type {
  MemberProfile,
  Faq,
  Testimonial,
  Announcement,
  Activity,
  Resource,
  AnnouncementType,
  ActivityType,
  ResourceType,
} from "@/types/types";
import {
  adminListMemberProfiles,
  adminCreateMemberProfile,
  adminUpdateMemberProfile,
  adminToggleMemberProfile,
  adminDeleteMemberProfile,
  adminListFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminToggleFaq,
  adminDeleteFaq,
  adminListTestimonials,
  adminCreateTestimonial,
  adminUpdateTestimonial,
  adminToggleTestimonial,
  adminDeleteTestimonial,
  adminListAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminToggleAnnouncement,
  adminDeleteAnnouncement,
  adminListActivities,
  adminCreateActivity,
  adminUpdateActivity,
  adminToggleActivity,
  adminDeleteActivity,
  adminListResources,
  adminCreateResource,
  adminUpdateResource,
  adminToggleResource,
  adminDeleteResource,
} from "@/db/admin-api";
import CollectionEditor, {
  type CollectionConfig,
  type FieldSpec,
} from "../CollectionEditor";
import { getColor } from "../fields";

// 公共选项
const ANNOUNCEMENT_TYPE_OPTIONS: { value: AnnouncementType; label: string }[] = [
  { value: "new_course", label: "新课上线" },
  { value: "live", label: "直播预告" },
  { value: "event", label: "活动" },
  { value: "announcement", label: "公告" },
];

const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "live", label: "直播" },
  { value: "lesson_review", label: "磨课会议" },
  { value: "study_group", label: "共学" },
  { value: "event", label: "其他活动" },
];

const RESOURCE_TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: "translation", label: "翻译" },
  { value: "wechat", label: "公众号" },
  { value: "article", label: "文章" },
];

// ==================== 会员风采 ====================

const memberConfig: CollectionConfig<MemberProfile> = {
  title: "会员风采列表",
  description: "管理首页「部分会员简介」展示的会员卡片。",
  itemName: "会员",
  deleteConfirmWord: "删除",
  fields: [
    { key: "icon", label: "图标（emoji）", type: "text", required: true, placeholder: "👶" },
    { key: "name", label: "名称", type: "text", required: true, full: true },
    { key: "description", label: "简介", type: "text", full: true },
    { key: "is_active", label: "上架（前台显示）", type: "toggle" },
  ],
  columns: [
    { key: "name", label: "名称", render: (r) => (
      <div className="flex items-center gap-2">
        <span>{r.icon}</span>
        <span className="font-ds-medium text-tx truncate max-w-[200px]">{r.name}</span>
      </div>
    ) },
    { key: "description", label: "简介", render: (r) => <span className="truncate inline-block max-w-[280px] align-bottom">{r.description}</span> },
  ],
  list: adminListMemberProfiles,
  create: (p) => adminCreateMemberProfile(p as never),
  update: (id, p) => adminUpdateMemberProfile(id, p as never),
  toggle: adminToggleMemberProfile,
  remove: adminDeleteMemberProfile,
  defaultForm: () => ({ icon: "⭐", name: "", description: "", is_active: true }),
};

export function MemberProfilesEditor() {
  return <CollectionEditor config={memberConfig} />;
}

// ==================== FAQ ====================

const faqConfig: CollectionConfig<Faq> = {
  title: "FAQ 列表",
  description: "首页常见问题。答案可用 **文字** 加粗。",
  itemName: "问题",
  deleteConfirmWord: "删除",
  fields: [
    { key: "question", label: "问题", type: "text", required: true, full: true, placeholder: "Q：……？" },
    { key: "answer", label: "答案", type: "textarea", required: true, full: true, rows: 5, hint: "用 **文字** 加粗" },
    { key: "is_active", label: "上架（前台显示）", type: "toggle" },
  ],
  columns: [
    { key: "question", label: "问题", render: (r) => (
      <span className="text-tx truncate inline-block max-w-[420px] align-bottom">{r.question}</span>
    ) },
  ],
  list: adminListFaqs,
  create: (p) => adminCreateFaq(p as never),
  update: (id, p) => adminUpdateFaq(id, p as never),
  toggle: adminToggleFaq,
  remove: adminDeleteFaq,
  defaultForm: () => ({ question: "", answer: "", is_active: true }),
};

export function FaqsEditor() {
  return <CollectionEditor config={faqConfig} />;
}

// ==================== 会员评价 ====================

const testimonialConfig: CollectionConfig<Testimonial> = {
  title: "会员评价列表",
  description: "首页评价轮播的图片。「摘要」用于图片说明与无障碍 alt。",
  itemName: "评价",
  deleteConfirmWord: "删除",
  fields: [
    { key: "image_url", label: "图片链接", type: "text", required: true, full: true, placeholder: "https://..." },
    { key: "alt_text", label: "评价摘要", type: "textarea", required: true, full: true, rows: 2, hint: "将作为图片说明 / 搜索文字" },
    { key: "author", label: "评价人（选填）", type: "text", full: true },
    { key: "is_active", label: "上架（前台显示）", type: "toggle" },
  ],
  columns: [
    { key: "image_url", label: "预览", render: (r) => (
      <img src={r.image_url} alt={r.alt_text} className="h-12 w-auto rounded border border-bd object-cover" />
    ) },
    { key: "alt_text", label: "摘要", render: (r) => (
      <span className="truncate inline-block max-w-[320px] align-bottom">{r.alt_text}</span>
    ) },
  ],
  list: adminListTestimonials,
  create: (p) => adminCreateTestimonial(p as never),
  update: (id, p) => adminUpdateTestimonial(id, p as never),
  toggle: adminToggleTestimonial,
  remove: adminDeleteTestimonial,
  defaultForm: () => ({ image_url: "", alt_text: "", author: null, is_active: true }),
};

export function TestimonialsEditor() {
  return <CollectionEditor config={testimonialConfig} />;
}

// ==================== 动态 / 上新 / 公告 ====================

const announcementFields: FieldSpec[] = [
  { key: "type", label: "类型", type: "select", required: true, options: ANNOUNCEMENT_TYPE_OPTIONS },
  { key: "is_pinned", label: "置顶", type: "toggle" },
  { key: "title", label: "标题", type: "text", required: true, full: true },
  { key: "summary", label: "摘要（选填）", type: "textarea", full: true, rows: 2 },
  { key: "link_url", label: "跳转链接（选填）", type: "text", full: true, placeholder: "https://..." },
  { key: "link_label", label: "按钮文字（选填）", type: "text", placeholder: "如：查看课程" },
  { key: "published_at", label: "发布时间", type: "datetime" },
  { key: "expires_at", label: "过期时间（留空=永不过期）", type: "datetime" },
  { key: "is_active", label: "上架（前台显示）", type: "toggle" },
];

const announcementConfig: CollectionConfig<Announcement> = {
  title: "动态 / 上新 / 公告",
  description: "首页动态信息流。过期时间留空表示长期显示；类型用于图标与颜色。",
  itemName: "动态",
  deleteConfirmWord: "删除",
  fields: announcementFields,
  columns: [
    { key: "type", label: "类型", render: (r) => (
      <span className={`inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${typeStyle(r.type).badge}`}>
        {ANNOUNCEMENT_TYPE_OPTIONS.find((o) => o.value === r.type)?.label ?? r.type}
      </span>
    ) },
    { key: "title", label: "标题", render: (r) => (
      <span className="font-ds-medium text-tx truncate inline-block max-w-[280px] align-bottom">
        {r.is_pinned && <span className="text-ac mr-1">📌</span>}
        {r.title}
      </span>
    ) },
    { key: "published_at", label: "发布", render: (r) => <span>{r.published_at?.slice(0, 10) ?? "—"}</span> },
  ],
  list: adminListAnnouncements,
  create: (p) => adminCreateAnnouncement(p as never),
  update: (id, p) => adminUpdateAnnouncement(id, p as never),
  toggle: adminToggleAnnouncement,
  remove: adminDeleteAnnouncement,
  defaultForm: () => ({
    type: "announcement",
    title: "",
    summary: null,
    link_url: null,
    link_label: null,
    is_pinned: false,
    is_active: true,
    published_at: toLocalInput(now()),
    expires_at: null,
  }),
};

export function AnnouncementsEditor() {
  return <CollectionEditor config={announcementConfig} />;
}

// ==================== 活动 / 直播 ====================

const activityConfig: CollectionConfig<Activity> = {
  title: "活动 / 直播",
  description: "近期直播、磨课、共学等活动。",
  itemName: "活动",
  deleteConfirmWord: "删除",
  fields: [
    { key: "activity_type", label: "类型", type: "select", required: true, options: ACTIVITY_TYPE_OPTIONS },
    { key: "title", label: "标题", type: "text", required: true, full: true },
    { key: "description", label: "描述（选填）", type: "textarea", full: true, rows: 3 },
    { key: "start_time", label: "开始时间", type: "datetime" },
    { key: "end_time", label: "结束时间（选填）", type: "datetime" },
    { key: "location", label: "地点 / 说明（选填）", type: "text", full: true },
    { key: "meeting_url", label: "会议链接（选填）", type: "text", full: true },
    { key: "is_active", label: "上架（前台显示）", type: "toggle" },
  ],
  columns: [
    { key: "activity_type", label: "类型", render: (r) => (
      <span className={`inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${typeStyle(r.activity_type).badge}`}>
        {ACTIVITY_TYPE_OPTIONS.find((o) => o.value === r.activity_type)?.label ?? r.activity_type}
      </span>
    ) },
    { key: "title", label: "标题", render: (r) => (
      <span className="font-ds-medium text-tx truncate inline-block max-w-[260px] align-bottom">{r.title}</span>
    ) },
    { key: "start_time", label: "开始", render: (r) => <span>{r.start_time?.slice(0, 16).replace("T", " ") ?? "—"}</span> },
  ],
  list: adminListActivities,
  create: (p) => adminCreateActivity(p as never),
  update: (id, p) => adminUpdateActivity(id, p as never),
  toggle: adminToggleActivity,
  remove: adminDeleteActivity,
  defaultForm: () => ({
    activity_type: "event",
    title: "",
    description: null,
    start_time: null,
    end_time: null,
    location: null,
    meeting_url: null,
    is_active: true,
  }),
};

export function ActivitiesEditor() {
  return <CollectionEditor config={activityConfig} />;
}

// ==================== 资源文章 ====================

const resourceConfig: CollectionConfig<Resource> = {
  title: "资源中心文章",
  description: "资源中心展示的文章。每篇可配置多个外链按钮。",
  itemName: "文章",
  deleteConfirmWord: "删除",
  fields: [
    { key: "resource_type", label: "分类", type: "select", required: true, options: RESOURCE_TYPE_OPTIONS },
    { key: "title", label: "标题", type: "text", required: true, full: true },
    { key: "description", label: "摘要（选填）", type: "textarea", full: true, rows: 2 },
    { key: "cover_url", label: "封面图链接（选填）", type: "text", full: true },
    { key: "links", label: "外链", type: "links", required: true, hint: "至少一个" },
    { key: "is_active", label: "上架（前台显示）", type: "toggle" },
  ],
  columns: [
    { key: "resource_type", label: "分类", render: (r) => (
      <span className={`inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${typeStyle(r.resource_type).badge}`}>
        {RESOURCE_TYPE_OPTIONS.find((o) => o.value === r.resource_type)?.label ?? r.resource_type}
      </span>
    ) },
    { key: "title", label: "标题", render: (r) => (
      <span className="text-tx truncate inline-block max-w-[360px] align-bottom">{r.title}</span>
    ) },
    { key: "links", label: "链接数", render: (r) => <span>{r.links?.length ?? 0}</span> },
  ],
  list: adminListResources,
  create: (p) => adminCreateResource(p as never),
  update: (id, p) => adminUpdateResource(id, p as never),
  toggle: adminToggleResource,
  remove: adminDeleteResource,
  defaultForm: () => ({
    resource_type: "article",
    title: "",
    description: null,
    cover_url: null,
    links: [{ label: "阅读全文", url: "" }],
    is_active: true,
  }),
};

export function ResourcesEditor() {
  return <CollectionEditor config={resourceConfig} />;
}

// ==================== 工具：类型颜色样式 ====================

function typeStyle(kind: string): { badge: string } {
  // translation=蓝, wechat=绿, article=紫, new_course/ac=主色, live=红, event=琥珀, announcement=青
  switch (kind) {
    case "translation":
    case "live":
      return { badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    case "wechat":
    case "study_group":
      return { badge: "bg-green-500/10 text-green-600 border-green-500/20" };
    case "article":
    case "announcement":
      return { badge: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
    case "new_course":
      return { badge: getColor("ac").badge };
    case "event":
    case "lesson_review":
      return { badge: getColor("am").badge };
    default:
      return { badge: getColor("tl").badge };
  }
}

// 日期工具（用于默认发布时间）
function now(): Date {
  return new Date();
}
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
