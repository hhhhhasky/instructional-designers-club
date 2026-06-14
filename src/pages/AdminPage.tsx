import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import PageMeta from '@/components/common/PageMeta';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import MemberOverviewSection from "@/components/admin/MemberOverviewSection";
import CourseRankingsSection from "@/components/admin/CourseRankingsSection";
import StudentListSection from "@/components/admin/StudentListSection";
import InactiveStudentsSection from "@/components/admin/InactiveStudentsSection";
import StudentLeaderboardSection from "@/components/admin/StudentLeaderboardSection";
import CourseManagementSection from "@/components/admin/CourseManagementSection";
import ContentManagementSection from "@/components/admin/content/ContentManagementSection";

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, profile, loading, session } = useAuth();
  const initialCheckDone = useRef(false);
  const [activeTab, setActiveTab] = useState("overview");

  // 认证守卫：等待 loading 结束
  useEffect(() => {
    if (loading && !initialCheckDone.current) return;
    if (!user) {
      navigate("/login", { state: { from: "/admin" } });
      return;
    }
    initialCheckDone.current = true;
  }, [user?.id, loading, navigate]);

  // 全屏加载
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  // 未登录兜底
  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center">
            <p className="text-txs mb-4">请先登录</p>
            <Button onClick={() => navigate("/login")}>前往登录</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Profile 未就绪
  if (!profile) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <p className="text-tx font-ds-semibold mb-2">
              账号已登录，用户资料暂未准备好
            </p>
            <p className="text-txs text-ds-sm mb-4">
              请稍后刷新；如果一直出现，请联系管理员。
            </p>
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 非管理员
  if (profile.role !== "admin") {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <ShieldCheck className="w-12 h-12 text-ac mx-auto mb-4" />
            <p className="text-tx font-ds-bold text-ds-xl mb-2">无访问权限</p>
            <p className="text-txs text-ds-sm mb-4">
              管理后台仅对管理员开放，当前账号无管理员权限。
            </p>
            <Button onClick={() => navigate("/")}>返回首页</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <PageMeta title="管理后台" description="" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto pt-4 md:pt-8 animate-fade-in">
          {/* 返回 + 标题 */}
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            返回首页
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-ds-full bg-pink-soft flex items-center justify-center shadow-ds-sm">
              <ShieldCheck className="w-5 h-5 text-ac" />
            </div>
            <div>
              <h1 className="text-ds-xl font-ds-black text-tx">管理后台</h1>
              <p className="text-ds-sm text-txs">
                运营数据统计与报表
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview">会员总览</TabsTrigger>
              <TabsTrigger value="courses">课程排行</TabsTrigger>
              <TabsTrigger value="course-manage">课程管理</TabsTrigger>
              <TabsTrigger value="content">内容运营</TabsTrigger>
              <TabsTrigger value="students">学员名单</TabsTrigger>
              <TabsTrigger value="inactive">沉默学员</TabsTrigger>
              <TabsTrigger value="leaderboard">学员排行榜</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <MemberOverviewSection />
            </TabsContent>

            <TabsContent value="courses">
              <CourseRankingsSection />
            </TabsContent>

            <TabsContent value="course-manage">
              <CourseManagementSection />
            </TabsContent>

            <TabsContent value="content">
              <ContentManagementSection />
            </TabsContent>

            <TabsContent value="students">
              <StudentListSection />
            </TabsContent>

            <TabsContent value="inactive">
              <InactiveStudentsSection />
            </TabsContent>

            <TabsContent value="leaderboard">
              <StudentLeaderboardSection />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
}
