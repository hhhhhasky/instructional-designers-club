import { imagePromptValue, renderImagePrompt, type ImagePromptOverrides } from "./hai_image_prompt_catalog.ts";

export type PptCourse = {
  subject: string;
  grade: string;
  unit: string;
  topic: string;
  teacher: string;
};
export type PptPage = {
  id: string;
  title: string;
  text: string;
  image_description: string;
  layout: string;
  section: string;
  content_markdown?: string;
};
export type PptSettings = {
  canvas: string;
  course: PptCourse;
  navigation_label: string;
  typography: Record<
    "cover_title" | "title" | "body" | "caption",
    { font: string; weight: string; size: number }
  >;
  anchors: Record<"title" | "navigation" | "page_number" | "margins", string>;
  palette: Record<
    "primary" | "secondary" | "accent" | "background" | "text",
    { hex: string; use: string }
  >;
};
export const record = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? v as Record<string, any>
    : {};
export function extractPptTeachingFlow(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^\s*(#{1,6})\s+(.+)$/);
    if (
      heading &&
      /教学(?:流程|过程|实施过程|活动过程)|课堂教学过程/.test(heading[2])
    ) {
      start = i;
      level = heading[1].length;
      break;
    }
  }
  if (start < 0) {
    throw Error("教案中未识别到教学流程章节，请先为教学流程添加独立标题。");
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const heading = lines[i].match(/^\s*(#{1,6})\s+/);
    if (heading && heading[1].length <= level) {
      end = i;
      break;
    }
  }
  const flow = lines.slice(start + 1, end).join("\n").trim();
  if (!flow) throw Error("教案的教学流程章节为空，请补充后继续。");
  return flow;
}
export function pptStageInstructions(
  instructions: string,
  phase: "outline" | "settings",
): string {
  const section = phase === "outline" ? "文字大纲阶段" : "整套共用设定阶段";
  const reference = phase === "outline" ? "大纲输出" : "共用设定输出";
  const body = instructions.match(
    new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## [^#]|$)`),
  )?.[1] || "";
  const output = instructions.match(
    new RegExp(`# ${reference}\\n([\\s\\S]*?)(?=\\n# [^#]|$)`),
  )?.[1] || "";
  return [body.trim(), output.trim()].filter(Boolean).join("\n\n");
}
export function parsePptJson(raw: string) {
  return record(
    JSON.parse(
      raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
    ),
  );
}
function text(v: unknown, limit = 12000) {
  return typeof v === "string" ? v.trim().slice(0, limit) : "";
}
export function normalizePptCourse(v: unknown): PptCourse {
  const r = record(v);
  return {
    subject: text(r.subject, 80),
    grade: text(r.grade, 80),
    unit: text(r.unit, 200),
    topic: text(r.topic, 200),
    teacher: text(r.teacher, 80),
  };
}
export function normalizePptPages(v: unknown): PptPage[] {
  if (!Array.isArray(v) || !v.length || JSON.stringify(v).length > 240000) {
    throw Error("大纲为空或内容过长，请调整后重试。");
  }
  return v.map((input, index) => {
    const r = record(input);
    const title = text(r.title, 200);
    const body = text(r.text);
    const markdown = typeof r.content_markdown === "string"
      ? r.content_markdown.trim()
      : undefined;
    if (markdown !== undefined && markdown.length > 240000) {
      throw Error(`第${index + 1}页内容过长，请拆页后重试。`);
    }
    if (!title || (!body && markdown === undefined)) {
      throw Error(`第${index + 1}页需要标题和完整投屏文字。`);
    }
    return {
      id: `P${String(index + 1).padStart(2, "0")}`,
      title,
      text: body,
      image_description: text(r.image_description, 2000),
      layout: text(r.layout, 2000),
      section: text(r.section, 200),
      ...(markdown !== undefined ? { content_markdown: markdown } : {}),
    };
  });
}

/** Only page boundaries are structural. The complete page brief stays intact. */
export function parsePptMarkdown(input: unknown): PptPage[] {
  if (typeof input !== "string" || !input.trim() || input.length > 240000) {
    throw Error("请填写文字大纲，整篇不超过24万字。");
  }
  const pages: PptPage[] = [];
  let title: string | null = null;
  let lines: string[] = [];
  let fence: { char: string; length: number } | null = null;
  const finish = () => {
    if (title === null) return;
    if (!title.trim()) throw Error(`第${pages.length + 1}页缺少标题。`);
    pages.push({
      id: `P${String(pages.length + 1).padStart(2, "0")}`,
      title: title.trim(),
      text: "",
      image_description: "",
      layout: "",
      section: "",
      content_markdown: lines.join("\n").trim(),
    });
  };
  for (const line of input.replace(/\r\n?/g, "\n").split("\n")) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (
        marker[1][0] === fence.char && marker[1].length >= fence.length &&
        /^\s*(?:`+|~+)\s*$/.test(line)
      ) fence = null;
      if (title !== null) lines.push(line);
      continue;
    }
    const heading = !fence && line.match(
      /^\s{0,3}#{1,6}\s+第\s*\d+\s*页(?:\s*[｜|:：.、—-]\s*|\s+)?(.*?)\s*#*\s*$/,
    );
    if (heading) {
      finish();
      title = heading[1];
      lines = [];
    } else if (title !== null) lines.push(line);
  }
  finish();
  if (!pages.length) {
    throw Error("请用“## 第1页｜页面标题”标明分页，每页内容可以自由编写。");
  }
  return pages;
}

export function pptPageMarkdown(page: PptPage): string {
  if (page.content_markdown !== undefined) return page.content_markdown;
  return [
    page.text ? `### 投屏内容\n\n${page.text}` : "",
    page.image_description ? `### 配图建议\n\n${page.image_description}` : "",
    page.layout ? `### 排版参考\n\n${page.layout}` : "",
    page.section ? `> 所属教学环节：${page.section}` : "",
  ].filter(Boolean).join("\n\n");
}

export function pptPagesToMarkdown(pages: PptPage[]): string {
  return pages.map((page, index) =>
    `## 第${index + 1}页｜${page.title}\n\n${pptPageMarkdown(page)}`.trimEnd()
  ).join("\n\n---\n\n");
}
export function normalizePptSettings(
  v: unknown,
  course: PptCourse,
): PptSettings {
  const r = record(v);
  const typography = {} as PptSettings["typography"];
  const palette = {} as PptSettings["palette"];
  const anchors = {} as PptSettings["anchors"];
  for (const key of ["cover_title", "title", "body", "caption"] as const) {
    const entry = record(record(r.typography)[key]);
    const size = Number(entry.size);
    if (
      !text(entry.font, 100) || !Number.isFinite(size) || size < 12 ||
      size > 300
    ) throw Error("整套文字设定不完整，请重试。");
    typography[key] = {
      font: text(entry.font, 100),
      weight: text(entry.weight, 80) || "Regular",
      size,
    };
  }
  for (
    const key of [
      "primary",
      "secondary",
      "accent",
      "background",
      "text",
    ] as const
  ) {
    const entry = record(record(r.palette)[key]);
    const hex = text(entry.hex, 7);
    if (!/^#[\da-f]{6}$/i.test(hex) || !text(entry.use, 200)) {
      throw Error("整套配色需要六位HEX色号和用途，请重试。");
    }
    palette[key] = { hex: hex.toUpperCase(), use: text(entry.use, 200) };
  }
  for (
    const key of ["title", "navigation", "page_number", "margins"] as const
  ) {
    anchors[key] = text(record(r.anchors)[key], 300);
    if (!anchors[key]) throw Error("整套导航与标题位置设定不完整，请重试。");
  }
  return {
    canvas: "1920×1080视觉参照，实际输出16:9",
    course,
    typography,
    palette,
    anchors,
    navigation_label: text(r.navigation_label, 100) || course.topic,
  };
}
export function pptPagePrompt(
  page: PptPage,
  settings: PptSettings,
  index: number,
  total: number,
  overrides: ImagePromptOverrides = {},
) {
  const pageContent = page.content_markdown !== undefined
    ? renderImagePrompt("ppt.markdown_page", { content_markdown: page.content_markdown }, overrides)
    : renderImagePrompt("ppt.legacy_page", {
      text: page.text,
      image_description: page.image_description || imagePromptValue("ppt.default_image", overrides),
      layout: page.layout || imagePromptValue("ppt.default_layout", overrides),
      section: page.section,
    }, overrides);
  return renderImagePrompt("ppt.page", {
    page_number: index + 1, total, settings: JSON.stringify(settings), title: page.title,
    page_content: pageContent, navigation: settings.navigation_label,
  }, overrides);
}
