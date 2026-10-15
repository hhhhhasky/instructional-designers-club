import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { imageStyleLabel, imageStylePrompt } from "./hai_image_styles.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { validateHeaderValue } from "node:http";
import {
  composeImageGenerationPrompt,
  IMAGE_DELIVERY_TIMEOUT_MS,
  IMAGE_GENERATION_STYLES,
  IMAGE_GENERATION_TYPES,
  imageBudgetSignal,
  ImageDeliveryTimeout,
  persistReferenceImages,
  readImageProviderConfig,
  submitImage,
} from "./hai_image_generation.ts";

Deno.test("image provider config reads the server-side ToAPIs settings", () => {
  const config = readImageProviderConfig((name) => ({
    HAI_COURSEWARE_IMAGE_PROVIDER: "toapis",
    HAI_COURSEWARE_IMAGE_API_KEY: "secret",
    HAI_COURSEWARE_IMAGE_BASE_URL: "https://example.test/images/",
    HAI_COURSEWARE_IMAGE_MODEL: "image-model",
  }[name]));
  assertEquals(config.baseUrl, "https://example.test/images");
  assertEquals(config.model, "image-model");
});

Deno.test("four modes and all styles retain visual detail in a compact envelope", () => {
  assertEquals(IMAGE_GENERATION_TYPES, [
    "课件 PPT",
    "海报",
    "学习单",
    "思维导图",
  ]);
  assertEquals(IMAGE_GENERATION_STYLES.length, 42);
  for (const mode of IMAGE_GENERATION_TYPES) {
    for (const style of IMAGE_GENERATION_STYLES) {
      const prompt = composeImageGenerationPrompt(
        "认识水循环",
        "16:9",
        style,
        mode,
        true,
      );
      for (
        const keyword of [
          "16:9",
          imageStyleLabel(style),
          mode,
          "认识水循环",
          "参考图片",
        ]
      ) {
        assertStringIncludes(prompt, keyword);
      }
      assertStringIncludes(prompt, imageStylePrompt(style));
      assertEquals(prompt.endsWith("用户原始要求：\n认识水循环"), true);
    }
  }
});

Deno.test("image generation sends the selected size and accepts an immediate provider URL", async () => {
  let request: Record<string, unknown> = {};
  const result = await submitImage(
    {
      provider: "toapis",
      apiKey: "secret",
      baseUrl: "https://example.test/images",
      model: "image-model",
    },
    { prompt: "课堂概念图", size: "3:4" },
    async (_input, init) => {
      request = JSON.parse(
        String((init as RequestInit | undefined)?.body ?? "{}"),
      );
      return new Response(
        JSON.stringify({
          data: [{ url: "https://example.test/generated.png" }],
        }),
        { status: 200 },
      );
    },
  );
  assertEquals(request.size, "3:4");
  assertEquals(request.resolution, "1k");
  assertEquals(result.url, "https://example.test/generated.png");
  assertStringIncludes(String(request.prompt), "课堂概念图");
});

Deno.test("image generation sends up to six R2 reference URLs to ToAPIs", async () => {
  let request: Record<string, unknown> = {};
  await submitImage(
    {
      provider: "toapis",
      apiKey: "secret",
      baseUrl: "https://example.test/images",
      model: "image-model",
    },
    {
      prompt: "调整配色",
      size: "1:1",
      referenceImageUrls: [
        "https://r2.example/one.png",
        "https://r2.example/two.png",
      ],
    },
    async (_input, init) => {
      request = JSON.parse(
        String((init as RequestInit | undefined)?.body ?? "{}"),
      );
      return new Response(
        JSON.stringify({
          data: [{ url: "https://example.test/generated.png" }],
        }),
        { status: 200 },
      );
    },
  );
  assertEquals(request.image_urls, [
    "https://r2.example/one.png",
    "https://r2.example/two.png",
  ]);
});

Deno.test("reference uploads serialize Chinese and emoji filenames into valid R2 HTTP headers", async () => {
  const env = {
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_BUCKET_NAME: "test-bucket",
    R2_PUBLIC_URL: "https://r2.example.test",
  };
  const previousEnv = Object.fromEntries(
    Object.keys(env).map((name) => [name, Deno.env.get(name)]),
  );
  const requests: { headers: Record<string, string>; path: string }[] = [];
  const client = new S3Client({
    region: "auto",
    endpoint: "https://r2.example.test",
    forcePathStyle: true,
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    maxAttempts: 1,
    requestHandler: {
      handle: (request: { headers: Record<string, string>; path: string }) => {
        // Exercise the SDK's actual serialization and the same header
        // validation used by its Node HTTP transport, without contacting R2.
        for (const [name, value] of Object.entries(request.headers)) {
          validateHeaderValue(name, value);
        }
        requests.push({ headers: request.headers, path: request.path });
        return Promise.resolve({
          response: { statusCode: 200, headers: {}, body: new Uint8Array() },
        });
      },
    },
  });
  const originalSend = client.send.bind(client);
  const sendStub = stub(
    S3Client.prototype,
    "send",
    ((command: PutObjectCommand) => originalSend(command)) as S3Client["send"],
  );
  try {
    for (const [name, value] of Object.entries(env)) Deno.env.set(name, value);
    const names = [
      "照片 1.jpg",
      "课堂🌱素材.png",
      "reference 100%.png",
      "",
      `${"a".repeat(159)}🌱.png`,
      "line\r\nbreak.png",
    ];
    const stored = await persistReferenceImages({
      files: names.map((name) =>
        new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })
      ),
      userId: "user-id",
      taskId: "task-id",
      runId: "run-id",
    });
    assertEquals(stored.length, names.length);
    assertEquals(requests.length, names.length);
    assertEquals(stored[0].name, "照片 1.jpg");
    assertEquals(stored[1].name, "课堂🌱素材.png");
    assertEquals(stored[3].name, "参考图片");
    for (const [index, request] of requests.entries()) {
      assertEquals(
        decodeURIComponent(request.headers["x-amz-meta-originalname"]),
        stored[index].name.toWellFormed(),
      );
      assertEquals(
        request.headers["x-amz-meta-originalnameencoding"],
        "percent-encoding",
      );
      assertEquals(
        request.path,
        `/test-bucket/hai-image-generation/user-id/task-id/references/run-id-${
          index + 1
        }.png`,
      );
    }
  } finally {
    sendStub.restore();
    client.destroy();
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});

Deno.test("lost submit response keeps the pre-saved business ID and polling recovers without another POST", async () => {
  const { submitImage, pollImage, ImageGenerationPending } = await import(
    "./hai_image_generation.ts"
  );
  const config = {
    provider: "toapis",
    apiKey: "secret",
    baseUrl: "https://example.test/images",
    model: "image-model",
  };
  let posts = 0;
  try {
    await submitImage(config, {
      prompt: "图",
      size: "1:1",
      businessId: "hai-image-run-1",
    }, async (_url, init) => {
      posts++;
      assertEquals(
        JSON.parse(String((init as RequestInit)?.body)).client_business_id,
        "hai-image-run-1",
      );
      throw new DOMException("Signal timed out.", "TimeoutError");
    });
    throw new Error("expected pending");
  } catch (error) {
    assertEquals(error instanceof ImageGenerationPending, true);
    assertEquals(
      (error as InstanceType<typeof ImageGenerationPending>).taskId,
      "hai-image-run-1",
    );
  }
  const recovered = await pollImage(
    config,
    "hai-image-run-1",
    async (url, init) => {
      assertEquals(String(url), "https://example.test/images/hai-image-run-1");
      assertEquals((init as RequestInit)?.method, undefined);
      return Response.json({
        id: "tsk_original",
        status: "completed",
        result: { data: [{ url: "https://example.test/result.png" }] },
      });
    },
  );
  assertEquals(recovered.taskId, "tsk_original");
  assertEquals(recovered.url, "https://example.test/result.png");
  assertEquals(posts, 1);
});

Deno.test("poll timeouts, missing lookup and rate limits remain recoverable; explicit failure is terminal", async () => {
  const { pollImage, ImageGenerationPending, ImageGenerationTaskError } =
    await import("./hai_image_generation.ts");
  const config = {
    provider: "toapis",
    apiKey: "secret",
    baseUrl: "https://example.test/images",
    model: "image-model",
  };
  for (const status of [404, 429, 502]) {
    try {
      await pollImage(
        config,
        "original-task",
        async () => Response.json({ error: "temporary" }, { status }),
      );
      throw new Error("expected pending");
    } catch (error) {
      assertEquals(error instanceof ImageGenerationPending, true);
      assertEquals(
        (error as InstanceType<typeof ImageGenerationTaskError>).taskId,
        "original-task",
      );
    }
  }
  try {
    await pollImage(
      config,
      "original-task",
      async () =>
        Response.json({
          status: "failed",
          error: { message: "provider rejected" },
        }),
    );
    throw new Error("expected failure");
  } catch (error) {
    assertEquals(error instanceof ImageGenerationTaskError, true);
    assertEquals(error instanceof ImageGenerationPending, false);
    assertEquals((error as Error).message, "provider rejected");
  }
});

Deno.test("submission returns the pending task immediately and rejects a definitive bad request", async () => {
  const { submitImage, ImageProviderHttpError } = await import(
    "./hai_image_generation.ts"
  );
  const config = {
    provider: "toapis",
    apiKey: "secret",
    baseUrl: "https://example.test/images",
    model: "image-model",
  };
  const result = await submitImage(config, {
    prompt: "图",
    size: "1:1",
    businessId: "business",
  }, async () => Response.json({ id: "task", status: "pending" }));
  assertEquals(result.taskId, "task");
  assertEquals(result.url, undefined);
  try {
    await submitImage(
      config,
      { prompt: "图", size: "1:1", businessId: "business" },
      async () =>
        Response.json({ error: { message: "invalid size" } }, { status: 400 }),
    );
    throw new Error("expected failure");
  } catch (error) {
    assertEquals(error instanceof ImageProviderHttpError, true);
    assertEquals((error as Error).message, "invalid size");
  }
});

Deno.test("missing provider task keeps the actual 404 response visible and can recover later", async () => {
  const { pollImage, ImageGenerationPending } = await import(
    "./hai_image_generation.ts"
  );
  const config = {
    provider: "toapis",
    apiKey: "secret",
    baseUrl: "https://example.test/images",
    model: "image-model",
  };
  const payload = {
    code: "task_not_exist",
    message: "生成失败: 任务处理失败",
    data: null,
  };
  try {
    await pollImage(
      config,
      "hai-image-original",
      async () => Response.json(payload, { status: 404 }),
    );
    throw new Error("expected pending");
  } catch (error) {
    assertEquals(error instanceof ImageGenerationPending, true);
    assertStringIncludes((error as Error).message, "404");
    assertStringIncludes((error as Error).message, "未找到原任务");
    assertEquals(
      (error as InstanceType<typeof ImageGenerationPending>).providerResponse,
      { http_status: 404, response: payload },
    );
  }
  const recovered = await pollImage(
    config,
    "hai-image-original",
    async () =>
      Response.json({
        id: "original",
        status: "completed",
        result: { data: [{ url: "https://example.test/result.png" }] },
      }),
  );
  assertEquals(recovered.url, "https://example.test/result.png");
});

Deno.test("a non-JSON HTTP rejection is not mistaken for a lost submission receipt", async () => {
  const { submitImage, ImageProviderHttpError } = await import(
    "./hai_image_generation.ts"
  );
  const config = {
    provider: "toapis",
    apiKey: "secret",
    baseUrl: "https://example.test/images",
    model: "image-model",
  };
  try {
    await submitImage(config, {
      prompt: "图",
      size: "1:1",
      businessId: "business",
    }, async () => new Response("Bad Request", { status: 400 }));
    throw new Error("expected rejection");
  } catch (error) {
    assertEquals(error instanceof ImageProviderHttpError, true);
    assertEquals(
      (error as InstanceType<typeof ImageProviderHttpError>).status,
      400,
    );
  }
});

Deno.test("all network stages share the remaining delivery budget", () => {
  const deadlines: number[] = [];
  const controller = new AbortController();
  const timeoutStub = stub(AbortSignal, "timeout", (ms) => {
    deadlines.push(ms);
    return controller.signal;
  });
  try {
    imageBudgetSignal(Date.now() + 2500);
    imageBudgetSignal(Date.now() + IMAGE_DELIVERY_TIMEOUT_MS, 15_000);
    assertEquals(deadlines[0] <= 2500 && deadlines[0] > 0, true);
    assertEquals(deadlines[1], 15_000);
    let expired = false;
    try {
      imageBudgetSignal(Date.now() - 1);
    } catch (error) {
      expired = error instanceof ImageDeliveryTimeout;
    }
    assertEquals(expired, true);
  } finally {
    timeoutStub.restore();
  }
});

Deno.test("subject is optional, preserves the raw request, and does not constrain cross-subject styles", () => {
  const raw = "保留标题“在山海之间”，但主体改为黏土质感。\n不要添加其他文字。";
  const prompt = composeImageGenerationPrompt(
    raw,
    "16:9",
    "红金山河",
    "课件 PPT",
    true,
    "语文",
  );
  assertStringIncludes(prompt, "学科：语文");
  assertStringIncludes(prompt, "厚实舒展");
  assertStringIncludes(prompt, "深红");
  assertStringIncludes(prompt, raw);
  assertStringIncludes(
    prompt,
    "参考图片：按用户要求修改，保留未指定修改的内容。",
  );
  assertEquals(
    composeImageGenerationPrompt(raw, "16:9", "红金山河", "课件 PPT").includes(
      "学科：",
    ),
    false,
  );
});

Deno.test("the final prompt follows the user's simplified example exactly", () => {
  const raw =
    "给我设计一张八年级下册《道德与法治》课的 PPT。\n\n封面页信息如下：\n单元：第三单元 认识国家制度\n课时：第五课 我国的政治制度\n框题：第一框 人民代表大会制度\n\n标题你自拟，标题字体要大要醒目。背景里要有人民代表大会会场画面";
  const visual =
    "采用现代法治与公共生活视觉，暖白底、海军蓝标题、蓝灰分区，朱红仅用于关键提示。标题用稳健的粗黑体，正文用干净的无衬线字体。以本课相关的校园、社区、公共服务或规则情境为主体，简洁人物插画与线性关系图相结合，卡片对齐、留白充分。";
  assertEquals(
    composeImageGenerationPrompt(
      raw,
      "16:9",
      "现代法治",
      "课件 PPT",
      false,
      "道德与法治",
    ),
    "图片尺寸：16:9\n学科：道德与法治。\n视觉风格：现代法治。" + visual +
      "\n生成图类型：课件 PPT。\n\n用户原始要求：\n" + raw,
  );
});

Deno.test("image types stay names only and raw text is not rewritten or truncated", () => {
  const raw = "标题“古典诗境”\r\n  Keep this wording.\n  只画背景，不加文字。";
  for (const mode of IMAGE_GENERATION_TYPES) {
    const actual = composeImageGenerationPrompt(raw, "3:4", "国风水墨", mode);
    assertEquals(
      actual.split("\n生成图类型：")[1],
      mode + "。\n\n用户原始要求：\n" + raw,
    );
    assertEquals(actual.includes("学科："), false);
    assertEquals(actual.includes("参考图片："), false);
  }
});
