import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  configuredImagePrompt,
  IMAGE_PROMPT_CATALOG,
  imagePromptVariables,
  renderImagePrompt,
  validateImagePrompt,
} from "./hai_image_prompt_catalog.ts";
import {
  buildCoursewareImagePromptPrompt,
  buildCoursewareOutlinePrompt,
  buildCoursewareVisualDesignPrompt,
} from "./hai_courseware_pipeline.ts";
import { loadImagePromptOverrides } from "./hai_image_prompt_config.ts";
import {
  normalizePptCourse,
  normalizePptSettings,
  pptPagePrompt,
} from "./hai_image_ppt.ts";
import { buildCoursewareImagePlan } from "./hai_courseware_images.ts";

Deno.test("all prompt definitions are unique, valid and can be rendered", () => {
  assertEquals(
    new Set(IMAGE_PROMPT_CATALOG.map((item) => item.key)).size,
    IMAGE_PROMPT_CATALOG.length,
  );
  for (const definition of IMAGE_PROMPT_CATALOG) {
    assertEquals(
      validateImagePrompt(definition.key, definition.defaultValue),
      null,
    );
    const values = Object.fromEntries(
      imagePromptVariables(definition.defaultValue).map((
        name,
      ) => [name, "示例内容"]),
    );
    assertEquals(
      renderImagePrompt(definition.key, values).includes("{{"),
      false,
    );
  }
});
Deno.test("template validation protects input placeholders and rejects unsupported variables", () => {
  assertStringIncludes(
    validateImagePrompt("image_prompt.compose", "只画蓝天")!,
    "必需变量",
  );
  assertStringIncludes(
    validateImagePrompt("image_prompt.reference", "{{unknown}}")!,
    "不支持",
  );
  assertStringIncludes(
    validateImagePrompt("image_prompt.reference", "  ")!,
    "不能为空",
  );
  assertThrows(() => renderImagePrompt("compose", {}), Error, "缺少变量");
});
Deno.test("configured templates, styles and reference rules reach the final prompt without rewriting raw input", () => {
  const prompt = configuredImagePrompt({
    prompt: "保留 {{size}} 和 $& 原文",
    style: "卡通",
    size: "3:4",
    imageType: "学习单",
    subject: "语文",
    hasReferences: true,
  }, {
    "image_prompt.style.卡通": "使用蓝色漫画线稿。",
    "image_prompt.reference": "保留参考图人物。",
  });
  assertStringIncludes(prompt, "使用蓝色漫画线稿。");
  assertStringIncludes(prompt, "保留参考图人物。");
  assertStringIncludes(prompt, "保留 {{size}} 和 $& 原文");
  assertStringIncludes(prompt, "图片尺寸：3:4");
});
Deno.test("PPT page and courseware image requests use administrator templates", () => {
  const course = normalizePptCourse({ topic: "规则" });
  const page = {
    id: "p1",
    title: "标题",
    text: "",
    image_description: "",
    layout: "",
    section: "",
    content_markdown: "投屏：问题",
  };
  const prompt = pptPagePrompt(
    page,
    normalizePptSettings({
      typography: Object.fromEntries(
        ["cover_title", "title", "body", "caption"].map((
          key,
        ) => [key, { font: "黑体", size: 32 }]),
      ),
      palette: Object.fromEntries(
        ["primary", "secondary", "accent", "background", "text"].map((
          key,
        ) => [key, { hex: "#112233", use: "示例" }]),
      ),
      anchors: {
        title: "顶部",
        navigation: "左下",
        page_number: "右下",
        margins: "48px",
      },
    }, course),
    0,
    3,
    {
      "image_prompt.ppt.markdown_page": "教师确认的说明：{{content_markdown}}",
    },
  );
  assertStringIncludes(prompt, "教师确认的说明：投屏：问题");
  const deck = {
    visualMode: "V3",
    slides: [{ slideId: "s1", imagePrompt: "完整页面内容" }],
  };
  const plan = buildCoursewareImagePlan(deck, {
    "image_prompt.courseware.generated_page": "整页规则：{{image_prompt}}",
  });
  assertEquals(plan.items[0].prompt, "整页规则：完整页面内容");
});
Deno.test("runtime loader rereads edits, ignores disabled defaults, and fails clearly on bad configuration", async () => {
  let calls = 0;
  let value = "第一次保存";
  const admin = {
    from: () => ({
      select: () => ({
        like: () => {
          calls++;
          return Promise.resolve({
            data: [{ key: "image_prompt.reference", value, enabled: true }, {
              key: "image_prompt.style.卡通",
              value: "",
              enabled: false,
            }],
            error: null,
          });
        },
      }),
    }),
  };
  assertEquals(
    (await loadImagePromptOverrides(admin as never))["image_prompt.reference"],
    "第一次保存",
  );
  value = "第二次保存";
  assertEquals(
    (await loadImagePromptOverrides(admin as never))["image_prompt.reference"],
    "第二次保存",
  );
  assertEquals(calls, 2);
  value = "";
  await assertRejects(
    () => loadImagePromptOverrides(admin as never),
    Error,
    "配置无效",
  );
  const failed = {
    from: () => ({
      select: () => ({
        like: () =>
          Promise.resolve({ data: null, error: { message: "offline" } }),
      }),
    }),
  };
  await assertRejects(
    () => loadImagePromptOverrides(failed as never),
    Error,
    "读取失败",
  );
});

Deno.test("legacy pure-image planning and outline instructions are configurable", () => {
  const source = {
    taskId: "t",
    artifactId: "a",
    artifactVersion: 1,
    taskTitle: "课",
    artifactTitle: "教案",
    subject: "语文",
    grade: "四年级",
    topic: "观察",
  };
  const options = {
    visualMode: "V3" as const,
    length: "compact" as const,
    imageStrategy: "smart" as const,
  };
  const visual = buildCoursewareVisualDesignPrompt("确定的大纲", source, {
    "image_prompt.courseware.visual_design":
      "视觉调整：{{subject}} {{grade}} {{topic}} {{outline}}",
  });
  assertStringIncludes(visual, "视觉调整：语文 四年级 观察 确定的大纲");
  const planned = buildCoursewareImagePromptPrompt(
    "确定的大纲",
    source,
    options,
    "已确认的风格",
    {
      "image_prompt.courseware.image_planning":
        "转换页面：{{subject}} {{grade}} {{topic}} {{length}} {{visual_design}} {{outline}}",
    },
  );
  assertStringIncludes(
    planned,
    "转换页面：语文 四年级 观察 compact 已确认的风格 确定的大纲",
  );
  assertStringIncludes(
    buildCoursewareOutlinePrompt("教案", source, options, [], {
      "image_prompt.courseware.outline_rule": "后台补充的纯图片规则",
    }),
    "后台补充的纯图片规则",
  );
});
