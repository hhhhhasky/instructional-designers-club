import { assertEquals } from "jsr:@std/assert@1";
import { readHaiTrace } from "./hai_trace.ts";

Deno.test("readHaiTrace prefers v2 and normalizes nested Skill metadata", () => {
  const trace = readHaiTrace({
    hai_trace: {
      trace_version: 2,
      kind: "chat_skill",
      mode: "skill",
      question: "如何判断课堂活动是否有效？",
      skill: {
        id: "skill-1",
        slug: "hai-consultation",
        name: "咨询",
        source_path: "SKILL.md",
        version: {
          id: "version-2",
          label: "v2",
          snapshot_hash: "hash-2",
        },
      },
      intent_result: { primary_intent: "diagnosis" },
      method_card_ids: ["method-1"],
      references: [{
        path: "references/method.md",
        content_hash: "reference-hash",
      }],
      memory_selection: { should_load_memory: false, loaded: false },
      evaluation_result: { score: 88, pass: true },
    },
    hai_context_trace: { question: "旧 trace 不应覆盖 v2" },
  });

  assertEquals(trace?.source, "hai_trace");
  assertEquals(trace?.question, "如何判断课堂活动是否有效？");
  assertEquals(trace?.skill?.version.id, "version-2");
  assertEquals(trace?.reference_paths, ["references/method.md"]);
  assertEquals(trace?.evaluation_result?.score, 88);
});

Deno.test("readHaiTrace supports legacy Skill and Context trace shapes", () => {
  const legacySkill = readHaiTrace({
    hai_skill_trace: {
      mode: "skill",
      skill_id: "skill-1",
      skill_slug: "hai-consultation",
      version_id: "version-1",
      version_label: "v1",
      snapshot_hash: "hash-1",
      method_card_ids: ["method-1"],
      reference_paths: ["references/a.md"],
      reference_hashes: ["hash-a"],
      memory_loaded: true,
    },
  });
  assertEquals(legacySkill?.source, "hai_skill_trace");
  assertEquals(legacySkill?.skill?.version.label, "v1");
  assertEquals(legacySkill?.memory_selection.loaded, true);

  const legacyContext = readHaiTrace({
    hai_context_trace: {
      question: "旧问题",
      intent_result: { primary_intent: "advice" },
      diagnostic_module: "daily_lesson",
      methodology_ids: ["method-2"],
      evaluation_result: { score: 70, pass: false },
    },
  });
  assertEquals(legacyContext?.source, "hai_context_trace");
  assertEquals(legacyContext?.question, "旧问题");
  assertEquals(legacyContext?.method_card_ids, ["method-2"]);
});
