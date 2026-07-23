import { describe, expect, it } from "vitest";
import {
  nextWorkVersionLabel,
  normalizeWorkReferencePath,
  serializeWorkReferences,
  workReferenceEditBlockReason,
  type WorkSkillReferenceDraft,
} from "@/components/admin/HaiWorkSkillManagement";

function reference(
  overrides: Partial<WorkSkillReferenceDraft> = {},
): WorkSkillReferenceDraft {
  return {
    id: "reference-1",
    skill_version_id: "version-1",
    path: "references/case-mode-v3.md",
    name: "案例式教学模板 V3",
    description: "案例式流程",
    media_type: "text/markdown",
    content: "材料—问题—分析—归纳",
    content_hash: "old-hash",
    load_mode: "case",
    max_chars: 24000,
    sort_order: 30,
    metadata: {},
    ...overrides,
  };
}

describe("HAI Work reference management", () => {
  it("keeps published and archived reference snapshots read-only", () => {
    expect(workReferenceEditBlockReason("draft")).toBeNull();
    expect(workReferenceEditBlockReason("published")).toContain("复制为草稿");
    expect(workReferenceEditBlockReason("archived")).toContain("只读");
  });

  it("normalizes uploaded or pasted paths into the references folder", () => {
    expect(normalizeWorkReferencePath("skill\\references\\case-mode-v3.md"))
      .toBe("references/case-mode-v3.md");
    expect(normalizeWorkReferencePath("output-template.md"))
      .toBe("references/output-template.md");
  });

  it("serializes the selected mode strategy and recomputes stable order", () => {
    const result = serializeWorkReferences([
      reference({ path: "case-mode-v3.md", max_chars: 80000 }),
      reference({
        id: "reference-2",
        path: "references/issue-mode-v3.md",
        load_mode: "issue",
      }),
    ]);
    expect(result[0]).toMatchObject({
      path: "references/case-mode-v3.md",
      load_mode: "case",
      max_chars: 50000,
      sort_order: 0,
    });
    expect(result[1]).toMatchObject({
      load_mode: "issue",
      sort_order: 10,
    });
  });

  it("chooses a non-conflicting draft label", () => {
    expect(nextWorkVersionLabel([
      { version_label: "v1" },
      { version_label: "v3" },
      { version_label: "v1.1.0" },
    ])).toBe("v4");
  });
});
