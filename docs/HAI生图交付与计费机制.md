# HAI 生图交付与计费机制

本文件记录机制。实现、发布和验收状态统一维护在 `项目需求与开发进展.md`。

## 图片选项与固定提示词

生成图类型仅保留：课件 PPT、海报、学习单、思维导图。课件 PPT 为默认项，生成单页教学视觉图片。新增非必选学科，选科后优先展示推荐风格，仍允许跨科选择。风格只保留一个选择器，14 种既有艺术风格与学科主题整合为 42 个预设，其中“国风水墨”沿用旧存储值、展示名为“水墨诗境”。

最终提示词仅组合以下内容，不调用 DeepSeek 改写：

1. 图片尺寸。
2. 学科（未选则省略）。
3. 视觉风格名称与完整风格说明。
4. 生成图类型名称。
5. 用户原始要求，保持原文及换行。

不再附加全局教学套话、商业场景排除清单、模式解释、用途适配长文、中文/水印要求及通用覆盖规则。参考图存在时仅额外追加一句“参考图片：按用户要求修改，保留未指定修改的内容。”；参考图 URL 仍通过供应商 image_urls 字段传送，尺寸仍通过 size 字段传送。

风格说明保留必要的字体、配色、材质、配图与版式细节，不统一截成短句。“现代法治”采用用户给出的精简风格正文；其他 41 套保留原有详细视觉说明。学科存入现有 metadata.subject 和 metadata.input.subject，最终提示词存入 composed_prompt。单页内容和用途细节由用户原始要求表达。

## 150 秒交付期限

前端在点击提交时开始计时，包含登录会话读取、参考图上传、供应商提交与绘图、结果查询、R2 保存和前端图片加载。提交时传送剩余时间，后端为该轮保存固定 `delivery_deadline_at`；刷新或重新打开记录不延长期限。各网络操作的超时不超过该轮剩余时间。

后端以 `EdgeRuntime.waitUntil` 保持生成流程，唯一一次 POST 提交之后只查询原供应商任务；结果下载和 R2 保存不再依赖网页持续查询。网页查询只读取该轮已有进展。背景提交或回执丢失不会自动触发第二次 POST。

后台阶段记录在 `metadata.phase`：参考图上传、供应商提交、供应商绘图、R2 保存、等待前端交付确认。前端的独立计时器即使遇到挂起的查询也会结束等待，并解锁输入。用户统一看到：

> 本次生成失败，本轮未扣积分，请再次尝试。

失败原因仅供后台排查，分别保存在 `failure_code`、`failure_stage`、`failure_detail` 及供应商响应中。暂时的查询 404、限流或网络错误在剩余期限内可重试；超过期限后关闭该轮，不再提供无限续取。用户主动再次提交会创建新一轮。

## 前端收到图片后结算

`r2_key`/`image_url` 已保存时，轮次仍为 running，尚未扣费。前端可以下载图片 Blob；仅在图片 `onLoad` 成功且客户端期限未过时发送 `acknowledge`。

`hai_acknowledge_image_delivery` 校验用户所有权、数据库期限和已保存图片，然后在同一事务内记录 `delivered_at` 并完成积分结算。失败、确认和完成采用相同的轮次行锁；重复确认不重复扣费。直接调用旧完成/结算 RPC 不能绕过新轮次的交付确认。

确认请求未到数据库时不扣费，由平台承担供应商成本。确认响应丢失而事务已经成功时，前端已收到图片，数据库保持一次完成结算，不再重复收费。当前页面保留已经收到的 Blob，即使确认失败，用户仍可下载；尚未确认的图片不宣称已可永久回访。

超时失败是终态。迟到回执可以保存为后台排查证据，但不恢复成功、不下载迟到图片、不补扣积分。历史已完成图片仍可读取和下载。

## 数据库兜底

迁移新增交付期限、确认时间和失败原因字段，保留原 RLS 所有权策略。内部失败函数只允许受控 RPC 与维护函数调用，普通用户不能关闭别人的轮次。

数据库维护函数每 5 秒扫描到期的 queued/running 轮次，关闭任务并释放未消费预留，防止用户关闭网页或 worker 被终止后留下长期 running。清扫不调用供应商、不生成图片、不扣费。物理状态更新可能晚一个调度间隔，但所有交付确认在数据库期限到达后都会被拒绝。

## 本地验证方法

- 前端：`pnpm exec vitest run`、`pnpm exec tsgo -p tsconfig.check.json`、`pnpm build`。
- 后端：`deno test --allow-env --allow-net --allow-sys supabase/functions/_shared/hai_image_generation_test.ts supabase/functions/hai-image-generation/index_test.ts`。
- 类型：`deno check supabase/functions/hai-image-generation/index.ts supabase/functions/hai-image-reference/index.ts`。
- 事务 SQL：在临时目录安装 `@electric-sql/pglite@0.3.14`，用 `HAI_PGLITE_MODULE` 指定其 `dist/index.js`，运行 `node scripts/test-hai-image-delivery.mjs`。测试在独立嵌入式 PostgreSQL 内加载 fixture 和真实迁移，不修改远端数据库。

示例：

```sh
npm install --prefix /tmp/hai-image-delivery-db-test --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
HAI_PGLITE_MODULE=/tmp/hai-image-delivery-db-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-hai-image-delivery.mjs
```

本地 SQL 测试验证计费与权限，不运行实际 pg_cron 调度器；部署时需核验维护任务存在。真实供应商出图、EdgeRuntime 生命周期和生产网络交付需要在发布后验收。

## 本地前端与生图处理器

后端已部署时，运行 `pnpm dev`，前端默认调用配置项目的线上生图函数。登录、数据记录、图片存储与积分均使用当前项目。不要在浏览器配置服务端密钥。

需要测试尚未部署的处理器时，可分别启动：

```sh
deno run --allow-env --allow-net --allow-read --allow-sys --env-file=.env.production --env-file=.env --env-file=.env.upload --env-file=supabase/functions/.env scripts/dev-hai-image.ts
VITE_HAI_IMAGE_FUNCTION_URL=http://127.0.0.1:54329 pnpm dev
```

本地处理器只监听 127.0.0.1，沿用真实 Auth、数据库、供应商和 R2；它不是全栈隔离沙盒，手动生成仍按现有规则结算积分。`VITE_HAI_IMAGE_FUNCTION_URL` 仅开发模式生效，提交、查询、确认与下载统一使用同一个处理器。生产构建忽略该覆盖值。
