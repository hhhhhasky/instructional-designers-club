import SiteContentForm, { ObjectListEditor, ParagraphListEditor } from '../SiteContentForm';
import { TextAreaField, TextField } from '../fields';
import { HOME_LANDING_DEFAULTS, type HomeLandingKey } from '@/lib/home-landing-content';

export const LANDING_TABS: { key: HomeLandingKey; label: string }[] = [
  { key: 'home_hero', label: '首屏与按钮' },
  { key: 'home_member', label: '登录后学习区' },
  { key: 'home_situations', label: '教学场景' },
  { key: 'home_problem', label: '常见做法的不足' },
  { key: 'home_method', label: '哈老师的方法' },
  { key: 'home_founder', label: '哈老师是谁' },
  { key: 'home_outcomes', label: '学习收获' },
  { key: 'home_courses', label: '三门课程' },
  { key: 'home_learning', label: '下单与观看' },
  { key: 'home_extra', label: '免费课·问答·更新' },
];

const LABELS: Record<HomeLandingKey, Record<string, string>> = {
  home_hero: { kicker: '首屏眉题', title_line1: '主标题第一行', title_line2: '主标题第二行', description: '首屏说明', primary_cta: '主按钮文字', secondary_cta: '次按钮文字', learning_cta: '已登录用户学习入口', aside_title: '右侧提示标题', aside_steps: '设计线索', aside_note: '右侧提示结语' },
  home_member: { kicker: '学习区眉题', greeting_prefix: '问候前缀', greeting_suffix: '问候后缀', description: '学习区说明', error_suffix: '加载失败时问候后缀', error_description: '加载失败提示', error_cta: '加载失败入口', learning_map_title: '学习地图标题', learning_map_description: '学习地图说明', chat_title: '咨询入口标题', chat_description: '咨询入口说明', work_title: '教研工具标题', work_description: '教研工具说明', completed_description: '已学完时提示', all_courses_cta: '全部课程入口', all_learning_cta: '全部学习入口' },
  home_situations: { kicker: '区块眉题', title: '区块标题', description: '区块说明', items: '教学场景卡片', label: '场景标签', detail: '具体说明' },
  home_problem: { kicker: '区块眉题', title: '区块标题', description: '区块说明', items: '常见做法', detail: '不足说明', conclusion: '区块结语' },
  home_method: { kicker: '区块眉题', title_line1: '标题第一行', title_line2: '标题第二行', description: '方法说明', items: '方法步骤', detail: '步骤说明', before_label: '调整前标签', before_text: '调整前示例', after_label: '调整后标签', after_text: '调整后示例', footnote: '示例脚注' },
  home_founder: { kicker: '区块眉题', title: '区块标题', description: '人物介绍', closing: '人物介绍结语' },
  home_outcomes: { kicker: '区块眉题', title: '区块标题', description: '区块说明', item_kicker: '卡片小标签', items: '学习收获', detail: '收获说明' },
  home_courses: { kicker: '区块眉题', title: '区块标题', description: '选课说明', product_label: '商品卡标签', catalogue_cta: '目录按钮文字', purchase_cta: '购买按钮前缀', access_cta: '已购按钮前缀', footnote: '购买说明', items: '三门课的适合人群与收获', audience: '适合人群', gain: '学习收获' },
  home_learning: { kicker: '区块眉题', title: '区块标题', items: '下单与观看步骤', detail: '步骤说明', footnote: '订单与开通提示', learning_cta: '学习入口文字' },
  home_extra: { free_kicker: '免费课眉题', free_title: '免费课标题', free_cta: '全部课程按钮', faq_kicker: '问答眉题', faq_title: '问答标题', faq_items: '常见问答', detail: '回答', faq_cta: '返回课程按钮', updates_title: '课程更新标题', updates_description: '课程更新说明' },
};

const labelFor = (section: HomeLandingKey, field: string) => LABELS[section][field] ?? field;

export function HomeLandingEditor({ sectionKey }: { sectionKey: HomeLandingKey }) {
  const tab = LANDING_TABS.find((entry) => entry.key === sectionKey)!;
  const defaults = HOME_LANDING_DEFAULTS[sectionKey] as Record<string, unknown>;

  return <SiteContentForm
    sectionKey={sectionKey}
    sectionLabel={tab.label}
    description="每个字段均对应首页的一处文字。保存后，前台刷新即可读取数据库中的新文案。"
    defaultData={defaults}
  >
    {({ data, setField }) => <div className="space-y-5">
      {Object.entries(defaults).map(([field, fallback]) => {
        const value = data[field] ?? fallback;
        if (typeof fallback === 'string') {
          return field === 'description' || field === 'detail' || field === 'footnote' || field === 'closing' || field.endsWith('_text') || fallback.length > 70
            ? <TextAreaField key={field} label={labelFor(sectionKey, field)} rows={3} value={String(value)} onChange={(next) => setField(field, next)} />
            : <TextField key={field} label={labelFor(sectionKey, field)} value={String(value)} onChange={(next) => setField(field, next)} />;
        }
        if (!Array.isArray(fallback)) return null;
        if (typeof fallback[0] === 'string') {
          return <ParagraphListEditor key={field} label={labelFor(sectionKey, field)} value={Array.isArray(value) ? value as string[] : fallback as string[]} onChange={(next) => setField(field, next)} />;
        }
        const items = (Array.isArray(value) ? value : fallback) as Record<string, string>[];
        if (sectionKey === 'home_courses') {
          return <div key={field} className="space-y-3">
            <h4 className="text-sm font-ds-bold text-tx">{labelFor(sectionKey, field)}</h4>
            {items.map((item, index) => <div key={item.code} className="rounded-ds-md border border-bd p-4 space-y-3">
              <p className="text-sm font-ds-bold text-ac">{item.code === 'teaching-general-v1' ? '教学通识课' : item.code === 'teacher-ai' ? '教师 AI 课' : '道法教材解读课'}</p>
              {(['audience', 'gain'] as const).map((name) => <TextAreaField key={name} label={labelFor(sectionKey, name)} rows={2} value={item[name] ?? ''} onChange={(next) => setField(field, items.map((current, at) => at === index ? { ...current, [name]: next } : current))} />)}
            </div>)}
          </div>;
        }
        const example = fallback[0] as Record<string, string>;
        return <ObjectListEditor<Record<string, string>>
          key={field}
          label={labelFor(sectionKey, field)}
          items={items}
          onChange={(next) => setField(field, next)}
          newItem={() => Object.fromEntries(Object.keys(example).map((name) => [name, '']))}
          addLabel="添加一项"
          renderItem={(item, update) => <div className="space-y-3">{Object.keys(example).map((name) => name === 'detail'
            ? <TextAreaField key={name} label={labelFor(sectionKey, name)} rows={2} value={item[name] ?? ''} onChange={(next) => update({ [name]: next })} />
            : <TextField key={name} label={labelFor(sectionKey, name)} value={item[name] ?? ''} onChange={(next) => update({ [name]: next })} />)}</div>}
        />;
      })}
    </div>}
  </SiteContentForm>;
}
