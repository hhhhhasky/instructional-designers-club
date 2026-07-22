import { describe, expect, it } from "vitest";
import {
  chatSkillBindingBlockReason,
  chatSkillEnableBlockReason,
  normalizeSkillBundlePath,
  parsePastedSkillBundle,
} from "@/components/admin/HaiChatSkillManagement";

describe("HAI Chat Skill maintenance guards", () => {
  it("does not enable a skill before a version is published", () => {
    expect(chatSkillEnableBlockReason(true, [{ status: "draft" }])).toContain(
      "先发布",
    );
    expect(chatSkillEnableBlockReason(true, [{ status: "published" }]))
      .toBeNull();
  });

  it("only binds enabled skills with a published version", () => {
    expect(
      chatSkillBindingBlockReason({ is_enabled: false }, [{
        status: "published",
      }]),
    ).toContain("先启用");
    expect(
      chatSkillBindingBlockReason({ is_enabled: true }, [{ status: "draft" }]),
    ).toContain("先发布");
    expect(
      chatSkillBindingBlockReason({ is_enabled: true }, [{
        status: "published",
      }]),
    ).toBeNull();
  });
});

describe("HAI Chat Skill bundle import", () => {
  it("parses SKILL.md and multiple reference files from pasted text", () => {
    const bundle = parsePastedSkillBundle(`=== SKILL.md ===
---
name: consultation
---
先诊断再建议。

=== references/methods.md ===
# 方法库
问题链

=== references/cases/example.md ===
# 案例
公开课`);
    expect(bundle.instructions).toContain("先诊断再建议");
    expect(bundle.references.map((item) => item.path)).toEqual([
      "references/methods.md",
      "references/cases/example.md",
    ]);
    expect(bundle.references[1].content).toContain("公开课");
  });

  it("treats plain paste as SKILL.md and normalizes uploaded paths", () => {
    expect(parsePastedSkillBundle("# Skill\n回答规则")).toEqual({
      instructions: "# Skill\n回答规则",
      references: [],
    });
    expect(normalizeSkillBundlePath("hai/SKILL.md")).toBe("SKILL.md");
    expect(normalizeSkillBundlePath("hai\\references\\cases.md")).toBe(
      "references/cases.md",
    );
    expect(normalizeSkillBundlePath("notes.md")).toBe("references/notes.md");
  });
});
