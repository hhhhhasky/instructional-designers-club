export const COURSEWARE_COLOR_SCHEMES = [
  {
    id: "ocean-blue",
    label: "海盐蓝",
    description: "清晰、理性，适合大多数学科。",
    background: "F7F9FC",
    foreground: "172033",
    muted: "667085",
    accent: "2E6BFF",
    secondary: "E6EDFF",
  },
  {
    id: "coral-warm",
    label: "珊瑚暖阳",
    description: "亲和、有活力，适合语文与低年级。",
    background: "FFF8F3",
    foreground: "33231F",
    muted: "7C6258",
    accent: "C94F3D",
    secondary: "F9DED3",
  },
  {
    id: "forest-green",
    label: "森林绿",
    description: "沉静、自然，适合科学与探究课。",
    background: "F5FAF6",
    foreground: "183329",
    muted: "5F766D",
    accent: "2F7D5A",
    secondary: "DCEFE4",
  },
  {
    id: "violet-thinking",
    label: "黛紫思辨",
    description: "聚焦、克制，适合数学与思辨课。",
    background: "F8F6FC",
    foreground: "251E38",
    muted: "6D6279",
    accent: "7254B3",
    secondary: "E8E0F5",
  },
  {
    id: "ink-paper",
    label: "墨白纸感",
    description: "极简、对比强，适合文科与打印。",
    background: "F8F7F2",
    foreground: "181818",
    muted: "66635D",
    accent: "242424",
    secondary: "E5E1D8",
  },
  {
    id: "sky-cyan",
    label: "天青水色",
    description: "通透、轻盈，适合地理与综合实践。",
    background: "F4FBFC",
    foreground: "153238",
    muted: "5E7478",
    accent: "16869A",
    secondary: "D8EFF3",
  },
] as const;

export type CoursewareColorSchemeId = (typeof COURSEWARE_COLOR_SCHEMES)[number]["id"];

export const COURSEWARE_FONT_PAIRINGS = [
  {
    id: "yahei-clear",
    label: "雅黑清晰",
    description: "通用屏幕阅读，Office 兼容性好。",
    titleFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    titleCss: "'Microsoft YaHei', 'PingFang SC', sans-serif",
    bodyCss: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  },
  {
    id: "source-modern",
    label: "思源现代",
    description: "方正中性，适合知识讲解和数据页。",
    titleFontFace: "Source Han Sans CN",
    bodyFontFace: "Source Han Sans CN",
    titleCss: "'Source Han Sans CN', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
    bodyCss: "'Source Han Sans CN', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
  },
  {
    id: "pingfang-light",
    label: "苹方轻盈",
    description: "现代、留白感强，适合简洁展示。",
    titleFontFace: "PingFang SC",
    bodyFontFace: "PingFang SC",
    titleCss: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    bodyCss: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    id: "serif-editorial",
    label: "宋黑编辑",
    description: "标题有书卷感，正文保持清晰。",
    titleFontFace: "Source Han Serif CN",
    bodyFontFace: "Microsoft YaHei",
    titleCss: "'Source Han Serif CN', 'Noto Serif CJK SC', SimSun, serif",
    bodyCss: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  },
  {
    id: "classic-song",
    label: "经典黑宋",
    description: "黑体标题配宋体正文，适合文科材料。",
    titleFontFace: "SimHei",
    bodyFontFace: "SimSun",
    titleCss: "SimHei, 'Microsoft YaHei', sans-serif",
    bodyCss: "SimSun, 'Songti SC', serif",
  },
  {
    id: "kaiti-humanities",
    label: "楷体人文",
    description: "楷体标题配雅黑正文，适合诗文与导入页。",
    titleFontFace: "KaiTi",
    bodyFontFace: "Microsoft YaHei",
    titleCss: "KaiTi, STKaiti, 'Microsoft YaHei', serif",
    bodyCss: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  },
] as const;

export type CoursewareFontPairingId = (typeof COURSEWARE_FONT_PAIRINGS)[number]["id"];

export const COURSEWARE_ANIMATION_PRESETS = [
  {
    id: "none",
    label: "无动画",
    description: "所有内容随页面一次显示。",
  },
  {
    id: "reveal-content",
    label: "内容逐项浮现",
    description: "标题常显，每次单击显示一组内容。",
  },
  {
    id: "reveal-all",
    label: "标题与内容逐项浮现",
    description: "第一次单击显示标题，之后逐项显示内容。",
  },
] as const;

export type CoursewareAnimationPreset = (typeof COURSEWARE_ANIMATION_PRESETS)[number]["id"];

export const COURSEWARE_FLAT_PATTERNS = [
  {
    id: "none",
    label: "无背景图案",
    description: "保留纯色背景和最大留白。",
  },
  {
    id: "layered-orbit",
    label: "轨道圆环",
    description: "用圆形、轨道和色块构成科技感图案。",
  },
  {
    id: "geometric-collage",
    label: "几何拼贴",
    description: "用圆角方块与线条构成编辑感图案。",
  },
  {
    id: "dot-rhythm",
    label: "点阵节奏",
    description: "用规律点阵和少量强调点构成轻量纹理。",
  },
] as const;

export type CoursewareFlatPattern = (typeof COURSEWARE_FLAT_PATTERNS)[number]["id"];

export const DEFAULT_COURSEWARE_COLOR_SCHEME: CoursewareColorSchemeId = "ocean-blue";
export const DEFAULT_COURSEWARE_FONT_PAIRING: CoursewareFontPairingId = "yahei-clear";
export const DEFAULT_COURSEWARE_ANIMATION_PRESET: CoursewareAnimationPreset = "reveal-content";
export const DEFAULT_COURSEWARE_FLAT_PATTERN: CoursewareFlatPattern = "layered-orbit";

export function normalizeCoursewareColorScheme(value: unknown): CoursewareColorSchemeId {
  return COURSEWARE_COLOR_SCHEMES.some((item) => item.id === value)
    ? value as CoursewareColorSchemeId
    : DEFAULT_COURSEWARE_COLOR_SCHEME;
}

export function normalizeCoursewareFontPairing(value: unknown): CoursewareFontPairingId {
  return COURSEWARE_FONT_PAIRINGS.some((item) => item.id === value)
    ? value as CoursewareFontPairingId
    : DEFAULT_COURSEWARE_FONT_PAIRING;
}

export function normalizeCoursewareAnimationPreset(value: unknown): CoursewareAnimationPreset {
  return COURSEWARE_ANIMATION_PRESETS.some((item) => item.id === value)
    ? value as CoursewareAnimationPreset
    : DEFAULT_COURSEWARE_ANIMATION_PRESET;
}

export function normalizeCoursewareFlatPattern(value: unknown): CoursewareFlatPattern {
  return COURSEWARE_FLAT_PATTERNS.some((item) => item.id === value)
    ? value as CoursewareFlatPattern
    : DEFAULT_COURSEWARE_FLAT_PATTERN;
}

export function getCoursewareColorScheme(value: unknown) {
  const id = normalizeCoursewareColorScheme(value);
  return COURSEWARE_COLOR_SCHEMES.find((item) => item.id === id)!;
}

export function getCoursewareFontPairing(value: unknown) {
  const id = normalizeCoursewareFontPairing(value);
  return COURSEWARE_FONT_PAIRINGS.find((item) => item.id === id)!;
}
