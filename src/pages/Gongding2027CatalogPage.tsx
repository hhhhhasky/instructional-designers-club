import { useCourseLessonHref } from "@/components/routing/CoursePaths";
import { COURSE_PATH } from "@/lib/course-paths";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import Footer from "@/components/common/Footer";
import PageBackBar from "@/components/common/PageBackBar";
import PageMeta from "@/components/common/PageMeta";
import {
  CourseEditorialCatalogLayout,
  CourseEditorialHero,
  CourseEditorialVolume,
} from "@/components/course/CourseEditorialShell";
import CoursePurchaseButton from "@/components/course/CoursePurchaseButton";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseProductCatalog, type CourseProductCatalog } from "@/db/api";
import { canAccessCourse } from "@/lib/access-control";
import { GONGDING_2027_PURCHASE_PRODUCT, TEACHING_GENERAL_2025_NAME, TEACHING_GENERAL_PURCHASE_PRODUCT } from "@/lib/course-purchase";
import { GONGDING_2027_CODE, GONGDING_2027_NAME, GONGDING_2027_STATUS } from "@/lib/gongding-2027";

export default function Gongding2027CatalogPage() {
  const lessonHref = useCourseLessonHref();
  const { profile, courseAccessCodes, loading } = useAuth();
  const [catalog, setCatalog] = useState<CourseProductCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const product = GONGDING_2027_PURCHASE_PRODUCT;
  const isAdmin = profile?.role === "admin";
  const hasAccess = isAdmin || canAccessCourse(courseAccessCodes, GONGDING_2027_CODE);
  const hasOldAccess = isAdmin || canAccessCourse(courseAccessCodes, TEACHING_GENERAL_PURCHASE_PRODUCT.code);

  useEffect(() => {
    let active = true;
    getCourseProductCatalog(GONGDING_2027_CODE)
      .then((result) => { if (active) setCatalog(result); })
      .catch((error) => {
        if (!active) return;
        console.error("加载搞定公开课目录失败:", error);
        setFailed(true);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  const renderChapters = (idPrefix: string) => catalog?.categories.map((chapter, index) => {
    const lessons = catalog.coursesByCategory[chapter];
    return (
      <CourseEditorialVolume
        key={chapter}
        id={`${idPrefix}${index + 1}`}
        index={index}
        unit="章"
        title={chapter}
        count={lessons.length}
        icon={BookOpen}
      >
        <ol className="space-y-2">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link to={lessonHref(lesson.id)} className="course-editorial-entry group">
                <span className="course-editorial-index">{String(lesson.sort_order).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 font-semibold text-tx group-hover:text-ac">{lesson.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-txs" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </CourseEditorialVolume>
    );
  });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <PageMeta title={GONGDING_2027_NAME} description={product.description} canonicalPath={product.cataloguePath} />
      <PageBackBar to={COURSE_PATH} label="返回课程" />
      <main className="course-reading-desk flex-1 pb-12 pt-4">
        <CourseEditorialHero
          kicker="课程目录"
          badge="研发中"
          title={GONGDING_2027_NAME}
          description={`${GONGDING_2027_STATUS}。${product.description}`}
          icon={BookOpen}
          stats={[
            { label: "课程章节", value: catalog?.categories.length ?? "—" },
            { label: "目录课节", value: catalog?.courses.length ?? "—" },
          ]}
        >
          {!loading && <div className="flex flex-wrap items-center gap-4">
            {!hasAccess && <CoursePurchaseButton productCode={GONGDING_2027_CODE} />}
            {hasOldAccess && (
              <Link className="inline-flex min-h-11 items-center gap-1 rounded-ds-sm border border-bd px-4 text-sm font-semibold text-ac hover:border-ac" to={TEACHING_GENERAL_PURCHASE_PRODUCT.cataloguePath}>
                去看{TEACHING_GENERAL_2025_NAME}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>}
        </CourseEditorialHero>

        {failed ? (
          <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-txs" role="alert">
            <p>课程目录加载失败，请重试。</p>
            <button type="button" className="mt-3 min-h-11 rounded-ds-sm border border-bd px-4 font-semibold text-ac" onClick={() => {
              setFailed(false);
              setLoadAttempt((previous) => previous + 1);
            }}>重新加载</button>
          </div>
        ) : !catalog ? (
          <p className="py-12 text-center text-sm text-txs" role="status">正在加载课程目录…</p>
        ) : (
          <CourseEditorialCatalogLayout
            label="课程大纲"
            countLabel={`${catalog.categories.length} 章 · ${catalog.courses.length} 节`}
            toc={catalog.categories.map((chapter, index) => (
              <a key={chapter} href={`#chapter-${index + 1}`} className="course-editorial-toc-link">
                <span className="text-xs text-txt">第 {index + 1} 章</span>
                <span>{chapter}</span>
              </a>
            ))}
            mobile={<div className="space-y-4">{renderChapters("mobile-chapter-")}</div>}
            emptyState={catalog.courses.length === 0 ? (
              <p className="py-12 text-center text-sm text-txs" role="status">课程目录正在准备中。</p>
            ) : undefined}
          >
            {renderChapters("chapter-")}
          </CourseEditorialCatalogLayout>
        )}
      </main>
      <Footer />
    </div>
  );
}
