/**
 * HAI 产物 Markdown → Word(.docx)浏览器端排版器。
 *
 * 取代旧 hai-pdf.ts:在浏览器端用 docx 库生成 .docx,老师下载后可直接编辑。
 * 版式对齐原 PDF:首页是封面(eyebrow + 居中大标题 + 装饰短线 + 元信息,封面无页脚),
 * 正文为标题/段落/列表/引用/代码/表格/分隔线,正文页脚统一水印 + 页码(从第 1 页起)。
 * Word 按字体名渲染,无需像 pdf-lib 那样嵌入 8MB 中文字体。
 */
import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  TabStopType,
  TableCell,
  TableRow,
  Table,
  TextRun,
  WidthType,
} from "docx";

// 字体(均为中文 Windows/Mac 通用):正文宋体(衬线、书卷气),标题微软雅黑,代码等宽。
const FONT_BODY = "宋体";
const FONT_HEADING = "微软雅黑";
const FONT_MONO = "Consolas";

// 与原 PDF 配色一致(由 rgb 换算的 hex)。
const C = {
  ink: "29211C",
  muted: "61564A",
  soft: "8C7F70",
  accent: "9E2E29",
  rule: "D6C9B8",
  quoteBar: "9E2E29",
  codeBg: "F6EFE3",
  quoteBg: "F9F2E8",
  tableBorder: "C7B8A3",
  tableHeaderBg: "EDE0C9",
  tableZebra: "FBF7F1",
};

// A4 页面 + 边距(对齐原 PDF:左右 60pt、上 72pt、下 64pt;1pt = 20 twips)。
const PAGE_W_TWIP = convertMillimetersToTwip(210);
const PAGE_H_TWIP = convertMillimetersToTwip(297);
const MARGIN = { top: 1440, right: 1200, bottom: 1280, left: 1200 };
const CONTENT_W_TWIP = PAGE_W_TWIP - MARGIN.left - MARGIN.right;

export type RenderHaiDocxInput = {
  title: string;
  version: number;
  markdown: string;
  watermark: string;
  metaRight: string; // 例如「任务名 · v2 · 2026-07-25」
};

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[]; indent: number }
  | { type: "ol"; items: string[]; indent: number }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "hr" };

export async function renderHaiDocx(input: RenderHaiDocxInput): Promise<Blob> {
  const body = parseMarkdown(input.markdown).map(blockToParagraphs).flat();
  const doc = new Document({
    creator: "HAI · 教学设计师俱乐部",
    title: input.title,
    styles: { default: { document: { run: { font: FONT_BODY, size: 22, color: C.ink } } } },
    sections: [
      {
        // 封面节:无页脚,内容垂直居中区域由若干空段推到上半部。
        properties: { page: { size: { width: PAGE_W_TWIP, height: PAGE_H_TWIP }, margin: MARGIN } },
        children: coverChildren(input.title, input.metaRight),
      },
      {
        // 正文节:页码从 1 重新计,底部水印 + 页码页脚。
        properties: {
          page: {
            size: { width: PAGE_W_TWIP, height: PAGE_H_TWIP },
            margin: MARGIN,
            pageNumbers: { start: 1 },
          },
        },
        footers: { default: bodyFooter(input.watermark, input.metaRight) },
        children: body,
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** 封面:留白 + eyebrow + 居中大标题 + 装饰短线 + 元信息。 */
function coverChildren(title: string, metaRight: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (let i = 0; i < 5; i++) out.push(new Paragraph({ children: [] }));
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "HAI · 教学设计产物", font: FONT_HEADING, size: 20, color: C.accent, bold: true })],
    }),
  );
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 240 },
      children: [new TextRun({ text: sanitize(title), font: FONT_HEADING, size: 60, color: C.ink, bold: true })],
    }),
  );
  // 装饰短线:用左右缩进 + 段落底边框,画出居中的短线条。
  const sideIndent = Math.max(0, Math.floor((CONTENT_W_TWIP - 1200) / 2));
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      indent: { left: sideIndent, right: sideIndent },
      border: { bottom: { style: BorderStyle.SINGLE, color: C.accent, size: 12, space: 1 } },
      children: [],
    }),
  );
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
      children: [new TextRun({ text: sanitize(metaRight), font: FONT_BODY, size: 22, color: C.muted })],
    }),
  );
  return out;
}

/** 正文页脚:左侧水印,右侧「meta · 第 X / Y 页」(用右制表位对齐),上方一条分隔线。 */
function bodyFooter(watermark: string, metaRight: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, color: C.rule, size: 6, space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W_TWIP }],
        children: [
          new TextRun({ text: sanitize(watermark), font: FONT_BODY, size: 16, color: C.soft }),
          new TextRun({ text: "\t", font: FONT_BODY, size: 16 }),
          new TextRun({ text: `${sanitize(metaRight)} · 第 `, font: FONT_BODY, size: 16, color: C.soft }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 16, color: C.soft }),
          new TextRun({ text: " / ", font: FONT_BODY, size: 16, color: C.soft }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES_IN_SECTION], font: FONT_BODY, size: 16, color: C.soft }),
          new TextRun({ text: " 页", font: FONT_BODY, size: 16, color: C.soft }),
        ],
      }),
    ],
  });
}

function blockToParagraphs(block: Block): Array<Paragraph | Table> {
  switch (block.type) {
    case "h": {
      const size = block.level <= 1 ? 48 : block.level === 2 ? 34 : block.level === 3 ? 28 : 24;
      return [
        new Paragraph({
          spacing: { before: block.level <= 1 ? 400 : block.level === 2 ? 320 : 240, after: 120 },
          children: [
            new TextRun({
              text: sanitize(block.text),
              font: FONT_HEADING,
              size,
              bold: true,
              color: block.level <= 1 ? C.accent : C.ink,
            }),
          ],
        }),
      ];
    }
    case "p": {
      return [
        new Paragraph({
          spacing: { before: 120, after: 120, line: 300 },
          children: [new TextRun({ text: sanitize(block.text), font: FONT_BODY, size: 22, color: C.ink })],
        }),
      ];
    }
    case "ul": {
      return block.items.map((item) => listItemParagraph("•", item, block.indent));
    }
    case "ol": {
      return block.items.map((item, idx) => listItemParagraph(`${idx + 1}.`, item, block.indent));
    }
    case "quote": {
      return [
        new Paragraph({
          spacing: { before: 120, after: 160, line: 280 },
          indent: { left: 320 },
          border: { left: { style: BorderStyle.SINGLE, color: C.quoteBar, size: 18, space: 12 } },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: C.quoteBg },
          children: [new TextRun({ text: sanitize(block.text), font: FONT_BODY, size: 22, color: C.muted })],
        }),
      ];
    }
    case "code": {
      // 每行一个等宽段落,统一底纹,行间无间距,形成连续代码块;等宽字体保留板书图对齐。
      const lines = block.text.split("\n").map((ln) => sanitize(ln));
      return lines.map(
        (ln, idx) =>
          new Paragraph({
            spacing: { before: idx === 0 ? 120 : 0, after: idx === lines.length - 1 ? 160 : 0, line: 240 },
            indent: { left: 200, right: 200 },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: C.codeBg },
            children: [new TextRun({ text: ln || " ", font: FONT_MONO, size: 18, color: C.ink })],
          }),
      );
    }
    case "table": {
      return [buildTable(block.rows)];
    }
    case "hr": {
      return [
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, color: C.rule, size: 6, space: 1 } },
          children: [],
        }),
      ];
    }
  }
}

function listItemParagraph(bullet: string, text: string, indent: number): Paragraph {
  const leftIndent = 360 + Math.min(indent, 8) * 200;
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 280 },
    indent: { left: leftIndent, hanging: 280 },
    children: [
      new TextRun({ text: `${bullet} `, font: FONT_BODY, size: 22, color: C.accent, bold: true }),
      new TextRun({ text: sanitize(text), font: FONT_BODY, size: 22, color: C.ink }),
    ],
  });
}

/** GFM 表格:100% 宽,网格边框 + 表头底色 + 斑马纹,表头行重复。 */
function buildTable(rows: string[][]): Table {
  const cols = rows[0]?.length ?? 0;
  if (cols === 0) return new Paragraph({ children: [] });
  const tableRows = rows.map((row, r) => {
    const isHeader = r === 0;
    const fill = isHeader ? C.tableHeaderBg : r % 2 === 0 ? C.tableZebra : undefined;
    return new TableRow({
      tableHeader: isHeader,
      children: row.slice(0, cols).map(
        (cell) =>
          new TableCell({
            shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: sanitize(cell ?? ""),
                    font: FONT_BODY,
                    size: 20,
                    color: C.ink,
                    bold: isHeader,
                  }),
                ],
              }),
            ],
          }),
      ),
    });
  });
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: tableRows,
  });
}

/** 仅去控制字符(保留换行/制表由调用方先拆行)。Word 支持 emoji 与 BMP 外字符,无需像 pdf-lib 那样过滤。 */
function sanitize(s: string): string {
  return Array.from(s)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (c < 0x20 && ch !== "\t") return false;
      return true;
    })
    .join("");
}

/** 去掉行内强调标记(**、`、~~、链接),保留纯文本(与原 PDF 一致;Word 端不渲染行内富文本)。 */
function stripInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => stripInline(c.trim()));
}

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: stripInline(heading[2].trim()) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows: string[][] = [parseTableRow(line)];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]) && !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(stripInline(lines[i].replace(/^>\s?/, "")));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join("\n") });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      const indent = (line.match(/^(\s*)[-*+]\s+/)?.[1] ?? "").length;
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(stripInline(lines[i].replace(/^\s*[-*+]\s+/, "")));
        i++;
      }
      blocks.push({ type: "ul", items, indent });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      const indent = (line.match(/^(\s*)\d+\.\s+/)?.[1] ?? "").length;
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(stripInline(lines[i].replace(/^\s*\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "ol", items, indent });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*\|.*\|\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s+|>|```|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(stripInline(lines[i]));
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}
