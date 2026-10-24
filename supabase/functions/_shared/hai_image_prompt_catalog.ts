// Pure shared catalog: used by the configuration editor and image runtimes.
import { IMAGE_STYLE_PRESETS, imageStyleLabel } from "./hai_image_styles.ts";

export type ImagePromptDefinition = {
  key: string;
  label: string;
  group: "通用生图" | "视觉风格" | "图片 PPT" | "课件配图";
  description: string;
  defaultValue: string;
};
export type ImagePromptOverrides = Record<string, string>;
const entry = (
  id: string,
  label: string,
  group: ImagePromptDefinition["group"],
  description: string,
  defaultValue: string,
): ImagePromptDefinition => ({
  key: `image_prompt.${id}`,
  label,
  group,
  description,
  defaultValue,
});
export const IMAGE_PROMPT_CATALOG: ImagePromptDefinition[] = [
  entry(
    "compose",
    "生图总模板",
    "通用生图",
    "所有独立生图和图片 PPT 在提交给生图服务前，使用这份模板拼装尺寸、风格与用户要求。",
    "图片尺寸：{{size}}\n{{subject_line}}视觉风格：{{style_label}}。{{style_prompt}}\n生成图类型：{{image_type}}。\n{{reference_line}}\n用户原始要求：\n{{prompt}}",
  ),
  entry(
    "reference",
    "参考图修改规则",
    "通用生图",
    "上传参考图或沿用上一轮图片时，加入总模板。",
    "参考图片：按用户要求修改，保留未指定修改的内容。",
  ),
  ...Object.entries(IMAGE_STYLE_PRESETS).map(([id, preset]) =>
    entry(
      `style.${id}`,
      preset.label,
      "视觉风格",
      "独立生图与图片 PPT 共用。修改后用于后续新生成的图片与整套风格设定。",
      preset.prompt,
    )
  ),
  entry(
    "ppt.outline",
    "文字大纲输入模板",
    "图片 PPT",
    "与 Work Skill 中的“大纲阶段”指令一起发给文本模型。",
    "根据以下输入生成课件文字大纲。\n学科：{{subject}}\n年级：{{grade}}\n用户补充需求：{{requirements}}\n教学流程：\n{{flow}}",
  ),
  entry(
    "ppt.feedback",
    "大纲追改模板",
    "图片 PPT",
    "用户提出大纲修改意见时追加。",
    "\n本轮修改意见：{{feedback}}\n当前编辑的完整大纲：\n{{outline}}",
  ),
  entry(
    "ppt.settings",
    "共用设定输入模板",
    "图片 PPT",
    "与 Work Skill 中的“共用设定阶段”指令一起发给文本模型。",
    "根据已选风格与确认大纲确定整套共用设定。\n现有风格提示词：{{style_prompt}}\n已确认课程信息：{{course}}\n已确认大纲：{{outline}}",
  ),
  entry(
    "ppt.page",
    "逐页出图总模板",
    "图片 PPT",
    "将已确认大纲和整套设定组装为每页出图要求，再进入生图总模板。",
    `生成一张完整16:9课堂PPT页面，页面序号{{page_number}}/{{total}}。艺术风格只使用请求中已有的风格要求。
整套共用设定（字体、参考字号、位置、HEX色号、课程信息必须沿用，不重新设计）：
{{settings}}
本页标题：{{title}}
{{page_content}}
导航使用“{{navigation}}”，页码使用“{{page_number}} / {{total}}”。封面可显示完整单元、课题与已提供教师信息，正文仅保留简洁导航；没有提供的课程信息省略。字号按统一画布参考保持视觉层级，正文过多时清楚分区，不删字。不要画PPT软件界面、水印、占位文字或额外课程名称。`,
  ),
  entry(
    "ppt.markdown_page",
    "完整页面说明执行规则",
    "图片 PPT",
    "采用 Markdown 页面说明的大纲，使用此模板传入每页内容。",
    `本页已确认的完整页面说明：
{{content_markdown}}
按本页说明区分学生实际看到的文字、配图与排版建议。投屏文字逐字保留；配图／排版说明及教学环节标签用于执行，不作为文字印到页面上。允许只有标题或图像为主的页面，不补凑正文。不增加答案、材料或额外栏目。`,
  ),
  entry(
    "ppt.legacy_page",
    "结构化页面执行规则",
    "图片 PPT",
    "兼容历史结构化大纲的逐页出图。",
    `本页学生投屏文字（逐字保留，不改写，不增加答案或虚构材料）：
{{text}}
本页配图内容：{{image_description}}
参考排版：{{layout}}
所属教学环节：{{section}}`,
  ),
  entry(
    "ppt.default_image",
    "缺少配图说明时的要求",
    "图片 PPT",
    "历史大纲没有单独配图说明时使用。",
    "根据文字内容组织页面，不添加无关插图。",
  ),
  entry(
    "ppt.default_layout",
    "缺少排版说明时的要求",
    "图片 PPT",
    "历史大纲没有单独排版说明时使用。",
    "根据内容灵活构图，沿用整套标题和导航位置。",
  ),
  entry(
    "courseware.style",
    "整套配图风格模板",
    "课件配图",
    "使用课件视觉方案中的画风、色板、光线等信息。",
    "统一画风：{{illustration_style}}；统一色板：{{palette}}；统一光线：{{lighting}}；统一质感：{{texture}}；写实程度：{{realism}}；统一视觉语言：清晰线条、适度留白、教育展示友好",
  ),
  entry(
    "courseware.background",
    "课件背景图模板",
    "课件配图",
    "V2 图文课件，以及没有专属整页提示词的页面使用。",
    `为《{{title}}》这同一份教学PPT生成第{{page_number}}页“{{slide_title}}”的{{role}}图片。
{{style}}
本页画面需求：{{description}}。
16:9 全景背景图，整页铺满PPT画布；主体和主要视觉重心根据本页文字排版需要避开文字密集区，保留可读的文字安全区；不要生成窄幅插图、边框装饰或独立素材，不要在图片中绘制标题。
图片放置规则：统一作为整页 background，使用 cover 铺满 16:9 画布；文字层由PPT原生组件独立叠放。
整套图片保持同一美术系统：色调、媒介、线条、光线、质感和写实程度一致；每页的具体人物、景物、物体与场景只由本页需求决定，不继承封面或其他页面的具体意象，不把单个案例扩展为整节课的固定主视觉。
16:9 横版，适合课堂投影。画面内严禁出现文字、字母、数字、标志、logo、水印、界面截图或边框外内容。`,
  ),
  entry(
    "courseware.generated_page",
    "模型生成的整页提示词模板",
    "课件配图",
    "V3 纯图片课件：页面提示词本身由 AI 课件 Skill 生成，此处可维护统一追加或包装规则。",
    "{{image_prompt}}",
  ),
  entry(
    "courseware.visual_design",
    "整体视觉设计指令",
    "课件配图",
    "旧版纯图片课件确认大纲后，生成供用户确认的整体视觉设计。",
    "你是 HAI 纯图片PPT的整套视觉总监。根据已经确认的 PPT 大纲，只输出一段给用户确认的“整体视觉设计”，不要生成逐页提示词、不要生成图片提示词、不要复述逐页文字、不要输出 JSON。\n\n这一段必须明确说清：整体气质与适用学段、主色/辅助色/背景色及对比关系、写实/插画/卡通/抽象等图片艺术风格、人物与场景的统一程度、光线与质感、中文字体与标题/正文层级、16:9 画面的构图和投影可读性。不得把某一页的具体人物、景物或物体当成整套固定意象。长度控制在 180—600 个中文字，用一至两个自然段表达。\n\n课程：{{subject}}，{{grade}}，{{topic}}\n已确认大纲：\n{{outline}}",
  ),
  entry(
    "courseware.image_planning",
    "逐页生图提示词设计指令",
    "课件配图",
    "旧版纯图片课件把确认大纲转换为逐页生图提示词时使用。输出结构须保持兼容。",
    '你是 HAI 纯图片PPT的逐页生图提示词设计器。下面的逐页内容稿已经确定教学顺序和全部学生可见素材。你的任务不是重新写课件，而是把每一页转换成一个可直接交给图片 API 的、可执行的中文生图提示词。\n\n输出且只能输出 JSON：{"schemaVersion":"hai_courseware_image_prompts_v1","visualProfile":{"illustrationStyle":"统一媒介与风格","palette":["颜色"],"lighting":"统一光线","texture":"统一质感","realismLevel":"统一写实程度","visualKeywords":["风格关键词"]},"pages":[{"pageId":"P01","prompt":"完整的逐页生图提示词","negativePrompt":"禁止项","visibleText":["必须在图片中原样排版的学生可见文字"]}]}\n\n严格规则：\n1. pages 必须与内容稿页数完全一致，按 P01、P02……顺序输出，不能遗漏、合并或新增页面。\n2. 每页 prompt 必须明确：16:9 横版、1K、教育投影场景、页面构图、视觉重心、层级、留白和文字安全区；同一套课件必须严格执行用户已确认的整体视觉设计并使用同一 visualProfile，但每页的具体场景只由本页内容决定。\n3. 纯图片PPT中没有可编辑文字层，因此 prompt 必须要求图片自身排版本页全部学生可见文字。visibleText 必须从本页 title 和 materials 原样提取，不能改写、缩写、翻译、补充答案或遗漏题干、条件、选项、步骤、数据和结论。教师备注、来源摘录中的教师说明不得放进图片。\n4. 中文文字要使用清晰的现代无衬线字体，标题与正文有明确字号层级，文字放在安全区内，避免与主体重叠；如果文字很多，要通过卡片、分栏、流程、时间线或信息层级排版，而不是删字或用小到不可读的字。\n5. 图片应是完整的一页课件画面，而不是背景素材、照片、海报模板或局部插图；不要生成 PPT 软件界面、边框外内容、logo、水印、随机字母、乱码或虚构事实。negativePrompt 写清楚这些禁止项。\n6. prompt 中可以复述 visibleText，且必须把要渲染的文字用【页面文字】区块列出并标明“逐字保留”。不要只写‘根据内容生成’或‘见大纲’。\n\n课程：{{subject}}，{{grade}}，{{topic}}；页数档位：{{length}}；画面比例：16:9；分辨率：1K\n用户已确认的整体视觉设计：\n{{visual_design}}\n\n逐页内容稿：\n{{outline}}',
  ),
  entry(
    "courseware.outline_rule",
    "纯图片大纲补充规则",
    "课件配图",
    "旧版课件大纲阶段对纯图片页面文字与画面需求的补充要求。",
    "纯图片PPT规则：每页最终只有一张 16:9 图片，图片本身必须承载本页学生要看的标题、正文、题目、材料、选项、步骤、数据和结论；所有学生可见文字必须逐字出现在 materials 中，不能只写‘见教案’。imageDescription 必须描述本页场景、构图、视觉层级、文字安全区和适合图片内排版的留白；不要写教师备注。后续阶段会把本页完整材料转换为生图提示词。",
  ),
  entry(
    "courseware.default_visual",
    "未提供视觉设定时的默认要求",
    "课件配图",
    "旧版纯图片课件未提供整体视觉设计时使用。",
    "使用适合学科和学段的统一现代教育视觉风格。",
  ),
  entry(
    "courseware.visual_system",
    "整体视觉设计角色指令",
    "课件配图",
    "旧版纯图片课件视觉设计阶段的系统角色提示词。",
    "你只为已确认的纯图片PPT大纲制定一套可供用户确认的整体视觉设计。",
  ),
  entry(
    "courseware.planning_system",
    "逐页提示词角色指令",
    "课件配图",
    "旧版纯图片课件逐页生图规划阶段的系统角色提示词。",
    "你只依据已确认大纲和整体视觉设计生成内部逐页生图参数，必须保留全部学生可见文字。",
  ),
];
const definitions = new Map(
  IMAGE_PROMPT_CATALOG.map((definition) => [definition.key, definition]),
);
export function imagePromptVariables(value: string): string[] {
  return [
    ...new Set(
      Array.from(value.matchAll(/\{\{\s*([\w]+)\s*\}\}/g), (match) => match[1]),
    ),
  ];
}
export function validateImagePrompt(key: string, value: string): string | null {
  const definition = definitions.get(key);
  if (!definition) return "未知提示词。";
  if (!value.trim()) return "提示词不能为空。";
  if (value.length > 30000) return "提示词不能超过 30000 字符。";
  const required = imagePromptVariables(definition.defaultValue);
  const actual = imagePromptVariables(value);
  const missing = required.filter((name) => !actual.includes(name));
  if (missing.length) {
    return `请保留必需变量：${missing.map((name) => `{{${name}}}`).join("、")}`;
  }
  const unknown = actual.filter((name) => !required.includes(name));
  return unknown.length ? `不支持的变量：${unknown.join("、")}` : null;
}
export function imagePromptValue(
  id: string,
  overrides: ImagePromptOverrides = {},
) {
  const key = id.startsWith("image_prompt.") ? id : `image_prompt.${id}`;
  const definition = definitions.get(key);
  if (!definition) throw new Error(`未知生图提示词：${key}`);
  const value = overrides[key];
  if (value !== undefined && validateImagePrompt(key, value)) {
    throw new Error(`生图提示词配置无效：${definition.label}`);
  }
  return value ?? definition.defaultValue;
}
export function renderImagePrompt(
  id: string,
  variables: Record<string, string | number>,
  overrides: ImagePromptOverrides = {},
) {
  // One pass only: user text containing {{...}} is content, never another template.
  return imagePromptValue(id, overrides).replace(
    /\{\{\s*([\w]+)\s*\}\}/g,
    (_, name: string) => {
      if (!(name in variables)) throw new Error(`生图提示词缺少变量：${name}`);
      return String(variables[name]);
    },
  );
}
export function configuredImageStylePrompt(
  style: string,
  overrides: ImagePromptOverrides = {},
) {
  return definitions.has(`image_prompt.style.${style}`)
    ? imagePromptValue(`style.${style}`, overrides)
    : "";
}
export function configuredImagePrompt(
  params: {
    prompt: string;
    size: string;
    style: string;
    imageType: string;
    hasReferences?: boolean;
    subject?: string;
  },
  overrides: ImagePromptOverrides = {},
) {
  return renderImagePrompt("compose", {
    size: params.size,
    subject_line: params.subject ? `学科：${params.subject}。\n` : "",
    style_label: imageStyleLabel(params.style),
    style_prompt: configuredImageStylePrompt(params.style, overrides),
    image_type: params.imageType,
    reference_line: params.hasReferences
      ? `${imagePromptValue("reference", overrides)}\n`
      : "",
    prompt: params.prompt,
  }, overrides);
}
