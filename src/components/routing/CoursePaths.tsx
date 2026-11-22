import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listCourseRoutes } from "@/db/course-routes";
import { courseLessonPath, courseSlug, legacyCourseLessonPath, type CourseRouteEntry } from "@/lib/course-paths";

const CoursePathsContext = createContext<{
  byId: ReadonlyMap<string, CourseRouteEntry>;
  bySlug: ReadonlyMap<string, CourseRouteEntry>;
  loading: boolean;
}>({ byId: new Map(), bySlug: new Map(), loading: false });

export function CoursePathsProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const scope = profile?.role === "admin" ? user?.id : null;
  const [index, setIndex] = useState<{ scope: typeof scope; entries: CourseRouteEntry[] }>();

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    listCourseRoutes().then((entries) => {
      if (active) setIndex({ scope, entries });
    }).catch(() => {
      if (active) setIndex({ scope, entries: [] });
    });
    return () => { active = false; };
  }, [authLoading, scope]);

  const value = useMemo(() => {
    const activeIndex = index?.scope === scope ? index : undefined;
    const entries = activeIndex?.entries ?? [];
    return {
      byId: new Map(entries.map((entry) => [entry.id, entry])),
      bySlug: new Map(entries.map((entry) => [entry.route_slug, entry])),
      loading: authLoading || !activeIndex,
    };
  }, [authLoading, index, scope]);

  return <CoursePathsContext.Provider value={value}>{children}</CoursePathsContext.Provider>;
}

export function useCourseRoutes() {
  return useContext(CoursePathsContext);
}

export function useCourseLessonHref() {
  const { byId } = useCourseRoutes();
  return useCallback((id: string) => {
    const route = byId.get(id);
    return route ? courseLessonPath(courseSlug(route), route.route_slug) : legacyCourseLessonPath(id);
  }, [byId]);
}
