import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import CourseManagementSection from "@/components/admin/CourseManagementSection";
import StudentListSection from "@/components/admin/StudentListSection";
import ContentManagementSection from "@/components/admin/content/ContentManagementSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminManagePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("courses");

  return (
    <AdminPageShell
      title="数据维护"
      description="会修改后端数据并影响前台展示的管理表单"
      currentPath="/admin/manage"
      actions={
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <BarChart3 className="w-4 h-4 mr-1" />
          返回数据看板
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="courses">课程管理</TabsTrigger>
          <TabsTrigger value="students">学员管理</TabsTrigger>
          <TabsTrigger value="content">首页信息</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <CourseManagementSection />
        </TabsContent>

        <TabsContent value="students">
          <StudentListSection />
        </TabsContent>

        <TabsContent value="content">
          <ContentManagementSection />
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
