import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
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
      description="只读运营数据、学习统计与排行榜"
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
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">会员总览</TabsTrigger>
          <TabsTrigger value="courses">课程排行</TabsTrigger>
          <TabsTrigger value="inactive">沉默学员</TabsTrigger>
          <TabsTrigger value="leaderboard">学员排行榜</TabsTrigger>
          <TabsTrigger value="hai">HAI 看板</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
