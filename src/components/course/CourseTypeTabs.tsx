import { BookOpen, GraduationCap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

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
  const activePath = pathname === "/teacher-ai-courses" ? "/teacher-ai-courses" : "/courses";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <nav className="flex overflow-x-auto border-b border-bd" aria-label="课程类型导航">
        {COURSE_TABS.map(({ to, label, description, icon: Icon }) => {
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
