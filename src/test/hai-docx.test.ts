import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { renderHaiDocx } from "@/lib/hai-docx";

const sample = [
  "# 公开课设计｜第八课 践行中华传统美德",
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
  "数学符号：$A=\\{x\\in\\mathbb R\\mid x>0\\}$，公式：$$S=\\frac{1}{2}ah$$。",
].join("\n");

describe("renderHaiDocx", () => {
  it("生成合法的 .docx(Promise<Blob>,体积合理,zip 头)", async () => {
    const blob = await renderHaiDocx({
      title: "公开课设计｜第八课 践行中华传统美德",
      version: 1,
      markdown: sample,
      watermark: "文档来自于教学设计师俱乐部哈老师研发的 HAI 产出",
      metaRight: "公开课设计 · v1 · 2026-07-26",
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

  it("将 Markdown 数学定界符转换为 Word OMML，而不是写入原始 MD", async () => {
    const blob = await renderHaiDocx({
      title: "数学公开课",
      version: 1,
      markdown: "# 数学\n\n集合 $A=\\{x\\in\\mathbb R\\mid x>0\\}$。\n\n$$S=\\frac{1}{2}ah$$",
      watermark: "HAI",
      metaRight: "数学公开课 · v1",
    });
    const xml = extractZipEntry(new Uint8Array(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("<m:oMath");
    expect(xml).toContain("∈");
    expect(xml).toContain("<m:f>");
    expect(xml).not.toContain("$A=");
  });

  it("处理数学装饰命令并为表格写入固定列宽", async () => {
    const blob = await renderHaiDocx({
      title: "数学表格导出",
      version: 1,
      markdown: [
        "向量：$\\overrightarrow{AB}=\\boldsymbol{a}$，长度：$\\big|\\vec{a}\\big|$，角度：$A\\circ B$。",
        "",
        "| 教学环节 | 教师活动与关键提问 | 学生活动与预期产出 | 评价与调整 |",
        "| --- | --- | --- | --- |",
        "| 导入 | 观察向量图示并写出 $\\overrightarrow{AB}$，比较模长 $\\big|\\vec{a}\\big|$。 | 小组讨论并记录结论。 | 根据表达准确性追问。 |",
      ].join("\n"),
      watermark: "HAI",
      metaRight: "数学表格导出 · v1",
    });
    const xml = extractZipEntry(new Uint8Array(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("<m:oMath");
    expect(xml).toContain("∘");
    expect(xml).toContain("→");
    expect(xml).not.toContain("$");
    expect(xml).not.toContain("overrightarrow");
    expect(xml).not.toContain("boldsymbol");
    expect(xml).not.toContain("\\big");
    expect(xml).toContain("<w:tblGrid>");
    expect((xml.match(/<w:gridCol /g) ?? []).length).toBe(4);
    expect(xml).toContain('w:tblLayout w:type="fixed"');
  });
});

function extractZipEntry(bytes: Uint8Array, entryName: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 30 <= bytes.length;) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (name === entryName) {
      const raw = method === 8 ? inflateRawSync(data) : data;
      return new TextDecoder().decode(raw);
    }
    offset = dataStart + compressedSize;
  }
  throw new Error(`ZIP entry not found: ${entryName}`);
}
