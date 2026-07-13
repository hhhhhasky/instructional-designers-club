import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bot, BookOpenCheck, Settings, Trophy, UserRoundSearch, Users } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import OperationsDashboardSection from "@/components/admin/OperationsDashboardSection";
import MemberOverviewSection from "@/components/admin/MemberOverviewSection";
import CourseRankingsSection from "@/components/admin/CourseRankingsSection";
import InactiveStudentsSection from "@/components/admin/InactiveStudentsSection";
import StudentLeaderboardSection from "@/components/admin/StudentLeaderboardSection";
import HaiDashboardSection from "@/components/admin/HaiDashboardSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <AdminPageShell
      title="数据看板"
      description="从增长信号到运营行动，一屏掌握俱乐部运行状态"
      currentPath="/admin"
      actions={
        <Button variant="outline" onClick={() => navigate("/admin/manage")}>
          <Settings className="w-4 h-4 mr-1" />
          进入数据维护
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-ds-xl border border-bd bg-white p-1.5 shadow-ds-xs md:grid-cols-3 xl:grid-cols-6">
          <DashboardTab value="overview" icon={BarChart3} label="运营总览" />
          <DashboardTab value="members" icon={Users} label="会员趋势" />
          <DashboardTab value="courses" icon={BookOpenCheck} label="课程表现" />
          <DashboardTab value="inactive" icon={UserRoundSearch} label="留存预警" />
          <DashboardTab value="leaderboard" icon={Trophy} label="学习榜单" />
          <DashboardTab value="hai" icon={Bot} label="HAI 运营" />
        </TabsList>

        <TabsContent value="overview">
          <OperationsDashboardSection onOpenDetail={setActiveTab} />
        </TabsContent>

        <TabsContent value="members">
          <MemberOverviewSection />
        </TabsContent>

        <TabsContent value="courses">
          <CourseRankingsSection />
        </TabsContent>

        <TabsContent value="inactive">
          <InactiveStudentsSection />
        </TabsContent>

        <TabsContent value="leaderboard">
          <StudentLeaderboardSection />
        </TabsContent>

        <TabsContent value="hai">
          <HaiDashboardSection />
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}

function DashboardTab({ value, icon: Icon, label }: { value: string; icon: typeof BarChart3; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 gap-1.5 rounded-ds-md text-ds-xs text-txs data-[state=active]:bg-[#173d39] data-[state=active]:text-white data-[state=active]:shadow-none"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </TabsTrigger>
  );
}
