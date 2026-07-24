# HAI 当前功能实现机制说明

> 生成日期：2026-07-06
> 范围：俱乐部官网当前 `/hai` 页面的一对一“问问哈老师”链路。
> 重点：用户提出问题后，HAI 从前端发送、后端编排、提示词形成、模型调用、质检、持久化到前端渲染的全过程。
> 文档性质：机制说明与 2026-07-06 链路快照，不维护项目进展；2026-07-17 后的当前状态与待办统一见 `docs/项目需求与开发进展.md`，涉及变更时应同时核对实际代码。

## 1. 当前 HAI 的产品形态

当前官网 HAI 后端仍保留多模块和圆桌能力，但前端实际开放面已经收敛为一个核心入口：

- 页面入口：`/hai`
- 可见模块：`ask-han`，页面显示为“问问哈老师”
- 对话模式：固定单聊 `chat`
- 后端函数：固定走 `hai-chat`
- 模型服务：Supabase Edge Function 服务端调用 DeepSeek，不把 API Key 暴露给前端

相关代码：

- `src/pages/HaiPage.tsx`
- `src/db/hai-api.ts`
- `supabase/functions/hai-chat/index.ts`
- `supabase/functions/_shared/hai.ts`
- `supabase/functions/_shared/hai_orchestrator/*`

## 2. 一句话总览

用户提问后，信息流大致是：

```text
HaiPage.handleSend
  -> streamHaiChat(fetch SSE)
  -> Edge Function hai-chat
  -> 鉴权与 HAI 权限检查
  -> 读取运行时配置，先判断 context.orchestrator_enabled
  -> 如果开启：读取模块配置和编排层 Prompt，走 LLM 语义路由与 HAIContextOrchestrator
  -> 如果关闭：读取模块配置和已发布 Prompt，走 legacy system prompt
  -> 用户素材检索 + 公共知识库检索 + 用户记忆加载
  -> 按当前分支生成最终 system prompt
  -> DeepSeek 流式生成
  -> 运行时安全质检；必要时重写
  -> assistant 消息、引用、trace、token 用量落库
  -> SSE 返回 ready/token/done
  -> 前端刷新对话、额度和消息列表
```

它不是“用户问题 + 一个固定 Prompt -> 模型回答”的简单结构。当前实现是一个“前置语义路由 + 分层上下文编排 + 检索增强 + 运行时安全质检 + 可观测 trace”的链路。

## 3. 前端入口：用户点击发送后发生什么

### 3.1 页面初始化

`src/pages/HaiPage.tsx` 在用户进入 `/hai` 后会做几件事：

1. 如果未登录，跳转到 `/login`。
2. 调用 `getHaiAccessStatus()`，检查用户是否有 HAI 权限和额度。
3. 调用 `getHaiModules()`，读取启用模块。
4. 前端只过滤显示 `slug === "ask-han"` 的模块。
5. 如果用户有权限，再加载最近对话和用户记忆。

关键代码：

- `HaiPage.tsx` 中 `visibleModules = modules.filter((item) => item.slug === "ask-han")`
- `getHaiAccessStatus()` 调用 Supabase Function `hai-access-status`
- `getHaiModules()` 读取表 `hai_feature_modules`
- `getHaiConversations()` 读取表 `hai_conversations`
- `getHaiMemories()` 读取表 `hai_user_memories`

### 3.2 发送消息

用户点击发送后，`handleSend()` 做的是：

1. 取出输入框文本 `draft.trim()`。
2. 在前端本地临时插入一条用户消息和一条空的助手消息，标记 `pending: true`。
3. 调用 `streamHaiChat()`。
4. 传给后端的 body 包括：
   - `conversationId`
   - `moduleSlug: activeModule.slug`，当前基本是 `ask-han`
   - `message: text`
   - `mode: "chat"`
   - `clientRequestId: crypto.randomUUID()`
5. 前端监听 SSE 事件：
   - `ready`：后端已建立或确认 conversation，前端记录 conversationId
   - `token`：追加到助手消息内容
   - `done`：取消 pending 状态
   - `error`：显示错误信息
6. 请求结束后刷新：
   - HAI 权限和额度
   - 对话列表
   - 当前对话的真实消息记录

相关代码：

- `src/pages/HaiPage.tsx`：`handleSend()`
- `src/db/hai-api.ts`：`streamHaiChat()`

## 4. 前端 API 层：如何建立 SSE 请求

`src/db/hai-api.ts` 的 `streamHaiChat()` 负责真正发请求。

流程：

1. 从 `supabase.auth.getSession()` 取当前用户 access token。
2. 根据模式选择 endpoint：
   - `chat` -> `hai-chat`
   - `roundtable` -> `hai-roundtable-chat`
3. 拼出 URL：`${VITE_SUPABASE_URL}/functions/v1/hai-chat`
4. 用 `fetch` POST 请求，header 带：
   - `authorization: Bearer <access_token>`
   - `content-type: application/json`
5. 读取 `response.body.getReader()`。
6. 按 SSE 规则拆分 `\n\n`，找到 `data: ...` 行，解析成 JSON 后回调给页面。

这意味着前端不直接接触 DeepSeek，也不直接知道模型调用细节。前端只处理“用户输入、SSE 流、消息 UI、状态刷新”。

## 5. 后端入口：`hai-chat` 的主流程

主链路在 `supabase/functions/hai-chat/index.ts`。

### 5.1 请求进入与基础校验

Edge Function 收到请求后：

1. 处理 CORS。
2. 只允许 `POST`。
3. 调用 `requireUser(request)`：
   - 从 Authorization header 取 Bearer token。
   - 用 Supabase service role client 校验用户。
   - 同时构造 admin client 和 user client。
4. 调用 `assertHaiAccess(auth.userClient)`：
   - 实际执行数据库函数 `hai_access_status()`。
   - 判断用户是否有内测资格或管理员权限。
5. 读取 body：
   - `message`
   - `moduleSlug`
   - `conversationId`
   - `clientRequestId`
6. 如果消息为空，直接 400。

相关代码：

- `supabase/functions/hai-chat/index.ts`
- `supabase/functions/_shared/hai.ts`
- 数据库函数：`hai_access_status()`

### 5.2 初始分支：先判断编排开关

通过权限检查后，后端先读取运行时配置：

- `loadHaiRuntimeConfig(auth.admin)`
- 表：`hai_runtime_settings`
- 关键开关：`context.orchestrator_enabled`

这一步现在是主分支判断点：

```text
context.orchestrator_enabled = true
  -> 直接走上下文编排流程
  -> 不加载 hai_prompt_versions
  -> 不拼入已发布 system_prompt / developer_prompt / response_contract

context.orchestrator_enabled = false
  -> 走已发布 Prompt 流程
  -> 加载 hai_prompt_versions
  -> 使用 system_prompt / developer_prompt / response_contract 形成 legacy system prompt
```

也就是说，当前实现已经从“编排 Prompt + 发布 Prompt 混合”改成了“初始阶段二选一”。

### 5.3 加载模块、编排配置或发布 Prompt

完成运行时分支判断后，后端再加载当前分支需要的配置：

1. `loadModule(auth.admin, moduleSlug)`
   - 表：`hai_feature_modules`
   - 读取模块模型参数：model、temperature、max output tokens、top_p、reasoning effort、history limit、memory limit、检索数量等。

2. 如果 `context.orchestrator_enabled = true`，调用 `loadOrchestratorPromptConfigs(auth.admin)`
   - 表：`hai_orchestrator_prompt_configs`
   - 读取后台可编辑的分层编排 Prompt。
   - 只加载 `enabled !== false` 且内容非空的配置。

3. 如果 `context.orchestrator_enabled = false`，调用 `loadPrompt(auth.admin, module.id)`
   - 表：`hai_prompt_versions`
   - 只读取当前 `status = 'published'` 的版本。
   - 字段包括：
     - `system_prompt`
     - `developer_prompt`
     - `response_contract`

随后 `buildChatCompletionOptions()` 会把模块配置和运行时配置合并为最终模型参数。

## 6. 语义路由：先判断用户真正的问题

当前 `ask-han` 的关键变化是：主路由使用 LLM 语义判断，而不是关键词优先。

代码入口：

- `routeSemanticallyWithLlm()`

### 6.1 路由调用内容

它会先用 `classifyIntent(text)` 得到一个本地 fallback 结果，但这不是主结果。只要运行时配置允许，就会再调用一次 DeepSeek，要求输出 JSON。

路由 prompt 由 `buildSemanticRouterPrompt()` 构造，来源包括：

- 代码内置主路由说明
- 后台可编辑的：
  - `intent_classifier_prompt`
  - `problem_rewriter_prompt`
  - `diagnostic_router_prompt`

这次路由调用要求模型同时输出三件事：

1. `intent_result`
   - `primary_intent`
   - `secondary_intents`
   - `explicit_need`
   - `implicit_need`
   - `risk_of_wrong_framing`
   - `confidence`
   - `route_reason`

2. `problem_rewrite`
   - `surface_problem`
   - `deeper_problem`
   - `wrong_attribution_risk`
   - `hai_reframing`
   - `recommended_answer_direction`

3. `diagnostic_module`
   - 用哪个诊断模块回答。

### 6.2 支持的 intent / diagnostic_module

当前允许的类型定义在 `types.ts`：

- `teaching_design`
- `lesson_plan_diagnosis`
- `public_lesson`
- `learning_profile`
- `classroom_management`
- `learning_motivation`
- `assessment_feedback`
- `ai_lesson_planning`
- `pbl_crossdisciplinary`
- `teacher_growth`
- `general_question`
- `unknown`

### 6.3 路由失败时的兜底

如果 LLM 路由失败、JSON 解析失败或运行时关闭 LLM 路由，会回退到：

- `intent_classifier.ts`：关键词/正则规则识别 intent
- `problem_rewriter.ts`：根据 intent 套静态问题重构框架
- `diagnostic_router.ts`：按 intent 找诊断模块

所以当前机制是：

```text
LLM 语义路由为主
  -> 失败时才使用本地关键词和静态模板兜底
```

## 7. 上下文编排器：生成 HAIContextPackage

如果 `runtime.contextOrchestratorEnabled` 为 true，后端会调用：

```ts
orchestrator.buildInitialPackage(...)
```

文件：

- `supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts`

它会把用户问题和语义路由结果整理成一个 `HAIContextPackage`。

上下文包结构定义在 `types.ts`，主要包括：

- `user_question`
- `core_identity`
- `safety_boundaries`
- `core_axioms`
- `formula_bank`
- `response_composer_prompt`
- `evaluator_prompt`
- `intent_result`
- `memory_selection`
- `problem_rewrite`
- `diagnostic_framework`
- `diagnostic_module`
- `retrieval_plan`
- `retrieved_cases`
- `retrieved_expressions`
- `style_pack`

### 7.1 身份与边界

上下文包中的身份和边界优先来自后台配置：

- `promptConfig.core_identity`
- `promptConfig.safety_boundaries`
- `promptConfig.style_pack`

如果后台配置不存在，就回退到代码常量：

- `prompts.ts` 的 `coreIdentity`
- `prompts.ts` 的 `safetyBoundaries`
- `prompts.ts` 的 `stylePack`

当前边界里有两个非常重要的约束：

1. 不替老师完成完整教案、完整说课稿、完整课堂脚本或可直接交付的整套材料。
2. 对没有可靠材料支撑的具体课文/教材事实，不得编造；不知道就明确说不知道，然后转向教学专业判断。

### 7.2 记忆选择

`memory_selector.ts` 先决定本轮要不要加载用户记忆。

判断依据：

- 用户是否提到“上次、之前、继续、我的、我们班、我教、偏好、限制”等历史或个人语境。
- 当前 intent 是否天然需要画像、当前任务、反复困难、历史建议、执行反馈、偏好等记忆。

它输出：

- `should_load_memory`
- `memory_types`
- `reason`

后续 `loadMemories()` 再真正去 `hai_user_memories` 表读取 active 记忆，并按类型过滤。

### 7.3 问题重构

如果 LLM 语义路由已经返回 `problem_rewrite`，直接使用。

如果没有，就由 `problem_rewriter.ts` 根据 intent 回退到静态框架。

问题重构的目的不是改写用户语言，而是把用户的表层诉求转成教学诊断问题。例如：

```text
表层：学生不爱听，想加游戏
深层：学生可能没有进入学习任务，也没有学习必要感
HAI 重构：不要先问怎么有趣，先问如何设计认知入口
```

### 7.4 诊断模块

`diagnostic_router.ts` 根据 LLM 给出的 `diagnostic_module` 或 fallback intent 选择诊断框架。

诊断框架内容来自：

- 后台配置中的 `diagnostic_module.<module_name>`
- 如果后台没有配置，则回退到 `static_content.ts` 的 `diagnosticModules`

每个模块都有：

- 诊断重点
- 常见误区
- 推荐回答方向

例如公开课模块会强调：不要把亮点理解成形式包装，而要判断学生理解是否发生了可见变化。

### 7.5 检索计划

`retrieval_planner.ts` 根据 intent 和问题重构生成检索计划：

- 是否检索案例库
- 案例查询语句
- 是否检索方法库
- 方法查询语句
- 是否检索理论库
- 理论查询语句
- 是否检索表达库
- 表达查询语句
- 各类最大数量

当前本地案例和表达来自 `static_content.ts`：

- `sampleCases`
- `expressionBank`

公共知识库和用户素材则走数据库函数检索。

## 8. 检索增强：素材、知识库、案例、表达如何进入回答

当前上下文来源有四类。

### 8.1 用户素材

代码：

- `loadMaterialContext()`
- 数据库函数：`hai_match_material_chunks(...)`

查询来源：

- `hai_materials`
- `hai_material_chunks`

检索逻辑：

- 只查当前用户的素材。
- 只查状态为 `processed` 或 `processed_no_embedding` 的素材。
- 如果有当前 conversationId，则优先当前对话相关素材。
- 使用 PostgreSQL `similarity(chunk.content, query_text)` 做文本相似度排序。
- 返回文本片段和 citations。

进入最终 prompt 的位置：

- `【用户上传/沉淀素材】`

### 8.2 公共知识库

代码：

- `loadKnowledgeContextFromPlan()`
- `loadKnowledgeContext()`
- 数据库函数：`hai_match_knowledge_chunks(...)`

查询来源：

- `hai_knowledge_sources`
- `hai_knowledge_chunks`

检索逻辑：

- 只查 `visibility = 'shared'`
- 只查 `is_active = true`
- 使用 `similarity(chunk.content, query_text)` 排序
- 方法库、理论库按 retrieval plan 分别查询，然后合并去重 citations

进入最终 prompt 的位置：

- `【方法/理论库命中】`

### 8.3 本地案例库

代码：

- `selectLocalCases()`
- `static_content.ts` 的 `sampleCases`

它不是数据库检索，而是代码内置样例。根据 intent 和问题重构做简单字符重合打分，选出少量案例。

进入最终 prompt 的位置：

- `【案例库命中】`

### 8.4 表达库

代码：

- `selectExpressions()`
- `static_content.ts` 的 `expressionBank`

它的作用不是提供专业判断，而是给生成阶段提供“哈老师式表达”的句式参考。

进入最终 prompt 的位置：

- `【表达库】`

## 9. 额度、上下文长度与请求预留

在真正调用最终回答模型前，后端会估算本轮输入 token。

估算内容按当前分支计算：

- 用户问题
- 编排开启时：编排包中的身份、边界、诊断框架、意图结果、问题重构、风格和输出结构
- 编排关闭时：已发布 Prompt 的 system/developer/response_contract
- 用户素材文本
- 知识库文本

然后调用：

- `reserveUsage()`
- 数据库函数：`hai_check_and_reserve_usage(...)`

数据库函数会检查：

- 用户是否有 HAI 权限
- 单次请求 token 上限
- 当日 token 上限
- 本周 token 上限
- 用户并发上限
- 全局并发上限

通过后，会写入：

- `hai_request_reservations`
- `hai_usage_events`，事件为 `hai.request.started`

如果超限，后端会直接返回 429 或相应错误，模型不会被调用。

## 10. 对话持久化和用户记忆

额度预留后，后端进入会话处理。

### 10.1 conversation

如果前端传了 `conversationId`：

- 调用 `loadConversation()` 校验这个对话属于当前用户。

如果没有：

- 插入 `hai_conversations`
- title 由 `createTitle(text)` 从用户问题前 28 个字符生成
- mode 写入 `chat`
- module_slug 写入当前模块

### 10.2 用户消息落库

后端先把用户消息插入 `hai_messages`：

- `role = 'user'`
- `content = text`
- `metadata = { module_slug }`
- `token_estimate`
- `input_tokens`

### 10.3 自动提取显性记忆

随后调用：

- `rememberExplicitTeacherFacts()`

它用正则从用户输入中提取显性事实，例如：

- “我教……”
- “我的学生……”
- “请记住……”
- “我的限制是……”

提取后写入：

- `hai_user_memories`

这个自动记忆是轻量规则，不是 LLM 抽取。它只保存较明确、较短的事实，并会避免重复插入。

### 10.4 历史消息加载

`loadRecentMessages()` 会从 `hai_messages` 读取当前 conversation 最近若干条用户/助手消息，数量受：

- `module.history_message_limit`
- `runtime.contextWindowTokens`

共同限制。

这些历史消息会放入最终模型 messages 中，位于 system prompt 之后、本轮用户消息之前。

## 11. 最终 Prompt 是怎么形成的

最终回答用的 system prompt 由初始分支决定。

如果 `context.orchestrator_enabled = true`，使用 `buildComposedSystemPrompt()` 拼出编排版 system prompt。

代码：

- `supabase/functions/_shared/hai_orchestrator/response_composer.ts`

拼接顺序大致是：

1. `core_identity`
2. `safety_boundaries`
3. `core_axioms`，如果有
4. 当前功能模块说明
5. `【意图识别】`：JSON 化的 `intent_result`
6. `【用户记忆选择】`：记忆选择 JSON + 实际加载的记忆
7. `【问题重构】`：JSON 化的 `problem_rewrite`
8. `【诊断框架】`
9. `【检索规划】`
10. `【案例库命中】`
11. `【教学设计公式库】`，如果有
12. `【用户上传/沉淀素材】`
13. `【方法/理论库命中】`
14. `【表达库】`
15. `【风格要求】`
16. `response_composer_prompt` 或默认输出结构
17. 如果进入重写，会追加“质检未通过，必须重写”块
18. 最后追加：不要输出内部 JSON、trace、检索规划或质检结果

注意一个关键点：

编排开启时，`hai_prompt_versions` 不再加载，已发布 Prompt 的 `system_prompt / developer_prompt / response_contract` 都不会进入最终 system prompt。编排链路的提示词来源是 `hai_orchestrator_prompt_configs` 加代码兜底常量、检索结果和上下文包。

如果 `contextOrchestratorEnabled` 关闭，才会走 `buildLegacySystemPrompt()`，即老式拼法：

```text
published system_prompt
developer_prompt
response_contract
用户记忆
用户上传素材
知识库片段
```

## 12. 模型调用：DeepSeek 流式生成

最终 messages 结构是：

```ts
[
  { role: "system", content: systemPrompt },
  ...recentMessages,
  { role: "user", content: text }
]
```

调用代码：

- `streamDeepSeek(messages, options)`

模型参数来自：

- `hai_feature_modules`
- `hai_runtime_settings`
- `buildChatCompletionOptions()`

发送给 DeepSeek 的主要参数：

- `model`
- `messages`
- `temperature`
- `top_p`
- `max_tokens`
- `response_format`
- `stop`
- `stream: true`
- `user_id`
- `thinking`

`streamDeepSeek()` 从 DeepSeek SSE 中读取 token。当前 `hai-chat` 的实现会先把最终回答完整收集到 `output`，再决定是否需要安全重写。如果不重写，则一次性把完整 finalAnswer 作为一个 `token` SSE 事件发给前端；如果重写，则重写过程中的 token 会边生成边发给前端。

这意味着“协议是 SSE 流式”，但正常通过质检的路径在用户侧可能更像“一次性返回整段回答”。只有重写路径是真正逐 token 转发。

## 13. 运行时质检与重写

当前运行时质检已经从复杂评分改成“硬安全违规兜底”。

代码：

- `response_evaluator.ts`

它检查的主要问题：

- 泄露系统提示词或内部实现
- 泄露模型/API key/额度检查等信息
- 套话式自我暴露为 AI
- 绝对化承诺，比如保证、一定能、彻底解决、百分之百等

如果没有命中违规：

- `pass = true`
- `score = 100`
- 直接使用初稿

如果命中违规：

1. `pass = false`
2. 生成 `rewrite_instructions`
3. `hai-chat` 用同一个上下文包重新构造 system prompt
4. 追加“质检未通过，必须重写”块
5. 最多重写 `runtime.evaluatorMaxRewrites` 次，当前默认是 1

现在运行时质检不再负责完整质量评分。意图识别、教学判断、风格、事实性等质量维度主要交给离线评估和后台 trace 分析。

## 14. 输出落库、trace 和前端返回

最终回答确定后，后端会：

1. 计算 input/output token 估算。
2. 插入 assistant 消息到 `hai_messages`：
   - `role = 'assistant'`
   - `content = finalAnswer`
   - `citations = materialContext.citations + knowledgeContext.citations`
   - `metadata = buildMessageMetadata(...)`
   - `input_tokens`
   - `output_tokens`
3. 更新 `hai_conversations.updated_at` 和 `module_slug`。
4. 调用 `finalizeUsage()`：
   - 数据库函数：`hai_finalize_usage(...)`
   - 更新 `hai_request_reservations`
   - 写入 `hai_usage_events`，事件为 `hai.request.completed`
5. 发送 SSE：
   - `done`
   - `conversationId`
   - `messageId`
   - `usage`

### 14.1 metadata 中的 trace

如果 `runtime.logConfigSnapshot` 开启，assistant 消息 metadata 会包含：

- `config`：本轮模型参数、检索开关、编排开关、质检开关等配置快照
- `hai_context_trace`：本轮上下文 trace

trace 包括：

- 用户问题
- `intent_result`
- `memory_selection`
- `problem_rewrite`
- `diagnostic_module`
- `retrieval_plan`
- 命中的上下文 id
- draft answer
- evaluation result
- final answer

后台 `HAI 配置` 页面会读取最近 assistant 消息中的 trace，用于观察路由、检索、质检和生成效果。

## 15. 管理后台如何影响 HAI

后台组件：

- `src/components/admin/HaiManagementSection.tsx`

它提供几类管理能力：

### 15.1 用户权限和邀请码

读写：

- `hai_user_access`
- `hai_invite_codes`
- `hai_quota_policies`

用途：

- 授权用户使用 HAI
- 创建邀请码
- 调整额度策略

### 15.2 模块参数

读写：

- `hai_feature_modules`

可影响：

- 模型
- temperature
- max output tokens
- top_p
- thinking 开关
- history/memory/material/knowledge 数量

### 15.3 发布 Prompt 版本

读写：

- `hai_prompt_versions`

发布逻辑：

1. 把当前同模块 `published` 版本归档。
2. 插入一条新的 `published` 版本。

字段：

- `version_label`
- `system_prompt`
- `developer_prompt`
- `response_contract`

### 15.4 运行时设置

读写：

- `hai_runtime_settings`

影响：

- 是否启用上下文编排
- 是否启用记忆
- 是否启用素材/知识库检索
- 案例/方法/理论/表达的最大加载数
- 是否启用质检
- 是否记录配置快照

### 15.5 分层编排 Prompt

读写：

- `hai_orchestrator_prompt_configs`

这些配置是当前 HAI Prompt 形成机制里最重要的后台可编辑层。

典型 key：

- `core_identity`
- `safety_boundaries`
- `intent_classifier_prompt`
- `memory_selector_prompt`
- `problem_rewriter_prompt`
- `diagnostic_router_prompt`
- `retrieval_planner_prompt`
- `style_pack`
- `response_composer_prompt`
- `response_evaluator_prompt`
- `diagnostic_module.*`
- `core_axioms`
- `formula_bank`

后台可以保存、恢复默认、启用/禁用这些层。

## 16. 数据流总结

### 16.1 输入数据来源

本轮回答的输入来自：

- 用户本轮问题
- 当前 conversation 的历史消息
- `hai_feature_modules` 模块参数
- 编排开启时：`hai_orchestrator_prompt_configs` 分层编排 Prompt
- 编排关闭时：`hai_prompt_versions` 已发布 Prompt
- `hai_runtime_settings` 运行时配置
- `hai_user_memories` 用户记忆
- `hai_material_chunks` 用户素材片段
- `hai_knowledge_chunks` 公共知识库片段
- 代码内置案例库和表达库

### 16.2 中间数据

中间产物包括：

- `SemanticRouteResult`
- `IntentResult`
- `ProblemRewrite`
- `MemorySelection`
- `RetrievalPlan`
- `HAIContextPackage`
- `systemPrompt`
- `ChatMessage[]`
- `ResponseEvaluation`
- `HAITrace`

### 16.3 输出数据

输出会写到：

- `hai_messages`
  - 用户消息
  - 助手消息
  - citations
  - metadata trace
  - token 估算
- `hai_conversations`
  - updated_at
  - module_slug
- `hai_usage_events`
  - started
  - completed / failed
- `hai_request_reservations`
  - active -> completed / failed
- `hai_user_memories`
  - 从用户输入中提取到的显性事实

前端最终展示：

- 助手回答 Markdown
- pending 状态取消
- 最新对话列表
- 最新额度统计

## 17. 关键代码索引

### 前端

- `src/pages/HaiPage.tsx`
  - 页面初始化
  - 权限 gate
  - 对话列表
  - `handleSend()`
  - SSE 事件处理

- `src/db/hai-api.ts`
  - HAI 类型定义
  - `getHaiAccessStatus()`
  - `getHaiModules()`
  - `getHaiConversations()`
  - `getHaiMessages()`
  - `getHaiMemories()`
  - `streamHaiChat()`

- `src/components/admin/HaiManagementSection.tsx`
  - HAI 管理后台
  - Prompt 发布
  - 运行时设置
  - 分层编排 Prompt 编辑
  - trace 查看
  - 知识库管理

### Edge Functions

- `supabase/functions/hai-chat/index.ts`
  - 单聊主链路
  - 加载配置
  - LLM 语义路由
  - 上下文编排
  - 检索
  - 额度预留
  - 对话落库
  - 模型生成
  - 质检和重写
  - assistant 消息落库
  - SSE 返回

- `supabase/functions/_shared/hai.ts`
  - Supabase client
  - 用户鉴权
  - 权限检查
  - runtime config 解析
  - 模型参数构造
  - DeepSeek SSE 调用
  - token 估算
  - 使用额度预留/结算
  - 自动记忆提取

### Context Orchestrator

- `context_orchestrator.ts`
  - 组装 `HAIContextPackage`

- `intent_classifier.ts`
  - 本地关键词 fallback 意图识别

- `problem_rewriter.ts`
  - 静态 fallback 问题重构

- `diagnostic_router.ts`
  - 选择诊断模块和诊断框架

- `retrieval_planner.ts`
  - 生成案例/方法/理论/表达检索计划

- `response_composer.ts`
  - 组合最终 system prompt

- `response_evaluator.ts`
  - 运行时安全质检

- `prompts.ts`
  - 代码兜底的身份、边界、风格、质检标准

- `static_content.ts`
  - 代码内置诊断模块、样例案例、表达库

- `types.ts`
  - HAI 中间结构类型定义

### 数据库

- `supabase/migrations/20260703090000_hai_workspace.sql`
  - HAI 基础表
  - RLS
  - 权限函数
  - 额度函数
  - 素材/知识库检索函数
  - 初始模块和 Prompt

- `supabase/migrations/20260705093000_hai_orchestrator_prompt_configs.sql`
  - 分层编排 Prompt 配置表
  - 初始分层配置

- `supabase/migrations/20260705113000_hai_semantic_router_primary.sql`
  - 将 LLM 语义路由调整为主路由

- `supabase/migrations/20260705120000_hai_textbook_fact_boundary.sql`
  - 加强教材/课文事实边界

## 18. 当前机制的几个重要技术结论

1. 当前 HAI 主链路是 `ask-han -> hai-chat -> context orchestrator -> DeepSeek`。

2. 当前意图识别不是关键词优先。关键词分类器仍在，但主要用于 LLM 路由失败时兜底。

3. 当前 Prompt 不是单表单字段，而是三层来源组合：
   - `hai_prompt_versions` 的已发布线上 Prompt
   - `hai_orchestrator_prompt_configs` 的分层可编辑编排 Prompt
   - 代码里的兜底常量、诊断模块、案例库、表达库

4. 当前回答质量主要靠前置编排来控制：
   - 语义路由
   - 问题重构
   - 诊断模块
   - 检索计划
   - 记忆选择
   - 输出结构
   - 风格层

5. 当前运行时质检只做硬安全兜底，不再做完整教学质量评分。真正的质量优化需要看 trace、离线评估和人工校准结果。

6. 当前“不知道就说不知道”边界已经同时进入：
   - 代码兜底 `safetyBoundaries`
   - 后台可编辑 `safety_boundaries`
   - 已发布 `ask-han` Prompt 的教材事实边界

7. 当前 observability 主要靠 assistant message 的 `metadata.hai_context_trace`，后台只要读取最近助手消息，就能看到路由、重构、检索、质检和最终输出链路。

8. 当前用户侧前端虽然是简单聊天框，但后端实际已经是一个多阶段咨询编排器。
