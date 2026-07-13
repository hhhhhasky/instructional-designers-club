export interface HaiShareContent {
  question: string;
  answer: string;
}

const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_MAX_HEIGHT = 15000;
export const HAI_SHARE_QR_URL = "/images/hai/hai-register-qr.png";
export const HAI_SHARE_CTA = {
  eyebrow: "HAI 新用户礼遇",
  headline: "注册 HAI，免费送",
  benefit: "10 万 Token",
  promise: "解答你的备课难题",
  qrLabel: "扫码注册 HAI",
} as const;

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
  const [, qrImage] = await Promise.all([
    document.fonts?.ready,
    loadImage(HAI_SHARE_QR_URL),
  ]);

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
  const ctaTop = 48;
  const ctaHeight = 270;
  const questionTop = ctaTop + ctaHeight + 32;
  const requestedHeight = questionTop + questionHeight + 32 + answerHeight + 126;
  const canvasHeight = Math.min(SHARE_IMAGE_MAX_HEIGHT, requestedHeight);

  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = canvasHeight;

  drawShareBackground(context, canvasHeight);

  drawShareCta(context, qrImage, ctaTop, ctaHeight);

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

function drawShareCta(
  context: CanvasRenderingContext2D,
  qrImage: HTMLImageElement,
  top: number,
  height: number,
) {
  const left = 76;
  const width = SHARE_IMAGE_WIDTH - 152;
  drawRoundedRect(context, left, top, width, height, 36, "#244f48");

  context.save();
  roundedRectPath(context, left, top, width, height, 36);
  context.clip();
  const glow = context.createRadialGradient(left + 520, top + 250, 20, left + 520, top + 250, 360);
  glow.addColorStop(0, "rgba(241,181,151,0.25)");
  glow.addColorStop(1, "rgba(241,181,151,0)");
  context.fillStyle = glow;
  context.fillRect(left, top, width, height);
  context.fillStyle = "rgba(255,255,255,0.06)";
  context.beginPath();
  context.arc(left + 690, top - 20, 190, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawRoundedRect(context, 108, top + 28, 176, 39, 20, "rgba(255,255,255,0.14)");
  context.fillStyle = "#f6e8dc";
  context.font = '700 20px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText(HAI_SHARE_CTA.eyebrow, 126, top + 55);

  context.fillStyle = "#ffffff";
  context.font = '700 38px "Noto Serif SC", "Songti SC", serif';
  context.fillText(HAI_SHARE_CTA.headline, 108, top + 121);
  context.fillStyle = "#f1b597";
  context.font = '900 50px "Noto Serif SC", "Songti SC", serif';
  context.fillText(HAI_SHARE_CTA.benefit, 108, top + 181);
  context.fillStyle = "rgba(255,255,255,0.84)";
  context.font = '400 25px "LXGW WenKai", "PingFang SC", sans-serif';
  context.fillText(HAI_SHARE_CTA.promise, 108, top + 226);

  drawRoundedRect(context, 804, top + 24, 168, 168, 22, "#ffffff");
  context.drawImage(qrImage, 814, top + 34, 148, 148);
  context.fillStyle = "rgba(255,255,255,0.82)";
  context.font = '700 21px "LXGW WenKai", "PingFang SC", sans-serif';
  context.textAlign = "center";
  context.fillText(HAI_SHARE_CTA.qrLabel, 888, top + 228);
  context.textAlign = "left";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("HAI 二维码加载失败"));
    image.src = src;
  });
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
