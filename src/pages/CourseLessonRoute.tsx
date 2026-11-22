import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { useCourseRoutes } from "@/components/routing/CoursePaths";
import RouteRedirect from "@/components/routing/RouteRedirect";
import { findCourseRoute } from "@/db/course-routes";
import { COURSE_PATH, courseLessonPath, courseSlug, type CourseRouteEntry } from "@/lib/course-paths";
import CourseDetailPage from "./CourseDetailPage";
import NotFoundPage from "./NotFoundPage";

export default function CourseLessonRoute() {
  const { id, lessonSlug } = useParams();
  const { pathname } = useLocation();
  const { byId, bySlug, loading } = useCourseRoutes();
  const indexed = id ? byId.get(id) : bySlug.get(lessonSlug ?? "");
  const key = id ? "id" : "route_slug";
  const value = id ?? lessonSlug ?? "";
  const [result, setResult] = useState<{ key: string; route: CourseRouteEntry | null; failed?: boolean }>();
  const requestKey = `${key}:${value}`;

  useEffect(() => {
    if (loading || indexed) return;
    let active = true;
    findCourseRoute(key, value).then((route) => {
      if (active) setResult({ key: requestKey, route });
    }).catch(() => {
      if (active) setResult({ key: requestKey, route: null, failed: true });
    });
    return () => { active = false; };
  }, [indexed, key, loading, requestKey, value]);

  const resolved = result?.key === requestKey ? result : undefined;
  const route = indexed ?? resolved?.route;
  if (route) {
    const path = courseLessonPath(courseSlug(route), route.route_slug);
    if (pathname !== path) return <RouteRedirect to={path} />;
    return <CourseDetailPage courseId={route.id} canonicalPath={path} />;
  }
  if (loading || !resolved) return <LoadingOverlay message="正在查找课节..." />;
  if (id && resolved.failed) return <CourseDetailPage courseId={id} />;
  if (resolved.failed) {
    return <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <p role="alert">暂时无法加载课节，请稍后重试。</p>
      <button type="button" className="mt-4 text-ac underline" onClick={() => window.location.reload()}>重新加载</button>
    </div>;
  }
  return <NotFoundPage backTo={COURSE_PATH} backLabel="返回课程总览" />;
}
