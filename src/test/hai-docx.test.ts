import { describe, it, expect } from "vitest";
import { renderHaiDocx } from "@/lib/hai-docx";

const sample = [
  "# 思政公开课设计｜第八课 践行中华传统美德",
  "",
  "这是一段普通正文,用于验证段落渲染与中文。Emoji 应保留:✅🎉。",
  "",
  "## 一、课程基本信息",
  "",
  "- 学科:道德与法治",
  "- 年级:八年级",
  "- 课时:1 课时",
  "",
  "### 教学目标",
  "",
  "1. 理解中华传统美德的内涵。",
  "2. 能结合生活实例说明「薪火相传」。",
  "",
  "> 引用:美德不是悬在半空的口号,而是日用而不自知的习惯。",
  "",
  "## 二、板书设计",
  "",
  "```",
  "┌──────────┬──────────┐",
  "│  传统美德 │  当代践行 │",
  "├──────────┼──────────┤",
  "│  孝悌    │  家庭和睦 │",
  "└──────────┴──────────┘",
  "```",
  "",
  "## 三、评价表",
  "",
  "| 维度 | 优秀 | 合格 |",
  "| --- | --- | --- |",
  "| 表达 | 清晰 | 基本清楚 |",
  "| 思辨 | 深入 | 有意识 |",
  "",
  "---",
  "",
  "结束段。",
].join("\n");

describe("renderHaiDocx", () => {
  it("生成合法的 .docx(Promise<Blob>,体积合理,zip 头)", async () => {
    const blob = await renderHaiDocx({
      title: "思政公开课设计｜第八课 践行中华传统美德",
      version: 1,
      markdown: sample,
      watermark: "文档来自于教学设计师俱乐部哈老师研发的 HAI 产出",
      metaRight: "思政公开课设计 · v1 · 2026-07-26",
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(3000);
    // docx 是 zip 压缩包,以 PK\x03\x04 开头。
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    // document.xml 是 deflate 压缩的,正文中文无法直接读出;
    // 改查 zip 中央目录里未压缩的部件名,证明文档结构齐全。
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("word/document.xml");
    expect(text).toContain("word/footer"); // 正文节带页脚(水印 + 页码)
  });
});
