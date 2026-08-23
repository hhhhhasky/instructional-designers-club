import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, Bookmark, Check, Clock3, FileDown, Headphones, Image as ImageIcon, LockKeyhole, PlayCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { clearLearningDataCache } from "@/db/api";
import { getV2LessonBundle, saveV2Card, submitV2Attempt, createV2Attempt, saveV2Answers, upsertV2LearningRecord, type V2LessonBundle } from "@/db/v2-api";
import { buildV2AssessmentLayout, type V2AssessmentGroup } from "@/lib/v2-assessment-layout";

export default function CourseV2LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bundle, setBundle] = useState<V2LessonBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: `/course-v2/lesson/${lessonId ?? ""}` } });
      return;
    }
    if (!lessonId) {
      setError("缺少课程 ID");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getV2LessonBundle(lessonId, user.id)
      .then((data) => {
        if (!cancelled) {
          setBundle(data);
          if (!data) setError("课程不存在、尚未发布，或当前账号还没有 V2 权限");
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("课程加载失败，请确认账号权限后重试");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, lessonId, navigate, user]);

  const latestAttemptByBlock = useMemo(() => {
    const map = new Map<string, V2LessonBundle["attempts"][number]>();
    bundle?.attempts.forEach((attempt) => {
      const current = map.get(attempt.assessment_block_id);
      if (!current || attempt.attempt_no > current.attempt_no) map.set(attempt.assessment_block_id, attempt);
    });
    return map;
  }, [bundle]);

  async function markComplete() {
    if (!bundle || !user) return;
    setSaving(true);
    try {
      const record = await upsertV2LearningRecord(user.id, bundle.lesson.id, 100, true);
      setBundle((current) => current ? { ...current, learningRecord: record } : current);
      clearLearningDataCache(user.id);
      toast.success(bundle.lesson.credits > 0 ? `已完成，本课 ${bundle.lesson.credits} 学分已计入累计学分` : "已记录为完成");
    } catch (saveError) {
      console.error(saveError);
      toast.error("保存学习进度失败");
    } finally { setSaving(false); }
  }

  async function submitAssessment(blockId: string, items: V2LessonBundle["assessments"][number]["items"]) {
    if (!bundle || !user) return;
    const latest = latestAttemptByBlock.get(blockId);
    const attemptNo = (latest?.attempt_no ?? 0) + 1;
    setSaving(true);
    try {
      const attempt = await createV2Attempt(user.id, blockId, attemptNo);
      await saveV2Answers(attempt.id, items.map((item) => {
        const value = answerDrafts[item.id] ?? "";
        return {
          item_id: item.id,
          answer_text: Array.isArray(value) ? value.join(",") : value,
          answer_json: Array.isArray(value) ? value : null,
          attachment_data: [],
        };
      }));
      const submitted = await submitV2Attempt(attempt.id);
      setBundle((current) => current ? { ...current, attempts: [submitted, ...current.attempts] } : current);
      toast.success("任务已提交，等待批阅");
    } catch (saveError) {
      console.error(saveError);
      toast.error("提交失败，请检查答案后重试");
    } finally { setSaving(false); }
  }

  if (authLoading || loading) return <LoadingScreen />;
  if (error || !bundle) return <ErrorScreen message={error ?? "课程暂不可用"} />;

  const { lesson, unit, module, resources, cards, assessments, learningRecord } = bundle;
  const assessmentLayout = buildV2AssessmentLayout(assessments, bundle.dictionaryItems);
  const currentUserId = user?.id ?? "";
  return (
    <>
      <PageMeta title={`${lesson.title}｜V2课程`} description={lesson.description ?? lesson.subtitle ?? "教学通识课 V2"} noIndex />
      <Header />
      <main className="min-h-screen bg-[#f4efe7] px-4 pb-20 pt-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-txs">
            <Link to="/course-v2" className="inline-flex items-center gap-1 transition-colors hover:text-ac"><ArrowLeft className="h-3.5 w-3.5" />回到 V2 课程目录</Link>
            <span>/</span><span>{module.title}</span><span>/</span><span>{unit.title}</span>
          </div>

          <section className="overflow-hidden rounded-[28px] border border-[#173d39]/10 bg-[#173d39] px-6 py-8 text-white shadow-ds-lg sm:px-10 sm:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-ds-black tracking-[.18em] text-[#efb393]">V2 · {module.title}</p>
                <h1 className="mt-3 font-serif text-3xl font-ds-black leading-tight sm:text-5xl">{lesson.title}</h1>
                {lesson.subtitle && <p className="mt-3 text-sm leading-7 text-white/65">{lesson.subtitle}</p>}
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/60">
                  {lesson.duration_minutes != null && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />约 {lesson.duration_minutes} 分钟</span>}
                  <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5" />{lesson.credits ?? 0} 学分</span>
                  {lesson.is_trial && <span className="rounded-full bg-[#efb393]/15 px-2.5 py-1 text-[#efb393]">试看内容</span>}
                  <span className="rounded-full bg-white/10 px-2.5 py-1">独立学习记录</span>
                </div>
              </div>
              <div className="min-w-[170px] rounded-2xl border border-white/10 bg-white/[.07] p-4">
                <p className="text-[10px] tracking-[.14em] text-white/45">CURRENT PROGRESS</p>
                <p className="mt-2 font-serif text-4xl font-ds-black">{Math.round(learningRecord?.progress ?? 0)}<span className="ml-1 text-base text-white/45">%</span></p>
                <Button onClick={markComplete} disabled={saving || learningRecord?.status === "completed"} className="mt-3 w-full bg-[#efb393] text-[#173d39] hover:bg-[#f2c4a9]">
                  {learningRecord?.status === "completed" ? <><Check className="h-4 w-4" />已完成</> : "完成本课"}
                </Button>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <LessonDesign lesson={lesson} />
              <AssessmentGroups groups={assessmentLayout.beforeContent} bundle={bundle} latestAttemptByBlock={latestAttemptByBlock} answerDrafts={answerDrafts} setAnswerDrafts={setAnswerDrafts} onSubmit={submitAssessment} saving={saving} />
              <section className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-6 shadow-ds-sm sm:p-8">
                <SectionHeading eyebrow="核心课程内容" title="把判断变成可以复用的动作" />
                {lesson.body_markdown ? <MarkdownRenderer content={lesson.body_markdown} /> : <p className="mt-5 text-sm text-txs">课程正文还在整理中。</p>}
                {resources.length > 0 && <ResourceList resources={resources} />}
              </section>
              <AssessmentGroups groups={assessmentLayout.afterContent} bundle={bundle} latestAttemptByBlock={latestAttemptByBlock} answerDrafts={answerDrafts} setAnswerDrafts={setAnswerDrafts} onSubmit={submitAssessment} saving={saving} />
              {cards.length > 0 && <KnowledgeCards cards={cards} savedCardIds={bundle.savedCardIds} userId={currentUserId} onSaved={(cardId, saved) => setBundle((current) => current ? { ...current, savedCardIds: saved ? [...current.savedCardIds, cardId] : current.savedCardIds.filter((id) => id !== cardId) } : current)} />}
              <AssessmentGroups groups={assessmentLayout.afterLearning} bundle={bundle} latestAttemptByBlock={latestAttemptByBlock} answerDrafts={answerDrafts} setAnswerDrafts={setAnswerDrafts} onSubmit={submitAssessment} saving={saving} />
            </div>
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-5 shadow-ds-sm">
                <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">LESSON MAP</p>
                <p className="mt-2 font-serif text-lg font-ds-black text-tx">{unit.title}</p>
                <p className="mt-1 text-xs leading-5 text-txs">本页状态只属于当前登录账号，课程正文与资源对所有有权限用户一致。</p>
                <Link to="/course-v2" className="mt-4 inline-flex text-xs font-ds-bold text-ac hover:underline">查看 V2 课程目录 →</Link>
              </div>
              <div className="rounded-3xl border border-[#173d39]/10 bg-[#fffaf2] p-5">
                <div className="flex items-center gap-2 text-ac"><LockKeyhole className="h-4 w-4" /><span className="text-xs font-ds-bold">V2 独立记录</span></div>
                <p className="mt-2 text-xs leading-5 text-txs">不会覆盖 V1 的课程进度、作答或收藏。</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function LessonDesign({ lesson }: { lesson: V2LessonBundle["lesson"] }) {
  const objectives = Array.isArray(lesson.objectives) ? lesson.objectives : [];
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-[#efb393]/35 bg-[#fffaf2] p-6 sm:p-7">
        <div className="flex items-center gap-2 text-[#bb704c]"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-ds-black tracking-[.16em]">TODAY'S CHALLENGE</span></div>
        <h2 className="mt-4 font-serif text-2xl font-ds-black text-tx">{lesson.challenge_title ?? "今天，你要带走一个可判断的问题"}</h2>
        {lesson.challenge_markdown && <div className="mt-3 text-sm leading-7 text-txs"><MarkdownRenderer content={lesson.challenge_markdown} /></div>}
      </div>
      <div className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-6 sm:p-7">
        <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">LEARNING OBJECTIVES</p>
        <h2 className="mt-3 font-serif text-2xl font-ds-black text-tx">学完之后，你应该能</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-txs">{objectives.length ? objectives.map((objective) => <li key={objective.id} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-ac" />{objective.text}</li>) : <li>目标正在补充中。</li>}</ul>
      </div>
      {(lesson.success_criteria_markdown || lesson.takeaway_markdown) && <div className="rounded-3xl border border-[#173d39]/10 bg-[#173d39] p-6 text-white md:col-span-2 sm:p-7"><p className="text-[10px] font-ds-black tracking-[.16em] text-[#efb393]">TAKEAWAY</p><div className="mt-3 grid gap-5 md:grid-cols-2"><div><h2 className="font-serif text-xl font-ds-black">达标标准</h2>{lesson.success_criteria_markdown && <MarkdownRenderer content={lesson.success_criteria_markdown} />}</div><div><h2 className="font-serif text-xl font-ds-black">核心带走内容</h2>{lesson.takeaway_markdown && <MarkdownRenderer content={lesson.takeaway_markdown} />}</div></div></div>}
    </section>
  );
}

function ResourceList({ resources }: { resources: V2LessonBundle["resources"] }) {
  return <div className="mt-8 border-t border-bdl pt-6"><p className="text-[10px] font-ds-black tracking-[.16em] text-ac">RESOURCES</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{resources.map((resource) => { const url = resource.external_url; const isVideo = resource.mime_type?.startsWith("video/"); const isAudio = resource.mime_type?.startsWith("audio/"); const Icon = isVideo ? PlayCircle : isAudio ? Headphones : resource.mime_type?.startsWith("image/") ? ImageIcon : FileDown; return <a key={resource.id} href={url ?? undefined} target={url ? "_blank" : undefined} rel="noreferrer" className={`group rounded-2xl border border-bdl bg-bgs/45 p-4 ${url ? "hover:border-ac" : "opacity-70"}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-ac" /><div className="min-w-0"><p className="truncate text-sm font-ds-bold text-tx">{resource.title ?? resource.file_name ?? "课程资源"}</p><p className="mt-1 text-xs text-txs">{resource.description ?? (resource.is_downloadable ? "可下载附件" : resource.storage_key ? "R2 资源，需由运行时生成播放地址" : "课程辅助资源")}</p></div></div></a>; })}</div></div>;
}

function KnowledgeCards({ cards, savedCardIds, userId, onSaved }: { cards: V2LessonBundle["cards"]; savedCardIds: string[]; userId: string; onSaved: (id: string, saved: boolean) => void }) {
  return <section className="rounded-3xl border border-[#efb393]/35 bg-[#fffaf2] p-6 sm:p-8"><SectionHeading eyebrow="KNOWLEDGE CARDS" title="带走这些" /><div className="mt-5 grid gap-4 md:grid-cols-2">{cards.map((card) => { const saved = savedCardIds.includes(card.id); return <article key={card.id} className="rounded-2xl border border-[#efb393]/30 bg-white/60 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-serif text-xl font-ds-black text-tx">{card.title}</h3><button type="button" aria-label={saved ? "取消收藏" : "收藏知识卡"} onClick={() => { void saveV2Card(userId, card.id, !saved).then(() => { onSaved(card.id, !saved); toast.success(!saved ? "知识卡已收藏" : "已取消收藏"); }).catch(() => toast.error("收藏失败")); }} className={saved ? "text-[#bb704c]" : "text-txs hover:text-ac"}><Bookmark className="h-5 w-5" fill={saved ? "currentColor" : "none"} /></button></div><div className="mt-3 text-sm leading-7 text-txs"><MarkdownRenderer content={card.content_markdown} /></div></article>; })}</div></section>;
}

function AssessmentGroups({ groups, bundle, latestAttemptByBlock, answerDrafts, setAnswerDrafts, onSubmit, saving }: { groups: V2AssessmentGroup[]; bundle: V2LessonBundle; latestAttemptByBlock: Map<string, V2LessonBundle["attempts"][number]>; answerDrafts: Record<string, string | string[]>; setAnswerDrafts: (value: Record<string, string | string[]>) => void; onSubmit: (blockId: string, items: V2LessonBundle["assessments"][number]["items"]) => void; saving: boolean }) {
  return groups.map((group) => (
    <V2AssessmentSection
      key={group.key}
      title={group.label}
      assessments={group.assessments}
      dictionaryItems={bundle.dictionaryItems}
      latestAttemptByBlock={latestAttemptByBlock}
      answers={bundle.answers}
      reviews={bundle.reviews}
      answerDrafts={answerDrafts}
      setAnswerDrafts={setAnswerDrafts}
      onSubmit={onSubmit}
      saving={saving}
    />
  ));
}

function V2AssessmentSection({ title, assessments, dictionaryItems, latestAttemptByBlock, answers, reviews, answerDrafts, setAnswerDrafts, onSubmit, saving }: { title: string; assessments: V2LessonBundle["assessments"]; dictionaryItems: V2LessonBundle["dictionaryItems"]; latestAttemptByBlock: Map<string, V2LessonBundle["attempts"][number]>; answers: V2LessonBundle["answers"]; reviews: V2LessonBundle["reviews"]; answerDrafts: Record<string, string | string[]>; setAnswerDrafts: (value: Record<string, string | string[]>) => void; onSubmit: (blockId: string, items: V2LessonBundle["assessments"][number]["items"]) => void; saving: boolean }) {
  const itemTypeKey = (itemTypeId: string | null) => dictionaryItems.find((item) => item.id === itemTypeId)?.key ?? "";
  return (
    <section className="rounded-3xl border border-[#173d39]/10 bg-white/75 p-6 sm:p-8">
      <SectionHeading eyebrow="CHECK & PRACTICE" title={title} />
      <div className="mt-5 space-y-6">
        {assessments.map((assessment) => {
          const latest = latestAttemptByBlock.get(assessment.id);
          const review = latest ? reviews.find((row) => row.attempt_id === latest.id && row.answer_id === null) : null;
          const locked = latest?.status === "submitted" || latest?.status === "reviewed";
          return (
            <div key={assessment.id} className="rounded-2xl border border-bdl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-serif text-xl font-ds-black text-tx">{assessment.title}</h3>{assessment.instructions_markdown && <div className="mt-2 text-sm leading-6 text-txs"><MarkdownRenderer content={assessment.instructions_markdown} /></div>}</div>
                {latest && <span className={`rounded-full px-2.5 py-1 text-[10px] font-ds-bold ${latest.status === "revision_required" ? "bg-[#fff0e8] text-[#bb704c]" : "bg-bgs text-ac"}`}>{latest.status === "submitted" ? "等待批阅" : latest.status === "reviewed" ? "已批阅" : latest.status === "revision_required" ? "要求修改" : "草稿"}</span>}
              </div>
              {review && <div className="mt-4 rounded-xl bg-[#fffaf2] p-4 text-sm text-txs"><p className="font-ds-bold text-tx">教师反馈{review.score != null ? ` · ${review.score} 分` : ""}</p>{review.feedback_markdown && <MarkdownRenderer content={review.feedback_markdown} />}</div>}
              <div className="mt-5 space-y-5">
                {assessment.items.map((item, index) => {
                  const previous = latest ? answers.find((answer) => answer.attempt_id === latest.id && answer.item_id === item.id) : null;
                  const typeKey = itemTypeKey(item.item_type_id);
                  const previousValue = typeKey === "multiple_choice" && Array.isArray(previous?.answer_json)
                    ? previous.answer_json.filter((value): value is string => typeof value === "string")
                    : previous?.answer_text ?? "";
                  const value = answerDrafts[item.id] ?? previousValue;
                  return (
                    <div key={item.id}>
                      <div className="text-sm font-ds-bold text-tx">{index + 1}. <MarkdownRenderer content={item.prompt_markdown} /></div>
                      {item.case_markdown && <div className="mt-2 rounded-xl bg-bgs/45 p-3 text-sm text-txs"><MarkdownRenderer content={item.case_markdown} /></div>}
                      {item.options.length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {item.options.map((option) => {
                            const checked = Array.isArray(value) ? value.includes(option.option_key) : value === option.option_key;
                            return (
                              <label key={option.id} className="flex items-center gap-2 rounded-xl border border-bdl px-3 py-2 text-sm text-txs">
                                <input
                                  type={typeKey === "multiple_choice" ? "checkbox" : "radio"}
                                  name={item.id}
                                  value={option.option_key}
                                  disabled={locked}
                                  checked={checked}
                                  onChange={() => {
                                    if (typeKey === "multiple_choice") {
                                      const current = Array.isArray(value) ? value : [];
                                      setAnswerDrafts({ ...answerDrafts, [item.id]: current.includes(option.option_key) ? current.filter((key) => key !== option.option_key) : [...current, option.option_key] });
                                    } else {
                                      setAnswerDrafts({ ...answerDrafts, [item.id]: option.option_key });
                                    }
                                  }}
                                />
                                {option.option_key}. {option.option_text}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea disabled={locked} value={Array.isArray(value) ? value.join(",") : value} onChange={(event) => setAnswerDrafts({ ...answerDrafts, [item.id]: event.target.value })} rows={typeKey === "open_task" ? 7 : 4} placeholder={typeKey === "open_task" ? "提交你的真实任务方案与判断依据" : "写下你的回答"} className="mt-3 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" />
                      )}
                    </div>
                  );
                })}
              </div>
              {!locked && <Button onClick={() => onSubmit(assessment.id, assessment.items)} disabled={saving} className="mt-5 bg-[#173d39] text-white hover:bg-[#24554e]"><Send className="h-4 w-4" />{latest?.status === "revision_required" ? "再次提交" : "保存并提交"}</Button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="text-[10px] font-ds-black tracking-[.16em] text-ac">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl font-ds-black text-tx sm:text-3xl">{title}</h2></div>; }

function LoadingScreen() { return <div className="min-h-screen bg-[#f4efe7]"><Header /><LoadingOverlay message="正在打开 V2 课程..." /></div>; }
function ErrorScreen({ message }: { message: string }) { return <><Header /><main className="flex min-h-screen items-center justify-center bg-[#f4efe7] px-4 pt-20"><div className="max-w-md rounded-3xl border border-[#173d39]/10 bg-white/75 p-8 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-ac" /><h1 className="mt-4 font-serif text-2xl font-ds-black text-tx">V2 课程暂不可用</h1><p className="mt-3 text-sm leading-6 text-txs">{message}</p><Link to="/learning" className="mt-6 inline-flex text-sm font-ds-bold text-ac hover:underline">回到学习主页</Link></div></main><Footer /></>; }
