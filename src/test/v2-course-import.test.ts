import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseV2CourseWorkbook, type V2ImportDictionary } from "@/components/admin/v2-course-import";

const dictionary: V2ImportDictionary = {
  lesson_type: { keys: new Set(["method"]), labels: new Map([["方法课", "method"]]) },
  objective_type: { keys: new Set(["knowledge"]), labels: new Map([["知识理解", "knowledge"]]) },
  knowledge_card_type: { keys: new Set(["concept"]), labels: new Map([["核心概念", "concept"]]) },
  assessment_type: { keys: new Set(["posttest"]), labels: new Map([["后测", "posttest"]]) },
  item_type: { keys: new Set(["single_choice"]), labels: new Map([["单选题", "single_choice"]]) },
  grading_mode: { keys: new Set(["auto"]), labels: new Map([["自动评分", "auto"]]) },
};

function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, values]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(values), name));
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const baseSheets = {
  "资源": [["单元名称", "课程标题", "资源标题", "资源说明", "资源链接"]],
  "知识卡": [["单元名称", "课程标题", "知识卡类型", "知识卡标题", "知识卡内容 Markdown"]],
  "评估区块": [["单元名称", "课程标题", "评估区块名称", "评估类型", "作答说明 Markdown", "是否必做", "预计用时（分钟）"]],
  "评估题": [["单元名称", "课程标题", "评估区块名称", "题型", "评分方式", "题目 Markdown", "情境材料 Markdown", "最高分", "批阅标准", "选项", "正确答案"]],
};

describe("V2 course workbook parser", () => {
  it("uses Chinese content fields and generates internal linkage keys", async () => {
    const result = await parseV2CourseWorkbook(workbookBuffer({
      "课程": [
        ["单元名称", "单元介绍", "课程标题", "课程副标题", "课程描述", "课程类型", "时长（分钟）", "学分", "允许试看", "挑战标题", "挑战说明 Markdown", "学习目标", "达标标准 Markdown", "核心带走内容 Markdown", "正文 Markdown"],
        ["学习目标", "单元介绍", "把目标写成学生能完成的事", "副标题", "课程描述", "方法课", "30", "1.5", "是", "挑战", "挑战说明", "知识理解｜能解释核心概念", "达标", "带走", "正文"],
      ],
      "资源": [...baseSheets["资源"], ["学习目标", "把目标写成学生能完成的事", "示例资源", "补充", "https://example.com/resource.pdf"]],
      "知识卡": [...baseSheets["知识卡"], ["学习目标", "把目标写成学生能完成的事", "核心概念", "目标结构", "行为 + 条件 + 标准"]],
      "评估区块": [...baseSheets["评估区块"], ["学习目标", "把目标写成学生能完成的事", "课后达标测试", "后测", "请完成测试", "是", "10"]],
      "评估题": [...baseSheets["评估题"], ["学习目标", "把目标写成学生能完成的事", "课后达标测试", "单选题", "自动评分", "哪项正确？", "", "10", "", "A｜行为；B｜态度", "A"]],
    }), dictionary);

    expect(result.issues).toEqual([]);
    expect(result.payload?.units[0]).toMatchObject({ title: "学习目标", description_markdown: "单元介绍" });
    const lesson = result.payload?.units[0].lessons[0];
    expect(lesson).toMatchObject({ lesson_key: "lesson-1", lesson_title: "把目标写成学生能完成的事", duration_minutes: 30, credits: 1.5, is_trial: true, lesson_type_key: "method" });
    expect(lesson?.resources).toHaveLength(1);
    expect(lesson?.cards[0].card_type_key).toBe("concept");
    expect(lesson?.assessments[0].key).toBe("assessment-1");
    expect(lesson?.assessments[0].items[0]).toMatchObject({ item_type_key: "single_choice", grading_mode_key: "auto", answer_key: { correct: ["A"] } });
  });

  it("reports ambiguous human linkage and invalid Chinese dictionary values", async () => {
    const courseHeader = ["单元名称", "单元介绍", "课程标题", "课程副标题", "课程描述", "课程类型", "时长（分钟）", "学分", "允许试看", "挑战标题", "挑战说明 Markdown", "学习目标", "达标标准 Markdown", "核心带走内容 Markdown", "正文 Markdown"];
    const result = await parseV2CourseWorkbook(workbookBuffer({
      "课程": [courseHeader, ["单元", "", "重复标题", "", "", "不存在的类型", "bad", "", "", "", "", "知识理解", "", "", ""], ["单元", "", "重复标题", "", "", "", "", "", "", "", "", "", "", "", ""]],
      ...baseSheets,
    }), dictionary);

    expect(result.payload).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("课程关联名称必须唯一"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("不在数据字典"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("时长必须是整数"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("目标类型｜目标文本"))).toBe(true);
  });
});
