import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import PageMeta from "@/components/common/PageMeta";
import { useCourseLessonHref } from "@/components/routing/CoursePaths";
import { getCoursesByMembershipAndCategory } from "@/db/api";
import { COURSE_SLUGS, courseCatalogPath, courseSlug } from "@/lib/course-paths";
import type { Course } from "@/types/types";

export default function FreeCourseCatalogPage() {
  const lessonHref = useCourseLessonHref();
  const [courses, setCourses] = useState<Course[]>();

  useEffect(() => {
    let active = true;
    getCoursesByMembershipAndCategory("free", "全部").then((result) => {
      if (active) setCourses(result.filter((course) => courseSlug(course) === COURSE_SLUGS.free));
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-5 py-10">
      <PageMeta title="免费体验课" description="浏览哈老师的免费体验课。" canonicalPath={courseCatalogPath(COURSE_SLUGS.free)} />
      <h1 className="text-3xl font-bold text-tx">免费体验课</h1>
      {!courses ? <LoadingOverlay message="正在加载课程..." /> : courses.length ? (
        <ul className="mt-6 divide-y divide-bd rounded-xl border border-bd bg-white">
          {courses.map((course) => (
            <li key={course.id}>
              <Link to={lessonHref(course.id)} className="block px-5 py-4 font-semibold text-tx hover:text-ac">{course.title}</Link>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-txs">暂无免费体验课。</p>}
    </section>
  );
}
