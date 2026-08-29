import { ArrowRight, BookOpen, Clock3, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "@/components/common/Footer";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import PageMeta from "@/components/common/PageMeta";
import CourseTypeTabs from "@/components/course/CourseTypeTabs";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedV2Outlines, getV2Access, type V2Outline } from "@/db/v2-api";

export default function CourseV2CatalogPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [outlines, setOutlines] = useState<V2Outline[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/course-v2" } });
      return;
    }
    const userId = user.id;
    let cancelled = false;
    async function load() {
      try {
        const manager = profile?.role === "admin";
        const is2015Plus = profile?.access_level === "plus2015";
        const access = manager || is2015Plus ? null : await getV2Access(userId);
        const now = Date.now();
        const hasAccess = manager || !is2015Plus && Boolean(
          access?.status === "active" &&
          (!access.starts_at || new Date(access.starts_at).getTime() <= now) &&
          (!access.expires_at || new Date(access.expires_at).getTime() > now),
        );
        if (!hasAccess) {
          if (!cancelled) setDenied(true);
          return;
        }
        const result = await getPublishedV2Outlines();
        if (!cancelled) setOutlines(result);
      } catch (error) {
        console.error("V2 catalog load failed", error);
        if (!cancelled) setDenied(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [authLoading, navigate, profile?.role, user]);

  return (
    <>
      <PageMeta title="教学通识课 V2" description="教学通识课第二版：按 Module、Unit 和 Lesson 学习。" noIndex />
      <div className="min-h-screen bg-[#f4efe7]">
        <Header />
        <main className="pb-16 pt-20">
          <CourseTypeTabs />
          {authLoading || loading ? (
            <LoadingOverlay message="正在加载 V2 课程目录..." />
          ) : denied ? (
            <div className="mx-auto mt-12 max-w-lg px-4 text-center">
              <div className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-8">
                <LockKeyhole className="mx-auto h-10 w-10 text-ac" />
                <h1 className="mt-4 font-serif text-2xl font-ds-black text-tx">尚未开通 V2 课程</h1>
                <p className="mt-3 text-sm leading-6 text-txs">当前账号还没有有效的 V2 访问权限，请联系管理员开通。</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl px-4 pt-8">
              <section className="rounded-[30px] bg-[#173d39] px-6 py-9 text-white shadow-ds-lg sm:px-10">
                <p className="text-[10px] font-ds-black tracking-[.18em] text-[#efb393]">V2 LEARNING PATH</p>
                <h1 className="mt-3 font-serif text-3xl font-ds-black sm:text-5xl">教学通识课 V2</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">从挑战、学习目标和达标标准出发，在每节课中完成内容学习、知识卡收藏、前后测和真实任务。
                </p>
              </section>

              <div className="mt-7 space-y-6">
                {outlines.map((outline, moduleIndex) => (
                  <section key={outline.module.id} className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-5 shadow-ds-sm sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-acl text-xs font-ds-black text-ac">{moduleIndex + 1}</span>
                      <div><p className="text-[10px] font-ds-black tracking-[.14em] text-ac">MODULE</p><h2 className="font-serif text-2xl font-ds-black text-tx">{outline.module.title}</h2></div>
                    </div>
                    <div className="mt-5 space-y-5">
                      {outline.units.map((unit, unitIndex) => (
                        <div key={unit.id} className="rounded-2xl border border-bdl bg-bgs/35 p-4">
                          <p className="text-[10px] font-ds-black tracking-wide text-txs">UNIT {unitIndex + 1}</p>
                          <h3 className="mt-1 text-sm font-ds-bold text-tx">{unit.title}</h3>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {unit.lessons.map((lesson, lessonIndex) => (
                              <Link key={lesson.id} to={`/course-v2/lesson/${lesson.id}`} className="group flex min-h-[140px] flex-col rounded-2xl border border-bdl bg-white p-4 transition hover:-translate-y-0.5 hover:border-ac hover:shadow-ds-sm">
                                <div className="flex items-center gap-2 text-[10px] text-txs"><BookOpen className="h-3.5 w-3.5 text-ac" />LESSON {lessonIndex + 1}{lesson.duration_minutes != null && <span className="ml-auto inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{lesson.duration_minutes} 分钟</span>}</div>
                                <p className="mt-3 font-serif text-lg font-ds-black leading-6 text-tx">{lesson.title}</p>
                                {lesson.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-txs">{lesson.subtitle}</p>}
                                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-ds-bold text-ac">进入学习 <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                {outlines.length === 0 && <div className="rounded-3xl border border-dashed border-bdl bg-white/55 px-6 py-16 text-center"><BookOpen className="mx-auto h-9 w-9 text-ac/45" /><p className="mt-3 text-sm font-ds-bold text-tx">还没有已发布的 V2 单课</p><p className="mt-1 text-xs text-txs">管理员发布 Lesson 后会自动同步发布所属 Unit 和 Module。</p></div>}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}
