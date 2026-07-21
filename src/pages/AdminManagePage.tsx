import {
  BarChart3,
  BookOpenCheck,
  Bot,
  CircleHelp,
  FileKey2,
  LayoutTemplate,
  type LucideIcon,
  RefreshCw,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminPageShell from "@/components/admin/AdminPageShell";
import CourseManagementSection from "@/components/admin/CourseManagementSection";
import CourseQuestionsManagementSection from "@/components/admin/CourseQuestionsManagementSection";
import ContentManagementSection from "@/components/admin/content/ContentManagementSection";
import HaiManagementSection from "@/components/admin/HaiManagementSection";
import PasswordResetSection from "@/components/admin/PasswordResetSection";
import StudentListSection from "@/components/admin/StudentListSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminMaintenanceSnapshot, type MaintenanceSnapshot } from "@/db/admin-operations";

const MANAGE_TABS = [
  { value: "courses", label: "课程与分类", short: "课程", description: "课程、分类、附件与上下架", icon: BookOpenCheck },
  { value: "students", label: "会员与权益", short: "会员", description: "等级、状态与奖励学分", icon: UserCog },
  { value: "questions", label: "课程问答", short: "问答", description: "问题、回复与内容审核", icon: CircleHelp },
  { value: "content", label: "内容运营", short: "内容", description: "首页、公告、活动与资源", icon: LayoutTemplate },
  { value: "hai", label: "HAI 配置", short: "HAI", description: "模型、提示词、额度与知识库", icon: Bot },
  { value: "reset", label: "服务工单", short: "工单", description: "密码重置与账号协助", icon: FileKey2 },
] as const;

type ManageTab = typeof MANAGE_TABS[number]["value"];

export default function AdminManagePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = MANAGE_TABS.some((item) => item.value === requestedTab) ? requestedTab as ManageTab : "courses";
  const [activeTab, setActiveTab] = useState<ManageTab>(initialTab);
  const [snapshot, setSnapshot] = useState<MaintenanceSnapshot | null>(null);

  useEffect(() => {
    if (requestedTab && MANAGE_TABS.some((item) => item.value === requestedTab)) {
      setActiveTab(requestedTab as ManageTab);
    }
  }, [requestedTab]);

  useEffect(() => {
    let cancelled = false;
    void getAdminMaintenanceSnapshot()
      .then((data) => { if (!cancelled) setSnapshot(data); })
      .catch((error) => console.error("getAdminMaintenanceSnapshot error:", error));
    return () => { cancelled = true; };
  }, []);

  const changeTab = (value: string) => {
    const tab = value as ManageTab;
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <AdminPageShell
      title="数据维护"
      description="所有会写入后端、影响会员体验的管理工作区"
      currentPath="/admin/manage"
      actions={
        <Button
          className="bg-[#de7856] text-white hover:bg-[#c96546] hover:text-white"
          onClick={() => navigate("/admin")}
        >
          <BarChart3 className="mr-1 h-4 w-4" />
          返回数据看板
        </Button>
      }
    >
      <MaintenancePulse snapshot={snapshot} onOpen={changeTab} />

      <Tabs value={activeTab} onValueChange={changeTab} className="mt-5 w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-ds-xl border border-bd bg-white p-1.5 shadow-ds-xs lg:grid-cols-6">
          {MANAGE_TABS.map((tab) => (
            <ManageTabTrigger key={tab.value} {...tab} />
          ))}
        </TabsList>

        <div className="mt-5 min-h-[420px] rounded-ds-xl border border-bd bg-white/55 p-3 shadow-ds-xs md:p-5">
          <WorkspaceIntro tab={MANAGE_TABS.find((item) => item.value === activeTab) ?? MANAGE_TABS[0]} />
          <TabsContent value="courses" className="mt-5"><CourseManagementSection /></TabsContent>
          <TabsContent value="students" className="mt-5"><StudentListSection /></TabsContent>
          <TabsContent value="questions" className="mt-5"><CourseQuestionsManagementSection /></TabsContent>
          <TabsContent value="content" className="mt-5"><ContentManagementSection /></TabsContent>
          <TabsContent value="hai" className="mt-5"><HaiManagementSection /></TabsContent>
          <TabsContent value="reset" className="mt-5"><PasswordResetSection /></TabsContent>
        </div>
      </Tabs>
    </AdminPageShell>
  );
}

function MaintenancePulse({ snapshot, onOpen }: { snapshot: MaintenanceSnapshot | null; onOpen: (tab: string) => void }) {
  const items = [
    { label: "发布课程", value: snapshot?.published_courses, note: `${snapshot?.draft_courses ?? "-"} 门草稿`, tab: "courses", tone: "text-tl bg-tll" },
    { label: "正常会员", value: snapshot?.active_members, note: `${snapshot?.banned_members ?? "-"} 个停用`, tab: "students", tone: "text-ac bg-acl" },
    { label: "公开问答", value: snapshot?.visible_questions, note: "含回复审核", tab: "questions", tone: "text-pp bg-ppl" },
    { label: "在架内容", value: snapshot?.active_content, note: "公告 · 活动 · 资源", tab: "content", tone: "text-am bg-aml" },
    { label: "HAI 告警", value: snapshot?.open_hai_alerts, note: "未处理运行告警", tab: "hai", tone: "text-tl bg-tll" },
    { label: "待办工单", value: snapshot?.pending_resets, note: "密码重置申请", tab: "reset", tone: "text-red-600 bg-red-50" },
  ];

  return (
    <section className="relative overflow-hidden rounded-ds-xl border border-[#244f48]/10 bg-[#244f48] px-4 py-5 text-white shadow-ds-lg md:px-6">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(226,167,92,.18),transparent_68%)]" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="xl:w-[245px] xl:shrink-0">
          <div className="flex items-center gap-2 text-[#efb393]"><RefreshCw className="h-4 w-4" /><span className="text-[10px] font-ds-black tracking-[.16em]">MAINTENANCE PULSE</span></div>
          <h2 className="mt-2 font-serif text-ds-xl font-ds-black">六个真实写入工作区</h2>
          <p className="mt-1 text-[11px] leading-5 text-white/55">每项修改都会同步到 Supabase，并按权限与业务规则校验。</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {items.map((item) => (
            <button key={item.tab} type="button" onClick={() => onOpen(item.tab)} className="group rounded-ds-lg border border-white/10 bg-white/[0.06] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/10">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-ds-bold ${item.tone}`}>{item.label}</span>
              <p className="mt-2 font-serif text-ds-2xl font-ds-black">{item.value ?? <span className="text-white/30">—</span>}</p>
              <p className="mt-0.5 truncate text-[10px] text-white/45">{item.note}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ManageTabTrigger({ value, label, short, icon: Icon }: { value: ManageTab; label: string; short: string; description: string; icon: LucideIcon }) {
  return (
    <TabsTrigger value={value} className="h-11 gap-1.5 rounded-ds-md px-2 text-ds-xs text-txs data-[state=active]:bg-[#173d39] data-[state=active]:text-white data-[state=active]:shadow-none">
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline lg:hidden xl:inline">{label}</span>
      <span className="sm:hidden lg:inline xl:hidden">{short}</span>
    </TabsTrigger>
  );
}

function WorkspaceIntro({ tab }: { tab: typeof MANAGE_TABS[number] }) {
  const Icon = tab.icon;
  return (
    <div className="flex items-start gap-3 border-b border-bdl pb-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ds-md bg-bgs text-ac"><Icon className="h-4 w-4" /></span>
      <div><p className="text-ds-md font-ds-black text-tx">{tab.label}</p><p className="mt-0.5 text-[11px] text-txs">{tab.description}</p></div>
    </div>
  );
}
