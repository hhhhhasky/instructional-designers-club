import { describe, expect, it } from "vitest";
import { getHaiTextbookHierarchy } from "@/lib/hai-textbook-hierarchy";

describe("HAI textbook hierarchy labels", () => {
  it("maps a politics-like unit lesson frame catalog to unit, topic and frame", () => {
    expect(getHaiTextbookHierarchy("道德与法治", [{
      unit_label: "第一单元",
      lesson_label: "第一课",
      frame_label: "第一框",
    }])).toMatchObject({
      top: "单元",
      middle: "课题",
      bottom: "框题",
      hasThirdLevel: true,
    });
  });

  it("recognizes chapter and section naming", () => {
    expect(getHaiTextbookHierarchy("生物", [{
      unit_label: "第一单元",
      lesson_label: "第一章",
      frame_label: "第一节",
    }])).toMatchObject({
      top: "单元",
      middle: "章",
      bottom: "节",
      hasThirdLevel: true,
    });
  });

  it("treats English sessions as the final selectable teaching content", () => {
    expect(getHaiTextbookHierarchy("英语", [{
      unit_label: "Unit 1",
      lesson_label: "第1课时",
      frame_label: "Section A",
    }])).toMatchObject({
      top: "单元",
      middle: "课时 / 课题",
      bottom: "教材证据",
      hasThirdLevel: false,
    });
  });

  it("supports a top-level chapter or single-lesson catalog", () => {
    expect(getHaiTextbookHierarchy("阅读", [{
      unit_label: "第一章",
      lesson_label: "第一节",
      frame_label: "",
    }])).toMatchObject({
      top: "章",
      middle: "节",
      hasThirdLevel: false,
    });
    expect(getHaiTextbookHierarchy("综合实践", [{
      unit_label: "第一单课",
      lesson_label: "",
      frame_label: "",
    }])).toMatchObject({ top: "单课", middle: "课题" });
  });
});
