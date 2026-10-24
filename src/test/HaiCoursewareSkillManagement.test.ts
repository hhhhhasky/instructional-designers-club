import { describe, expect, it } from "vitest";
import {
  nextCoursewareSkillVersionLabel,
  normalizeCoursewareReferencePath,
  serializeCoursewareReferences,
  type CoursewareSkillReferenceDraft,
} from "@/components/admin/HaiCoursewareSkillManagement";

function reference(overrides: Partial<CoursewareSkillReferenceDraft> = {}): CoursewareSkillReferenceDraft {
  return {
    id: "reference-1", skill_version_id: "version-1", path: "subjects/chinese.md", name: "语文功能页", description: "",
    media_type: "text/markdown", content: "# 语文", load_mode: "subject", match_criteria: { subject_profiles: ["chinese"] },
    max_chars: 99999, sort_order: 99, metadata: {}, ...overrides,
  };
}

describe("AI 课件 Skill 管理辅助逻辑", () => {
  it("把路径统一限制在 references 下", () => {
    expect(normalizeCoursewareReferencePath("./subjects/chinese.md")).toBe("references/chinese.md");
    expect(normalizeCoursewareReferencePath("skill/references/subjects/chinese.md")).toBe("references/subjects/chinese.md");
    expect(normalizeCoursewareReferencePath("references\\quality.md")).toBe("references/quality.md");
  });

  it("序列化 reference 时保留匹配条件并限制字符上限", () => {
    expect(serializeCoursewareReferences([reference()])).toEqual([expect.objectContaining({
      path: "references/chinese.md", load_mode: "subject", max_chars: 50000, sort_order: 0,
      match_criteria: { subject_profiles: ["chinese"] },
    })]);
  });

  it("生成不与已有版本冲突的新标签", () => {
    expect(nextCoursewareSkillVersionLabel([{ version_label: "v1" }, { version_label: "v3" }])).toBe("v4");
    expect(nextCoursewareSkillVersionLabel([{ version_label: "v1" }, { version_label: "v2" }])).toBe("v3");
  });
});
