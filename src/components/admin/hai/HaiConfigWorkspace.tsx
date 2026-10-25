import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  BookOpen,
  BriefcaseBusiness,
  Image,
  Layers3,
  Settings2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const sections: Array<{ id: string; label: string; detail: string; icon: LucideIcon }> = [
  { id: "work", label: "Work 工具", detail: "Skill · 提示词 · 版本", icon: BriefcaseBusiness },
  { id: "chat", label: "对话", detail: "Skill · 绑定 · 版本", icon: Bot },
  { id: "images", label: "生图提示词", detail: "模板 · 风格 · 图片 PPT", icon: Image },
  { id: "courseware", label: "AI 课件", detail: "Skill · 学科参考 · 版本", icon: Layers3 },
  { id: "knowledge", label: "知识与方法", detail: "知识库 · 课程方法卡", icon: BookOpen },
  { id: "points", label: "积分与额度", detail: "套餐 · 发放 · 使用限制", icon: Wallet },
  { id: "models", label: "模型与运行", detail: "供应商 · 生成参数 · 运行设置", icon: Settings2 },
];
const WorkspaceContext = createContext("work");
export function HaiConfigWorkspace({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("work");
  return (
    <WorkspaceContext.Provider value={active}>
      <div className="space-y-6">
        <nav
          aria-label="HAI 配置分类"
          className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-bd pb-4 sm:grid-cols-3 xl:grid-cols-4"
        >
          {sections.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => setActive(id)}
              className={`flex items-start gap-2.5 border-l-2 px-3 py-3 text-left transition-colors ${active === id ? "border-ac bg-ac/5 text-ac" : "border-transparent text-txs hover:bg-bg hover:text-tx"}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-bold">{label}</span>
                <span className="mt-1 block text-xs text-txs">{detail}</span>
              </span>
            </button>
          ))}
        </nav>
        {children}
      </div>
    </WorkspaceContext.Provider>
  );
}
export function HaiConfigPage({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title: string;
  description: string;
  children: ReactNode;
  icon?: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
}) {
  const active = useContext(WorkspaceContext);
  const visited = useRef(false);
  if (active === section) visited.current = true;
  if (!visited.current) return null;
  return (
    <section hidden={active !== section} aria-label={title} className="min-w-0">
      {!["work", "chat", "courseware", "images"].includes(section) && (
        <header className="mb-4">
          <h2 className="text-base font-bold text-tx">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-txs">{description}</p>
        </header>
      )}
      {children}
    </section>
  );
}

export function SkillAdvancedSettings({
  children,
  label = "高级设置",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="group border-y border-bd py-3">
      <summary className="cursor-pointer text-xs font-bold text-txs hover:text-ac">{label}</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
export function skillVersionStatus(status: string) {
  return status === "published" ? "已发布" : status === "draft" ? "草稿" : "已归档";
}

export function confirmSkillNavigation(dirty: boolean) {
  return !dirty || window.confirm("当前内容尚未保存，切换后这些修改会丢失。确定继续吗？");
}

export function useWarnOnUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
