# HAI 子系统接手文档

> 生成时间：2026-07-03
> 最后更新：2026-07-03
> 状态：✅ 数据库迁移已执行 · ✅ Edge Functions 已部署 · ✅ 核心单聊测试面已简化 · ✅ 旧 HAI 知识库已迁移 · ⏳ 尚未提交 git

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

当前前端状态（2026-07-03 更新）：
- `/hai` 页面不再显示“单聊 / 圆桌”切换，发送固定走 `hai-chat`。
- `/hai` 页面不再显示“诊断教案 / 教学灵感”入口，只显示并默认使用 `ask-han`（问问哈老师）。
- “素材依据”面板保留已有素材列表和删除能力，但上传素材入口已隐藏；后端 `hai-ingest-material`、Storage 和素材表仍保留。

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

### 5.8 ✅ 旧 Prompt — 已抽取并发布

`ask-han` 当前发布版本：`legacy-hai-prompts-2026-07-03`

内容来源：
- 旧 HAI 技能提示词（教学目标、真实任务、教案诊断、整课备课、多视角审视）
- 旧 HAI 角色提示词（班主任、教研员、教研组长、创意教师、知心教师、技术教师）
- 旧 HAI 主教练协议（追问而非代笔、一次推进一个关键点、具体克制）

### 5.9 🟡 后续事项

| 事项 | 说明 |
|---|---|
| 继续打磨 `ask-han` Prompt | 当前已发布旧 HAI 合并版 Prompt，需要用真实问题继续测试和迭代 |
| 知识库 ranking 优化 | 当前文本相似度可用，但短查询可能误召回；建议加 title/topic/tags 权重或接 embedding |
| 邀请码流程端到端测试 | 用一个非 admin 用户测试：访问 /hai → 输入 HAI2026 → 兑换 → 发消息 |
| 圆桌模式测试 | 后端保留，前端入口当前隐藏；待核心单聊稳定后恢复入口测试 |
| 素材上传 + 解析测试 | 后端保留，前端入口当前隐藏；待核心单聊稳定后恢复入口测试 |
| 提交 git | 建议两个 commit: ① infra（迁移/函数/deno）② 前端 |

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
| ~~P1~~ ✅ | 发布首版正式 Prompt | 已发布旧 HAI 合并版 `legacy-hai-prompts-2026-07-03`，后续继续真实问题迭代 |
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
