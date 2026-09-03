import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceDir = resolve(
  process.argv[2] || "/Users/apple/.shared-skills/sizheng-public-lesson-design",
);
const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = join(
  repoRoot,
  "supabase/seed-data/sizheng-public-lesson-design-work-skill.json",
);
const versionLabel = String(process.argv[3] || "v1.2.0").trim();

const referenceConfigs = [
  ["references/mode-selection.md", "三种模式判断表", "共同模式判断规则", "always", 10],
  ["references/carrier-selection.md", "中国特色教学载体选择", "共同载体选择与事实核验规则", "always", 20],
  ["references/output-template.md", "思政公开课统一输出模板", "九部分 Markdown 教案、五列教学流程与分学段评价量规", "always", 25],
  ["references/case-mode-v3.md", "案例式教学 V3", "案例式唯一主模板", "case", 30],
  ["references/task-mode-v3.md", "任务式教学 V3", "任务式唯一主模板", "task", 40],
  ["references/issue-mode-v3.md", "议题式教学 V3", "议题式唯一主模板", "issue", 50],
  ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60],
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePublicLessonProductName(value) {
  const productName = "公开课设计";
  return value.replaceAll(`思政${productName}`, productName);
}

const instructions = normalizePublicLessonProductName(
  readFileSync(join(sourceDir, "SKILL.md"), "utf8").trim(),
);
const references = referenceConfigs.map(([path, name, description, loadMode, sortOrder]) => {
  const content = normalizePublicLessonProductName(readFileSync(join(sourceDir, path), "utf8").trim());
  return {
    path,
    name,
    description,
    media_type: path.endsWith(".yaml") ? "application/yaml" : "text/markdown",
    content,
    content_hash: sha256(content),
    load_mode: loadMode,
    max_chars: Math.min(Math.max([...content].length, 1), 50000),
    sort_order: sortOrder,
    metadata: {
      source_package: "sizheng-public-lesson-design",
      runtime_role: loadMode === "always" ? "common" : loadMode,
    },
  };
});

const snapshotMaterial = JSON.stringify({
  instructions,
  references: references.map(({ path, content_hash, load_mode, max_chars, sort_order }) => ({
    path,
    content_hash,
    load_mode,
    max_chars,
    sort_order,
  })),
});

const payload = {
  skill_slug: "politics-public-lesson",
  source_skill_name: "sizheng-public-lesson-design",
  version_label: versionLabel,
  snapshot_hash: sha256(snapshotMaterial),
  instructions,
  input_contract: {
    format: "sizheng_public_lesson_input_v1",
    required: [
      "stage", "subject", "grade", "volume", "unit", "topic",
      "teaching_mode", "lesson_type",
    ],
    teaching_modes: ["案例式", "任务式", "议题式"],
  },
  output_contract: {
    format: "public_lesson_markdown_v2",
    required_sections: [
      "课程基本信息", "课标分析", "教材分析", "学情分析", "教学目标",
      "教学重难点", "教学流程", "教学评估", "板书设计",
    ],
    lesson_flow_required: [
      "设计意图", "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式", "过渡语",
    ],
    lesson_flow_table_columns: [
      "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式",
    ],
    rubric_columns: {
      primary: ["评价维度", "合格（1分）", "良好（2分）", "优秀（3分）"],
      secondary: ["评价维度", "新手（1分）", "入门（2分）", "熟练（3分）", "专家（4分）"],
    },
  },
  source_metadata: {
    source_package: "sizheng-public-lesson-design",
    source_kind: "local_shared_skill",
    source_file_count: 1 + references.length,
    runtime_reference_count: references.filter((item) => item.load_mode !== "evaluation_only").length,
    source_skill_hash: sha256(instructions),
  },
  references,
};

mkdirSync(resolve(outputPath, ".."), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`已生成思政 Work Skill 快照：1 个 SKILL.md + ${references.length} 个源文件`);
console.log(`snapshot_hash=${payload.snapshot_hash}`);
console.log(outputPath);
