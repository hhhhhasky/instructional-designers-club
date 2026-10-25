import type { WorkSkillCandidate, WorkSkillReference } from "./hai_work.ts";

export const PUBLIC_LESSON_SKILL = "subject-lesson-design-unified";
export type LessonPhase = "focus" | "mode" | "result";
export type LessonReferences = Partial<Record<LessonPhase, Array<Pick<WorkSkillReference, "path" | "content" | "max_chars">>>>;

export function publicLessonSubject(subject: string): string {
  if (subject.startsWith("高中数学")) return "mathematics";
  const subjects: Record<string, string> = {
    "语文": "chinese", "数学": "mathematics", "英语": "english", "历史": "history", "地理": "geography",
    "道德与法治": "sizheng", "思想政治": "sizheng", "政治 / 道法": "sizheng", "物理": "physics", "化学": "chemistry",
    "生物": "biology", "生物学": "biology", "科学": "science", "音乐": "music", "美术": "art", "体育": "physical-education",
    "体育与健康": "physical-education", "信息科技": "information-technology", "信息技术": "information-technology",
    "通用技术": "general-technology", "心理健康": "psychology", "综合实践": "integrated-practice", "劳动": "labor",
    "其他 / 专业课": "professional",
  };
  const key = subjects[subject];
  if (!key) throw new Error("该学科尚未配置公开课参考资料，请检查学科选择。");
  return key;
}

// Exact file selection, independent of fuzzy subject matching in legacy Skills.
export function publicLessonReferences(skill: WorkSkillCandidate, input: Record<string, unknown>, phase: LessonPhase) {
  const subject = publicLessonSubject(String(input.subject));
  const template = subject === "labor" ? "integrated-practice" : subject;
  const paths = phase === "focus"
    ? [`references/subjects/${subject}.md`, ...(subject === "sizheng" || subject === "labor" ? [] : [`references/boundaries/${subject}.md`])]
    : phase === "mode" ? ["references/teaching-models.md"] : [`references/templates/${template}.md`];
  const selected = paths.map(path => {
    const ref = skill.version.references?.find(ref => ref.path === path);
    if (!ref?.content.trim()) throw new Error(`公开课参考资料未加载：${path}`);
    return ref;
  });
  return selected;
}

export function appendLessonReferences(prompt: { system: string; user: string }, refs: LessonReferences, phase: LessonPhase) {
  const selected = refs[phase];
  if (!selected?.length) throw new Error(`公开课${phase}阶段的参考资料未加载。`);
  return { ...prompt, user: `${prompt.user}\n\n## 本阶段参考资料\n${selected.map(ref => `### ${ref.path}\n${ref.content.slice(0, ref.max_chars)}`).join("\n\n")}` };
}
