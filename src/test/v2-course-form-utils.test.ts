import { describe, expect, it } from "vitest";
import {
  buildV2OutlineExpansion,
  canPublishV2AssessmentBlock,
  getV2ErrorMessage,
  isV2AssessmentVisibleOnLesson,
  resolveV2CreateParentId,
} from "@/components/admin/v2-course-form-utils";

const outlines = [
  {
    module: { id: "module-1" },
    units: [{ id: "unit-1" }, { id: "unit-2" }],
  },
  {
    module: { id: "module-2" },
    units: [{ id: "unit-3" }],
  },
];

describe("V2 course create form", () => {
  it("expands every module and unit when the outline first loads", () => {
    expect(buildV2OutlineExpansion(outlines)).toEqual({
      "module-1": true,
      "module-2": true,
      "unit-1": true,
      "unit-2": true,
      "unit-3": true,
    });
  });

  it("uses a unit id as the default parent for a lesson", () => {
    expect(resolveV2CreateParentId("lesson", outlines)).toBe("unit-1");
  });

  it("keeps the parent selected by the clicked module or unit", () => {
    expect(resolveV2CreateParentId("unit", outlines, "module-2")).toBe(
      "module-2",
    );
    expect(resolveV2CreateParentId("lesson", outlines, "unit-3")).toBe(
      "unit-3",
    );
  });

  it("surfaces the actual create error when available", () => {
    expect(getV2ErrorMessage(new Error("请选择所属单元"), "单课创建失败")).toBe(
      "请选择所属单元",
    );
    expect(getV2ErrorMessage(null, "单课创建失败")).toBe("单课创建失败");
  });

  it("only exposes published assessment blocks and never publishes an empty block", () => {
    expect(isV2AssessmentVisibleOnLesson("draft")).toBe(false);
    expect(isV2AssessmentVisibleOnLesson("published")).toBe(true);
    expect(canPublishV2AssessmentBlock("draft", 0)).toBe(false);
    expect(canPublishV2AssessmentBlock("draft", 1)).toBe(true);
    expect(canPublishV2AssessmentBlock("published", 1)).toBe(false);
  });
});
