import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { SpreadsheetFile, Workbook } = require("@oai/artifact-tool");

const outputPath = process.env.V2_TEMPLATE_OUTPUT ?? fileURLToPath(new URL("../public/templates/v2-course-import-template.xlsx", import.meta.url));
const workbook = Workbook.create();
const colors = { ink: "#173D39", pale: "#EEF5F1", line: "#D8E3DE", accent: "#BB704C", text: "#30423E", system: "#F4F0EA" };
const V2_IMPORT_SHEET_NAMES = { instructions: "使用说明", fieldGuide: "字段说明", lessons: "课程", resources: "资源", cards: "知识卡", assessments: "评估区块", items: "评估题" };

const courseColumns = [
  ["单元名称", "单元介绍", "课程标题", "课程副标题", "课程描述", "课程类型", "时长（分钟）", "学分", "允许试看", "挑战标题", "挑战说明 Markdown", "学习目标", "达标标准 Markdown", "核心带走内容 Markdown", "正文 Markdown"],
  ["学习目标", "理解目标、任务和证据的关系。", "把目标写成学生能完成的事", "从抽象要求到可观察表现", "本课帮助你把目标改写为可观察的学习表现。", "方法课", "30", "1", "否", "把一个模糊目标改清楚", "请把\n“理解合作”\n改写成可观察表现。", "知识理解｜能解释核心概念\n技能应用｜能完成目标改写", "能写出包含行为、条件和标准的目标。", "好目标要能指导任务和评价。", "## 为什么要改写目标\n\n正文内容……"],
];
const courseFields = [
  ["课程", "模块名称", "课程所属的大模块名称；相同模块可在多行重复。", "是", "教学设计基础"],
  ["课程", "模块介绍", "模块的简短介绍，供课程目录使用。", "否", "建立教学设计的基本框架"],
  ["课程", "单元名称", "课程所属的单元名称；相同单元可在多行重复。", "是", "学习目标"],
  ["课程", "单元介绍", "单元的简短介绍，供课程目录使用。", "否", "理解目标、任务和证据的关系。"],
  ["课程", "课程标题", "一节课在前台显示的标题，也是其他工作表关联课程的依据。", "是", "把目标写成学生能完成的事"],
  ["课程", "课程副标题", "课程标题下的补充说明。", "否", "从抽象要求到可观察表现"],
  ["课程", "课程描述", "课程简介。", "否", "本课帮助你把目标改写为可观察的学习表现。"],
  ["课程", "课程类型", "从后台数据字典填写中文名称，例如“概念课”“方法课”。", "否", "方法课"],
  ["课程", "时长（分钟）", "预计完成本课所需分钟数。", "否", "30"],
  ["课程", "学分", "完成本课后计入学员总学分的数值。", "否", "1"],
  ["课程", "允许试看", "填写“是”或“否”；留空默认为“否”。", "否", "否"],
  ["课程", "挑战标题", "今天的挑战标题。", "否", "把一个模糊目标改清楚"],
  ["课程", "挑战说明 Markdown", "挑战任务的详细说明，可使用 Markdown。", "否", "请把“理解合作”改写成可观察表现。"],
  ["课程", "学习目标", "每行一个目标，格式为“目标类型｜目标文本”。目标类型使用数据字典中的中文名称。", "否", "知识理解｜能解释核心概念"],
  ["课程", "达标标准 Markdown", "学员完成本课后，什么表现可以算达标。", "否", "能写出包含行为、条件和标准的目标。"],
  ["课程", "核心带走内容 Markdown", "学员完成课程后需要带走的核心方法或结论。", "否", "好目标要能指导任务和评价。"],
  ["课程", "正文 Markdown", "课程正文内容，可使用标题、列表、引用等 Markdown。", "否", "## 为什么要改写目标"],
  ["资源", "模块名称", "填写要关联的模块名称，必须与“课程”表一致。", "是", "教学设计基础"],
  ["资源", "单元名称", "填写要关联的单元名称，必须与“课程”表一致。", "是", "学习目标"],
  ["资源", "课程标题", "填写要关联的课程标题，必须与“课程”表一致。", "是", "把目标写成学生能完成的事"],
  ["资源", "资源标题", "资源在课程中的显示名称。", "否", "目标改写示例"],
  ["资源", "资源说明", "资源用途或补充说明。", "否", "课后参考"],
  ["资源", "资源链接", "可访问的 http 或 https 链接；本地文件导入后在课程编辑器中上传。", "是", "https://example.com/resource.pdf"],
  ["知识卡", "模块名称", "填写要关联的模块名称，必须与“课程”表一致。", "是", "教学设计基础"],
  ["知识卡", "单元名称", "填写要关联的单元名称，必须与“课程”表一致。", "是", "学习目标"],
  ["知识卡", "课程标题", "填写要关联的课程标题，必须与“课程”表一致。", "是", "把目标写成学生能完成的事"],
  ["知识卡", "知识卡类型", "从后台数据字典填写中文名称，例如“核心概念”“方法步骤”。", "否", "核心概念"],
  ["知识卡", "知识卡标题", "知识卡的显示标题。", "是", "目标的三个组成部分"],
  ["知识卡", "知识卡内容 Markdown", "知识卡正文，可使用 Markdown。", "是", "行为 + 条件 + 标准"],
  ["评估区块", "模块名称", "填写要关联的模块名称，必须与“课程”表一致。", "是", "教学设计基础"],
  ["评估区块", "单元名称", "填写要关联的单元名称，必须与“课程”表一致。", "是", "学习目标"],
  ["评估区块", "课程标题", "填写要关联的课程标题，必须与“课程”表一致。", "是", "把目标写成学生能完成的事"],
  ["评估区块", "评估区块名称", "也是“评估题”表的关联依据，例如课前诊断、课后达标测试。", "是", "课后达标测试"],
  ["评估区块", "评估类型", "从后台数据字典填写中文名称，例如“前测”“后测”“真实任务”。", "否", "后测"],
  ["评估区块", "作答说明 Markdown", "向学员说明如何完成本评估。", "否", "请先独立完成，再提交答案。"],
  ["评估区块", "是否必做", "填写“是”或“否”；留空默认为“否”。", "否", "是"],
  ["评估区块", "预计用时（分钟）", "完成该评估区块预计需要的分钟数。", "否", "10"],
  ["评估题", "模块名称", "填写要关联的模块名称，必须与“课程”表一致。", "是", "教学设计基础"],
  ["评估题", "单元名称", "填写要关联的单元名称，必须与“课程”表一致。", "是", "学习目标"],
  ["评估题", "课程标题", "填写要关联的课程标题，必须与“课程”表一致。", "是", "把目标写成学生能完成的事"],
  ["评估题", "评估区块名称", "填写要关联的评估区块名称，必须与“评估区块”表一致。", "是", "课后达标测试"],
  ["评估题", "题型", "从后台数据字典填写中文名称，例如“单选题”“多选题”“判断题”“简答题”。", "是", "单选题"],
  ["评估题", "评分方式", "从后台数据字典填写中文名称，例如“自动评分”“教师批阅”。", "否", "自动评分"],
  ["评估题", "题目 Markdown", "题干和问题描述，可使用 Markdown。", "是", "下列哪项最符合本课目标？"],
  ["评估题", "情境材料 Markdown", "题目前置的案例或真实情境；简答题、真实任务可填写。", "否", "某教师写下“理解合作”……"],
  ["评估题", "最高分", "该题最高得分，可留空。", "否", "10"],
  ["评估题", "批阅标准", "每行写一条批阅标准，主要用于简答题和真实任务。", "否", "是否包含关键概念"],
  ["评估题", "选项", "选择题填写“A｜选项一；B｜选项二”；非选择题留空。", "否", "A｜行为；B｜态度"],
  ["评估题", "正确答案", "选择题填写选项字母，例如 A；多选题填写 A,C；非选择题留空。", "否", "A"],
].filter((row) => row[1] !== "模块名称" && row[1] !== "模块介绍");

const instruction = workbook.worksheets.add(V2_IMPORT_SHEET_NAMES.instructions);
instruction.showGridLines = false;
instruction.mergeCells("A1:F1");
instruction.getRange("A1").values = [["教学通识课 V2｜课程内容 Excel 批量导入模板"]];
instruction.getRange("A1:F1").format = { fill: colors.ink, font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "left", verticalAlignment: "center" };
instruction.getRange("A1:F1").format.rowHeight = 32;
instruction.getRange("A3:B3").values = [["填写原则", "说明"]];
instruction.getRange("A3:B3").format = { fill: colors.pale, font: { bold: true, color: colors.ink }, borders: { preset: "all", style: "thin", color: colors.line } };
instruction.getRange("A4:B12").values = [
  ["1", "你只需要填写课程内容和内容之间的中文关联名称；课程 ID、slug、排序、状态、时间戳、外键和私有答案键由系统自动生成。"],
  ["2", "课程表每一行代表一节课；资源、知识卡、评估区块、评估题分别在对应工作表填写。"],
  ["3", "关联其他工作表时，使用单元名称 + 课程标题；评估题再填写评估区块名称。名称重复会在预览阶段报错。"],
  ["4", "课程类型、目标类型、知识卡类型、评估类型、题型和评分方式都填写后台数据字典中的中文名称，不需要填写英文 key。"],
  ["5", "学习目标每行一个，格式：目标类型｜目标文本，例如：知识理解｜能解释核心概念。"],
  ["6", "选择题选项格式：A｜选项一；B｜选项二；正确答案填写 A，多选题填写 A,C。"],
  ["7", "正文、挑战说明、知识卡、作答说明、题目和批阅标准都支持 Markdown；批阅标准每行写一条。"],
  ["8", "资源工作表填写外部链接；本地音视频、PDF 等文件在课程创建后进入 Lesson 编辑器上传。"],
  ["9", "导入只创建草稿。请先看“字段说明”页，填写后上传并在后台预览校验结果。"],
];
instruction.getRange("A4:A12").format = { font: { bold: true, color: colors.accent }, horizontalAlignment: "center" };
instruction.getRange("B4:B12").format = { font: { color: colors.text }, wrapText: true };
instruction.getRange("A3:B12").format.borders = { preset: "all", style: "thin", color: colors.line };
instruction.getRange("A:A").format.columnWidth = 8;
instruction.getRange("B:B").format.columnWidth = 100;
instruction.getRange("C:F").format.columnWidth = 16;

const fieldGuide = workbook.worksheets.add(V2_IMPORT_SHEET_NAMES.fieldGuide);
fieldGuide.showGridLines = false;
fieldGuide.getRange("A1:E1").values = [["工作表", "中文填写项", "填写说明", "是否必填", "示例"]];
fieldGuide.getRange(`A1:E${courseFields.length + 1}`).format = { wrapText: true, verticalAlignment: "top", font: { color: colors.text }, borders: { insideHorizontal: { style: "thin", color: colors.line }, insideVertical: { style: "thin", color: colors.line } } };
fieldGuide.getRange("A1:E1").format = { fill: colors.ink, font: { bold: true, color: "#FFFFFF" }, wrapText: true, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "all", style: "thin", color: colors.ink } };
fieldGuide.getRange(`A2:E${courseFields.length + 1}`).values = courseFields;
fieldGuide.getRange(`D2:D${courseFields.length + 1}`).format = { fill: colors.pale, font: { bold: true, color: colors.accent }, horizontalAlignment: "center" };
fieldGuide.getRange(`E2:E${courseFields.length + 1}`).format = { fill: colors.system, font: { color: colors.text }, wrapText: true };
fieldGuide.getRange("A:A").format.columnWidth = 16;
fieldGuide.getRange("B:B").format.columnWidth = 28;
fieldGuide.getRange("C:C").format.columnWidth = 62;
fieldGuide.getRange("D:D").format.columnWidth = 10;
fieldGuide.getRange("E:E").format.columnWidth = 42;
fieldGuide.freezePanes.freezeRows(1);

const sheets = [
  [V2_IMPORT_SHEET_NAMES.lessons, courseColumns[0]],
  [V2_IMPORT_SHEET_NAMES.resources, ["单元名称", "课程标题", "资源标题", "资源说明", "资源链接"]],
  [V2_IMPORT_SHEET_NAMES.cards, ["单元名称", "课程标题", "知识卡类型", "知识卡标题", "知识卡内容 Markdown"]],
  [V2_IMPORT_SHEET_NAMES.assessments, ["单元名称", "课程标题", "评估区块名称", "评估类型", "作答说明 Markdown", "是否必做", "预计用时（分钟）"]],
  [V2_IMPORT_SHEET_NAMES.items, ["单元名称", "课程标题", "评估区块名称", "题型", "评分方式", "题目 Markdown", "情境材料 Markdown", "最高分", "批阅标准", "选项", "正确答案"]],
];

for (const [name, columns] of sheets) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const lastColumn = String.fromCharCode(64 + columns.length);
  sheet.getRange(`A1:${lastColumn}1`).values = [columns];
  sheet.getRange(`A1:${lastColumn}1`).format = { fill: colors.ink, font: { bold: true, color: "#FFFFFF" }, wrapText: true, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "all", style: "thin", color: colors.ink } };
  sheet.getRange(`A1:${lastColumn}1`).format.rowHeight = 34;
  sheet.getRange(`A2:${lastColumn}20`).format = { verticalAlignment: "top", wrapText: true, font: { color: colors.text } };
  sheet.getRange(`A1:${lastColumn}20`).format.borders = { insideHorizontal: { style: "thin", color: colors.line }, insideVertical: { style: "thin", color: colors.line }, bottom: { style: "thin", color: colors.line } };
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A:A").format.columnWidth = 20;
  sheet.getRange(`B:${lastColumn}`).format.columnWidth = 24;
  if (name === V2_IMPORT_SHEET_NAMES.lessons) {
    sheet.getRange("B:B").format.columnWidth = 32;
    sheet.getRange("D:D").format.columnWidth = 30;
    sheet.getRange("G:G").format.columnWidth = 34;
    sheet.getRange("K:O").format.columnWidth = 42;
    sheet.getRange("I2:I200").dataValidation = { rule: { type: "list", values: ["是", "否"] } };
  }
  if (name === V2_IMPORT_SHEET_NAMES.resources) {
    sheet.getRange("E:E").format.columnWidth = 48;
  }
  if (name === V2_IMPORT_SHEET_NAMES.cards) {
    sheet.getRange("E:E").format.columnWidth = 48;
  }
  if (name === V2_IMPORT_SHEET_NAMES.assessments) {
    sheet.getRange("E:E").format.columnWidth = 42;
    sheet.getRange("F2:F200").dataValidation = { rule: { type: "list", values: ["是", "否"] } };
  }
  if (name === V2_IMPORT_SHEET_NAMES.items) {
    sheet.getRange("F:G").format.columnWidth = 42;
    sheet.getRange("I:K").format.columnWidth = 36;
  }
}

await fs.mkdir(new URL("../public/templates/", import.meta.url), { recursive: true });
const previewDir = process.env.V2_TEMPLATE_PREVIEW_DIR ?? "/tmp/v2-course-import-template-previews";
await fs.mkdir(previewDir, { recursive: true });
for (const [name] of [[V2_IMPORT_SHEET_NAMES.instructions], [V2_IMPORT_SHEET_NAMES.fieldGuide], ...sheets]) {
  const preview = await workbook.render({ sheetName: name, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${name}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
