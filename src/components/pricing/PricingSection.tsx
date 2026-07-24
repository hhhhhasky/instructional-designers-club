import { ArrowUpRight, BookOpenCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const APPLICATION_URL = "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb";

export default function PricingSection() {
  return (
    <section id="join" className="border-y border-bd bg-[var(--paper-deep)] px-4 py-12 md:py-16">
      <div className="editorial-paper mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.62fr)] md:p-10">
        <div>
          <span className="editorial-kicker">MEMBERSHIP NOTE · 会员说明</span>
          <h2
            className="mt-4 max-w-2xl text-2xl font-ds-black leading-tight text-tx md:text-4xl"
            style={{ fontFamily: "var(--fd)" }}
          >
            想继续系统学习，再看看会员方案
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-txs md:text-base">
            俱乐部面向愿意长期精进教学设计的老师。先从公开课程了解我们的教研方式，确认适合之后，再申请加入。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="editorial-note">
              <BookOpenCheck className="h-5 w-5 text-ac" aria-hidden="true" />
              <div>
                <p className="font-ds-bold text-tx">Plus · 教学通识课</p>
                <p className="mt-1 text-xs leading-5 text-txs">系统理解学习与课堂设计的底层逻辑。</p>
              </div>
            </div>
            <div className="editorial-note">
              <GraduationCap className="h-5 w-5 text-tl" aria-hidden="true" />
              <div>
                <p className="font-ds-bold text-tx">Pro · 教师 AI 课</p>
                <p className="mt-1 text-xs leading-5 text-txs">把教学判断转化为可复用的 AI 工作流。</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex flex-col justify-between border-t border-dashed border-bd pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <div>
            <span className="editorial-stamp">申请制</span>
            <p className="mt-4 text-sm leading-7 text-txs">
              报名表会说明当前开放方案、服务边界与加入方式，请以表单中的最新信息为准。
            </p>
          </div>
          <Button asChild size="lg" className="mt-8 w-full bg-ac text-white shadow-none hover:bg-acd">
            <a href={APPLICATION_URL} target="_blank" rel="noreferrer">
              查看会员申请
              <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </aside>
      </div>
    </section>
  );
}
