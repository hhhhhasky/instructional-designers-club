# HAI Work 异步执行机制

本文件说明执行、恢复和发布机制；开发、发布与真实账号验收状态统一维护在《项目需求与开发进展》。

## 适用范围

公开课设计、教学设计、教案诊断、诊断后优化教案、环节优化，以及各工具的追改、重生成与失败重试，共用这条执行链路。Chat、独立生图和 PPT 执行链路不由本机制接管。

## 提交与执行

1. 浏览器以稳定 `clientRequestId` 调用 `hai-work`，新客户端要求 JSON 回执。
2. 服务端校验身份、输入、原任务和产物所有权，组装教材、Skill、材料及上一版内容。`hai_prepare_work_run` 利用现有 `(user_id, client_request_id)` 唯一约束处理并发提交，竞争失败时回滚本次临时任务，返回已有 run。
3. 仍通过既有 RPC 预留积分，完整提示词及模型参数进入仅服务端可读的 `hai_work_jobs`。入队提交后返回 202 和 taskId/runId，页面跳转任务详情。
4. 服务端调度器通过 pg_net 唤醒 `hai-work-worker`；每 10 秒 cron 补发未执行或失联的任务，不依赖浏览器继续打开。pg_net 只传任务编号，任务的可靠存储在普通数据库表中，HTTP 传输丢失不会丢队列记录。
5. worker 领取运行权。一次调用只处理一个模型阶段，或保存/结算阶段。初次输出为空时另排一次修复，不在同一实例中连续等待两个长模型调用。
6. 完整模型输出和供应商用量先保存为阶段结果。后续 worker 根据已保存尝试补写用量账本，再以同一个数据库事务保存产物、分配版本、更新任务最新产物、调用既有积分结算并结束 run。
7. 详情页以不重叠的 3 秒查询显示排队/生成/保存状态；追改期间旧产物继续可读，新结果到达后自动选择新版本。

旧浏览器仍可收到一个短 SSE ready/done 回执，之后由任务详情查询结果。这个兼容响应不执行模型，也不维持长连接。

提交/入队回执丢失时先查原请求。客户端保留未确认请求的编号；不会自动再次调用模型。服务端也不会把入队响应丢失等同于入队事务失败，更不会因此关闭可能已经被 worker 领取的任务。

## 运行时限与恢复

- **旧请求模式**：保留原来超过 3 分钟的失联清扫，只作用于 `execution_mode=request`。
- **新异步模式**：不按 run 创建或开始后 3 分钟判失败。排队中的任务没有执行租约；worker 每 20 秒续期，租约为 90 秒。数据库在写阶段结果或完成事务时检查领取编号和租约，拒绝已失效 worker 的迟到写入。
- **单次模型调用**：继续保留既有 140 秒上限。本次改造解除浏览器连接依赖，没有把普通模型接口变成供应商可查询的长任务接口，也没有声称能突破 Edge 实例时限。worker 的 pg_net HTTP 预算为 145 秒，每次只调用一次模型。若未来需要单次生成超过该预算，应另行调整执行承载和时限。
- **没有已保存输出的模型阶段失联**：不自动重发付费调用，改走失败结算并提示重试。供应商可能已产生计算费用，但本轮不会交付或扣成功用量。
- **已有完整输出的阶段失联，或用量记账/保存/结算失败**：继续保存阶段，不重新调用模型；多次唤醒及多次完成只产生一个版本和一次成功结算。
- **排队/未完成模型阶段累计超过 30 分钟**：领取时转为失败并释放预留，避免无限排队；已有完整输出不因调度停机超过 30 分钟而被丢弃，仍可恢复保存与结算。
- **额度预留**：入队时将本轮原预留延长为 35 分钟，防止原 5 分钟并发预留提前过期。已保存输出晚于预留恢复时，完成事务仅恢复属于该 run、该用户和 hai-work 路由的 expired 预留，再使用既有结算规则；重复完成不会再次扣费。

`hai_finish_work_job` 锁住任务行分配版本，避免并发追改分配相同版本；产物、最新版本和结算处于同一事务，任何一步失败均回滚。供应商用量按 `(request_id, call_index)` 幂等补写；worker 使用严格写入模式，记账失败不会被静默当成成功结算。

队列及调度凭据表启用 RLS，撤销普通用户全部表权限；领取、续期、阶段保存、完成和调度 RPC 仅授予 service_role。worker 不接受用户 JWT 作为调度凭据，而验证独立服务端 secret；任务中的用户编号来自已授权 run，不储存用户 access token。完成事务临时以该 run 所有者的身份调用既有结算函数，并恢复原授权上下文。

## 发布顺序

只有用户明确要求发布时才执行以下远端步骤。不要执行宽泛 `supabase db push`。

1. 通过项目约定的 Management API，在同一事务中精确应用并登记 `20261016020951_hai_work_async_jobs.sql`；只读核实表权限、RPC 权限、异步/旧请求清扫区分及 cron 存在。
2. 部署 `hai-work-worker`。其 `verify_jwt=false` 是因为它验证 `x-hai-work-secret`，普通用户不能获取这个 secret。缺失或错误凭据应返回 401。
3. 运行 `node scripts/configure-hai-work-worker.mjs`，将同一个随机服务端 secret 写入 Edge 配置和仅服务端可读的调度配置，启用调度。脚本会修改远端配置，不输出 secret。
4. 部署 `hai-work`，保留其既有 JWT 和服务端所有权检查。未配置调度器时必须返回明确 503，避免提交后无人执行。
5. 验证后按白名单提交/推送前端与相关代码。Cloudflare Pages 沿用 GitHub 自动发布；未经要求不另行轮询。
6. 真实账号执行各工具、优化教案与追改；提交后关闭页面，再打开确认同一 run 完成。核对仅有一份对应产物与一次成功结算，旧版本可读。

配置脚本需要已忽略的本地环境文件中的 Supabase URL、服务端 key 和 `SUPABASE_ACCESS_TOKEN`；不要把这些密钥带入浏览器。上线顺序中先应用数据库和配置 worker，再切换提交接口/前端，避免新接口缺少执行器。

## 本地验证

```sh
pnpm exec tsgo -p tsconfig.check.json
pnpm exec vitest run
pnpm build
deno check supabase/functions/hai-work/index.ts supabase/functions/hai-work-worker/index.ts
deno test --allow-env --allow-read supabase/functions/hai-work/index_test.ts supabase/functions/hai-work-worker/handler_test.ts supabase/functions/_shared/hai_work_test.ts supabase/functions/_shared/hai_usage_test.ts
HAI_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-hai-work-async-sql.mjs
```

SQL 脚本在独立嵌入式 PostgreSQL 内执行真实新迁移及既有计费函数，不访问远端数据库。pg_net 与 cron 使用记录调用的本地替身；它验证重发、权限与事务行为，但不代表生产调度器或第三方模型网络已经验收。HTTP 模拟运行真实提交处理器与 Supabase 客户端，全部请求在内存拦截，不产生真实付费生成。
