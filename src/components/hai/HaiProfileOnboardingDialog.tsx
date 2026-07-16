import {
  BookOpen,
  Check,
  ChevronLeft,
  Clock3,
  GraduationCap,
  Loader2,
  MessageCircleMore,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface HaiProfileOnboardingMemory {
  category: "basic_info" | "challenge" | "teaching_preference";
  content: string;
}

const STAGES = ["幼儿园", "小学", "初中", "高中", "中职", "高校", "其他教育场景"] as const;

const GENERAL_SUBJECTS = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "地理",
  "政治 / 道法",
  "历史",
  "科学",
  "信息科技",
  "心理健康",
  "音乐",
  "美术",
  "体育",
  "综合实践",
  "其他 / 专业课",
] as const;

const KINDERGARTEN_SUBJECTS = [
  "语言",
  "健康",
  "社会",
  "科学",
  "艺术",
  "综合主题活动",
  "其他 / 专业课",
] as const;

const EXPERIENCES = ["1 年以内", "1—3 年", "4—7 年", "8—15 年", "16 年以上"] as const;

const ROLES = [
  "一线任课教师",
  "班主任",
  "备课组长 / 教研组长",
  "学校管理者",
  "师范生 / 新入职教师",
  "教师培训 / 教研人员",
] as const;

const CHALLENGES = [
  "教学目标与重难点",
  "课堂活动与参与度",
  "学情差异与分层",
  "评价与学习证据",
  "公开课 / 赛课",
  "班级管理",
  "AI 辅助备课",
  "教师成长与反思",
] as const;

const SUPPORT_STYLES = [
  "先直接指出最核心的问题",
  "和我一起追问、梳理思路",
  "给我清晰的下一步行动",
  "帮我审阅和改进已有方案",
] as const;

const TOTAL_STEPS = 6;

export default function HaiProfileOnboardingDialog({
  open,
  saving,
  error,
  onSubmit,
  onSkip,
}: {
  open: boolean;
  saving: boolean;
  error?: string;
  onSubmit: (memories: HaiProfileOnboardingMemory[]) => void | Promise<void>;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [otherSubject, setOtherSubject] = useState("");
  const [experience, setExperience] = useState("");
  const [role, setRole] = useState("");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [supportStyle, setSupportStyle] = useState("");

  const subjectOptions = stage === "幼儿园" ? KINDERGARTEN_SUBJECTS : GENERAL_SUBJECTS;
  const requiresOtherSubject = subjects.includes("其他 / 专业课");
  const canContinueSubjects = subjects.length > 0 && (!requiresOtherSubject || Boolean(otherSubject.trim()));
  const canContinueChallenges = challenges.length > 0;

  const memories = useMemo<HaiProfileOnboardingMemory[]>(() => {
    const subjectLabels = subjects.map((subject) => (
      subject === "其他 / 专业课" ? otherSubject.trim() : subject
    )).filter(Boolean);

    return [
      { category: "basic_info", content: `我目前主要在${stage}任教。` },
      { category: "basic_info", content: `我主要教授${subjectLabels.join("、")}。` },
      { category: "basic_info", content: `我的教龄是${experience}。` },
      { category: "basic_info", content: `我目前的主要角色是${role}。` },
      { category: "challenge", content: `我目前最常遇到的教学问题是${challenges.join("、")}。` },
      { category: "teaching_preference", content: `我更希望 HAI ${supportStyle}。` },
    ];
  }, [challenges, experience, otherSubject, role, stage, subjects, supportStyle]);

  function toggleSubject(subject: string) {
    setSubjects((current) => (
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    ));
  }

  function toggleChallenge(challenge: string) {
    setChallenges((current) => {
      if (current.includes(challenge)) return current.filter((item) => item !== challenge);
      if (current.length >= 3) return current;
      return [...current, challenge];
    });
  }

  function selectStage(value: string) {
    if (value !== stage) {
      setSubjects([]);
      setOtherSubject("");
    }
    setStage(value);
    setStep(1);
  }

  function selectAndContinue(setter: (value: string) => void, value: string) {
    setter(value);
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-1rem)] max-w-2xl gap-0 overflow-hidden rounded-[28px] border border-[#e4d8ca] bg-[#fffdf8] p-0 shadow-[0_28px_90px_rgba(83,57,40,0.28)] sm:max-h-[calc(100dvh-2rem)]"
        data-testid="hai-profile-onboarding"
      >
        <div className="relative overflow-hidden border-b border-[#eadfD2] bg-[#f7ede5] px-5 pb-5 pt-6 sm:px-8 sm:pb-6">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-ac/10" />
          <div className="absolute -bottom-20 right-20 h-32 w-32 rounded-full border-[18px] border-white/50" />
          <DialogHeader className="relative text-left">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-ds-pill border border-ac/15 bg-white/75 px-3 py-1.5 text-ds-xs font-ds-semibold text-ac shadow-ds-xs backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                第一次见面
              </div>
              <span className="text-ds-xs font-ds-semibold text-[#8f796a]">
                {step + 1} / {TOTAL_STEPS}
              </span>
            </div>
            <DialogTitle className="font-ds-black text-[1.65rem] leading-tight text-tx sm:text-[2rem]">
              先让我认识你
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xl text-ds-sm leading-relaxed text-[#756457] sm:text-ds-base">
              只需点击几次，HAI 会把这些信息作为你的长期记忆，在之后的教学咨询中理解你的真实处境。
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-5 grid grid-cols-6 gap-1.5" aria-label={`问卷进度 ${step + 1}/${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-ds-pill transition-colors",
                  index <= step ? "bg-ac" : "bg-white/80",
                )}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7">
          {step === 0 && (
            <QuestionSection
              icon={<GraduationCap className="h-5 w-5" />}
              eyebrow="教学阶段"
              title="你主要在哪个学段教学？"
              description="选择最常工作的学段即可。"
            >
              <ChoiceGrid>
                {STAGES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={stage === option}
                    onClick={() => selectStage(option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </ChoiceGrid>
            </QuestionSection>
          )}

          {step === 1 && (
            <QuestionSection
              icon={<BookOpen className="h-5 w-5" />}
              eyebrow="学科"
              title={stage === "幼儿园" ? "你主要负责哪些学习领域？" : "你主要教授哪些学科？"}
              description="可以多选；高校或专业课教师可选择“其他 / 专业课”。"
            >
              <ChoiceGrid>
                {subjectOptions.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={subjects.includes(option)}
                    onClick={() => toggleSubject(option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </ChoiceGrid>
              {requiresOtherSubject && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-ds-sm font-ds-semibold text-tx">填写专业课或其他学科</span>
                  <input
                    autoFocus
                    value={otherSubject}
                    onChange={(event) => setOtherSubject(event.target.value)}
                    placeholder="例如：课程与教学论、机械设计"
                    className="h-12 w-full rounded-ds-md border border-bd bg-white px-4 text-[16px] text-tx outline-none transition focus:border-ac focus:ring-2 focus:ring-ac/15"
                  />
                </label>
              )}
            </QuestionSection>
          )}

          {step === 2 && (
            <QuestionSection
              icon={<Clock3 className="h-5 w-5" />}
              eyebrow="教学经验"
              title="你的教龄大约多久？"
              description="这会帮助 HAI 调整解释深度和建议颗粒度。"
            >
              <ChoiceGrid>
                {EXPERIENCES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={experience === option}
                    onClick={() => selectAndContinue(setExperience, option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </ChoiceGrid>
            </QuestionSection>
          )}

          {step === 3 && (
            <QuestionSection
              icon={<Users className="h-5 w-5" />}
              eyebrow="当前角色"
              title="你现在最主要的工作角色是？"
              description="如果身兼多职，选择最希望 HAI 优先理解的角色。"
            >
              <ChoiceGrid>
                {ROLES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={role === option}
                    onClick={() => selectAndContinue(setRole, option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </ChoiceGrid>
            </QuestionSection>
          )}

          {step === 4 && (
            <QuestionSection
              icon={<Target className="h-5 w-5" />}
              eyebrow="常见难题"
              title="你最常遇到哪些教学难题？"
              description={`最多选择 3 项，已选择 ${challenges.length} 项。`}
            >
              <ChoiceGrid>
                {CHALLENGES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={challenges.includes(option)}
                    disabled={!challenges.includes(option) && challenges.length >= 3}
                    onClick={() => toggleChallenge(option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </ChoiceGrid>
            </QuestionSection>
          )}

          {step === 5 && (
            <QuestionSection
              icon={<MessageCircleMore className="h-5 w-5" />}
              eyebrow="支持方式"
              title="你更希望 HAI 怎样帮助你？"
              description="选择一种默认方式；你随时可以在对话中提出不同要求。"
            >
              <div className="grid gap-2.5">
                {SUPPORT_STYLES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={supportStyle === option}
                    onClick={() => setSupportStyle(option)}
                    wide
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </div>
              {supportStyle && (
                <div className="mt-5 rounded-ds-lg border border-ac/15 bg-acl/45 px-4 py-3 text-ds-sm leading-relaxed text-[#704333]">
                  <span className="font-ds-bold">HAI 会记住：</span>
                  你在{stage}教授{subjects.map((subject) => (
                    subject === "其他 / 专业课" ? otherSubject.trim() : subject
                  )).filter(Boolean).join("、")}，并优先{supportStyle}。
                </div>
              )}
            </QuestionSection>
          )}

          {error && (
            <p className="mt-4 rounded-ds-md border border-red-200 bg-red-50 px-3 py-2 text-ds-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eadfd2] bg-white px-5 py-4 sm:px-8">
          <div>
            {step > 0 ? (
              <Button
                variant="ghost"
                className="text-txs hover:bg-bgs hover:text-tx"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={saving}
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            ) : (
              <button
                type="button"
                className="px-2 py-2 text-ds-sm text-txs transition hover:text-tx"
                onClick={onSkip}
              >
                稍后再填写
              </button>
            )}
          </div>

          {step === 1 && (
            <Button
              className="h-10 rounded-ds-pill bg-ac px-5 text-white hover:bg-acd"
              disabled={!canContinueSubjects}
              onClick={() => setStep(2)}
            >
              下一步
            </Button>
          )}
          {step === 4 && (
            <Button
              className="h-10 rounded-ds-pill bg-ac px-5 text-white hover:bg-acd"
              disabled={!canContinueChallenges}
              onClick={() => setStep(5)}
            >
              下一步
            </Button>
          )}
          {step === 5 && (
            <Button
              className="h-10 rounded-ds-pill bg-ac px-5 text-white shadow-accent hover:bg-acd"
              disabled={!supportStyle || saving}
              onClick={() => void onSubmit(memories)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "正在保存" : "完成，让 HAI 记住我"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionSection({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 duration-300">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-full bg-acl text-ac">
          {icon}
        </span>
        <div>
          <p className="text-ds-xs font-ds-bold tracking-[0.12em] text-ac">{eyebrow}</p>
          <h2 className="mt-1 text-ds-xl font-ds-black leading-tight text-tx sm:text-ds-2xl">{title}</h2>
          <p className="mt-2 text-ds-sm leading-relaxed text-txs">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</div>;
}

function ChoiceButton({
  selected,
  disabled = false,
  wide = false,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  wide?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative min-h-12 rounded-ds-md border px-3 py-2.5 text-left text-ds-sm font-ds-semibold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/25 disabled:cursor-not-allowed disabled:opacity-35",
        wide && "flex min-h-14 items-center pr-12",
        selected
          ? "border-ac bg-ac text-white shadow-accent"
          : "border-bd bg-white text-tx shadow-ds-xs hover:-translate-y-0.5 hover:border-ac/40 hover:bg-[#fffaf6] hover:shadow-ds-sm",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-ds-full border transition",
          selected ? "border-white/40 bg-white text-ac" : "border-bd bg-bgs text-transparent",
          wide && "top-1/2 -translate-y-1/2",
        )}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}
