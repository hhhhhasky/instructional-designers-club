import { describe, expect, it } from "vitest";
import type { V2Resource } from "@/db/v2-api";
import { isSubjectExplorerResource, parseSubjectExamples } from "@/lib/v2-subject-explorer";

function resource(metadata: Record<string, unknown>): V2Resource {
  return {
    id: "resource-1", lesson_id: "lesson-5", resource_type_id: null, usage_type_id: null,
    title: "案例选择器", description: null, storage_provider: null, storage_key: null,
    external_url: null, file_name: null, mime_type: null, file_size: null,
    is_downloadable: false, sort_order: 0, is_active: true, metadata,
  };
}

describe("V2 subject example explorer metadata", () => {
  it("recognizes the explorer and keeps only complete subject branches", () => {
    const input = resource({
      component: "subject_example_explorer",
      subjects: [
        { id: "math", label: "数学", structure: "类型二", example: "全等三角形", route: "第四学段 → 图形与几何", focus: "条件与推理", direction: "形成有依据的几何判断", contribution: "SAS 提供一种判断依据", pitfall: "只背口诀" },
        { id: "broken", label: "缺字段" },
      ],
    });

    expect(isSubjectExplorerResource(input)).toBe(true);
    expect(parseSubjectExamples(input)).toHaveLength(1);
    expect(parseSubjectExamples(input)[0].label).toBe("数学");
  });

  it("ignores ordinary resources and malformed metadata", () => {
    expect(parseSubjectExamples(resource({ component: "download", subjects: [] }))).toEqual([]);
    expect(parseSubjectExamples(resource({ component: "subject_example_explorer", subjects: "math" }))).toEqual([]);
  });
});
