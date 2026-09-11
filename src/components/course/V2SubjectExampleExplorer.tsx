import { ArrowRight, BookOpenCheck, Check, Route, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { V2Resource } from "@/db/v2-api";
import { parseSubjectExamples } from "@/lib/v2-subject-explorer";

export default function V2SubjectExampleExplorer({ resource }: { resource: V2Resource }) {
  const subjects = useMemo(() => parseSubjectExamples(resource), [resource]);
  const [activeId, setActiveId] = useState(() => subjects[0]?.id ?? "");
  const active = subjects.find((subject) => subject.id === activeId) ?? subjects[0];

  if (!active) return null;

  return (
    <section className="rounded-3xl border border-[#173d39]/10 bg-white/80 p-6 shadow-ds-sm sm:p-8" aria-labelledby="subject-explorer-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">SUBJECT PATH EXPLORER</p>
          <h2 id="subject-explorer-title" className="mt-2 font-serif text-2xl font-ds-black text-tx sm:text-3xl">选择一个学科，看完整判断路径</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-txs">五个案例共享同一判断逻辑，但进入课标的目录路径不同。先看与你最接近的学科，再换一个陌生学科迁移。</p>
        </div>
        <span className="shrink-0 rounded-full bg-acl px-3 py-1.5 text-[10px] font-ds-black text-ac">{subjects.length} 条学科路径</span>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="学科示范选择">
        {subjects.map((subject) => {
          const selected = subject.id === active.id;
          return (
            <button
              key={subject.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`subject-panel-${subject.id}`}
              id={`subject-tab-${subject.id}`}
              onClick={() => setActiveId(subject.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-[#173d39] bg-[#173d39] text-white shadow-ds-sm" : "border-bdl bg-bgs/35 text-tx hover:border-ac hover:bg-white"}`}
            >
              <span className={`text-[9px] font-ds-black tracking-[.12em] ${selected ? "text-[#efb393]" : "text-ac"}`}>{subject.structure}</span>
              <span className="mt-1 block text-sm font-ds-black">{subject.label}</span>
            </button>
          );
        })}
      </div>

      <article id={`subject-panel-${active.id}`} role="tabpanel" aria-labelledby={`subject-tab-${active.id}`} className="mt-4 overflow-hidden rounded-[24px] border border-bdl bg-[#fffaf2]">
        <div className="border-b border-bdl px-5 py-5 sm:px-7">
          <p className="text-[10px] font-ds-black tracking-[.14em] text-[#bb704c]">案例对象</p>
          <h3 className="mt-1 font-serif text-xl font-ds-black text-tx sm:text-2xl">{active.example}</h3>
        </div>
        <div className="grid gap-px bg-bdl md:grid-cols-2">
          <ExampleCell icon={<Route className="h-4 w-4" />} title="目录路径" body={active.route} />
          <ExampleCell icon={<BookOpenCheck className="h-4 w-4" />} title="专家聚焦" body={active.focus} />
          <ExampleCell icon={<Check className="h-4 w-4" />} title="单元方向" body={active.direction} />
          <ExampleCell icon={<ArrowRight className="h-4 w-4" />} title="单课贡献" body={active.contribution} />
        </div>
        <div className="flex gap-3 bg-[#fff0e8] px-5 py-4 text-[#8d4f34] sm:px-7">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-5"><strong className="font-ds-black">没读透的信号：</strong>{active.pitfall}</p>
        </div>
      </article>
    </section>
  );
}

function ExampleCell({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white/80 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-ac">{icon}<p className="text-[10px] font-ds-black tracking-[.12em]">{title}</p></div>
      <p className="mt-3 text-sm leading-7 text-txs">{body}</p>
    </div>
  );
}
