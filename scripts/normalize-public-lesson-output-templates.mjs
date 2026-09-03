import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const skillRoot = join(repoRoot, "supabase/skill-sources");

const subjects = {
  art: {
    dir: "art-public-lesson-design",
    title: "美术",
    textbook: "突出单元主题、作品或图像、视觉语言、材料技法、文化语境及创作/评述任务之间的关系。",
  },
  biology: {
    dir: "biology-public-lesson-design",
    title: "生物学",
    textbook: "突出单元大概念、生命现象、证据、模型、结构与功能及适用边界之间的关系。",
  },
  chemistry: {
    dir: "chemistry-public-lesson-design",
    title: "化学",
    textbook: "突出单元大概念、物质与变化、实验证据以及宏观—微观—符号表征之间的关系。",
  },
  chinese: {
    dir: "chinese-public-lesson-design",
    title: "语文",
    textbook: "突出单元主题、语文要素、文本结构、关键语言材料及真实语言文字运用任务之间的关系。",
  },
  english: {
    dir: "english-public-lesson-design",
    title: "英语",
    textbook: "突出单元主题与 Big Question、语篇 What—Why—How、语言功能、文化语境和最终交际成果之间的关系。",
  },
  "general-technology": {
    dir: "general-technology-public-lesson-design",
    title: "通用技术",
    textbook: "突出项目阶段、真实需求、约束、技术原理、图样/模型、试验标准和迭代任务之间的关系。",
  },
  geography: {
    dir: "geography-public-lesson-design",
    title: "地理",
    textbook: "突出单元与区域定位、时空尺度、地图/数据资料、地理事象、机制解释和人地权衡之间的关系。",
  },
  history: {
    dir: "history-public-lesson-design",
    title: "历史",
    textbook: "突出单元时空线索、关键史事、史料来源与互证、历史解释及其边界之间的关系。",
  },
  "information-technology": {
    dir: "information-technology-public-lesson-design",
    title: "信息科技",
    textbook: "突出单元逻辑、真实数字问题、数据/算法/系统原理、测试调试和数字成果之间的关系。",
  },
  "integrated-practice": {
    dir: "integrated-practice-public-lesson-design",
    title: "综合实践活动",
    textbook: "突出长周期项目位置、真实问题与对象、前序实践证据、本课方法和后续行动之间的关系。",
  },
  mathematics: {
    dir: "mathematics-public-lesson-design",
    title: "数学",
    textbook: "突出数学对象、概念/性质/法则/模型、表征联系、算理或论证过程以及变式迁移之间的关系。",
  },
  music: {
    dir: "music-public-lesson-design",
    title: "音乐",
    textbook: "突出单元主题、作品与真实音响、音乐要素、表现/创造任务和文化语境之间的关系。",
  },
  "physical-education": {
    dir: "physical-education-public-lesson-design",
    title: "体育与健康",
    textbook: "突出单元学练赛评结构、运动技能、真实情境、负荷与恢复、健康行为之间的关系。",
  },
  physics: {
    dir: "physics-public-lesson-design",
    title: "物理",
    textbook: "突出单元主线、物理现象、实验证据、物理模型、规律及适用条件之间的关系。",
  },
  professional: {
    dir: "professional-public-lesson-design",
    title: "其他 / 专业课",
    textbook: "突出办学层次、培养方案/课程标准、典型任务、专业知识与技能、实训条件及评价标准之间的关系。",
  },
  psychology: {
    dir: "psychology-public-lesson-design",
    title: "心理健康",
    textbook: "突出课程体系位置、心理发展主题、发展性知识边界、体验/技能练习和迁移情境之间的关系。",
  },
  science: {
    dir: "science-public-lesson-design",
    title: "科学",
    textbook: "突出单元大概念、研究对象/工程需求、现象与原始证据、解释/模型/作品及迁移之间的关系。",
  },
};

const unifiedOutputContract = {
  format: "public_lesson_markdown_v2",
  required_sections: [
    "课程基本信息",
    "课标分析",
    "教材分析",
    "学情分析",
    "教学目标",
    "教学重难点",
    "教学流程",
    "教学评估",
    "板书设计",
  ],
  lesson_flow_required: [
    "设计意图",
    "对应目标",
    "核心问题",
    "核心任务",
    "教师活动/教学活动",
    "评估方式",
    "过渡语",
  ],
  lesson_flow_table_columns: [
    "对应目标",
    "核心问题",
    "核心任务",
    "教师活动/教学活动",
    "评估方式",
  ],
  rubric_columns: {
    primary: ["评价维度", "合格（1分）", "良好（2分）", "优秀（3分）"],
    secondary: ["评价维度", "新手（1分）", "入门（2分）", "熟练（3分）", "专家（4分）"],
  },
};

function extractBoard(text, file) {
  const match = text.match(/^##\s+[^\n]*板书[^\n]*\n+([\s\S]*?)(?=^##\s+|\s*$)/m);
  if (!match?.[1]?.trim()) throw new Error(`无法从 ${file} 提取现有板书要求`);
  return match[1].trim();
}

function templateFor(subject, board) {
  return `# ${subject.title}公开课统一输出模板

只输出 Markdown 教案，不输出 JSON；只用以下九个二级标题。样例只参考学科方法和证据，不沿用旧章节。

## 一、课程基本信息

用一张简表呈现：

| 学科/学段/年级 | 教材版本/册次 | 单元/单课/框题 | 课时/时长 | 班级人数 | 课型/场景 | 教材来源与核验状态 |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

框题不适用时写“无”，人数未提供时如实标注。教具、器材、场地或软件只在学科确有需要时追加。

## 二、课标分析

义务教育区分 2022 年版，高中区分 2017 年版，其他学段使用已核验的适用标准。说明本课回应的核心素养及落实方式；有依据时可补充学段要求。仅当上下文提供可核验课标原文、可靠资料或联网核验结果时，才引用具体表述、条款或页码；否则只写“本次未获得可核验的现行课标依据，具体表述与核心素养映射待教师核验”。

## 三、教材分析

只分两层：**单元分析**说明主题/大概念、内容或任务结构、前序、本课位置与后续；**单课及框题分析**说明具体内容、知识关系、必经学科过程与教材材料/任务功能。

${subject.textbook}

## 四、学情分析

用简表分析：

| 认知 | 经验 | 情绪和态度 | 判断依据 |
|---|---|---|---|
| 已有知识、前概念、误解与卡点 | 相关生活、一手、操作或表达经验 | 兴趣、倾向、排斥、焦虑、畏难或安全感 | 真实班情证据；无证据时写“一般性预判” |

## 五、教学目标

只写 3—4 项并编号。句式：“学生通过【环节/活动】，能够【可观察认知动词＋具体学科内容】，达到【可测评标准】，形成或回应【经核验的核心素养】。”课标未核验时标注“核心素养映射待核验”。

## 六、教学重难点

| 类型 | 具体内容 | 确定依据 | 突破方式 |
|---|---|---|---|
| 教学重点 | 来自目标的核心增长 | 目标编号 |  |
| 教学难点 | 学生达成重点的主要障碍 | 学情证据 |  |

## 七、教学流程

设 5—6 环：导入 1 环、主体 3—4 环、总结/迁移/出口检测 1 环。每环标时，总时间等于课时。

### 环节N｜名称（X分钟）

**设计意图**：要激活的经验、暴露的误解或跨越的认知台阶。

| 对应目标 | 核心问题 | 核心任务 | 教师活动/教学活动 | 评估方式 |
|---|---|---|---|---|
| 目标编号 | 一个核心问题 | 学生行动、材料与可见产出 | 教师呈现、组织、讲解、追问、理答和关键反馈 | 工具、证据、判断标准与即时处理 |

**过渡语**：环节末用一两句教师语言衔接下一环；最后一环可省略。

必要的安全、伦理、版权、隐私或停止条件只在相关单元格写一次。

## 八、教学评估

用简表汇总目标、评估类型、任务/工具、证据与标准。过程性评估可用提问、观察、出口条、任务单或原始记录；表现性评估可用作品、展示、论证、设计、操作或迁移成果。不重复各环活动。

复杂任务才设量规，选 3—5 个目标相关维度。小学默认三档：

| 评价维度 | 合格（1分） | 良好（2分） | 优秀（3分） |
|---|---|---|---|
|  |  |  |  |

中学默认四档：

| 评价维度 | 新手（1分） | 入门（2分） | 熟练（3分） | 专家（4分） |
|---|---|---|---|---|
|  |  |  |  |  |

要点直接写在维度×档位交叉单元格，不设“要点描述”列。档名可按学科调整，小学保持三档、中学保持四档。

## 九、板书设计

${board}
`;
}

function updateSkillInstructions(file) {
  const source = readFileSync(file, "utf8");
  const marker = "## 输出要求";
  const index = source.lastIndexOf(marker);
  if (index < 0) throw new Error(`${file} 缺少输出要求章节`);
  const replacement = `${marker}\n\n严格使用 [输出模板](references/output-template.md) 的九个部分，直接输出 Markdown 教案，不输出 JSON，不使用代码围栏包裹全文。教学流程设置 5—6 个环节，每环只使用“设计意图＋五列表格＋过渡语”；五列依次为对应目标、核心问题、核心任务、教师活动/教学活动、评估方式。学科样例只参考方法、内容和证据，其旧章节结构不再适用。主 Skill、主流模式和来源边界中的教材事实、学科方法、安全、伦理、版权、隐私与证据限制继续有效，但不另设统一一级章节，只在实际需要处简洁呈现。\n`;
  writeFileSync(file, `${source.slice(0, index).trimEnd()}\n\n${replacement}`);
}

for (const subject of Object.values(subjects)) {
  const templateFile = join(skillRoot, subject.dir, "references/output-template.md");
  const oldTemplate = readFileSync(templateFile, "utf8");
  const board = extractBoard(oldTemplate, templateFile);
  writeFileSync(templateFile, `${templateFor(subject, board).trimEnd()}\n`);
  updateSkillInstructions(join(skillRoot, subject.dir, "SKILL.md"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const politicsSeedFile = join(repoRoot, "supabase/seed-data/sizheng-public-lesson-design-work-skill.json");
const politics = JSON.parse(readFileSync(politicsSeedFile, "utf8"));
const politicsTemplateRef = politics.references.find((item) => item.path === "references/output-template.md");
if (!politicsTemplateRef) throw new Error("思政 Skill 快照缺少 output-template.md");
const politicsBoard = `给出教师可直接使用的简洁板书文字布局和逻辑说明，呈现教材知识、贯穿载体/议题/任务、学生认识发展和最终价值判断之间的关系；不抄写整份教案。`;
politicsTemplateRef.name = "思政公开课统一输出模板";
politicsTemplateRef.description = "九部分 Markdown 教案、五列流程、分学段量规与思政板书要求";
politicsTemplateRef.content = templateFor({
  title: "思政",
  textbook: "突出单元主题与结构、单课/框题知识关系、教材活动、贯穿载体以及学生价值判断或行动任务之间的关系。",
}, politicsBoard).trim();
politicsTemplateRef.content_hash = sha256(politicsTemplateRef.content);
politicsTemplateRef.max_chars = [...politicsTemplateRef.content].length;

const politicsOutputSection = `## 第六步：生成完整教学设计

先完整阅读 [output-template.md](references/output-template.md)，只输出 Markdown 教案，不输出 JSON。严格使用课程基本信息、课标分析、教材分析、学情分析、教学目标、教学重难点、教学流程、教学评估、板书设计九个部分。

教学流程保留导入、3—4 个主体环节与总结/迁移；主体环节按唯一主导模式命名为案例、议题或任务。每环只使用“设计意图＋五列表格＋过渡语”，五列依次为对应目标、核心问题、核心任务、教师活动/教学活动和评估方式，过渡语放在环节末尾。不确定的课标、班情、教材或案例事实如实标注。`;
politics.instructions = politics.instructions.replace(
  /## 第六步：生成完整教学设计[\s\S]*?(?=\n## 质量边界)/,
  politicsOutputSection,
).replace(
  "输出中的 `textbook_source_path` 必须来自实际读取内容，不得根据表单字段自行拼接。",
  "课程基本信息中的教材来源必须来自实际读取内容，不得根据表单字段自行拼接。",
).replace(
  "3. 输出中的 `mode_template_path` 必须写实际加载路径；",
  "3. 运行时只采用实际加载的模式 reference；",
);
politics.version_label = "v1.3.0";
politics.output_contract = unifiedOutputContract;
politics.source_metadata.source_skill_hash = sha256(politics.instructions);
const snapshotMaterial = JSON.stringify({
  instructions: politics.instructions,
  references: politics.references.map(({ path, content_hash, load_mode, max_chars, sort_order }) => ({
    path,
    content_hash,
    load_mode,
    max_chars,
    sort_order,
  })),
});
politics.snapshot_hash = sha256(snapshotMaterial);
writeFileSync(politicsSeedFile, `${JSON.stringify(politics, null, 2)}\n`);

console.log(`已统一 ${Object.keys(subjects).length} 个仓库学科源包及思政快照的输出模板。`);
console.log(JSON.stringify(unifiedOutputContract));
