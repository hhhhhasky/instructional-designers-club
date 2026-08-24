import { useEffect, useState } from "react";
import { BarChart3, Bot, BookOpenCheck, Radio, Trophy, UserRoundSearch, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import AdminPageShell from "@/components/admin/AdminPageShell";
import OperationsDashboardSection from "@/components/admin/OperationsDashboardSection";
import MemberOverviewSection from "@/components/admin/MemberOverviewSection";
import CourseRankingsSection from "@/components/admin/CourseRankingsSection";
import InactiveStudentsSection from "@/components/admin/InactiveStudentsSection";
import StudentLeaderboardSection from "@/components/admin/StudentLeaderboardSection";
import HaiDashboardSection from "@/components/admin/HaiDashboardSection";
import LiveDashboardSection from "@/components/admin/LiveDashboardSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = DASHBOARD_TABS.includes(requestedTab ?? "") ? requestedTab as DashboardTab : "overview";
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  useEffect(() => {
    if (requestedTab && DASHBOARD_TABS.includes(requestedTab)) setActiveTab(requestedTab as DashboardTab);
  }, [requestedTab]);

  const changeTab = (value: string) => {
    const tab = value as DashboardTab;
    setActiveTab(tab);
    setSearchParams(tab === "overview" ? {} : { tab }, { replace: true });
  };

  return (
    <AdminPageShell
      title="数据看板"
      description="从增长信号到运营行动，一屏掌握俱乐部运行状态"
      currentPath="/admin"
      activeSection="dashboard"
    >
      <Tabs value={activeTab} onValueChange={changeTab} className="w-full">
        <div className="grid md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          <DashboardSidebar />
          <div className="min-w-0 pt-5 md:pl-5 md:pt-0">
            <TabsContent value="overview" className="mt-0"><OperationsDashboardSection onOpenDetail={setActiveTab} /></TabsContent>
            <TabsContent value="members" className="mt-0"><MemberOverviewSection /></TabsContent>
            <TabsContent value="courses" className="mt-0"><CourseRankingsSection /></TabsContent>
            <TabsContent value="inactive" className="mt-0"><InactiveStudentsSection /></TabsContent>
            <TabsContent value="leaderboard" className="mt-0"><StudentLeaderboardSection /></TabsContent>
            <TabsContent value="hai" className="mt-0"><HaiDashboardSection /></TabsContent>
            <TabsContent value="live" className="mt-0"><LiveDashboardSection /></TabsContent>
          </div>
        </div>
      </Tabs>
    </AdminPageShell>
  );
}

function DashboardSidebar() {
  return (
    <TabsList className="h-auto w-full flex-col items-stretch border-b border-bd bg-transparent pb-4 md:sticky md:top-24 md:border-b-0 md:border-r md:pr-5" aria-label="数据看板导航">
      <div className="px-3 pb-2 pt-2 text-[10px] font-ds-black tracking-[0.16em] text-txs">看板模块</div>
      <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
        <DashboardTab value="overview" icon={BarChart3} label="运营总览" />
        <DashboardTab value="members" icon={Users} label="会员趋势" />
        <DashboardTab value="courses" icon={BookOpenCheck} label="课程表现" />
        <DashboardTab value="inactive" icon={UserRoundSearch} label="留存预警" />
        <DashboardTab value="leaderboard" icon={Trophy} label="学习榜单" />
        <DashboardTab value="hai" icon={Bot} label="HAI 运营" />
        <DashboardTab value="live" icon={Radio} label="Live 互动" />
      </div>
    </TabsList>
  );
}

const DASHBOARD_TABS = ["overview", "members", "courses", "inactive", "leaderboard", "hai", "live"];
type DashboardTab = typeof DASHBOARD_TABS[number];

function DashboardTab({ value, icon: Icon, label }: { value: string; icon: typeof BarChart3; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 w-full justify-start gap-2 rounded-ds-md px-2 text-left text-ds-xs text-txs data-[state=active]:bg-[#173d39] data-[state=active]:text-white data-[state=active]:shadow-none sm:px-3"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </TabsTrigger>
  );
}
