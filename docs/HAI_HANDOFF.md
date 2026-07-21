# HAI 子系统接手文档

> 生成时间：2026-07-03
> 最后更新：2026-07-16
> 状态：✅ 数据库迁移已执行 · ✅ Edge Functions 已部署 · ✅ 核心单聊测试面已简化 · ✅ 旧 HAI 知识库已迁移 · ✅ 单聊已接入并部署 Context Orchestrator MVP · ✅ HAI 配置页已接入编排参数与 trace · ✅ 每日复盘后端与 00:05 cron 已上线

> 2026-07-14 新增：每日 00:05 自动复盘、用户点赞/点踩、严格离线评分、候选 Prompt、反事实 A/B、低风险门禁发布、发布快照回滚和管理看板。后端迁移、Edge Function、secret、cron 已线上核验；前端随本次代码发布生效。实现与运行规则见 `docs/HAI_DAILY_REVIEW_AUTOPILOT.md`。

---

## 一、HAI 是什么

HAI（哈老师 AI）是俱乐部官网的 AI 教学助手子系统。后端保留 3 个功能模块，但当前前端测试面已先收敛为“问问哈老师”单聊模式，方便集中验证核心问答质量。

| 模块 slug | 名称 | 说明 |
|---|---|---|
| `lesson-diagnosis` | 诊断教案 | 粘贴教案，HAI 从目标/任务/评价/学情诊断结构问题 |
| `ask-han` | 问问哈老师 | 教学设计问答 |
| `teaching-inspiration` | 教学灵感 | 为导入、任务、活动、评价提供灵感方向 |

后端支持两种对话模式：
- **单聊模式**（chat）：一对一对话
- **圆桌模式**（roundtable）：可选 3 个角色（班主任/教研员/教研组长/创意教师/知心教师/技术教师）同时观察发言

当前前端状态（2026-07-13 更新）：
- `/hai` 页面不再显示“单聊 / 圆桌”切换，发送固定走 `hai-chat`。
- `/hai` 页面不再显示“诊断教案 / 教学灵感”入口，只显示并默认使用 `ask-han`（问问哈老师）。
- “素材依据”面板保留已有素材列表和删除能力，但上传素材入口已隐藏；后端 `hai-ingest-material`、Storage 和素材表仍保留。
- HAI 回答支持复制和生成分享图；点击“转发”只生成并展示图片，不再自动下载，移动端可长按图片保存或转发。
- `/admin` 数据看板新增“HAI 看板”；使用次数、使用人数、Token 趋势与用户排行、最近调用、额度告警和编排 trace 已集中到此处，`/admin/manage` 的 HAI 配置页只保留可维护项。
- 用户首次进入已开通的 `/hai` 时，会在页面中央看到 6 步点击式个人信息问卷，收集教学阶段、学科、教龄、主要角色、常见难题和偏好支持方式；提交后批量写入 `hai_user_memories`，后续咨询按现有记忆选择链路加载。

访问控制：邀请码 + token 额度系统。用户需先兑换邀请码获得权限，每次对话预留/扣减额度。

---

## 二、文件清单与 Git 状态

### 尚未 git commit 的文件

**全部未提交**。当前 git status：

```
修改的文件：
  src/routes.tsx                          ← 新增 /hai 路由

未跟踪的文件：
  docs/HAI_DEPLOYMENT_CHECKLIST.md        ← 部署清单
  src/db/hai-api.ts                       ← 前端 API 层
  src/pages/HaiPage.tsx                   ← HAI 聊天主页面
  src/components/admin/HaiManagementSection.tsx  ← 管理后台 HAI 配置面板
  scripts/migrate-hai-legacy-content.mjs  ← 旧 HAI 知识库 + Prompt 迁移脚本
  supabase/functions/_shared/hai.ts       ← Edge Functions 共享工具
  supabase/functions/deno.json
  supabase/functions/deno.lock
  supabase/functions/hai-access-status/index.ts
  supabase/functions/hai-chat/index.ts
  supabase/functions/hai-ingest-material/index.ts
  supabase/functions/hai-redeem-invite/index.ts
  supabase/functions/hai-roundtable-chat/index.ts
  supabase/migrations/20260703090000_hai_workspace.sql  ← 数据库迁移
```

建议提交时分成两个 commit：
1. 数据库迁移 + Edge Functions + deno 配置
2. 前端（routes、HaiPage、HaiManagementSection、hai-api）

---

## 三、架构概览

### 3.1 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS（设计系统：`rounded-ds-*`、`text-ds-*`、`border-bd`、`text-tx`、主色 `#c45d3e`）
- **后端**：Supabase（PostgreSQL + Edge Functions + Storage）
- **AI**：DeepSeek API，通过 Edge Functions 服务端调用（key 在 Supabase Secrets，不暴露到前端）
- **部署**：`pnpm dev` 本地开发（Vite，默认端口 5173；若占用可换 5175）

### 3.2 数据库表（17 张）

| 表名 | 用途 |
|---|---|
| `hai_invite_codes` | 邀请码（code, max_uses, used_count, status, quota_policy_key） |
| `hai_user_access` | 用户访问权限（user_id, status, quota_policy_key, expires_at） |
| `hai_quota_policies` | 额度策略（daily/weekly token limit, concurrency） |
| `hai_feature_modules` | 功能模块定义（slug, name, model, temperature 等） |
| `hai_prompt_versions` | Prompt 版本管理（module_id, status=draft/published/archived） |
| `hai_runtime_settings` | 运行时配置键值对 |
| `hai_conversations` | 对话（mode=chat/roundtable, roundtable_role_ids） |
| `hai_messages` | 消息（role, content, citations, tokens） |
| `hai_user_memories` | 用户记忆（自动提取 + 手动添加） |
| `hai_materials` | 用户上传素材（file_name, storage_path, kind, status） |
| `hai_material_chunks` | 素材分块（chunk_index, content, token_count） |
| `hai_knowledge_sources` | 知识库来源（visibility=shared/private） |
| `hai_knowledge_chunks` | 知识库分块 |
| `hai_request_reservations` | 请求预留（防并发超限） |
| `hai_usage_events` | 使用事件记录 |
| `hai_usage_alerts` | 额度告警 |
| `hai_quality_test_runs` | 质量测试记录 |

### 3.3 数据库函数（8 个）

| 函数 | 用途 |
|---|---|
| `hai_has_access(p_user_id)` | 检查用户是否有权限 |
| `hai_access_status()` | 返回当前用户的完整权限 + 额度状态 |
| `hai_redeem_invite_code(p_code)` | 兑换邀请码 |
| `hai_check_and_reserve_usage(...)` | 预留 token 额度 |
| `hai_finalize_usage(...)` | 完成后结算实际 token |
| `hai_usage_summary(p_user_id)` | 返回已用/剩余额度 |
| `hai_match_material_chunks(...)` | 文本相似度匹配用户素材 |
| `hai_match_knowledge_chunks(...)` | 文本相似度匹配知识库 |

RLS 策略使用 `public.is_admin()` 判断管理员权限，该函数检查 `profiles.role = 'admin'`。

### 3.4 Edge Functions

| 函数 | 路由 | 用途 |
|---|---|---|
| `hai-access-status` | GET | 获取当前用户 HAI 权限 + 额度 |
| `hai-redeem-invite` | POST | 兑换邀请码 |
| `hai-chat` | POST (SSE) | 单聊模式，流式返回 |
| `hai-roundtable-chat` | POST (SSE) | 圆桌模式，流式返回 |
| `hai-ingest-material` | POST | 上传素材后触发解析入库 |

共享代码：`supabase/functions/_shared/hai.ts`（358 行），包含：
- `requireUser()` — 鉴权
- `assertHaiAccess()` — 权限检查
- `reserveUsage()` / `finalizeUsage()` — 额度管理
- `streamDeepSeek()` — DeepSeek SSE 流式调用
- `rememberExplicitTeacherFacts()` — 自动提取用户记忆（正则匹配教学场景事实）
- `estimateTokens()` — CJK + 混合文本 token 估算

新增编排层：`supabase/functions/_shared/hai_orchestrator/`
- `context_orchestrator.ts`：HAIContextOrchestrator 入口，负责组装本轮上下文包
- `intent_classifier.ts`：LLM 路由失败时的确定性降级意图识别
- `memory_selector.ts`：按意图选择是否加载用户记忆及记忆类型
- `problem_rewriter.ts`：LLM 未返回问题重构时的静态降级框架
- `diagnostic_router.ts`：按 LLM 选择的诊断模块加载诊断框架；未提供时按 intent 降级
- `retrieval_planner.ts`：按重构结果生成案例/方法/理论/表达检索计划
- `response_composer.ts`：把分层上下文组装成短 system prompt
- `response_evaluator.ts`：生成后质检，不合格最多重写一次
- `types.ts`：核心上下文、trace、质检结构类型

当前只接入 `hai-chat` 单聊路径。`hai-roundtable-chat` 后端保留旧链路，等单聊质量稳定后再决定是否接入同一编排层。

### 3.5 前端

| 文件 | 行数 | 用途 |
|---|---|---|
| `src/pages/HaiPage.tsx` | ~810 | HAI 聊天主页面：三栏布局（历史列表 / 聊天 / 上下文面板），邀请码兑换 gate，SSE 流式渲染；当前前端只开放“问问哈老师”单聊，隐藏圆桌/模块切换/素材上传入口 |
| `src/components/admin/HaiManagementSection.tsx` | ~810 | 管理后台：邀请码创建/管理、直接授权用户、模块 Prompt 编辑发布、知识库管理、使用事件查看 |
| `src/db/hai-api.ts` | 348 | 类型定义 + CRUD API 层 + SSE 流式解析 |
| `src/routes.tsx` | +7行 | 新增 `/hai` 路由 |
| `src/pages/AdminManagePage.tsx` | 已集成 | `HAI 配置` Tab 已加入管理页 |
| `scripts/migrate-hai-legacy-content.mjs` | ~250 | 从旧 HAI Supabase 迁移 `knowledge_sources` / `knowledge_chunks` 到当前 `hai_knowledge_*`，并发布合并旧提示词后的 `ask-han` Prompt |

---

## 四、已完成的工作

### 4.1 数据库迁移（✅ 已执行 — 2026-07-03）

文件：`supabase/migrations/20260703090000_hai_workspace.sql`（1302 行）

包含：extension 创建、17 张表、8 个函数、RLS 策略、Storage Bucket、Seed 数据（4 个额度策略、3 个功能模块 + 初始 Prompt、5 个运行时配置）。`ask-han` 的初始 Prompt 后续已被旧 HAI 合并版替换。

**执行方式**：`supabase db push --include-all`（项目已通过 CLI link，config.toml 已创建）

**遇到的问题和修复**：

1. `similarity()` 函数找不到 → 迁移文件开头已有 `set search_path = public, extensions;`，但 `hai_match_material_chunks` 和 `hai_match_knowledge_chunks` 两个函数定义内部各自设了 `set search_path = public`，覆盖了外部设置。修复：将这两个函数内部的 search_path 改为 `set search_path = public, extensions`。

2. 旧迁移文件未追踪 → 远程数据库的迁移历史记录只追溯到 `20260617121047`，本地 19 个旧迁移文件在 push 时被标记为 "not found on remote"。解决：临时移走旧文件，只保留 HAI 迁移 + 匹配远程记录的那个文件，推送后再恢复。

### 4.2 Edge Functions（✅ 已部署 — 2026-07-03）

所有 5 个函数已通过 `supabase functions deploy` 部署：

| 函数 | 状态 |
|---|---|
| `hai-access-status` | ✅ |
| `hai-redeem-invite` | ✅ |
| `hai-chat` | ✅ |
| `hai-roundtable-chat` | ✅ |
| `hai-ingest-material` | ✅ |

Supabase Secrets 已配置：
- `DEEPSEEK_API_KEY`（由用户手动配置）✅

### 4.3 冒烟测试（✅ 通过 — 2026-07-03）

| 测试项 | 结果 |
|---|---|
| `/hai` 页面加载 | ✅ 当前测试面只显示“问问哈老师”单聊 + 上下文面板 |
| 单聊模式发送消息 | ✅ AI 流式回复完整（DeepSeek v4-flash） |
| SSE 流式渲染 | ✅ Markdown 渲染正常（标题、列表、加粗） |
| Token 额度统计 | ✅ 当日已用额度正确显示 |
| Session 列表 | ✅ 左侧面板显示对话历史 |
| 管理后台 HAI 配置 | ✅ 所有面板加载正常 |

### 4.4 管理后台修复（2026-07-03）

`HaiManagementSection.tsx` 的两个 PostgREST 外键歧义修复：

`hai_user_access` 和 `hai_usage_alerts` 表各有 2 个以上 `profiles` 外键（`user_id` / `granted_by` / `resolved_by`），查询 `profiles(nickname, phone, access_level)` 时 PostgREST 返回 HTTP 300。已改用 `profiles!user_id(nickname, phone, access_level)` 消歧义语法。

### 4.5 邀请码

已创建邀请码 `HAI2026`（beta 策略，最多 10 人使用，0/10 已用）。

### 4.6 前端测试面简化（✅ 已完成 — 2026-07-03）

目标：降低 `/hai` 首轮测试干扰，集中验证“问问哈老师”核心能力。

已完成：
- 删除前端可见的“单聊 / 圆桌”切换入口；发送请求固定传 `mode: "chat"`，走 `hai-chat`。
- 删除前端可见的“诊断教案 / 教学灵感”模块入口；`activeModuleSlug` 固定为 `ask-han`，页面只展示“问问哈老师”。
- 删除“素材依据”里的上传素材控件；保留已有素材列表、状态展示和删除能力。
- 页面 meta keywords 已从“教案诊断 / 教学灵感”调整为“问问哈老师”。

未删除：
- 后端 `lesson-diagnosis`、`teaching-inspiration`、`hai-roundtable-chat`、`hai-ingest-material` 代码和数据库结构均保留，后续可重新开放前端入口。

### 4.7 旧 HAI 知识库与 Prompt 迁移（✅ 已完成 — 2026-07-03）

脚本：`scripts/migrate-hai-legacy-content.mjs`

迁移来源：`/Users/apple/vibe coding project/HAI` 对应旧 HAI Supabase 项目。

迁移结果（远程当前官网 HAI 库校验）：
- `hai_knowledge_sources`: `362`
- `hai_knowledge_chunks`: `11530`
- 旧库 `knowledge_sources` / `knowledge_chunks` 数量与当前库一致。

Prompt 处理：
- 已从旧 HAI 代码中的技能提示词、角色提示词和教练协议中抽取核心规则。
- 已合并发布为 `ask-han` 模块的新 Prompt 版本：`legacy-hai-prompts-2026-07-03`。
- `ask-han` 模块显示名称已统一为“问问哈老师”。
- 已将旧中文称呼统一为“哈老师 / 问问哈老师”；`ask-han` 仅作为内部 slug 保留。

验证：
- 当前远程库 `hai_feature_modules`、`hai_prompt_versions`、`hai_knowledge_sources`、`hai_knowledge_chunks` 中已无旧中文称呼残留。
- `hai_match_knowledge_chunks` 可从迁移后的知识库召回内容。
- `pnpm build` 通过。

---

## 五、当前状态（2026-07-03 更新）

### 5.1 ✅ 数据库迁移 — 已完成

通过 `supabase db push --include-all` 执行。17 张表、8 个函数、RLS 策略、Storage Bucket、Seed 数据全部创建成功。

**额外修复**：
- `hai_match_material_chunks` / `hai_match_knowledge_chunks` 内部 `search_path` 从 `public` 改为 `public, extensions`（否则 `similarity()` 找不到）
- 创建了 `supabase/config.toml`（项目 ID: `isjflmyhbvdlmcsaewbq`）

### 5.2 ✅ Edge Functions 部署 — 已完成

5 个函数全部通过 `supabase functions deploy` 部署成功。

### 5.3 ✅ DEEPSEEK_API_KEY — 已配置

用户在 Supabase Dashboard → Edge Functions → Secrets 中手动配置完成。

### 5.4 ✅ 冒烟测试 — 已通过

单聊模式发送消息 → AI 流式回复 → 额度统计 → Session 记录 → 管理后台 HAI 配置面板全部正常。

### 5.5 ✅ 邀请码 — 已创建

`HAI2026`（beta 策略，最多 10 人，0/10 已用）

### 5.6 ✅ 前端核心测试面 — 已简化

当前 `/hai` 只开放“问问哈老师”单聊测试：
- 默认功能：`ask-han`
- 默认模式：`chat`
- 隐藏入口：圆桌、诊断教案、教学灵感、上传素材
- 后端相关能力保留，后续按测试节奏逐步恢复入口。

### 5.7 ✅ 旧 HAI 知识库 — 已迁移

旧 HAI 项目迁移到当前官网 HAI 库：

| 数据 | 旧库 | 当前库 | 状态 |
|---|---:|---:|---|
| 知识源 | 362 | 362 | ✅ |
| 知识块 | 11530 | 11530 | ✅ |

迁移脚本可重复执行：`node scripts/migrate-hai-legacy-content.mjs`

注意：当前 `hai_match_knowledge_chunks` 仍是 `pg_trgm` 文本相似度检索，短查询排序有时不理想；数据已迁移完整，但 ranking 后续仍值得优化。

### 5.8 ✅ 旧 Prompt — 已抽取并作为基线

旧基线版本：`legacy-hai-prompts-2026-07-03`

内容来源：
- 旧 HAI 技能提示词（教学目标、真实任务、教案诊断、整课备课、多视角审视）
- 旧 HAI 角色提示词（班主任、教研员、教研组长、创意教师、知心教师、技术教师）
- 旧 HAI 主教练协议（追问而非代笔、一次推进一个关键点、具体克制）

### 5.9 🟡 Prompt R02-R05 调试（2026-07-04，未发布）

本轮围绕“问问哈老师”单聊模式继续调试 `ask-han` Prompt，目标是：
- 将角色定位从“备课教练 / 追问优先”调整为“教学设计咨询师 / 判断先于追问”。
- 在意图识别层聚焦公开课、说课、日常课、局部设计咨询/教案诊断。
- 强化“不交付完整教案、完整说课稿、完整教学环节或整套任务脚本”的边界。

已跑 3 轮离线 A/B，均只生成候选版和报告，未覆盖线上已发布 Prompt：

| 轮次 | 报告 | 结果 | 结论 |
|---|---|---|---|
| R02 | `docs/hai-quality-runs/2026-07-04T05-08-31-452Z-prompt-ab-test.md` | 4.98 -> 4.89 | 不发布；意图、判断、行动和边界稳定，但回复明显变长 |
| R03 | `docs/hai-quality-runs/2026-07-04T05-13-56-110Z-prompt-ab-test.md` | 4.98 -> 4.93 | 不发布；外科式校准优于 R02，但仍输在简洁度 |
| R04 | `docs/hai-quality-runs/2026-07-04T05-18-39-148Z-prompt-ab-test.md` | 4.98 -> 4.95 | 暂不发布；公开课、备课、教案诊断、目标、学情、任务、代写、概念解释基本持平或提升，但说课场景下降 |

R05 根据人工标准同步做了两项调整，并已跑新 A/B，未发布：
- 候选 Prompt 新增“底线要求”和 60/70/80/90 分质量标准，强调表层意图不等于真问题。
- 评估器改为严格百分制，权重调整为：意图/真问题识别 35%，教学判断 40%，可执行性 10%，风格/边界/简洁各 5%；总分由代码按权重计算，避免自动评估模型把底线表现打成高分。
- R05 报告：`docs/hai-quality-runs/2026-07-04T08-20-27-112Z-prompt-ab-test.md`，结果为 87.36 -> 87.17（胜 / 平 / 负 = 5 / 2 / 6）。候选版在公开课、教学目标、学情分析、任务情境上提升，但在备课没思路、日常课、教案诊断、代写诱导上下降，因此不发布。

当前最佳候选逻辑已保留在 `scripts/run-hai-prompt-ab-test.mjs`：在旧版有效 Prompt 上外科式替换“追问而非抢答”，新增公开课/说课/日常课/局部设计路由，加入 180-260 字短答契约，并用 R05 标准约束“九十分回答”。

### 5.10 ✅ Prompt R06 人工咨询标尺版 — 已发布（2026-07-04）

R06 版本：`ask-han-consultant-standard-2026-07-04`

校准来源：`docs/HAI_CONSULTANT_STANDARD_CALIBRATION.md`

落盘与发布：
- 可执行迁移：`supabase/migrations/20260704172000_hai_ask_han_consultant_standard_prompt.sql`
- 远程发布脚本：`scripts/publish-hai-consultant-standard-prompt.mjs`
- 发布方式：脚本从 migration 读取三段 Prompt，归档旧 published 版本，插入新 published 版本。

远程验证结果：
- `version_label`: `ask-han-consultant-standard-2026-07-04`
- `status`: `published`
- `published_at`: `2026-07-04T09:46:06.041+00:00`
- Prompt 长度：system `684`，developer `1633`，response_contract `319`

核心规则：
- 高分回答不再等于“识别场景 + 给建议 + 不代写”，而是必须识别表层意图背后的真问题。
- 设计层问题要倒推到目标、课标/教材、学情和评价证据。
- 具体教材信息不足时不凭空分析教材细节，优先提醒“用教材教，不是教教材”。
- 公开课亮点优先来自教材/目标理解深度和学情洞察，而不是 PPT、闯关、AI 赋能、项目式等形式包装。
- 代写边界更硬：HAI 是帮助老师思考的咨询工具，不替老师完成教学设计任务。

注意：
- `supabase db push --linked --dry-run` 已确认新 migration 在待应用队列中，但远程迁移历史仍存在旧 migration 缺口；直接 push 会要求处理一批旧迁移。因此本轮通过脚本先完成远程 Prompt 发布，migration 作为代码化可追溯记录保留。

离线版本对比（2026-07-04）：
- 测试脚本：`scripts/run-hai-prompt-version-comparison.mjs`
- 测试报告：`docs/hai-quality-runs/2026-07-04T10-00-17-859Z-r06-version-comparison.md`
- 测试集：哈老师人工咨询标尺 9 题
- 结果：`legacy-hai-prompts-2026-07-03` 75.28 -> `ask-han-consultant-standard-2026-07-04` 81.72（+6.44），胜 / 平 / 负 = 6 / 0 / 3
- 主要提升：备课没思路 +22.5，日常课假懂 +13，概念辨析 +13，教学目标 +7.75
- 轻微退步：说课 -1.25，公开课 -1，任务情境 -0.25。共同问题是新版偏长、偏解释化，后续优先收紧 response_contract，不再扩写 developer_prompt。

### 5.11 ✅ Prompt R08 表达方式层 — 已发布（2026-07-04）

当前远程 `ask-han` 发布版本：`ask-han-expression-style-2026-07-04`

校准来源：
- `docs/HAI_CONSULTANT_STANDARD_CALIBRATION.md` 的“表达方式分析：哈老师怎么说话”

落盘与发布：
- 可执行迁移：`supabase/migrations/20260704182000_hai_ask_han_expression_style_prompt.sql`
- 远程发布脚本：`scripts/publish-hai-expression-style-prompt.mjs`
- 发布方式：保留 R06 的 developer_prompt 和 response_contract，只在 system_prompt 追加 `【哈老师表达方式】`。

远程验证结果：
- `version_label`: `ask-han-expression-style-2026-07-04`
- `status`: `published`
- `published_at`: `2026-07-04T11:19:39.9+00:00`
- `has_style`: `true`
- Prompt 长度：system `1453`，developer `1633`，response_contract `319`

写入的表达规则：
- 开头先定性，不先夸、不先安慰。
- 常用“这个问题其实是……”“这里有一个误区……”“原因主要有两个……”。
- 用“不是 A，而是 B”纠正错误假设。
- 用“好，我们再往前倒一步”这类句式讲因果链。
- 用 2-3 个反问推动老师自查，例如“你能不能明确知道这节课的目标是什么？”
- 适度使用“好、那么、你看、其实、对吧、总而言之”等口语连接词，但不机械堆叠。

### 5.12 🟡 后续事项

| 事项 | 说明 |
|---|---|
| 人工抽检 R08 表达效果 | 当前线上已是 `ask-han-expression-style-2026-07-04`；下一步抽 3 条短样本看是否更像哈老师本人表达，而不是只多了口头禅 |
| 人工抽检 R06 轻微负例 | 9 题标尺回归整体 +6.44，但说课、公开课、任务情境轻微下降；在 R08 风格检查后继续抽检这 3 条负例 |
| 扩展混合评估 | 在人工抽检后，再把原 13 个自动回归用例加入混合评估，确认新版本没有在非标尺场景退步 |
| 知识库 ranking 优化 | 当前文本相似度可用，但短查询可能误召回；建议加 title/topic/tags 权重或接 embedding |
| 邀请码流程端到端测试 | 用一个非 admin 用户测试：访问 /hai → 输入 HAI2026 → 兑换 → 发消息 |
| 圆桌模式测试 | 后端保留，前端入口当前隐藏；待核心单聊稳定后恢复入口测试 |
| 素材上传 + 解析测试 | 后端保留，前端入口当前隐藏；待核心单聊稳定后恢复入口测试 |
| 提交 git | 建议两个 commit: ① infra（迁移/函数/deno）② 前端 |

### 5.13 ✅ Context Orchestrator MVP — 已接入并部署（2026-07-04）

本轮目标：不继续加长 system prompt，而是把 `hai-chat` 单聊链路改成分层上下文编排。

当前单聊调用链：
1. `/hai` 前端发送消息到 `hai-chat`。
2. `hai-chat` 完成鉴权、模块配置、Prompt 版本和 runtime config 加载。
3. `hai-chat` 先调用 LLM 语义路由，一次性输出 intent、problem rewrite 和 diagnostic module；只有在 LLM 路由关闭、失败或 JSON 不可用时，才回退到 `classifyIntent()` 确定性规则。
4. `HAIContextOrchestrator` 根据语义路由结果继续执行：
   - memory selection
   - diagnostic framework selection
   - retrieval planning
   - 本地 sample case / expression selection
5. 根据 memory selector 按需加载 `hai_user_memories`，不再默认全量注入。
6. 根据 retrieval plan 限量检索：
   - 用户素材：仍走 `hai_match_material_chunks`
   - 方法/理论：仍复用 `hai_match_knowledge_chunks`，但按 `method_query` / `theory_query` 分次、少量召回
   - 案例/表达/边界：先用本地 MVP 文件承载
7. `response_composer.ts` 用 core identity、问题重构、诊断框架、少量检索结果和 style pack 生成短上下文。
8. DeepSeek 先生成初稿；`response_evaluator.ts` 做确定性质检。
9. 质检不通过时最多重写一次；普通用户只收到最终回答。
10. trace 写入 assistant message 的 `metadata.hai_context_trace`，前端不展示。

新增文件：
- `supabase/functions/_shared/hai_orchestrator/types.ts`
- `supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts`
- `supabase/functions/_shared/hai_orchestrator/intent_classifier.ts`
- `supabase/functions/_shared/hai_orchestrator/memory_selector.ts`
- `supabase/functions/_shared/hai_orchestrator/problem_rewriter.ts`
- `supabase/functions/_shared/hai_orchestrator/diagnostic_router.ts`
- `supabase/functions/_shared/hai_orchestrator/retrieval_planner.ts`
- `supabase/functions/_shared/hai_orchestrator/response_composer.ts`
- `supabase/functions/_shared/hai_orchestrator/response_evaluator.ts`
- `supabase/functions/_shared/hai_orchestrator/prompts/*.md`
- `supabase/functions/_shared/hai_orchestrator/modules/*.md`
- `supabase/functions/_shared/hai_orchestrator/knowledge/**`
- `supabase/functions/_shared/hai_orchestrator/evals/golden_questions.json`
- `scripts/run-hai-context-eval.mjs`

验证方式：
- 类型检查：`deno check supabase/functions/hai-chat/index.ts`
- 圆桌旧链路检查：`deno check supabase/functions/hai-roundtable-chat/index.ts`
- eval runner 语法检查：`node --check scripts/run-hai-context-eval.mjs`
- 线上批测：提供 `VITE_SUPABASE_URL` / `HAI_EVAL_ACCESS_TOKEN` 后运行 `node scripts/run-hai-context-eval.mjs`
- 若同时提供 `SUPABASE_SECRET_KEY`，eval 报告会从 `hai_messages.metadata.hai_context_trace` 读取 intent、retrieval plan、质检分数和 context ids。

注意：
- 这是 MVP，不新增数据库迁移；trace 先存在消息 metadata。
- 已执行 `supabase functions deploy hai-chat`，部署到项目 `isjflmyhbvdlmcsaewbq`。部署时 CLI 提示 Docker 未运行，但本次函数上传与部署成功。
- 当前环境没有可用用户 access token，因此未执行真实用户态线上对话 smoke test；可用 `HAI_EVAL_ACCESS_TOKEN` 跑 `scripts/run-hai-context-eval.mjs`。
- 旧 Prompt 仍保留在数据库和后台配置中，但单聊生成时不再把完整 system prompt 原样塞入上下文，只保留 response contract 和一段 developer 摘要。
- 当前方法库/理论库仍复用迁移后的 `hai_knowledge_chunks`；后续需要把高质量哈老师方法论整理成结构化 method bank，并优化 ranking。

### 5.14 ✅ HAI 配置页接入上下文编排（2026-07-04）

本轮目标：把 Context Orchestrator 从“后端隐藏逻辑”同步暴露到 `/admin/manage` 的 `HAI 配置` 页面，后续调质量时可以直接改配置和看 trace。

已完成：
- `HAI 配置` 页面新增 `上下文编排` 面板。
- 面板展示当前单聊链路状态：`Context Orchestrator` / `Legacy Prompt`。
- 面板聚合展示并可编辑 `hai_runtime_settings` 中的编排配置：
  - `context.orchestrator_enabled`
  - `orchestrator.case_max`
  - `orchestrator.method_max`
  - `orchestrator.theory_max`
  - `orchestrator.expression_max`
  - `evaluator.enabled`
  - `evaluator.pass_score`
  - `evaluator.max_rewrites`
- 面板展示 `ask-han` 模块的历史、记忆、素材召回、知识召回上限，仍写回 `hai_feature_modules`。
- 面板展示 8 层上下文编排结构：身份边界、意图识别、记忆选择、问题重构、诊断路由、检索规划、回答生成、回答质检。
- 面板读取最近 assistant message 的 `metadata.hai_context_trace`，展示 intent、诊断模块、记忆加载、上下文数量、质检分数和问题摘要。
- 面板保留 golden eval 命令入口：`HAI_EVAL_ACCESS_TOKEN=... node scripts/run-hai-context-eval.mjs`。

后端同步：
- `HaiRuntimeConfig` 新增编排和质检参数。
- `hai-chat` 会读取这些参数：
  - 关闭 `context.orchestrator_enabled` 时回退旧 Prompt + 记忆 + RAG 链路。
  - 开启时把 case/method/theory/expression 上限传给 `HAIContextOrchestrator`。
  - `evaluator.pass_score` 控制质检通过阈值。
  - `evaluator.enabled` / `evaluator.max_rewrites` 控制是否触发自动重写。
- 新增迁移：`supabase/migrations/20260704203000_hai_context_orchestrator_settings.sql`。

远程状态：
- 已通过 `supabase db query --linked --file supabase/migrations/20260704203000_hai_context_orchestrator_settings.sql` 写入远程配置项。
- 已查询确认 8 个配置项存在并启用。
- 已执行 `supabase functions deploy hai-chat` 部署新函数。

验证：
- `deno check supabase/functions/hai-chat/index.ts`
- `pnpm exec tsgo -p tsconfig.check.json`
- `pnpm build`
- `pnpm exec biome lint --only=correctness/noUndeclaredDependencies src/components/admin/HaiManagementSection.tsx supabase/functions/_shared/hai.ts supabase/functions/hai-chat/index.ts`

---

## 六、设计决策记录

### 为什么用 `set search_path = public, extensions;`？

Supabase 的新迁移默认把扩展安装在 `extensions` schema（而非 `public`）。`pg_trgm` 的 `similarity()` 函数在 `extensions.similarity`，但 SQL Editor 默认 search_path 只有 `public`。两种解法：
1. `set search_path = public, extensions;`（采用）
2. 在函数定义中用完全限定名 `extensions.similarity()`（侵入性高）

选择方案 1 因为它同时解决所有扩展函数的访问问题（包括 `gen_random_uuid()` 来自 `pgcrypto`）。

### 为什么素材/知识检索用文本相似度而非向量？

迁移中 `hai_material_chunks` 和 `hai_knowledge_chunks` 都有 `embedding vector(1536)` 列，但当前检索函数 `hai_match_material_chunks` 和 `hai_match_knowledge_chunks` 使用 `pg_trgm.similarity()` 做文本匹配。向量嵌入回填管线尚未接入。这是刻意的设计选择——先上线可用版本，后续接入 embedding 提升召回质量。

### 为什么用户记忆用正则而非 LLM？

`rememberExplicitTeacherFacts()` 用正则从用户消息中提取明确的教学事实（科目、学生描述、偏好、限制）。这是为了控制成本和延迟——不需要为每条消息额外调一次 LLM。后续可以改为 LLM 提取。

### 为什么 token 估算用自实现而非 tiktoken？

Edge Functions 运行在 Deno 环境中，`tiktoken` 的 npm 包可能不兼容。自实现函数 `estimateTokens()` 对 CJK 字符系数 0.9、英文词 1.25，精度足够用于额度管控（不需要精确到 token 级别）。

---

## 七、已知限制与后续 TODO

| 优先级 | 项目 | 说明 |
|---|---|---|
| ~~P0~~ ✅ | 执行迁移 SQL | 已完成 |
| ~~P0~~ ✅ | 部署 Edge Functions | 已完成 |
| ~~P0~~ ✅ | 配置 DEEPSEEK_API_KEY | 已完成 |
| ~~P1~~ ✅ | 发布首版正式 Prompt | 已发布旧 HAI 合并版 `legacy-hai-prompts-2026-07-03` |
| ~~P1~~ ✅ | 发布人工咨询标尺版 Prompt | 已发布 `ask-han-consultant-standard-2026-07-04`；下一步做混合评估和线上抽检 |
| ~~P1~~ ✅ | 发布表达方式层 Prompt | 已发布 `ask-han-expression-style-2026-07-04`；下一步人工抽检回答是否更像哈老师本人表达 |
| P1 | 知识库 ranking / 向量嵌入回填 | 旧知识库已迁移；embedding 列已建，需要接 embedding 生成管线或先优化文本检索权重 |
| P2 | 扫描件 PDF OCR | 当前仅支持文字层 PDF，扫描件会报错 |
| P2 | 多轮圆桌阶段推进 | 后端保留，前端入口当前隐藏；圆桌模式当前只有"澄清"阶段，设计中有"分歧-收敛"等后续阶段 |
| P2 | 前端移动端适配 | HaiPage 当前主要面向桌面端，移动端布局未专门优化 |
| P3 | 自动记忆改为 LLM 提取 | 当前正则提取较保守，LLM 提取更全面但成本更高 |
| P3 | 管理后台使用事件分页 | 当前 HaiManagementSection 的使用事件列表无分页 |

---

## 八、代码风格要点

- Tailwind 使用设计系统 class：`rounded-ds-lg`、`text-ds-lg`、`font-ds-bold`、`border-bd`、`text-tx`、`bg-bg`
- Radix UI 组件：Button, Tabs, Dialog, Select 等，从 `@/components/ui/` 引入
- Supabase 客户端：`import { supabase } from "@/db/supabase"`
- admin 鉴权：RLS + `public.is_admin()`，前端无额外 admin 检查（依赖 Supabase RLS）
- Dev server：`pnpm dev`（Vite，默认端口 5173；当前验证用过 5175）
- Lint：tsgo + biome
- 主要语言：中文注释 + 中文 UI 文案

---

## 九、部署记录（2026-07-03）

### 9.1 search_path 二次修复

**现象**：`supabase db push` 时报 `function similarity(text, text) does not exist`

**根因**：迁移文件顶部有 `set search_path = public, extensions;`，但函数定义内部的 `set search_path = public` 覆盖了外部设置，导致 `pg_trgm` 的 `similarity()` 找不到。

**修复**：将 `hai_match_material_chunks` 和 `hai_match_knowledge_chunks` 两个函数内部的 `set search_path` 改为 `public, extensions`。

### 9.2 PostgREST 外键歧义

**现象**：管理后台 HAI 配置页面报"HAI 配置加载失败"，Network 面板显示 `hai_user_access` 和 `hai_usage_alerts` 请求返回 HTTP 300。

**根因**：这两张表有多个 `profiles` 外键（`user_id` + `granted_by` / `resolved_by`），PostgREST 执行 `profiles(nickname, phone, access_level)` 时无法确定 join 哪个 FK。

**修复**：将查询中的 `profiles(...)` 改为 `profiles!user_id(...)` 明确指定通过 `user_id` 列 join。

### 9.3 supabase db push 旧迁移冲突

**现象**：本地 19 个旧迁移文件被标记为 "Remote migration versions not found in local migrations directory"。

**原因**：远程迁移历史记录只到 `20260617121047`，本地有完整的所有历史迁移文件，但远程是通过 Dashboard SQL Editor 手动执行的，没有通过 CLI push。

**解决**：临时移走只保留远程匹配文件 + HAI 迁移，push 完再恢复。未来考虑做一次 `supabase migration repair` 对齐历史。`supabase/config.toml` 已创建（project_id: `isjflmyhbvdlmcsaewbq`）。

### 9.4 top_p 参数越界

**现象**：HAI 请求报 `Invalid top_p value, the valid range of top_p is (0, 1.0]`。

**根因**：管理后台允许 `default_top_p = 0`，后端又把 `top_p` clamp 到 `[0, 1]` 后继续发送；DeepSeek 接口要求 `top_p` 必须在 `(0, 1]`。

**修复**：`buildChatCompletionOptions()` 对 `top_p <= 0` 视为未设置，不再发送；管理页 Top P 最小值改为 `0.01`；新增迁移 `20260704214500_hai_top_p_positive_constraint.sql`，清理已有 `0` 并把数据库约束改为 `null or (0, 1]`。

**远程状态**：已通过 `supabase db query --linked --file ...` 执行迁移 SQL，并用 `supabase migration repair --linked --status applied 20260704214500` 登记历史；已重新部署 `hai-chat` 和 `hai-roundtable-chat`。远程核验：`ask-han.default_top_p = 0.30`，其余模块为 `null`，约束为 `default_top_p is null or (default_top_p > 0 and default_top_p <= 1)`。

### 9.5 Context Orchestrator Prompt 配置与语义路由（2026-07-05）

**目标**：让 HAI 配置页不仅能启停上下文编排，还能直接编辑每一层 prompt / 诊断模块内容；同时把 intent routing、问题重构和诊断模块选择改为 LLM 语义判断主导，避免用代码关键词机械决定关键诊断层次。

**新增/修改**：
- 新增迁移 `supabase/migrations/20260705093000_hai_orchestrator_prompt_configs.sql`
  - 新表：`public.hai_orchestrator_prompt_configs`
  - 已写入 22 条配置：`core_identity`、`safety_boundaries`、`intent_classifier_prompt`、`memory_selector_prompt`、`problem_rewriter_prompt`、`diagnostic_router_prompt`、`retrieval_planner_prompt`、`style_pack`、`response_composer_prompt`、`response_evaluator_prompt`、12 个 `diagnostic_module.*`
  - RLS：仅 admin 可读写
  - 运行时设置新增：
    - `router.llm_fallback_enabled`
    - `router.llm_confidence_threshold`
- 新增迁移 `supabase/migrations/20260705100000_hai_internal_eval_quota_policy.sql`
  - 新增 `internal` 配额策略，用于 live eval 测试账号，避免 9 条质量评估被日额度截断。
- 新增迁移 `supabase/migrations/20260705113000_hai_semantic_router_primary.sql`
  - 将 `router.llm_fallback_enabled` 的说明更新为“启用 LLM 语义路由”。
  - 将 `router.llm_confidence_threshold` 标记为历史兼容字段。
  - 更新 `intent_classifier_prompt`、`problem_rewriter_prompt`、`diagnostic_router_prompt` 默认内容，明确 LLM 是主路由，不是关键词兜底。
- `src/components/admin/HaiManagementSection.tsx`
  - “上下文编排”区域新增分层 Prompt 配置编辑器。
  - 支持选中配置、编辑正文、保存、恢复默认、启停单个配置项。
  - 编辑器显示可编辑层启用数、未保存状态、是否为默认内容、字数和 token 粗估。
  - 切换单层启用状态不会覆盖当前编辑框中未保存的正文。
  - 将“混合路由策略”改为“语义路由策略”：LLM 主路由，代码仅在关闭或失败时降级。
  - trace 卡片展示 `route_method`、`confidence`、`matched_signals`。
- `supabase/functions/hai-chat/index.ts`
  - 加载 `hai_orchestrator_prompt_configs`，传给 `HAIContextOrchestrator`。
  - 正常链路先调用 `routeSemanticallyWithLlm()`，让 LLM 一次性输出 intent、problem rewrite 和 diagnostic module。
  - `classifyIntent()` 只在 LLM 路由关闭、调用失败或 JSON 不可用时作为降级路径。
  - 最终语义路由结果写入 trace。
- `supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts`
  - `buildInitialPackage()` 可直接接收 `SemanticRouteResult`。
  - LLM 返回的问题重构优先于静态 `rewriteProblem()`；LLM 返回的 `diagnostic_module` 优先于按 intent 映射。
- `supabase/functions/_shared/hai_orchestrator/intent_classifier.ts`
  - 从简单关键词计数升级为加权信号规则。
  - 输出 `route_method`、`route_reason`、`matched_signals`。
  - 当前定位为降级路径，不再是主路由。
  - 已补强：
    - “听懂/点头但做题错” -> `assessment_feedback`
    - “具体课文/教材/切入” -> `teaching_design`
    - “流程完整但不够有力量/问题在哪” -> `lesson_plan_diagnosis`

**远程状态**：
- 已执行两条迁移 SQL。
- 已核验：
  - `hai_orchestrator_prompt_configs` 共 22 条，层级 0-7。
  - `router.llm_fallback_enabled = true`
  - `router.llm_confidence_threshold = 0.72`
  - `internal` 配额策略存在，daily 600000。
- 已执行 `supabase functions deploy hai-chat` 两次，最新部署包含完整流程诊断路由修正。
- 本轮已执行 `supabase db query --linked --file supabase/migrations/20260705113000_hai_semantic_router_primary.sql`，并用 `supabase migration repair --linked --status applied 20260705113000` 登记历史。
- 已重新执行 `supabase functions deploy hai-chat`，远程项目 `isjflmyhbvdlmcsaewbq` 当前单聊函数包含 LLM 主路由代码。

**验证**：
- `deno check supabase/functions/hai-chat/index.ts`
- `pnpm exec tsgo -p tsconfig.check.json`
- `pnpm build`
- `pnpm exec biome lint --only=correctness/noUndeclaredDependencies src/components/admin/HaiManagementSection.tsx supabase/functions/_shared/hai.ts supabase/functions/hai-chat/index.ts supabase/functions/_shared/hai_orchestrator/intent_classifier.ts supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts supabase/functions/_shared/hai_orchestrator/diagnostic_router.ts`
- 2026-07-05 本地复核：以上 `deno check`、`tsgo`、`pnpm build` 和定向 `biome lint` 均通过；`pnpm build` 仅保留 Vite 大 chunk 与 Browserslist 数据过期提示。
- live eval 完整跑通：
  - 报告：`docs/hai-quality-runs/2026-07-05T02-33-40-319Z-live-context-orchestrator-eval.md`
  - JSON：`docs/hai-quality-runs/2026-07-05T02-33-40-319Z-live-context-orchestrator-eval.json`
  - live average：84.03
  - vs historical legacy：+8.75
  - vs R06：+2.31
  - wins/ties/losses vs R06：4 / 3 / 2
  - intent 维度：86.67（vs R06 +2.23）
  - teaching_judgment 维度：82.22（vs R06 +2.78）

**最新路由核验**：
- 9 条 live eval trace 的 `route_method` 均为 `llm`。
- `日常课假懂`：`assessment_feedback` -> `assessment_feedback`，83。
- `备课没思路`：`teaching_design` -> `teaching_design`，81.5。
- `公开课`：`public_lesson` -> `public_lesson`，88.45。
- `说课`：`public_lesson` -> `public_lesson`，82。
- `教学目标`：`teaching_design` -> `teaching_design`，81.5。
- `教案诊断`：`lesson_plan_diagnosis` -> `lesson_plan_diagnosis`，81.5。
- `任务情境`：`teaching_design` -> `teaching_design`，81.5；相对 R06 -1，是后续应关注的轻微回退点。
- `代写诱导`：`public_lesson` -> `public_lesson`，92.6。
- `概念辨析`：`teaching_design` -> `teaching_design`，84.25。

### 9.6 教材事实边界强化（2026-07-05）

**目标**：明确写入“不知道就说不知道”的系统边界。用户只给具体课题、篇名或教材名，但没有提供原文、教材页、课标/单元信息或知识点材料时，HAI 不得引用、概括或分析自己并不掌握的课文/教材具体内容。

**新增/修改**：
- 新增迁移 `supabase/migrations/20260705120000_hai_textbook_fact_boundary.sql`
  - 更新 `hai_orchestrator_prompt_configs.safety_boundaries` 的 `content/default_content`。
  - 发布新 `ask-han` Prompt 版本：`ask-han-textbook-boundary-2026-07-05`。
  - 在 system prompt 追加 `【教材事实边界】`，保留上一版 developer_prompt 和 response_contract。
- 更新本地默认边界：
  - `supabase/functions/_shared/hai_orchestrator/prompts.ts`
  - `supabase/functions/_shared/hai_orchestrator/prompts/safety_boundaries.md`
  - `supabase/functions/_shared/hai_orchestrator/knowledge/boundary_bank/safety_boundaries.md`

**边界要点**：
- 不知道就明确说不知道，不要不懂装懂。
- 用户没有提供具体文本/教材材料，且知识库没有可靠内容时，不得编造单元要素、篇章结构、人物情节、文本主旨、活动细节或教材事实。
- 数学、物理、化学等通用知识点，可在模型可靠掌握范围内解释概念和教学难点。
- 语文、道德与法治、政治、历史等高度依赖具体文本/教材版本的内容，材料不足时必须先声明不知道具体内容，再转向目标、学情、评价证据、教学主线等教学专业判断。

**远程状态**：
- 已执行 `supabase db query --linked --file supabase/migrations/20260705120000_hai_textbook_fact_boundary.sql`。
- 已执行 `supabase migration repair --linked --status applied 20260705120000`。
- 已重新部署 `supabase functions deploy hai-chat`。
- 远程核验：
  - 当前 published prompt：`ask-han-textbook-boundary-2026-07-05`
  - `system_prompt_has_boundary = true`
  - `safety_has_unknown_rule = true`
  - `safety_has_textbook_rule = true`

**验证**：
- `deno check supabase/functions/hai-chat/index.ts`
- `pnpm exec tsgo -p tsconfig.check.json`
- `pnpm build`
- 线上探针：
  - 输入：`我下周要上三年级语文《云朵邮局》，你帮我具体分析一下这篇课文第二自然段应该抓哪些关键词讲？`
  - 输出要点：HAI 明确回复 `我不知道《云朵邮局》这篇课文原文，所以不具体说“你应该教XX词”。`，随后转向关键词筛选的教学判断框架，没有编造具体课文内容。

### 9.7 01/02/03 真人口述咨询风格校准（2026-07-13，已发布）

**校准材料**：通过仓库内 macOS 替身定位到 Obsidian 中的 `hai-consultation-corpus`，逐题比较前三份文件的真人回答和 HAI 原始回答。30 题中，Q001 真人回答错配，Q015/Q016/Q026 为空，因此只用 26 个有效配对归纳。

**关键结论**：旧表达层把“先判断—不是 A 而是 B—往前倒—三步建议”固化成统一模板，但真人的第一步其实是选择答法：定义澄清、问题拆分、条件判断、关系辨析、因果回溯、概念解释或直接策略。公开课回答还必须区分教学专业标准与当地竞赛/评委偏好。

**本地候选改动**：
- `core_identity`：加入答法选择、诊断证据阈值、现实评审边界和反虚构约束。
- `style_pack`：改为人称、共同推理、条件意识、真实语料与反模板规则；不模仿口误和语气词堆叠。
- `response_composer_prompt`：取消固定六段、三步、最小行动和总结邀请。
- `diagnostic_module.public_lesson`：加入日常展示/公开课/赛课、地区偏好和用户目标。
- 表达库：加入定义澄清、问题拆分、目的/手段、原因/结果、双重标准等表达骨架。
- 分析文档：`docs/HAI_CONSULTATION_VOICE_CALIBRATION_2026-07-13.md`。
- 已执行迁移：`supabase/migrations/20260713090000_hai_consultation_voice_prompt_calibration.sql`。

**发布状态**：已于 2026-07-13 写入线上 Prompt 配置，并随 R11.1 一起重新部署 Edge Function。Q003/Q004/Q014/Q020/Q021/Q022/Q025/Q029 继续作为发布后的重点回归样本。

### 9.8 01 文档人工反馈驱动的 R10（2026-07-13，已发布）

用户已完成 01 文档 Q001-Q010 的“AI 哪里不像我”和“可沉淀逻辑”标注。R09 的主要剩余问题不再是教学逻辑错误，而是没有优先调用哈老师自己的教学通识课体系，同时输出仍有明显 Markdown 排版。

R10 新增 `han_methodology` 层，已知内容包括备课流程“分析—设计—研发—迭代”、教学设计六要素、新教师最低有效备课标准、学情分析四类方法和基于六要素的教学反思。生成层同步改为具体共情、纯文本自然段、一个精准抓手、一个例子或前后对比，以及与本题直接相关的续聊邀请。冒烟测试证明只靠 Prompt 仍会选错或叠加框架，因此进一步新增 `methodology_router.ts` 做逐题方法聚焦，并用 `normalizeHaiVoiceFormatting()` 稳定移除 Markdown、列表标记、复杂标点和枚举式表达。

详细分析：`docs/HAI_R10_01_FEEDBACK_PROMPT_ITERATION.md`。已执行迁移：`supabase/migrations/20260713113000_hai_r10_personal_methodology_and_voice.sql`。

发布状态：已写入线上配置并部署。Q001、Q004、Q005、Q008、Q009、Q010 保留为线上回归样本，重点检查是否命中个人框架、是否完全无 Markdown，以及课程引导是否自然且无编造。

### 9.9 教学通识课结构化方法库 R11.1（2026-07-13，已发布）

用户提供 `docs/教学通识课Plus-课程大纲.md` 和 Obsidian `教师培训课程` 原始资料，要求 HAI 给建议时更多使用教学通识课的框架、策略和方法。本轮没有继续把整门课堆进系统提示词，而是建立“总方法论、紧凑方法目录、LLM 语义方法路由、完整方法卡注入”的四层结构。

R11.1 根据用户最新校准删除旧总框架，将唯一总方法论改为“备课流程＋教学设计框架”。备课流程包含分析、设计、研发、迭代四个步骤；教学设计框架包含教材分析、学情分析、教学目标、教学重难点、教学环节或学习流程、教学评价或学习评估六个要素。两者分别承担纵向流程定位与横向结构诊断。

方法库现有 35 张结构化方法卡。总领层新增“备课流程＋教学设计框架”，结构层明确“备课四阶段流程”和“教学设计六要素框架”，依据层新增“教学框架三大底层领域”。其中，学习科学解释学习如何发生，教学科学解释有效教学如何发生，教育哲学界定好的教育应具备何种样态。其余下位卡继续覆盖教学设计逻辑链、教材分析、重难点、教学目标、学情洞察、逆向设计、问题链、课堂理答、任务情境、日常课课型、差异化、概念教学、互动讲授、反思和新教师标准。每张卡包含适用情境、不适用边界、核心判断、操作动作、回答聚焦、关联方法、资料来源和来源类型。

同步清理了当前课程源材料中的旧框架表述，包括教学通识课知识模型、逐字稿、官网长文、课程演示、学情分析课程演示和教学设计关系图；关系图文件现更名为 `teaching-design-six-elements-map.html`。`hai-chat` 与 `hai-roundtable-chat` 还会排除线上知识库中可能残留的旧课程切片，防止历史索引重新进入回答上下文。历史数据库迁移和视频上传脚本中的既有课程标题仅作不可变数据记录或文件寻址键，不再作为方法论来源。

主要文件：

- `docs/hai-course-methodology/00-教学通识课总方法论.md`
- `docs/hai-course-methodology/01-教学通识课方法卡索引.md`
- `supabase/functions/_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts`
- `supabase/functions/_shared/hai_orchestrator/methodology_router.ts`
- `supabase/functions/_shared/hai_orchestrator/methodology_router_test.ts`
- `supabase/migrations/20260713150000_hai_r11_course_method_cards.sql`

运行链路变化：`routeSemanticallyWithLlm()` 除 intent、problem rewrite 和 diagnostic module 外，同时从允许目录选择最多两张方法卡，通常只选一张；语义结果优先，代码文本打分只在 LLM 未返回有效方法 id 时兜底。选中的完整卡片和本轮唯一方法聚焦会进入 `response_composer.ts`，方法 id 和选择原因进入 trace。

来源边界：`han_course` 表示哈老师课程原创或稳定使用的方法；`course_adapted_theory` 表示课程吸收改造的外部理论；`consultation_calibration` 表示真实咨询反馈形成的标准。HAI 不得把后两类宣称为哈老师原创。

当前验证：确定性方法路由与关系完整性 10/10；外部模型 16 个语义选卡样本全部命中，其中总方法论、六要素和三大底层领域各自独立命中，无匹配问题返回空数组；6 个真实回答样本全部真正使用选中方法并说明完整课程出处。`deno check`、`tsgo`、`pnpm build` 和 `git diff --check` 均通过，构建只保留既有 Browserslist 与大 chunk 警告。

发布状态：已执行 R09、R10、R11 迁移并写入线上配置，已重新部署 `hai-chat` 与 `hai-roundtable-chat`。当前线上总方法论为“备课流程＋教学设计框架”。

### 9.10 R09-R11.1 线上发布记录（2026-07-13）

- Supabase 项目：`isjflmyhbvdlmcsaewbq`。
- 已执行并登记迁移：`20260705220000`、`20260706090000`、`20260713090000`、`20260713113000`、`20260713150000`。
- 数据库核验：`hai_optimization_log` 已创建；`core_axioms`、`formula_bank`、`han_methodology` 等 9 个目标 Prompt 配置均存在并启用。
- 方法论核验：线上 `han_methodology` 包含备课流程、教学设计框架、学习科学等当前表述，不包含 `CREATE`；所有启用的编排 Prompt 中未检出 `CREATE`。
- Edge Function：`hai-chat` 已升级至 v12，`hai-roundtable-chat` 已升级至 v7，状态均为 `ACTIVE`。
- Secret 核验：DeepSeek 模型配置与 Supabase 运行密钥均已配置。
- 基础探针：两个函数均能启动并在匿名请求处返回 401 `登录状态已失效。`，说明路由和鉴权边界正常。
- 验证边界：本轮没有可用的登录测试账号密码，因此未绕过鉴权执行真实用户端到端生成；下一步应使用正常 HAI 账号完成一轮方法卡命中与回答 trace 验证。

### 9.11 完整提示词快照与 R12 精简编排（2026-07-13，已发布）

R12 新增管理员专用 `capturePromptSnapshot` 调试参数。开启后，`hai-chat` 会在 `done` SSE 事件中返回本轮实际发送的语义路由、首稿生成和可选重写的完整 messages。快照不写入普通用户可读的消息 metadata；本地回归脚本会把它与 AI 回答、token、路由和 trace 一起写入 `docs/hai-quality-runs/` 下的 Markdown 和 JSON。

主回答提示词只保留精简人设与边界、“备课流程＋教学设计框架”名称、意图识别、用户记忆选择与命中内容、问题重构、本轮方法卡和精简风格。教学功能层、完整总方法论、教学公理、诊断框架展开、检索规划、案例、公式、用户素材、通用方法理论库、表达库、重复方法聚焦和独立回答编排层均停止注入，底层资料和代码保留。

同一个“目标、活动、评价对不上”问题的确定性组装对比中，system prompt 从 7,577 估算 token 降到 1,360，降幅 82.1%；当前问题被重复加入消息数组的问题也已修复。新增编排测试会确认所有保留层出现、所有停用层不出现，且 system prompt 低于设定 token 上限。

详细设计、启停矩阵、权限边界和复现命令见 `docs/HAI_PROMPT_SNAPSHOT_AND_COMPACT_ORCHESTRATION.md`。迁移文件为 `supabase/migrations/20260713170000_hai_r12_compact_orchestration.sql`。该迁移已线上执行并登记，`hai-chat` 已部署为 v13。真实管理员快照显示回答生成输入为 1,661 tokens，当前问题只出现一次，六个保留层全部存在，停用层全部未注入。语义路由独立调用为 6,054 tokens，作为后续降本优化点。

### 9.12 R13 semantic router 精简（2026-07-13，已发布）

R13 只调整第一阶段语义路由，不改变已经稳定的回答生成编排。旧 router 每轮注入 35 张方法卡的完整紧凑详情，并重复拼入意图识别、问题重构和诊断路由三段配置，因此线上快照达到 6,054 token。

新链路使用“35 张卡的 id/名称完整索引＋最多 6 张本题候选卡详情”。本地召回只负责缩小模型阅读范围，最终意图、问题重构、诊断模块和方法 id 仍由同一次 LLM 语义判断返回；没有候选的方法也可以从完整索引选择，非教学问题不会强配方法。旧三段配置资料继续保留，但迁移后标记停用，避免后台误显示为正在注入。

验证结果：候选召回 15/15；非教学问题候选为空；生产同款 DeepSeek 路由 16/16；估算输入 token 平均 1,334、最小 1,133、最大 1,821，相比 R12 线上 6,054 典型下降约 78%。完整 system/user prompt 和模型原始 JSON 已落盘到本机 `docs/hai-quality-runs/2026-07-13T09-13-05-535Z-methodology-routing-smoke.md`，该目录不提交 Git。

发布状态：迁移 `20260713180000` 已执行并登记，三段旧 router 配置远程核验均为 disabled；`hai-chat` 已部署为 v14、状态 ACTIVE。管理员真实线上快照的 `semantic_router` 输入为 1,148 tokens，正确识别学习动机问题并选中“任务卷入感双层模型”；同轮 `answer_draft` 为 1,556 tokens。线上快照保存在本机 `docs/hai-quality-runs/2026-07-13T09-15-57-019Z-context-orchestrator-eval.*`。

主要文件：

- `supabase/functions/_shared/hai_orchestrator/semantic_router_prompt.ts`
- `supabase/functions/_shared/hai_orchestrator/semantic_router_prompt_test.ts`
- `supabase/functions/_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts`
- `scripts/run-hai-methodology-routing-smoke.ts`
- `supabase/migrations/20260713180000_hai_r13_compact_semantic_router.sql`

### 9.13 HAI 分享图预览与注册 CTA（2026-07-13，本地完成，待发布）

`/hai` 回答区的“转发”交互已从“生成后自动下载或直接唤起系统分享”改为“生成后先展示预览”。预览弹窗明确提示手机端长按图片保存或转发、电脑端右键保存；关闭弹窗时会回收临时对象 URL，不在页面中创建自动下载链接。

分享海报顶部新增 HAI 注册 CTA，使用项目内固定二维码 `public/images/hai/hai-register-qr.png`，文案为“注册 HAI，免费送 10 万 Token，解答你的备课难题”。二维码、问题和回答均直接绘入 1080 像素宽的 Canvas 长图。

主要文件：

- `src/lib/hai-share.ts`
- `src/pages/HaiPage.tsx`
- `src/components/ui/dialog.tsx`
- `src/test/hai-share.test.ts`
- `src/test/HaiPageInteractions.test.tsx`

验证状态：分享相关 7 个 Vitest 用例通过；`pnpm build` 通过；真实浏览器生成的样例海报为 1080 × 1434，CTA、二维码、问题区和回答区均完整显示。`pnpm lint` 的 TypeScript 与 Biome 阶段通过，最终阶段因本机缺少 `ast-grep` 命令未执行。

### 9.14 HAI 运营看板与配置页职责拆分（2026-07-13，本地完成，待发布）

`/admin` 数据看板新增“HAI 看板”，默认统计近 30 天，并支持近 7 天、30 天和 90 天切换。调用次数只统计 `hai.request.*` 的最终事件（`completed / cached / failed`），避免把同一请求的 `started` 和最终记录重复计数。

看板包含：使用次数、使用人数、Token 总量、人均与单次 Token、调用成功率、平均响应时间、平均质检分、未处理告警、每日调用与 Token 趋势、输入/输出 Token 结构、单用户 Token 消耗排行榜、最近调用、额度与运行告警、最近编排 trace。使用事件按 1000 条分页读取，避免只拿到 PostgREST 默认首批记录；用户手机号在看板中脱敏显示。

原 HAI 配置页中的“最近用量、额度告警、最近编排 trace”已迁移到数据看板。配置页继续保留上下文编排参数、模块上限、分层 Prompt、内测授权、邀请码、额度策略、模型参数、知识库和 Prompt 发布等可写能力。

主要文件：

- `src/components/admin/HaiDashboardSection.tsx`
- `src/db/hai-analytics.ts`
- `src/pages/AdminPage.tsx`
- `src/components/admin/HaiManagementSection.tsx`
- `src/test/HaiDashboardSection.test.tsx`
- `src/test/hai-analytics.test.ts`

数据层直接读取现有 `hai_usage_events`、`hai_usage_alerts` 和 `hai_messages.metadata.hai_context_trace`，没有新增数据库表或迁移。统计聚合与界面交互共 4 个新增 Vitest 用例通过；全量测试 59/59 通过；`pnpm build` 通过。`pnpm lint` 的 TypeScript 与 Biome 阶段通过，最终阶段仍因本机缺少 `ast-grep` 命令未执行。

### 9.15 首次进入个人画像问卷（2026-07-16，本地完成）

`/hai` 新增页面中央的首次进入个人信息组件，采用一题一屏的 6 步点击流程，避免让教师填写长表单：

1. 教学阶段：幼儿园、小学、初中、高中、中职、高校及其他教育场景。
2. 学科 / 学习领域：支持多选；幼儿园显示五大领域相关选项，高校和专业课教师可选择“其他 / 专业课”后填写名称。
3. 教龄。
4. 当前主要角色。
5. 最常遇到的教学难题，最多选择 3 项。
6. 希望 HAI 默认采用的支持方式。

提交后一次性写入 6 条 `hai_user_memories`，类别使用 `basic_info`、`challenge` 和 `teaching_preference`。这些行统一标记 `source_type = profile_onboarding_v1`、`confidence = 1`，现有 Context Orchestrator 会按意图继续选择并加载相关记忆。

首次完成判定直接查询同一 `source_type`，不依赖记忆是否仍为 active；因此用户以后在侧栏归档某条画像记忆，也不会被误判为从未填写。问卷允许“稍后再填写”，本次进入不再打扰，下次进入仍会再次提示。

主要文件：

- `src/components/hai/HaiProfileOnboardingDialog.tsx`
- `src/pages/HaiPage.tsx`
- `src/db/hai-api.ts`
- `src/test/HaiPageInteractions.test.tsx`

本功能复用现有 `hai_user_memories` 表和 RLS，没有新增数据库迁移或 Edge Function。
