export type CoursewareSkillReference = {
  id: string;
  path: string;
  name: string;
  description: string;
  media_type: string;
  content: string;
  load_mode:
    | "always"
    | "subject"
    | "lesson_genre"
    | "visual_mode"
    | "evaluation_only";
  match_criteria: Record<string, unknown>;
  max_chars: number;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export type CoursewareSkillCandidate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  match_criteria: Record<string, unknown>;
  priority: number;
  is_fallback: boolean;
  version: {
    id: string;
    version_label: string;
    instructions: string;
    input_contract: Record<string, unknown>;
    output_contract: Record<string, unknown>;
    source_metadata: Record<string, unknown>;
    references?: CoursewareSkillReference[];
  };
};

export type CoursewareSkillContext = {
  subject: string;
  subjectProfile: string;
  stage: string;
  lessonGenre: string;
  visualMode: "V1" | "V2" | "V3";
  outputMode: "ppt" | "interactive";
};

const SUBJECT_ALIASES: Array<[string, string[]]> = [
  ["chinese", ["语文", "中文", "汉语"]],
  ["mathematics", ["数学"]],
  ["english", ["英语", "外语", "日语", "俄语"]],
  ["science", ["科学", "小学科学"]],
  ["physics", ["物理"]],
  ["chemistry", ["化学"]],
  ["biology", ["生物", "生物学"]],
  ["history", ["历史"]],
  ["geography", ["地理"]],
  ["politics", ["道德与法治", "思想政治", "思政", "政治"]],
  ["information-technology", ["信息科技", "信息技术", "通用技术"]],
  ["art", ["艺术", "美术", "音乐", "舞蹈", "戏剧", "影视"]],
  ["physical-education", ["体育", "体育与健康"]],
  ["labor", ["劳动", "综合实践", "综合实践活动"]],
];

const GENRE_RULES: Array<[string, RegExp]> = [
  ["classical", /古诗|古文|文言|诗词|诵读/u],
  ["whole_book", /整本书|名著导读/u],
  ["writing", /写作|习作|作文|表达训练/u],
  ["oral", /口语交际|演讲|辩论/u],
  ["listening_speaking", /听说|听力|口语|对话/u],
  ["reading", /阅读|精读|略读|文学|语篇/u],
  ["grammar", /语法/u],
  ["theorem", /定理|证明|推导/u],
  ["statistics", /统计|概率|数据分析/u],
  ["modeling", /建模|模型应用/u],
  ["experiment", /实验|探究|观察|测量/u],
  ["exercise", /练习|复习|讲评|习题/u],
  ["project", /项目|综合实践|劳动任务|工程设计/u],
  ["concept", /概念|新授|规律|性质/u],
];

function values(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];
}

function matchesOne(criteria: unknown, candidates: string[]) {
  const expected = values(criteria);
  if (expected.length === 0) return true;
  const normalized = candidates.map((item) => item.trim().toLowerCase()).filter(
    Boolean,
  );
  return expected.some((item) => normalized.includes(item));
}

function matchesCriteria(
  criteria: Record<string, unknown>,
  context: CoursewareSkillContext,
) {
  return matchesOne(criteria.subjects, [
    context.subject,
    context.subjectProfile,
  ]) &&
    matchesOne(criteria.subject_profiles, [context.subjectProfile]) &&
    matchesOne(criteria.stages, [context.stage]) &&
    matchesOne(criteria.lesson_genres, [context.lessonGenre]) &&
    matchesOne(criteria.visual_modes, [context.visualMode]) &&
    matchesOne(criteria.output_modes, [context.outputMode]);
}

export function normalizeCoursewareSubjectProfile(subject: string) {
  const normalized = subject.trim().toLowerCase();
  for (const [profile, aliases] of SUBJECT_ALIASES) {
    if (
      profile === normalized ||
      aliases.some((alias) => normalized.includes(alias.toLowerCase()))
    ) return profile;
  }
  return "general";
}

export function inferCoursewareLessonGenre(
  markdown: string,
  declaredGenre = "",
) {
  const declared = declaredGenre.trim() ||
    extractCoursewareField(markdown, "课型/场景") ||
    extractCoursewareField(markdown, "课型") ||
    markdown.match(/课型(?:为|是)\s*([^，。；\n]+)/u)?.[1]?.trim() || "";
  if (declared) {
    for (const [genre, pattern] of GENRE_RULES) {
      if (pattern.test(declared)) return genre;
    }
    return declared.toLowerCase().replace(/\s+/g, "_");
  }
  const excerpt = markdown.slice(0, 12000);
  for (const [genre, pattern] of GENRE_RULES) {
    if (pattern.test(excerpt)) return genre;
  }
  return "general";
}

export function extractCoursewareField(markdown: string, field: string) {
  const clean = markdown.replace(/\*\*|__/g, "");
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = clean.match(
    new RegExp(
      `(?:^|[|\\n])\\s*(?:[-#]+\\s*)?${escaped}\\s*[|：:]\\s*([^|\\n]+)`,
      "u",
    ),
  );
  return match?.[1]?.replace(/`/g, "").trim() ?? "";
}

export function inferCoursewareSourceInfo(
  markdown: string,
  fallbackTitle: string,
) {
  const heading = markdown.match(/^#\s+(.+)$/mu)?.[1] ?? "";
  const subject = extractCoursewareField(markdown, "学科") ||
    SUBJECT_ALIASES.flatMap(([, aliases]) => aliases).sort((a, b) =>
      b.length - a.length
    ).find((alias) => heading.includes(alias)) || "";
  const grade = extractCoursewareField(markdown, "年级") ||
    extractCoursewareField(markdown, "学段") ||
    markdown.slice(0, 1200).match(
      /高[一二三]|[一二三四五六七八九]年级|高中|初中|小学/u,
    )?.[0] || "";
  return {
    subject,
    grade,
    topic: extractCoursewareField(markdown, "课题") ||
      heading.replace(/^.*?(?:教案|教学设计)[：:]\s*/u, "") || fallbackTitle,
    subjectProfile: normalizeCoursewareSubjectProfile(subject),
    lessonGenre: inferCoursewareLessonGenre(markdown),
  };
}

export function selectCoursewareSkill(
  candidates: CoursewareSkillCandidate[],
  context: CoursewareSkillContext,
) {
  const matched = candidates
    .filter((candidate) =>
      !candidate.is_fallback &&
      matchesCriteria(candidate.match_criteria ?? {}, context)
    )
    .sort((left, right) => right.priority - left.priority);
  if (matched[0]) return matched[0];
  return candidates
    .filter((candidate) => candidate.is_fallback)
    .sort((left, right) => right.priority - left.priority)[0] ?? null;
}

export function selectCoursewareSkillReferences(
  skill: CoursewareSkillCandidate,
  context: CoursewareSkillContext,
) {
  return [...(skill.version.references ?? [])]
    .filter((reference) => reference.load_mode !== "evaluation_only")
    .filter((reference) =>
      reference.load_mode === "always" ||
      matchesCriteria(reference.match_criteria ?? {}, context)
    )
    .sort((left, right) =>
      left.sort_order - right.sort_order || left.path.localeCompare(right.path)
    );
}

export function buildCoursewareSkillSystemPrompt(
  skill: CoursewareSkillCandidate,
  references: CoursewareSkillReference[],
  stage:
    | "material"
    | "content"
    | "design"
    | "interactive_design"
    | "image_prompt"
    | "deck" = "deck",
) {
  const sections = [
    `# Runtime Skill\n${skill.name} · ${skill.version.version_label}`,
    skill.version.instructions.trim(),
  ];
  let usedChars = sections.join("\n\n").length;
  const stageReferences = references.filter((reference) => {
    if (stage === "deck") return true;
    const path = reference.path;
    if (stage === "material") {
      return path.endsWith("material-supplement.md") ||
        path.endsWith("quality-rules.md") || path.includes("/subjects/");
    }
    if (stage === "interactive_design") {
      return path.endsWith("common-page-functions.md") ||
        path.endsWith("content-manuscript.md") ||
        path.endsWith("quality-rules.md") ||
        path.endsWith("visual-content.md") ||
        path.endsWith("frontend-slides-foundation.md") ||
        path.endsWith("interactive-learning-patterns.md") ||
        path.endsWith("html-runtime-contract.md") ||
        path.includes("/subjects/");
    }
    if (stage === "content" || stage === "image_prompt") {
      return path.endsWith("common-page-functions.md") ||
        path.endsWith("content-manuscript.md") ||
        path.endsWith("quality-rules.md") ||
        path.endsWith("visual-content.md") || path.includes("/subjects/");
    }
    return path.endsWith("deck-spec-contract.md") ||
      path.endsWith("layout-and-components.md") ||
      path.endsWith("quality-rules.md") ||
      path.endsWith("visual-content.md");
  });
  for (const reference of stageReferences) {
    const content = reference.content.trim().slice(
      0,
      Math.max(1, Math.min(reference.max_chars, 50000)),
    );
    const section = `# Reference: ${reference.path}\n${content}`;
    if (usedChars + section.length > 100000) break;
    sections.push(section);
    usedChars += section.length;
  }
  sections.push(
    stage === "material"
      ? "当前只识别并补齐教案缺失的投屏素材。严格按用户提示输出素材补全 JSON，不生成逐页内容稿、组件或布局。"
      : stage === "content"
      ? "当前只生成第一轮逐页 PPT 大纲。严格按用户提示输出 Markdown 页面块；只输出 pageId、pageFunction、教学阶段、标题/body、页级 imageDescription、来源映射和教师备注，不输出 function、layout、组件类型或 visualPrototype。"
      : stage === "design"
      ? "当前只生成第二轮组件与布局设计 JSON。根据 pageFunction 和 body 直接选择 layout，不生成 visualPrototype；允许重复引用同一 body 以拆分内容，必须使用 sourceMaterialRef，且不得改写逐页内容稿或 PPT 大纲，不输出思考过程、Markdown、代码围栏或解释。"
      : stage === "interactive_design"
      ? "当前只根据逐页教学大纲直接生成完整互动课件 HTML。只输出 HTML，不输出 JSON、PPT 组件、Layout、思考过程、Markdown、代码围栏或解释；CSS 与 JavaScript 只能内联，不引用外部资源、不发起网络请求、不访问宿主页面，并逐字保留大纲中的学生可见素材。"
      : stage === "image_prompt"
      ? "当前只将逐页大纲转换为纯图片PPT的逐页生图提示词 JSON。图片必须承载所有学生可见文字；逐字保留原文，不遗漏题干、条件、选项、步骤、数据和结论。"
      : "严格只输出最终 JSON，不输出思考过程、Markdown、代码围栏或解释。",
  );
  return sections.filter(Boolean).join("\n\n");
}

export function coursewareSkillSnapshot(
  skill: CoursewareSkillCandidate,
  references: CoursewareSkillReference[],
  context: CoursewareSkillContext,
) {
  return {
    slug: skill.slug,
    name: skill.name,
    version: skill.version.version_label,
    version_id: skill.version.id,
    subject_profile: context.subjectProfile,
    lesson_genre: context.lessonGenre,
    reference_paths: references.map((reference) => reference.path),
    source_metadata: skill.version.source_metadata ?? {},
  };
}
