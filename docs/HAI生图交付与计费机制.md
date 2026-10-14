# HAI 生图交付与计费机制

本文件记录机制。实现、发布和验收状态统一维护在 `项目需求与开发进展.md`。

## 图片选项与固定提示词

生成图类型仅保留：课件 PPT、海报、学习单、思维导图。课件 PPT 为默认项，生成单页教学视觉图片。14 种既有艺术风格全部保留。

所有组合都包含同一段全局约束：面向学生，服务于老师课堂教学；排除商业汇报、公司述职、企业培训、商演、路演和演讲用途。最终提示词由全局约束、尺寸、模式说明、风格说明与用户原始要求直接组合，不调用 DeepSeek 改写。带参考图时也使用相同全局约束，并要求保留用户未要求修改的主体与内容。尺寸同时传入供应商 `size` 字段，参考图链接通过 `image_urls` 传入。

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
