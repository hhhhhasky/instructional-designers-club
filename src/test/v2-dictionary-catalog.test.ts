import { describe, expect, it } from "vitest";
import {
  getV2DictionaryField,
  V2_DICTIONARY_FIELD_CATALOG,
} from "@/components/admin/v2-dictionary-catalog";

describe("V2 dictionary field catalog", () => {
  it("keeps field keys unique and maps each field to a database path", () => {
    const keys = V2_DICTIONARY_FIELD_CATALOG.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(V2_DICTIONARY_FIELD_CATALOG.every((field) => field.fieldPath.startsWith("v2_"))).toBe(true);
  });

  it("provides the assessment and objective types required by the editor", () => {
    expect(getV2DictionaryField("objective_type")?.items.map((item) => item.key)).toEqual(
      expect.arrayContaining(["knowledge", "skill", "attitude", "transfer"]),
    );
    expect(getV2DictionaryField("assessment_type")?.items.map((item) => item.key)).toEqual(
      expect.arrayContaining(["pretest", "posttest", "authentic_task"]),
    );
    expect(getV2DictionaryField("item_type")?.items.map((item) => item.key)).toEqual(
      expect.arrayContaining(["single_choice", "multiple_choice", "true_false", "short_answer", "open_task"]),
    );
  });
});
