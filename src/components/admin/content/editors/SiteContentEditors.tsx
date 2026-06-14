import SiteContentForm, {
  ParagraphListEditor,
  ObjectListEditor,
} from "../SiteContentForm";
import {
  TextField,
  TextAreaField,
  NumberField,
  IconSelect,
  ColorSelect,
} from "../fields";

// 读取助手：把 JSONB 值安全地转成目标类型
const asStr = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const asNum = (v: unknown): number | null =>
  typeof v === "number" && !Number.isNaN(v) ? v : null;
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// ==================== Hero 主视觉 ====================

export function HeroEditor() {
  return (
    <SiteContentForm
      sectionKey="hero"
      sectionLabel="首页主视觉（Hero）"
      description="首页最顶部的大标题与按钮。"
    >
      {({ data, setField }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <TextField
              label="主标题第一行"
              value={asStr(data.title_line1)}
              onChange={(v) => setField("title_line1", v)}
              placeholder="让每一堂课，"
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              label="主标题第二行"
              value={asStr(data.title_line2)}
              onChange={(v) => setField("title_line2", v)}
              placeholder="都值得被认真对待"
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              label="副标题"
              value={asStr(data.subtitle)}
              onChange={(v) => setField("subtitle", v)}
              placeholder="一所AI时代的线上创新师范学院"
            />
          </div>
          <TextField
            label="按钮文字"
            value={asStr(data.cta_text)}
            onChange={(v) => setField("cta_text", v)}
            placeholder="申请成为会员"
          />
          <TextField
            label="按钮跳转链接"
            value={asStr(data.cta_link)}
            onChange={(v) => setField("cta_link", v)}
            placeholder="https://（报名表单地址）"
          />
        </div>
      )}
    </SiteContentForm>
  );
}

// ==================== 俱乐部介绍 ====================

export function IntroductionEditor() {
  return (
    <SiteContentForm
      sectionKey="introduction"
      sectionLabel="俱乐部介绍"
      description="首页「俱乐部介绍」卡片：标题、欢迎语、Plus / Pro 产品介绍。"
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="区块标题"
              value={asStr(data.section_title)}
              onChange={(v) => setField("section_title", v)}
            />
            <TextField
              label="区块副标题"
              value={asStr(data.section_subtitle)}
              onChange={(v) => setField("section_subtitle", v)}
            />
            <div className="md:col-span-2">
              <TextField
                label="欢迎卡标题"
                value={asStr(data.welcome_title)}
                onChange={(v) => setField("welcome_title", v)}
              />
            </div>
          </div>

          <ParagraphListEditor
            label="欢迎正文（多段）"
            hint="用 **文字** 表示加粗"
            value={asArr<string>(data.welcome_paragraphs)}
            onChange={(v) => setField("welcome_paragraphs", v)}
          />

          <TextField
            label="产品介绍小标题"
            value={asStr(data.product_intro_heading)}
            onChange={(v) => setField("product_intro_heading", v)}
          />

          <TextAreaField
            label="Plus 会员介绍"
            hint="用 **文字** 表示加粗"
            rows={4}
            value={asStr(data.plus_text)}
            onChange={(v) => setField("plus_text", v)}
          />
          <TextAreaField
            label="Pro 会员介绍"
            hint="用 **文字** 表示加粗"
            rows={4}
            value={asStr(data.pro_text)}
            onChange={(v) => setField("pro_text", v)}
          />
        </div>
      )}
    </SiteContentForm>
  );
}

// ==================== 教学价值观 ====================

interface ValueItem {
  emoji: string;
  text: string;
}

export function ClubValuesEditor() {
  return (
    <SiteContentForm
      sectionKey="club_values"
      sectionLabel="教学价值观"
      description="「我们相信的教学观」标题与若干条信念。"
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="区块标题"
              value={asStr(data.values_title)}
              onChange={(v) => setField("values_title", v)}
            />
            <TextField
              label="区块副标题"
              value={asStr(data.values_subtitle)}
              onChange={(v) => setField("values_subtitle", v)}
            />
          </div>

          <ObjectListEditor<ValueItem>
            label="信念条目"
            hint="用 **文字** 表示加粗"
            items={asArr<ValueItem>(data.items)}
            onChange={(v) => setField("items", v)}
            newItem={() => ({ emoji: "⭐", text: "" })}
            addLabel="添加一条信念"
            renderItem={(item, update) => (
              <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3">
                <TextField
                  label="图标"
                  value={item.emoji}
                  onChange={(v) => update({ emoji: v })}
                  placeholder="✨"
                />
                <TextField
                  label="文案"
                  value={item.text}
                  onChange={(v) => update({ text: v })}
                  placeholder="学习是可以被优化的"
                />
              </div>
            )}
          />
        </div>
      )}
    </SiteContentForm>
  );
}

// ==================== 俱乐部创始人 ====================

interface FounderTag {
  icon: string;
  label: string;
  color: string;
}
interface FounderInfo {
  icon: string;
  label: string;
  text: string;
  color: string;
}
interface FounderStat {
  icon: string;
  value: string;
  label: string;
  color: string;
}

export function FounderEditor() {
  return (
    <SiteContentForm
      sectionKey="founder"
      sectionLabel="俱乐部创始人"
      description="创始人头像、姓名、标签、座右铭、愿景/产品/社区、关键数据指标。"
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="区块标题"
              value={asStr(data.section_title)}
              onChange={(v) => setField("section_title", v)}
            />
            <TextField
              label="姓名"
              value={asStr(data.name)}
              onChange={(v) => setField("name", v)}
            />
            <TextField
              label="头像图片链接"
              value={asStr(data.avatar_url)}
              onChange={(v) => setField("avatar_url", v)}
            />
            <TextField
              label="头像描述（alt）"
              value={asStr(data.avatar_alt)}
              onChange={(v) => setField("avatar_alt", v)}
            />
            <div className="md:col-span-2">
              <TextField
                label="座右铭"
                value={asStr(data.motto)}
                onChange={(v) => setField("motto", v)}
              />
            </div>
          </div>

          <ObjectListEditor<FounderTag>
            label="头衔标签"
            items={asArr<FounderTag>(data.tags)}
            onChange={(v) => setField("tags", v)}
            newItem={() => ({ icon: "Sparkles", label: "", color: "ac" })}
            addLabel="添加标签"
            renderItem={(item, update) => (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <IconSelect
                  label="图标"
                  value={item.icon}
                  onChange={(v) => update({ icon: v })}
                />
                <TextField
                  label="文字"
                  value={item.label}
                  onChange={(v) => update({ label: v })}
                />
                <ColorSelect
                  label="颜色"
                  value={item.color}
                  onChange={(v) => update({ color: v })}
                />
              </div>
            )}
          />

          <ObjectListEditor<FounderInfo>
            label="愿景 / 产品 / 社区"
            items={asArr<FounderInfo>(data.info_items)}
            onChange={(v) => setField("info_items", v)}
            newItem={() => ({ icon: "Lightbulb", label: "", text: "", color: "am" })}
            addLabel="添加一行"
            renderItem={(item, update) => (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <IconSelect
                  label="图标"
                  value={item.icon}
                  onChange={(v) => update({ icon: v })}
                />
                <TextField
                  label="小标题（如 愿景）"
                  value={item.label}
                  onChange={(v) => update({ label: v })}
                />
                <TextField
                  label="内容"
                  value={item.text}
                  onChange={(v) => update({ text: v })}
                />
                <ColorSelect
                  label="颜色"
                  value={item.color}
                  onChange={(v) => update({ color: v })}
                />
              </div>
            )}
          />

          <ObjectListEditor<FounderStat>
            label="关键数据指标"
            hint="如 6h+ / 每日AI"
            items={asArr<FounderStat>(data.stats)}
            onChange={(v) => setField("stats", v)}
            newItem={() => ({ icon: "Sparkles", value: "", label: "", color: "ac" })}
            addLabel="添加一项"
            renderItem={(item, update) => (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <IconSelect
                  label="图标"
                  value={item.icon}
                  onChange={(v) => update({ icon: v })}
                />
                <TextField
                  label="数值（如 6h+）"
                  value={item.value}
                  onChange={(v) => update({ value: v })}
                />
                <TextField
                  label="标签（如 每日AI）"
                  value={item.label}
                  onChange={(v) => update({ label: v })}
                />
                <ColorSelect
                  label="颜色"
                  value={item.color}
                  onChange={(v) => update({ color: v })}
                />
              </div>
            )}
          />
        </div>
      )}
    </SiteContentForm>
  );
}

// ==================== 俱乐部数据 ====================

export function StatsEditor() {
  return (
    <SiteContentForm
      sectionKey="stats"
      sectionLabel="俱乐部数据"
      description="数据区块标题与脚注。「会员人数」可手填覆盖（留空则自动取真实会员数）；「运行起始日」用于计算运行天数。"
    >
      {({ data, setField }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="区块标题"
            value={asStr(data.section_title)}
            onChange={(v) => setField("section_title", v)}
          />
          <TextField
            label="区块副标题"
            value={asStr(data.section_subtitle)}
            onChange={(v) => setField("section_subtitle", v)}
          />
          <NumberField
            label="会员人数（覆盖值，留空=自动统计真实会员数）"
            hint="例如想显示 500 就填 500；留空则按数据库真实会员数显示"
            value={asNum(data.member_count)}
            onChange={(v) => setField("member_count", v)}
            min={0}
          />
          <TextField
            label="运行起始日（YYYY-MM-DD）"
            hint="用于「运行天数」计算"
            value={asStr(data.start_date)}
            onChange={(v) => setField("start_date", v)}
            placeholder="2025-03-31"
          />
          <div className="md:col-span-2">
            <TextAreaField
              label="脚注文案"
              rows={2}
              value={asStr(data.footnote)}
              onChange={(v) => setField("footnote", v)}
            />
          </div>
        </div>
      )}
    </SiteContentForm>
  );
}
