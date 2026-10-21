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

## 第三方异步任务与 10 秒轮询

独立的 HAI「图片生成」入口使用 ToAPIs 的异步接口。课件配图是另一条链路，不在本次改动范围内。

1. 网站保存 queued 轮次并预留原积分额度，上传参考图。
2. 在调用供应商前保存 `hai-image-<run_id>`，并作为 `client_business_id` 提交。收到真实任务 ID 后持久化并返回 202，不等待整张图生成。提交 HTTP 等待上限为 30 秒，回执丢失时保留业务 ID，后续仅查询原任务。
3. 浏览器每次查询结束后等待 10 秒，再发送一个 `action=status` 请求；当前查询未结束时不叠加查询。服务端每次最多向供应商查询一次，不包含等待生成的循环，也不启动等待生图的 `EdgeRuntime.waitUntil` worker。
4. `queued/in_progress` 保持 running；`completed` 结果先保存 source_url，再下载到 R2。保存后仍为 running/awaiting_delivery，等待前端加载确认；只有供应商明确失败才进入失败终态。
5. 查询网络异常、404、429 和 5xx 不代表生成失败；R2 临时错误保留 source_url，后续可重试。429 按供应商 `Retry-After` 推迟下一次上游查询，浏览器仍按 10 秒节奏查本站。后台阶段与错误继续记录在 metadata 与供应商响应中。

新轮次标记 `metadata.execution_mode=provider_async`，`delivery_deadline_at=NULL`。单次提交/查询收图操作各有 120 秒执行预算，前端查询请求上限 130 秒，但这不是整个任务的生成期限。供应商生成数分钟不会因原 150 秒规则失败。刷新或重新打开同一任务时从数据库恢复编号继续查询，绝不自动重新 POST 生图。

关闭网页后生成仍在第三方继续；当前方案由浏览器驱动查单收图，网页关闭期间本站不主动收图。ToAPIs 文档注明结果图片 URL 有效期为 24 小时，需要在其有效期内返回查询；一旦保存到 R2，就可持续回访。Webhook 或后台定时收图不在本次轮询方案内。

历史有 delivery_deadline_at 的任务仍执行原期限，失败终态不自动恢复；本次不改写历史迁移、不重新打开失败记录。

## 供应商线路与终态护栏

供应商接入点有两条：`https://toapis.com` 为官方默认（国际）线路，`https://toapis.cn` 仅为面向中国大陆用户的线路（解析到大陆机房，如中国联通山东节点）。本站 Edge Function 运行在海外，跨境访问大陆线路会间歇性挂起，造成提交 POST 超时丢回执（“Signal timed out.”）与轮询超时，这是多起“暂未确认接单”死单的根因。2026-10-21 起 Edge secret `HAI_COURSEWARE_IMAGE_BASE_URL` 固定为 `https://toapis.com/v1/images/generations`（同一账号、同一后端，真实任务 ID 跨线路可互查；`hai-image-<run_id>` 业务 ID 同样跨线路可查）；hai-image-generation 与 hai-courseware-images 已重新部署加载新配置。

两类终态护栏（2026-10-21 起）：① 提交回执丢失、任务仍只有业务 ID（`hai-image-<run_id>`）时，供应商返回明确 404（task_not_exist）即表示任务从未创建，永远不可能出图；预留 10 分钟宽限期（防刚受理任务尚未可见），过期后轮询进入失败终态 `provider_task_not_found`，不再无限“继续查询”。② provider_async 轮次创建满 24 小时强制失败终态 `provider_timeout`，与 ToAPIs 任务 24 小时过期对齐。两条护栏只关闭从未扣费的 running 轮次（acknowledge 是唯一扣费路径，失败轮次零扣费），不恢复任何失败记录。

官方协议：[生成接口](https://docs.toapis.cn/docs/cn/api-reference/images/gpt-image-2/generation)、[查询接口](https://docs.toapis.cn/docs/cn/api-reference/tasks/image-status)、[异步限流](https://docs.toapis.cn/docs/cn/api-reference/rate-limits/async-tasks)。

## 短时效直链交付

图片桶保持私有（r2.dev 与无签名对象访问均被拒绝），不向互联网开放读权限。Edge 用 AWS SigV4 为已保存的 `r2_key` 签发 600 秒预签名直链（`getStoredImageDirectUrl`，virtual-hosted 形如 `https://<桶>.<账号>.r2.cloudflarestorage.com/<key>?X-Amz-Signature=...`），在 `generate`/`status` 响应中作为 `access_url` 附带返回；签名 GET 与浏览器 `<img>` 请求完全等价，图片字节由浏览器直接从 R2（Cloudflare 边缘）拉取，不再经 Supabase Edge 中转，消除此前"所有用户经东京 Edge 中转整图字节"的传输瓶颈。桶权限不因此变更：无签名访问依然被拒，链接 10 分钟后自然失效。

历史轮次经 RLS 列表查询恢复时不携带 `access_url`，页面检测到已保存图片但缺直链的轮次后，批量调用 `action=access` 补签（单次最多 30 条）。直链加载失败（过期或丢失）时，前端仅回退一次到原中转 `download`；下载按钮始终走中转 Blob，便于保存完整文件。

## 前端收到图片后结算

`r2_key`/`image_url` 已保存时，轮次仍为 running，尚未扣费。前端通过短时效直链（或回退中转）加载图片；仅在图片 `onLoad` 成功时发送 `acknowledge`；历史轮次继续校验其期限。

`hai_acknowledge_image_delivery` 校验用户所有权、已保存图片和适用的历史期限，然后在同一事务内记录 `delivered_at` 并完成积分结算。失败、确认和完成采用相同的轮次行锁；重复确认不重复扣费。直接调用旧完成/结算 RPC 不能绕过新轮次的交付确认。

确认请求未到数据库时不扣费，由平台承担供应商成本。确认响应丢失而事务已经成功时，前端已收到图片，数据库保持一次完成结算，不再重复收费。新异步轮次确认请求暂时失败时保留已收到的图片，在后续轮询中重试确认；数据库返回 completed 后才展示已完成和下载按钮，刷新后仍可重新加载已保存图片并确认。历史轮次保留旧版已按时交付时的本地 Blob 下载行为。

超时失败是终态。迟到回执可以保存为后台排查证据，但不恢复成功、不下载迟到图片、不补扣积分。历史已完成图片仍可读取和下载。

## 数据库兜底

迁移新增交付期限、确认时间和失败原因字段，保留原 RLS 所有权策略。内部失败函数只允许受控 RPC 与维护函数调用，普通用户不能关闭别人的轮次。

数据库维护函数每 5 秒扫描有明确期限且到期的历史 queued/running 轮次。新异步轮次期限为 NULL，不会被该清扫关闭。清扫不调用供应商、不生成图片、不扣费。预留超过五分钟后可能过期，保存好的图片在确认事务内恢复本轮预留并按钱包余额校验结算，重复确认不会重复扣费。

## 本地验证方法

- 前端：`pnpm exec vitest run`、`pnpm exec tsgo -p tsconfig.check.json`、`pnpm build`。
- 后端：`deno test --allow-env --allow-read --allow-net --allow-sys supabase/functions/_shared/hai_image_generation_test.ts supabase/functions/hai-image-generation/index_test.ts`。
- 类型：`deno check supabase/functions/hai-image-generation/index.ts supabase/functions/hai-image-reference/index.ts`。
- 事务 SQL：在临时目录安装 `@electric-sql/pglite@0.3.14`，用 `HAI_PGLITE_MODULE` 指定其 `dist/index.js`，运行 `node scripts/test-hai-image-async-sql.mjs`。测试在独立嵌入式 PostgreSQL 内加载 fixture 和真实迁移，不修改远端数据库。

示例：

```sh
npm install --prefix /tmp/hai-image-delivery-db-test --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
HAI_PGLITE_MODULE=/tmp/hai-image-delivery-db-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-hai-image-async-sql.mjs
```

本地 SQL 测试验证计费与权限，不运行实际 pg_cron 调度器；部署时需核验维护任务存在。真实供应商出图和生产网络交付需要在发布后验收。发布需先应用本次异步确认迁移，再部署处理器和前端；本地处理器也必须连接兼容的数据库，旧版 acknowledge RPC 会关闭 NULL 期限任务，不可混用。

## 本地前端与生图处理器

后端已部署时，运行 `pnpm dev`，前端默认调用配置项目的线上生图函数。登录、数据记录、图片存储与积分均使用当前项目。不要在浏览器配置服务端密钥。

需要测试尚未部署的处理器时，可分别启动：

```sh
deno run --allow-env --allow-net --allow-read --allow-sys --env-file=.env.production --env-file=.env --env-file=.env.upload --env-file=supabase/functions/.env scripts/dev-hai-image.ts
VITE_HAI_IMAGE_FUNCTION_URL=http://127.0.0.1:54329 pnpm dev
```

本地处理器只监听 127.0.0.1，沿用真实 Auth、数据库、供应商和 R2；它不是全栈隔离沙盒，手动生成仍按现有规则结算积分。`VITE_HAI_IMAGE_FUNCTION_URL` 仅开发模式生效，提交、查询、确认与下载统一使用同一个处理器。生产构建忽略该覆盖值。
