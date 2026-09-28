import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { FounderEditor } from './editors/SiteContentEditors';
import { AnnouncementsEditor, ActivitiesEditor, ResourcesEditor } from './editors/CollectionEditors';
import { HomeLandingEditor, LANDING_TABS } from './editors/HomeLandingEditors';
import type { HomeLandingKey } from '@/lib/home-landing-content';

type TabKey = HomeLandingKey | 'founder' | 'announcements' | 'activities' | 'resources';
const TABS: { key: TabKey; label: string }[] = [
  ...LANDING_TABS,
  { key: 'founder', label: '哈老师资料与头像' },
  { key: 'announcements', label: '课程更新/公告' },
  { key: 'activities', label: '活动/直播' },
  { key: 'resources', label: '资源文章' },
];

export default function ContentManagementSection() {
  const [tab, setTab] = useState<TabKey>('home_hero');
  return <div className="space-y-5">
    <div className="flex items-start gap-3 rounded-ds-lg bg-gradient-to-br from-ac/5 to-am/5 border border-bd p-4">
      <div className="w-9 h-9 rounded-ds-full bg-acl flex items-center justify-center flex-shrink-0"><LayoutDashboard className="w-5 h-5 text-ac" /></div>
      <div className="text-ds-sm text-txs leading-relaxed">
        <p className="font-ds-semibold text-tx mb-0.5">首页内容编辑</p>
        按浏览顺序逐段修改文案。每个区块单独保存到数据库，前台刷新即可显示。人物资料与头像在“哈老师资料与头像”中维护。
      </div>
    </div>
    <div className="flex flex-wrap gap-2 pb-3 border-b border-bd" aria-label="首页内容区块">
      {TABS.map((entry) => <button key={entry.key} type="button" onClick={() => setTab(entry.key)} className={`px-3 py-1.5 text-ds-sm rounded-ds-pill whitespace-nowrap transition-colors flex-shrink-0 ${tab === entry.key ? 'bg-ac text-white font-ds-semibold' : 'bg-warm text-txs hover:text-ac'}`}>{entry.label}</button>)}
    </div>
    {tab === 'founder' ? <FounderEditor /> : tab === 'announcements' ? <AnnouncementsEditor /> : tab === 'activities' ? <ActivitiesEditor /> : tab === 'resources' ? <ResourcesEditor /> : <HomeLandingEditor sectionKey={tab} />}
  </div>;
}
