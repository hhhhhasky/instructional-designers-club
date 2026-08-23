import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Library } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getV2Access } from "@/db/v2-api";

const COURSE_TABS = [
  {
    to: "/courses",
    label: "教学通识课",
    description: "教学设计与课堂实践",
    icon: BookOpen,
  },
  {
    to: "/teacher-ai-courses",
    label: "教师 AI 课",
    description: "AI 工具与教学协作",
    icon: GraduationCap,
  },
] as const;

export default function CourseTypeTabs() {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const [hasV2Access, setHasV2Access] = useState(profile?.role === "admin");
  const activePath = pathname.startsWith("/course-v2")
    ? "/course-v2"
    : pathname === "/teacher-ai-courses"
      ? "/teacher-ai-courses"
      : "/courses";

  useEffect(() => {
    if (!user) {
      setHasV2Access(false);
      return;
    }
    if (profile?.role === "admin") {
      setHasV2Access(true);
      return;
    }
    let cancelled = false;
    getV2Access(user.id)
      .then((access) => {
        const now = Date.now();
        const active = Boolean(
          access?.status === "active" &&
          (!access.starts_at || new Date(access.starts_at).getTime() <= now) &&
          (!access.expires_at || new Date(access.expires_at).getTime() > now),
        );
        if (!cancelled) setHasV2Access(active);
      })
      .catch(() => { if (!cancelled) setHasV2Access(false); });
    return () => { cancelled = true; };
  }, [profile?.role, user]);

  const tabs = hasV2Access
    ? [
        ...COURSE_TABS,
        {
          to: "/course-v2",
          label: "教学通识课 V2",
          description: "挑战、知识卡与评估",
          icon: Library,
        },
      ]
    : COURSE_TABS;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <nav className="flex overflow-x-auto border-b border-bd" aria-label="课程类型导航">
        {tabs.map(({ to, label, description, icon: Icon }) => {
          const active = to === activePath;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-[190px] items-center gap-3 border-r border-bd px-4 py-3 transition-colors first:border-l ${active ? "bg-bgs text-ac" : "text-txs hover:bg-bgs/70 hover:text-ac"}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ds-sm ${active ? "bg-acl" : "bg-bgs"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-ds-bold">{label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-txs">{description}</span>
              </span>
              {active && <span className="absolute inset-x-0 bottom-0 h-1 bg-ac" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
