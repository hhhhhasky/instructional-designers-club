export interface HaiShareContent {
  question: string;
  answer: string;
}

export type HaiShareResult = "shared" | "downloaded" | "cancelled";

const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_MAX_HEIGHT = 15000;

export async function copyHaiAnswer(content: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("浏览器未允许复制");
}

export async function createHaiShareImage({ question, answer }: HaiShareContent): Promise<Blob> {
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成分享图");

  const questionText = markdownToShareText(question);
  const answerText = markdownToShareText(answer);
  const contentWidth = SHARE_IMAGE_WIDTH - 152;
  const questionFont = '700 38px "Noto Serif SC", "Songti SC", serif';
  const answerFont = '400 32px "LXGW WenKai", "PingFang SC", sans-serif';

  context.font = questionFont;
  const questionLines = wrapCanvasText(context, questionText, contentWidth - 80);
  context.font = answerFont;
  const answerLines = wrapCanvasText(context, answerText, contentWidth - 80);

  const questionHeight = Math.max(128, questionLines.length * 58 + 80);
  const answerHeight = Math.max(220, answerLines.length * 52 + 112);
  const requestedHeight = 184 + questionHeight + 32 + answerHeight + 150;
  const canvasHeight = Math.min(SHARE_IMAGE_MAX_HEIGHT, requestedHeight);

  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = canvasHeight;

  drawShareBackground(context, canvasHeight);

  context.fillStyle = "#2c2420";
  context.font = '900 48px "Noto Serif SC", "Songti SC", serif';
  context.fillText("HAI", 76, 96);
  context.fillStyle = "#806f65";
  context.font = '400 25px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText("问问哈老师 · 教学设计咨询", 184, 91);

  const questionTop = 142;
  drawRoundedRect(context, 76, questionTop, contentWidth, questionHeight, 34, "#c45d3e");
  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = '700 23px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText("我的问题", 116, questionTop + 49);
  context.fillStyle = "#ffffff";
  context.font = questionFont;
  drawTextLines(context, questionLines, 116, questionTop + 103, 58, questionTop + questionHeight - 34);

  const answerTop = questionTop + questionHeight + 32;
  const availableAnswerHeight = canvasHeight - answerTop - 114;
  drawRoundedRect(context, 76, answerTop, contentWidth, availableAnswerHeight, 34, "#fffdf9");
  context.strokeStyle = "#e5d9cf";
  context.lineWidth = 2;
  strokeRoundedRect(context, 76, answerTop, contentWidth, availableAnswerHeight, 34);
  context.fillStyle = "#c45d3e";
  context.font = '700 24px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText("HAI 的回答", 116, answerTop + 54);
  context.fillStyle = "#3b302a";
  context.font = answerFont;
  const lastDrawnLine = drawTextLines(
    context,
    answerLines,
    116,
    answerTop + 112,
    52,
    answerTop + availableAnswerHeight - 44,
  );
  if (lastDrawnLine < answerLines.length) {
    const fadeTop = answerTop + availableAnswerHeight - 122;
    const fade = context.createLinearGradient(0, fadeTop, 0, answerTop + availableAnswerHeight);
    fade.addColorStop(0, "rgba(255,253,249,0)");
    fade.addColorStop(0.48, "#fffdf9");
    context.fillStyle = fade;
    context.fillRect(90, fadeTop, contentWidth - 28, 122);
    context.fillStyle = "#806f65";
    context.font = '400 23px "LXGW WenKai", "PingFang SC", sans-serif';
    context.textAlign = "right";
    context.fillText("回答较长，复制原文可查看完整内容", 1000, answerTop + availableAnswerHeight - 42);
    context.textAlign = "left";
  }

  context.fillStyle = "#9b8b82";
  context.font = '400 22px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText("教学设计师俱乐部", 76, canvasHeight - 48);
  context.textAlign = "right";
  context.fillText("让每一次备课，都更接近学习发生", 1004, canvasHeight - 48);
  context.textAlign = "left";

  return canvasToBlob(canvas);
}

export async function shareHaiExchange(content: HaiShareContent): Promise<HaiShareResult> {
  const blob = await createHaiShareImage(content);
  const filename = `HAI-教学咨询-${formatFileDate(new Date())}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        files: [file],
        title: "HAI 教学咨询",
        text: "分享一段来自 HAI 的教学设计咨询",
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Some desktop browsers expose share() but reject file sharing at runtime.
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

export function markdownToShareText(markdown: string): string {
  return markdown
    .replace(/<summary>([\s\S]*?)<\/summary>/gi, "$1\n")
    .replace(/<\/?details>/gi, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph.trim()) {
      if (lines[lines.length - 1] !== "") lines.push("");
      return;
    }

    let line = "";
    for (const character of Array.from(paragraph)) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line.trimEnd());
    if (paragraphIndex < paragraphs.length - 1 && paragraphs[paragraphIndex + 1]?.trim()) lines.push("");
  });

  return lines.length ? lines : [""];
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  maxY: number,
): number {
  let drawn = 0;
  for (const line of lines) {
    const y = startY + drawn * lineHeight;
    if (y > maxY) break;
    if (line) context.fillText(line, x, y);
    drawn += 1;
  }
  return drawn;
}

function drawShareBackground(context: CanvasRenderingContext2D, height: number) {
  context.fillStyle = "#f5efe7";
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, height);

  const glow = context.createRadialGradient(980, 80, 20, 980, 80, 330);
  glow.addColorStop(0, "rgba(196,93,62,0.16)");
  glow.addColorStop(1, "rgba(196,93,62,0)");
  context.fillStyle = glow;
  context.fillRect(650, 0, 430, 420);

  context.fillStyle = "rgba(42,122,110,0.08)";
  context.beginPath();
  context.arc(50, height - 110, 170, 0, Math.PI * 2);
  context.fill();
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("分享图生成失败"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatFileDate(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}${pick("month")}${pick("day")}`;
}
