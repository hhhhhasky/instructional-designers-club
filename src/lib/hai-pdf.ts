/**
 * HAI 产物 Markdown → PDF 文本流式排版器。
 *
 * 思路对齐 reportlab Platypus(见 pdf skill):把 markdown 解析成块(标题/段落/列表/
 * 引用/代码/表格/分隔线),用流式 y 坐标逐块绘制,自动分页,中文用嵌入的思源宋体
 * (衬线体),首页是封面(标题 + 元信息),每页底部统一绘制水印页脚。
 * 产物为可选文字的矢量 PDF,中英文清晰、排版规整。
 */
import { PDFDocument, PDFFont, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONT_URL = "/fonts/SourceHanSerifCN-Regular.otf";
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 60;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 64; // 含页脚区
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const C = {
  ink: rgb(0.16, 0.13, 0.11),
  muted: rgb(0.38, 0.34, 0.29),
  soft: rgb(0.55, 0.50, 0.44),
  accent: rgb(0.62, 0.18, 0.16), // 封面/标题用的暗红,衬线书卷气
  rule: rgb(0.84, 0.79, 0.72),
  quoteBar: rgb(0.62, 0.18, 0.16),
  codeBg: rgb(0.965, 0.94, 0.89),
  quoteBg: rgb(0.975, 0.95, 0.91),
  tableBorder: rgb(0.78, 0.72, 0.64),
  tableHeaderBg: rgb(0.93, 0.88, 0.79),
  tableZebra: rgb(0.985, 0.97, 0.945),
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

export type RenderHaiPdfInput = {
  title: string;
  version: number;
  markdown: string;
  watermark: string;
  metaRight: string; // 例如「任务名 · v2 · 2026-07-25」
};

export async function renderHaiPdf(input: RenderHaiPdfInput): Promise<Uint8Array> {
  const fontBytes = await fetch(FONT_URL).then((r) => {
    if (!r.ok) throw new Error("中文字体加载失败,请检查网络后重试。");
    return r.arrayBuffer();
  });
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // 关闭子集化:fontkit 对思源宋体这类大字符集 CJK 字体做 subset 会损坏 cmap,
  // 导致中文全部错位乱码。嵌入完整字体(文件略大,但渲染正确)。
  const font = await pdf.embedFont(fontBytes, { subset: false });
  pdf.setTitle(input.title);
  pdf.setCreator("HAI · 教学设计师俱乐部");

  const ctx = new LayoutContext(pdf, font);
  ctx.drawCover(input.title, input.metaRight);
  for (const block of parseMarkdown(input.markdown)) {
    ctx.drawBlock(block);
  }
  ctx.drawFooters(input.watermark, input.metaRight);
  return pdf.save();
}

class LayoutContext {
  pdf: PDFDocument;
  font: PDFFont;
  pages: PDFPage[];
  y: number; // 距页面顶部

  constructor(pdf: PDFDocument, font: PDFFont) {
    this.pdf = pdf;
    this.font = font;
    this.pages = [pdf.addPage([PAGE_W, PAGE_H])];
    this.y = MARGIN_TOP;
  }

  get page() {
    return this.pages[this.pages.length - 1];
  }
  get contentBottom() {
    return PAGE_H - MARGIN_BOTTOM;
  }
  pdfY() {
    return PAGE_H - this.y;
  }

  ensure(space: number) {
    if (this.y + space > this.contentBottom) {
      this.pages.push(this.pdf.addPage([PAGE_W, PAGE_H]));
      this.y = MARGIN_TOP;
    }
  }

  gap(h: number) {
    this.y += h;
  }

  private paintText(line: string, x: number, size: number, color: ReturnType<typeof rgb>) {
    try {
      this.page.drawText(line, { x, y: this.pdfY() - size, size, font: this.font, color });
    } catch {
      // 字体缺字等极端情况:跳过该行,不中断整体渲染。
    }
  }

  private paintCentered(text: string, page: PDFPage, y: number, size: number, color: ReturnType<typeof rgb>, maxWidth: number) {
    for (const line of wrapText(sanitize(text), this.font, size, maxWidth)) {
      const w = this.font.widthOfTextAtSize(line, size);
      try {
        page.drawText(line, { x: (PAGE_W - w) / 2, y, size, font: this.font, color });
      } catch {
        // 忽略缺字。
      }
      y -= size * 1.4;
    }
  }

  /** 封面页:eyebrow + 居中大标题 + 装饰线 + 元信息,占满首页,正文从下一页开始。 */
  drawCover(title: string, metaRight: string) {
    const page = this.pages[0];
    const titleSize = 30;
    const titleLines = wrapText(sanitize(title), this.font, titleSize, PAGE_W - 140);
    const lineGap = titleSize * 1.35;
    const titleTop = PAGE_H * 0.46;

    // eyebrow(与大标题保持足够留白,避免视觉上贴在一起)
    this.paintCentered("HAI · 教学设计产物", page, titleTop + 58, 10, C.accent, PAGE_W - 200);

    // 标题
    let ty = titleTop;
    for (const line of titleLines) {
      const w = this.font.widthOfTextAtSize(line, titleSize);
      try {
        page.drawText(line, { x: (PAGE_W - w) / 2, y: ty, size: titleSize, font: this.font, color: C.ink });
      } catch {
        // 忽略缺字。
      }
      ty -= lineGap;
    }
    // 装饰短线
    page.drawLine({
      start: { x: PAGE_W / 2 - 30, y: ty - 2 },
      end: { x: PAGE_W / 2 + 30, y: ty - 2 },
      thickness: 1.2,
      color: C.accent,
    });
    // 元信息
    this.paintCentered(metaRight, page, ty - 30, 11, C.muted, PAGE_W - 200);

    // 封面结束,正文从新页开始
    this.pages.push(this.pdf.addPage([PAGE_W, PAGE_H]));
    this.y = MARGIN_TOP;
  }

  drawParagraph(text: string, opts: { x: number; size: number; color: ReturnType<typeof rgb>; lineHeight: number; maxWidth: number }) {
    for (const line of wrapText(sanitize(text), this.font, opts.size, opts.maxWidth)) {
      this.ensure(opts.lineHeight);
      this.paintText(line, opts.x, opts.size, opts.color);
      this.y += opts.lineHeight;
    }
  }

  drawBlock(block: Block) {
    switch (block.type) {
      case "h": {
        const size = block.level <= 1 ? 24 : block.level === 2 ? 17 : block.level === 3 ? 14 : 12;
        this.gap(block.level <= 1 ? 20 : block.level === 2 ? 16 : 12);
        this.drawParagraph(block.text, {
          x: MARGIN_X,
          size,
          color: block.level <= 1 ? C.accent : C.ink,
          lineHeight: Math.round(size * 1.42),
          maxWidth: CONTENT_W,
        });
        this.gap(block.level <= 2 ? 9 : 6);
        break;
      }
      case "p": {
        this.gap(6);
        this.drawParagraph(block.text, { x: MARGIN_X, size: 11, color: C.ink, lineHeight: 22, maxWidth: CONTENT_W });
        this.gap(6);
        break;
      }
      case "ul": {
        this.gap(5);
        for (const item of block.items) this.drawListItem("•", item, Math.min(block.indent, 8) * 3);
        this.gap(6);
        break;
      }
      case "ol": {
        this.gap(5);
        block.items.forEach((item, idx) => this.drawListItem(`${idx + 1}.`, item, Math.min(block.indent, 8) * 3));
        this.gap(6);
        break;
      }
      case "quote": {
        this.gap(6);
        this.drawBox(block.text, { size: 11, lineHeight: 19, indent: 16, color: C.muted, bg: C.quoteBg, bar: C.quoteBar });
        this.gap(8);
        break;
      }
      case "code": {
        this.gap(6);
        this.drawCode(block.text);
        this.gap(8);
        break;
      }
      case "table": {
        this.gap(6);
        this.drawTable(block.rows);
        this.gap(8);
        break;
      }
      case "hr": {
        this.gap(10);
        this.ensure(14);
        this.page.drawLine({
          start: { x: MARGIN_X, y: this.pdfY() },
          end: { x: PAGE_W - MARGIN_X, y: this.pdfY() },
          thickness: 0.6,
          color: C.rule,
        });
        this.gap(12);
        break;
      }
    }
  }

  drawListItem(bullet: string, text: string, indentOffset = 0) {
    const indent = 22 + indentOffset;
    const lineH = 22;
    const lines = wrapText(sanitize(text), this.font, 11, CONTENT_W - indent);
    this.ensure(lines.length * lineH + 3);
    this.paintText(bullet, MARGIN_X + 2 + indentOffset, 11, C.accent);
    for (const line of lines) {
      this.paintText(line, MARGIN_X + indent, 11, C.ink);
      this.y += lineH;
    }
    this.y += 3;
  }

  drawBox(text: string, opts: { size: number; lineHeight: number; indent: number; color: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb>; bar: ReturnType<typeof rgb> }) {
    const lines = wrapText(sanitize(text), this.font, opts.size, CONTENT_W - opts.indent - 8);
    const blockH = lines.length * opts.lineHeight + 16;
    this.ensure(blockH);
    const top = this.pdfY();
    this.page.drawRectangle({ x: MARGIN_X, y: top - blockH + 8, width: CONTENT_W, height: blockH, color: opts.bg });
    this.page.drawRectangle({ x: MARGIN_X, y: top - blockH + 8, width: 3, height: blockH, color: opts.bar });
    this.gap(11);
    for (const line of lines) {
      this.paintText(line, MARGIN_X + opts.indent, opts.size, opts.color);
      this.y += opts.lineHeight;
    }
  }

  /**
   * 代码块渲染。含框线字符(U+2500-257F,常见于板书设计图)的代码块走等宽栅格:
   * 1 个 CJK/全角字符占 2 格,其余占 1 格,逐字符按栅格落位,整图按最宽行缩放进内容区,
   * 让模型生成的 ASCII 板书图保持原本的对齐结构。普通代码块仍按行左对齐(衬线体)。
   */
  drawCode(text: string) {
    // 先按换行拆分,再逐行 sanitize:sanitize 会删掉控制字符(含 \n),
    // 若先 sanitize 后 split 会把整个代码块压成一行,板书图全部挤到同一基线。
    const codeLines = text.split("\n").map((ln) => sanitize(ln));
    const padX = 12;
    const lineH = 14;
    const blockH = codeLines.length * lineH + 16;
    this.ensure(blockH);
    const top = this.pdfY();
    this.page.drawRectangle({ x: MARGIN_X, y: top - blockH + 8, width: CONTENT_W, height: blockH, color: C.codeBg });
    this.gap(11);

    const hasArt = codeLines.some((ln) => /[─-╿]/.test(ln));
    if (!hasArt) {
      const size = 9;
      for (const ln of codeLines) {
        this.paintText(ln, MARGIN_X + padX, size, C.ink);
        this.y += lineH;
      }
      return;
    }

    // 等宽栅格:1 CJK = 2 格。cellW 取半个 CJK 字宽,使 CJK 恰好占满 2 格。
    const cellCounts = codeLines.map(countCells);
    const maxCells = Math.max(1, ...cellCounts);
    const avail = CONTENT_W - padX * 2;
    let size = 9;
    const cellWFor = (s: number) => this.font.widthOfTextAtSize("字", s) / 2;
    let cellW = cellWFor(size);
    if (maxCells * cellW > avail) {
      // 整图过宽:按比例缩小字号,直到能塞进内容区(下限 5pt 保可读)。
      size = Math.max(5, (size * avail) / (maxCells * cellW));
      cellW = cellWFor(size);
    }
    for (const ln of codeLines) {
      const baseY = this.pdfY() - size;
      let cx = MARGIN_X + padX;
      for (const ch of ln) {
        try {
          this.page.drawText(ch, { x: cx, y: baseY, size, font: this.font, color: C.ink });
        } catch {
          // 缺字跳过。
        }
        cx += cellW * (isFullwidth(ch) ? 2 : 1);
      }
      this.y += lineH;
    }
  }

  /** GFM 表格:列宽按各列内容比例分配并 clamp,网格边框 + 表头底色 + 斑马纹,行粒度分页。 */
  drawTable(rows: string[][]) {
    const cols = rows[0]?.length ?? 0;
    if (cols === 0) return;
    const size = 10;
    const lineH = 14;
    const padX = 7;
    const padY = 6;

    // 列宽:每列 natural = 该列单元格自然宽度(不换行最大值),clamp 到 [minCol, capNatural],
    // 再按比例归一化到内容区宽度。cap 防止某列过长内容独占宽度,导致其他列被挤窄重叠。
    const minCol = 80;
    const capNatural = 220;
    const natural: number[] = [];
    for (let c = 0; c < cols; c++) {
      let raw = 0;
      for (const row of rows) {
        const w = this.font.widthOfTextAtSize(row[c] ?? "", size) + padX * 2;
        if (w > raw) raw = w;
      }
      natural.push(Math.min(Math.max(raw, minCol), capNatural));
    }
    const sumNat = natural.reduce((a, b) => a + b, 0);
    const colWidths = natural.map((w) => (w / sumNat) * CONTENT_W);
    const tableW = colWidths.reduce((a, b) => a + b, 0);

    // 预先换行每个单元格,行高取该行最大单元格行数。maxWidth 严格按列宽,绝不溢出到邻列。
    const cellLines: string[][][] = [];
    const rowHeights: number[] = [];
    for (let r = 0; r < rows.length; r++) {
      const cells: string[][] = [];
      let maxLines = 1;
      for (let c = 0; c < cols; c++) {
        const maxW = Math.max(colWidths[c] - padX * 2, 10);
        const lines = wrapText(rows[r][c] ?? "", this.font, size, maxW);
        cells.push(lines);
        if (lines.length > maxLines) maxLines = lines.length;
      }
      cellLines.push(cells);
      rowHeights.push(maxLines * lineH + padY * 2);
    }

    for (let r = 0; r < rows.length; r++) {
      const h = rowHeights[r];
      this.ensure(h); // 行粒度分页:整行不拆。
      const top = this.pdfY();
      const isHeader = r === 0;
      const bg = isHeader ? C.tableHeaderBg : r % 2 === 0 ? C.tableZebra : null;
      if (bg) {
        this.page.drawRectangle({ x: MARGIN_X, y: top - h, width: tableW, height: h, color: bg });
      }
      // 单元格文字
      for (let c = 0; c < cols; c++) {
        let textY = top - padY - size;
        const cellX = MARGIN_X + colOffset(colWidths, c) + padX;
        for (const ln of cellLines[r][c]) {
          try {
            this.page.drawText(ln, { x: cellX, y: textY, size, font: this.font, color: C.ink });
          } catch {
            // 缺字跳过。
          }
          textY -= lineH;
        }
      }
      // 网格边框:第一行画顶线,每行画底线 + 各列竖线
      const lineOpts = { thickness: 0.5, color: C.tableBorder };
      if (r === 0) {
        this.page.drawLine({ start: { x: MARGIN_X, y: top }, end: { x: MARGIN_X + tableW, y: top }, ...lineOpts });
      }
      this.page.drawLine({ start: { x: MARGIN_X, y: top - h }, end: { x: MARGIN_X + tableW, y: top - h }, ...lineOpts });
      let cx = MARGIN_X;
      for (let c = 0; c <= cols; c++) {
        this.page.drawLine({ start: { x: cx, y: top }, end: { x: cx, y: top - h }, ...lineOpts });
        if (c < cols) cx += colWidths[c];
      }
      this.y += h;
    }
  }

  drawFooters(watermark: string, metaRight: string) {
    const total = this.pages.length;
    this.pages.forEach((page, idx) => {
      if (idx === 0) return; // 封面页不画页脚(封面已含元信息)
      const baseY = 32;
      page.drawLine({
        start: { x: MARGIN_X, y: baseY + 14 },
        end: { x: PAGE_W - MARGIN_X, y: baseY + 14 },
        thickness: 0.5,
        color: C.rule,
      });
      try {
        page.drawText(sanitize(watermark), { x: MARGIN_X, y: baseY, size: 8, font: this.font, color: C.soft });
      } catch {
        // 忽略缺字。
      }
      const right = `${sanitize(metaRight)} · 第 ${idx}/${total - 1} 页`;
      const w = this.font.widthOfTextAtSize(right, 8);
      try {
        page.drawText(right, { x: PAGE_W - MARGIN_X - w, y: baseY, size: 8, font: this.font, color: C.soft });
      } catch {
        // 忽略缺字。
      }
    });
  }
}

function colOffset(widths: number[], idx: number): number {
  let s = 0;
  for (let i = 0; i < idx; i++) s += widths[i];
  return s;
}

/** 判断字符是否为全角/CJK(在等宽栅格中占 2 格)。框线字符 U+2500-257F 不在此列,按 1 格。 */
function isFullwidth(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    c === 0x2014 || // — 全角破折号
    c === 0x2015 || // ― 水平线
    c === 0x2026 || // … 省略号
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3040 && c <= 0x33bf) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa000 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6)
  );
}

/** 按等宽栅格计算一行占多少格(全角=2,半角=1),用于整图缩放。 */
function countCells(line: string): number {
  let n = 0;
  for (const ch of line) n += isFullwidth(ch) ? 2 : 1;
  return n;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let cur = "";
    for (const ch of para) {
      const test = cur + ch;
      if (font.widthOfTextAtSize(test, size) > maxWidth && cur.length > 0) {
        out.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    out.push(cur);
  }
  return out;
}

/** 去掉补充平面字符(emoji 等)与控制字符,保留思源宋体能覆盖的 BMP 常用字符。 */
function sanitize(s: string): string {
  return Array.from(s)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (c > 0xffff) return false;
      if (c < 0x20 && ch !== "\t") return false;
      return true;
    })
    .join("");
}

/** 去掉行内强调标记(**、`、~~、链接),保留纯文本(pdf-lib drawText 不支持富文本)。 */
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
      i++; // 跳过结束围栏
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
    // GFM 表格:首行 |...|,次行 |:---|:---|
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
