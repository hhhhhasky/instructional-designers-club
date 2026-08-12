import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  completeTextbookPayload,
  HAI_TEXTBOOK_SCHEMA_VERSION,
  validateHaiTextbookPayload,
} from "./hai-textbook-payload.mjs";

function collection(slug = "book") {
  return {
    slug,
    title: "测试教材",
    stage: "小学",
    subject: "道德与法治",
    grade_label: "四年级",
    volume: "下册",
  };
}

function section(overrides = {}) {
  return {
    section_key: "book::u2::l5::f1",
    collection_slug: "book",
    section_level: "frame",
    unit_number: 2,
    unit_label: "第2单元",
    unit_title: "做聪明的消费者",
    lesson_number: 5,
    lesson_label: "第5课",
    lesson_title: "合理消费",
    frame_number: 1,
    frame_label: "第1框",
    frame_title: "那些我想要的东西",
    section_path: "测试教材 / 第2单元 做聪明的消费者 / 第5课 合理消费 / 第1框 那些我想要的东西",
    content_type: "knowledge_summary",
    content_markdown: "核心知识点",
    content_text: "核心知识点",
    knowledge_point_count: 1,
    char_count: 5,
    sort_order: 1,
    content_hash: "hash",
    verification_status: "source_declared_current",
    ...overrides,
  };
}

test("completeTextbookPayload normalizes frame-only input into one hierarchy contract", () => {
  const payload = completeTextbookPayload({ collections: [collection()], sections: [section()] });
  assert.equal(payload.schema_version, HAI_TEXTBOOK_SCHEMA_VERSION);
  assert.deepEqual(payload.sections.map((item) => item.section_level), ["unit", "lesson", "frame"]);
  assert.equal(payload.links.length, 4);
  assert.equal(validateHaiTextbookPayload(payload), true);
});

test("completeTextbookPayload preserves unit and lesson source sections", () => {
  const unit = section({ section_key: "book::u2", section_level: "unit", lesson_number: 0, lesson_label: "", lesson_title: "", frame_number: 0, frame_label: "", frame_title: "", content_type: "unit_context" });
  const lesson = section({ section_key: "book::u2::l5", section_level: "lesson", frame_number: 0, frame_label: "", frame_title: "", content_type: "lesson_summary" });
  const payload = completeTextbookPayload({ collections: [collection()], sections: [unit, lesson] });
  assert.deepEqual(payload.sections.map((item) => item.section_level), ["unit", "lesson"]);
  assert.equal(payload.links.length, 2);
  assert.equal(validateHaiTextbookPayload(payload), true);
});

test("validateHaiTextbookPayload rejects a missing reverse link", () => {
  const payload = completeTextbookPayload({ collections: [collection()], sections: [section()] });
  payload.links = payload.links.slice(1);
  assert.throws(() => validateHaiTextbookPayload(payload), /双向 link/);
});

test("validateHaiTextbookPayload rejects a frame without a lesson parent", () => {
  const payload = {
    schema_version: HAI_TEXTBOOK_SCHEMA_VERSION,
    collections: [collection()],
    sections: [section()],
    links: [],
  };
  assert.throws(() => validateHaiTextbookPayload(payload), /缺少 lesson 父级记录/);
});

test("checked-in textbook payloads follow the same contract", () => {
  for (const file of [
    "hai-sizheng-textbooks.json",
    "hai-non-politics-textbooks.json",
    "hai-junior-politics-textbooks.json",
  ]) {
    const payload = JSON.parse(readFileSync(resolve("supabase/seed-data", file), "utf8"));
    assert.equal(validateHaiTextbookPayload(payload, { source: file }), true);
  }
});
