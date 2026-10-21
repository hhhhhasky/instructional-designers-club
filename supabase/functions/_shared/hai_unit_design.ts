// Shared by the browser and worker. Only stable catalog identifiers cross the API.
export type UnitScope = "within-unit" | "within-book" | "across-books";
export const UNIT_SCOPES = [
  { value: "within-unit", name: "单元内重构", description: "一本教材的一个完整单元，无需再选课题和框题。" },
  { value: "within-book", name: "教材内重构", description: "同一本教材的多个单元，可分别选择要重构的课。" },
  { value: "across-books", name: "跨教材重构", description: "添加多本教材，逐本选择单元和课题。" },
] as const;
export type UnitBookSelection = {
  collection_slug: string;
  units: Array<{
    unit_number: number;
    // Omitted means the entire unit; an empty array is invalid.
    lessons?: Array<{ lesson_number: number; frame_numbers?: number[] }>;
  }>;
};
export type UnitFile = { kind: "unit" | "lesson"; filename: string; title: string; markdown: string };
export type UnitLesson = { title: string; lesson_type: string; objectives: string; subtask: string; subquestion: string; connection: string; source_paths: string[] };

export function validateUnitSelection(scope: unknown, value: unknown): string {
  if (!UNIT_SCOPES.some((item) => item.value === scope)) return "请选择重构范围。";
  if (!Array.isArray(value) || !value.length) return "请添加教材并选择单元。";
  const books = value as UnitBookSelection[];
  if (books.some((book) => !book || typeof book.collection_slug !== "string" || !book.collection_slug.trim() || !Array.isArray(book.units) || !book.units.length)) return "请为每本教材选择至少一个单元。";
  if (new Set(books.map((book) => book.collection_slug)).size !== books.length) return "同一本教材请在一张卡片中选择，不能重复添加。";
  if (scope === "across-books" ? books.length < 2 : books.length !== 1) return scope === "across-books" ? "跨教材重构请至少选择两本教材。" : "当前重构范围只能选择一本教材。";
  for (const book of books) {
    if (new Set(book.units.map((unit) => unit?.unit_number)).size !== book.units.length) return "同一教材的单元不能重复。";
    for (const unit of book.units) {
      if (!unit || !positiveInt(unit.unit_number)) return "单元编号不正确，请重新选择。";
      if (unit.lessons !== undefined) {
        if (!Array.isArray(unit.lessons) || !unit.lessons.length) return "请为入选单元选择至少一课，或选择完整单元。";
        if (new Set(unit.lessons.map((lesson) => lesson?.lesson_number)).size !== unit.lessons.length) return "同一单元的课题不能重复。";
        for (const lesson of unit.lessons) {
          if (!lesson || !positiveInt(lesson.lesson_number)) return "课题编号不正确。";
          if (lesson.frame_numbers !== undefined && (!Array.isArray(lesson.frame_numbers) || !lesson.frame_numbers.length || lesson.frame_numbers.some((n) => !positiveInt(n)) || new Set(lesson.frame_numbers).size !== lesson.frame_numbers.length)) return "请选择完整课题或有效的框题。";
        }
      }
    }
  }
  if (scope === "within-unit" && (books[0].units.length !== 1 || books[0].units[0].lessons !== undefined)) return "单元内重构请选择一个完整单元。";
  if (scope === "within-book" && books[0].units.length < 2) return "教材内重构请至少选择两个单元。";
  return "";
}
function positiveInt(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

export const UNIT_SECTION_NAMES = ["单元主题", "单元内容分析", "学情分析", "单元目标设计", "单元问题设计", "学习评价设计", "单元课时规划"];
export const LESSON_SECTION_NAMES = ["教材分析", "学情分析", "学习目标设计", "学习评价设计", "学习活动设计", "板书设计", "作业设计", "教学反思与改进"];

export function validateUnitDocument(markdown: string, kind: "unit" | "lesson") {
  const sections = kind === "unit" ? UNIT_SECTION_NAMES : LESSON_SECTION_NAMES;
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  const missing = ["基本信息", ...sections].filter((name) => {
    const index = headings.findIndex((heading) => heading[1].includes(name));
    if (index < 0) return true;
    const start = headings[index].index! + headings[index][0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end).replace(/[#|\s:：—\-]/g, "");
    return body.length < 15 || /【填写】|【按需|同上/.test(body);
  });
  if (missing.length) throw new Error(`文档内容不完整：${missing.join("、")}。请重试。`);
}

export function parseUnitPlan(raw: string): { markdown: string; lessons: UnitLesson[] } {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const plan = JSON.parse(text);
  if (typeof plan.markdown !== "string" || !Array.isArray(plan.lessons) || !plan.lessons.length) throw new Error("整体设计缺少正文或课时安排，请重试。");
  validateUnitDocument(plan.markdown, "unit");
  for (const lesson of plan.lessons) {
    if (!lesson || ["title", "lesson_type", "objectives", "subtask", "subquestion", "connection"].some((key) => typeof lesson[key] !== "string" || !lesson[key].trim()) || !Array.isArray(lesson.source_paths) || !lesson.source_paths.length || lesson.source_paths.some((path: unknown) => typeof path !== "string" || !path.trim())) throw new Error("课时安排缺少课题、目标、任务、问题、衔接或教材来源。");
  }
  // Persist this manifest as the authoritative planning table and file order.
  const table = ["| 课时 | 课型 | 课题 | 课时目标 | 子任务 | 子问题 | 前后承接 | 教材位置 |", "| --- | --- | --- | --- | --- | --- | --- | --- |", ...plan.lessons.map((lesson: UnitLesson, index: number) => `| ${index + 1} | ${[lesson.lesson_type, lesson.title, lesson.objectives, lesson.subtask, lesson.subquestion, lesson.connection, lesson.source_paths.join("；")].map(tableCell).join(" | ")} |`)];
  const headings = [...plan.markdown.matchAll(/^##\s+(.+)$/gm)];
  const index = headings.findIndex((heading) => heading[1].includes("单元课时规划"));
  const start = headings[index].index! + headings[index][0].length;
  const end = headings[index + 1]?.index ?? plan.markdown.length;
  const markdown = `${plan.markdown.slice(0, start)}\n\n共 ${plan.lessons.length} 课时，以下每课时独立生成一份教案。\n\n${table.join("\n")}\n\n${plan.markdown.slice(end)}`;
  return { markdown, lessons: plan.lessons };
}
function tableCell(text: string) { return text.replace(/\|/g, "／").replace(/\n/g, " "); }

export function unitFile(kind: "unit" | "lesson", index: number, title: string, markdown: string): UnitFile {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 70);
  return { kind, title, markdown, filename: kind === "unit" ? "00_单元整体设计.md" : `${String(index).padStart(2, "0")}_第${String(index).padStart(2, "0")}课时_${safe}.md` };
}
