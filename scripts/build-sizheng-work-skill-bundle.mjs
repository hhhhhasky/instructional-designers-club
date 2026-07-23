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

const referenceConfigs = [
  ["references/mode-selection.md", "三种模式判断表", "共同模式判断规则", "always", 10],
  ["references/carrier-selection.md", "中国特色教学载体选择", "共同载体选择与事实核验规则", "always", 20],
  ["references/output-template.md", "思政公开课教案输出模板", "固定输出顺序、JSON 结构与教学流程字段", "always", 25],
  ["references/case-mode-v3.md", "案例式教学 V3", "案例式唯一主模板", "case", 30],
  ["references/task-mode-v3.md", "任务式教学 V3", "任务式唯一主模板", "task", 40],
  ["references/issue-mode-v3.md", "议题式教学 V3", "议题式唯一主模板", "issue", 50],
  ["agents/openai.yaml", "OpenAI Skill 界面配置", "源包界面元数据，不进入生成上下文", "evaluation_only", 60],
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const instructions = readFileSync(join(sourceDir, "SKILL.md"), "utf8").trim();
const references = referenceConfigs.map(([path, name, description, loadMode, sortOrder]) => {
  const content = readFileSync(join(sourceDir, path), "utf8").trim();
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
  version_label: "v1.1.0",
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
    format: "sizheng_public_lesson_v2",
    required: [
      "title", "basic_info", "textbook_analysis", "learner_analysis",
      "objectives", "key_points", "difficult_points", "lesson_flow",
      "board_design", "teaching_reflection",
    ],
    basic_info_required: [
      "subject", "stage", "grade", "textbook_edition", "unit", "lesson",
      "frame", "class_size", "duration", "lesson_type", "teaching_mode",
      "topic", "textbook_source_path", "mode_template_path",
    ],
    textbook_analysis_required: [
      "unit_analysis", "lesson_analysis", "curriculum_standard_analysis",
    ],
    lesson_flow_required: [
      "phase", "title", "minutes", "purpose", "materials",
      "key_question_or_task", "steps", "knowledge_landing", "transition",
    ],
    lesson_step_required: [
      "step", "teacher_behavior", "student_behavior", "expected_output", "evaluation",
    ],
    minimum_flow_items: 5,
    minimum_steps_per_flow: 2,
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
