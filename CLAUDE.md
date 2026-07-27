# CLAUDE.md — Claude Code 项目入口

> 本文件是 Claude Code 进入本项目时的**默认优先阅读文档**。它解决一个问题：**「要改某个功能，先去哪个文件夹找」**，避免每次从头遍历。
> 内容定位：项目结构地图 + 功能定位索引 + 关键机制速查。**当前状态、路线图、部署证据不在本文件维护**，一律以 `docs/项目需求与开发进展.md`（唯一接手文档）为准。
> 与 `AGENTS.md` 的关系：`AGENTS.md` 面向 CodeX，内容更精简；本文件补充目录细节与功能定位，基础信息（命令/栈/红线）两者一致。

---

## 1. 一句话定位

教学设计师俱乐部官网：面向已付费会员的**课程学习 + 运营管理 + HAI 教研工作**平台。
拉新成交在外部平台（小红书/视频号），本站只承接老用户看课与教研；**不要建议站内商业化/转化功能**。

## 2. 技术栈

- 前端：React 18 + TypeScript + Vite + React Router + Tailwind + Radix UI（`src/components/ui/`）
- 数据/鉴权：Supabase（Auth / Postgres / RLS / Edge Functions，Deno 运行时）
- 媒体：Cloudflare R2；部署：Cloudflare Pages
- HAI 模型：DeepSeek（Edge Function 调用）
- 包管理：**pnpm**（勿用 npm install，会在 pnpm 项目报 matches 错；装依赖用 `pnpm add`）

## 3. 本地运行与验证

```bash
pnpm install                              # 装依赖
pnpm dev                                  # 开发服务器 http://127.0.0.1:5173
pnpm exec tsgo -p tsconfig.check.json     # 类型检查（用 tsgo，不是 tsc）
pnpm exec vitest run                      # 单测
pnpm build                                # 生产构建（vite build + 生成 SEO html）
# Edge Function：
deno check supabase/functions/<name>/index.ts
deno test  supabase/functions/_shared/..._test.ts
# lint 三件套：tsgo + biome + ast-grep（ast-grep 需 brew install，未列入 package.json）
pnpm lint
```

> **任何功能更新须先在本地跑通再部署**（typecheck + 相关单测 + 手动验证）。

## 4. 红线（未经用户明确要求，禁止做）

- ❌ 不发布代码、不 push、不部署 Edge Function
- ❌ 不应用远端数据库迁移（`supabase db push` / `apply-migration.mjs`）
- ❌ 不改写已发布的历史 migration 来伪装新迁移；新增结构 → 新建 migration 文件
- ❌ 不清理分支、工作树或本地证据
- ❌ 不新建并行的「接手文档 / 需求池 / session 进展」Markdown；状态变更写回 `docs/项目需求与开发进展.md`
- ❌ 浏览器端只允许 publishable key；密钥只放本地 `.env*`（已 gitignore）或部署平台

---

## 5. 目录结构总览

```
俱乐部官网/
├── src/                      # 前端全部代码（页面/组件/数据访问/工具/测试）
├── supabase/
│   ├── migrations/           # 数据库结构、RLS、RPC、种子（按时间戳命名，只增不改）
│   ├── functions/            # Edge Functions（Deno）+ _shared/ 共享逻辑与提示词
│   ├── skill-sources/        # HAI Chat Skill 的源包（SKILL.md + references/），按版本归档
│   └── seed-data/            # 种子 JSON（思政教材、思政公开课 work skill）
├── scripts/                  # 一次性运维脚本（迁移应用、R2 上传、HAI 评测、SEO 生成等）
├── docs/                     # 机制/部署/课程/测试证据文档；唯一接手文档在此
├── .claude/skills/           # 项目级 Claude skill（目前仅 hai-daily-optimization）
├── public/                   # 静态资源
├── AGENTS.md                 # CodeX 入口文档（与本文件基础信息一致）
└── CLAUDE.md                 # ← 本文件
```

### 5.1 `src/` 详细

```
src/
├── main.tsx / App.tsx / routes.tsx     # 入口 + 路由表（路由名/路径/可见性/预加载在此）
├── pages/                              # 顶层页面，与 routes.tsx 一一对应
│   ├── HomePage / LearningPage / LearningMapPage / CoursesPage / CourseDetailPage
│   ├── PlusTrackPage / TeacherAiCoursesPage / ResourcesPage / ActivityDetailPage
│   ├── HaiPage                         # HAI Chat 单聊主页面（/hai/chat）
│   ├── HaiWorkPage                     # ★ HAI「帮你干活」工具页（/hai/work/:toolSlug）
│   ├── HaiWorkTaskPage                 # HAI Work 单个任务详情页（产物/重生成/导出）
│   ├── AdminPage / AdminManagePage     # 数据看板 / 数据维护后台
│   └── Login / Register / ForgotPassword / Settings
├── components/
│   ├── ui/                             # Radix 基础组件（button/dialog/tabs/select/sheet...）
│   ├── hai/                            # HAI 外壳：HaiWorkspaceShell / HaiWorkShell / HaiModeNavigation / TaskActionMenu / HaiProfileOnboardingDialog
│   ├── admin/                          # 后台分区组件（Hai* / Course* / Student* / Operations* ...）
│   │   └── hai/ModuleParamFields.tsx   # 后台编辑 HAI 模块参数的表单
│   ├── home/ learning/ course/ layout/ navigation/ common/ pricing/ testimonials/
├── db/                                 # 前端数据访问层（调 Supabase）
│   ├── api.ts admin-api.ts admin-operations.ts   # 通用 / 后台 / 运营数据
│   ├── hai-api.ts                     # ★ HAI 前端 API（Chat/Work 调用、SSE 流式）
│   ├── hai-analytics.ts course-questions.ts course-media.ts
│   └── supabase.ts errors.ts
├── lib/                                # 纯工具/常量
│   ├── hai-docx.ts                    # ★ Work 产物导出 Word（docx 库，浏览器端生成）
│   ├── hai-intents.ts hai-navigation.ts hai-share.ts
│   ├── sse.ts                         # SSE 流式解析
│   ├── constants.ts access-control.ts time.ts utils.ts ...
├── contexts/AuthContext.tsx            # 全局鉴权上下文
├── hooks/                              # use-mobile / useHome* / useAnnouncementFeed
├── types/                              # database.generated.ts（Supabase 生成，勿手改）/ types.ts
└── test/                               # vitest 单测，与源文件同名（HaiWorkPage.test.tsx 等）
```

### 5.2 `supabase/functions/`（Edge Functions）

```
functions/
├── _shared/                            # ★ HAI 共享核心，改动 HAI 必看
│   ├── hai.ts                          # HAI 通用入口逻辑
│   ├── hai_work.ts                     # ★★★ HAI Work 全部工具定义（见 §6.2）
│   ├── hai_chat/                       # HAI Chat 子模块（intent_classifier / response_evaluator / method_cards / memory_selector / response_format）
│   ├── hai_orchestrator/               # ★ HAI 编排与提示词（见 §6.3）
│   │   ├── prompts.ts                  # 核心提示词常量（coreIdentity/safetyBoundaries/hanMethodology/stylePack）
│   │   ├── prompts/*.md                # 提示词片段（core_identity / han_methodology / style_pack / safety_boundaries / evaluator）
│   │   ├── modules/*.md                # 诊断模块说明（lesson_plan_diagnosis / teaching_design / ...）
│   │   ├── methodology_router.ts / diagnostic_router.ts / retrieval_planner.ts / response_composer.ts
│   │   ├── knowledge/                  # 公理/公式/方法/案例/表达 知识库
│   │   └── evals/                      # 评测集（golden_questions.json）
│   ├── hai_chat_skill.ts / hai_skill / hai_daily_review.ts / hai_trace.ts
│   └── supabase-keys.ts
├── hai-chat/index.ts                   # ★ HAI Chat Edge Function（ACTIVE）
├── hai-work/index.ts                   # ★ HAI Work Edge Function（编排 4 个工具）
├── hai-roundtable-chat/ hai-daily-review/ hai-access-status/ hai-ingest-material/
├── hai-method-cards-admin/ hai-redeem-invite/
├── course-content/ course-cover/ upload-course-file/ upload-course-image/
└── admin-reset-password/
```

### 5.3 `docs/`

- **`项目需求与开发进展.md`** — ★ 唯一接手入口（需求池 + 进展台账 + 状态词体系），动手前先读
- `HAI_当前功能实现机制说明.md` / `HAI_WORK_MODE_IMPLEMENTATION.md` — HAI 机制说明
- `HAI_Skill构建资料总集.md` — Skill 构建素材
- `HAI_*CALIBRATION*.md` / `HAI_PROMPT_SNAPSHOT*.md` — 提示词校准与快照记录
- `HAI_DEPLOYMENT_CHECKLIST.md` — 部署清单
- `hai-quality-runs/` `hai-optimization-runs/` — HAI 评测与优化运行证据
- `归档/` — 已退役内容

---

## 6. 功能定位地图（★ 核心：改什么 → 去哪）

### 6.1 路由与页面

路由定义在 **`src/routes.tsx`**（路由名 / path / 可见性 / 预加载），页面在 **`src/pages/`**。改导航或加页面，先动这两处。

主要路由：`/` 首页 · `/courses` `/courses/:id` `/courses/plus/:trackId` `/teacher-ai-courses` 课程 · `/learning` `/learning-map` 学习 · `/resources` · `/hai/chat` HAI 单聊 · `/hai/work` `/hai/work/:toolSlug` `/hai/work/tasks/:taskId` HAI 干活 · `/admin` `/admin/manage` 后台。

### 6.2 HAI「帮你干活」(Work) — 当前主线功能

**4 个工具**（`HaiWorkToolSlug`，定义在 `supabase/functions/_shared/hai_work.ts` 顶部）：

| toolSlug | 中文名 | 必填字段（`validateWorkInput`） |
|---|---|---|
| `lesson-diagnosis` | 教案诊断 | stage, subject, topic + 教案正文/文件 |
| `segment-optimization` | 环节优化 | stage, subject, topic, segment_type, current_design, desired_outcome |
| `subject-lesson-design` | 研发教学方案（思政公开课） | stage, subject, grade, volume, unit, topic, teaching_mode, lesson_type |
| `teaching-design` | 教学设计（逆向设计） | stage, subject, design_type, desired_outcomes, unit_duration |

**改 Work 功能时去这几处：**

| 要改的东西 | 文件位置 |
|---|---|
| 工具列表 / toolSlug 枚举 / 字段校验 / 字段中文名 | `_shared/hai_work.ts`（`validateWorkInput`、`fieldLabel`） |
| 提示词拼装（system/user） / 教材与 reference 注入 | `_shared/hai_work.ts`（`buildWorkPrompt`） |
| AI 产物 → Markdown 渲染（每个工具一个 render 函数） | `_shared/hai_work.ts`（`renderWorkMarkdown` → `renderDiagnosis`/`renderSegment`/`renderLessonDesign`） |
| 产物 JSON 校验与补丁 | `_shared/hai_work.ts`（`parseWorkJson`/`validateWorkOutput`/`patchWorkOutput`） |
| Edge Function 编排（调模型、流式、存任务） | `hai-work/index.ts` |
| **前端表单字段（学段/学科/课题/选项）** | ★ `src/pages/HaiWorkPage.tsx` |
| 工具视觉配置（名称/描述/图标） | `HaiWorkPage.tsx` 的 `HAI_WORK_TOOL_CONFIG`（≈49 行） |
| 表单原子组件 | `HaiWorkPage.tsx` 的 `SelectField`/`TextField`/`FixedField`（≈631 行起） |
| 学段选项数组 `stages` / 环节类型 / 设计类型 | `HaiWorkPage.tsx`（≈84 行起） |
| 任务详情 / 重生成 / 导出 | `src/pages/HaiWorkTaskPage.tsx` + `src/lib/hai-docx.ts` |
| 后台管理 Work Skill / reference | `src/components/admin/HaiWorkSkillManagement.tsx` |
| Skill 源包（提示词模板 / input_contract / output_contract / references） | DB 表 `hai_work_skills` + `supabase/seed-data/` |

> **学科/学段字段**：Work 表单（`HaiWorkPage.tsx`）与 onboarding（`HaiProfileOnboardingDialog.tsx`）的学段、学科已统一到 `src/lib/hai-subject-options.ts`（导出 `HAI_STAGES` / `HAI_GENERAL_SUBJECTS` / `HAI_KINDERGARTEN_SUBJECTS` / `subjectsForStage(stage)`）。Work 的学科是 `SelectField` 下拉、学段切换联动刷新学科列表；新增需采集学段/学科的功能一律从此处取值。`subject-lesson-design`（思政公开课）因工具整体思政专属，学科仍为写死的 `FixedField`。

### 6.3 HAI Chat（问问哈老师）

| 要改的东西 | 文件位置 |
|---|---|
| 核心提示词常量（身份/边界/方法论/风格） | `_shared/hai_orchestrator/prompts.ts` + `prompts/*.md` |
| 诊断模块说明（教学设计/学情/课堂管理...） | `_shared/hai_orchestrator/modules/*.md` |
| 意图分类 / 方法卡 / 记忆 / 响应评估 | `_shared/hai_chat/*.ts` |
| 编排路由（方法论/诊断/检索/响应合成） | `_shared/hai_orchestrator/*_router.ts` / `response_composer.ts` |
| Edge Function | `hai-chat/index.ts` |
| 提示词配置（DB 可热更） | migration `20260705093000_hai_orchestrator_prompt_configs.sql` → 表 `hai_orchestrator_prompt_configs` |
| Skill 源包（按版本归档） | `supabase/skill-sources/hai-consultation/v*/` |
| 前端页面 | `src/pages/HaiPage.tsx` + `src/components/hai/HaiWorkspaceShell.tsx` |

### 6.4 课程 / 学习 / 后台

- 课程内容与媒体：`src/db/api.ts` `course-media.ts` + Edge `course-content/` `course-cover/` `upload-course-*`
- Plus 篇章结构：`src/lib/plusCourseStructure.ts`
- 学习地图：`src/components/learning/map/*` + `src/lib/learningMap.ts`
- 后台分区：`src/components/admin/*Section.tsx`（每个 Section 一个管理模块），外壳 `AdminPageShell.tsx`
- 内容运营：`src/components/admin/content/`

### 6.5 数据库迁移

- 位置：`supabase/migrations/`，文件名 `YYYYMMDDHHMMSS_描述.sql`
- **只增不改**：不改写已发布的历史迁移；新结构新建文件
- 应用本地/远端迁移：`scripts/apply-migration.mjs`（**需用户授权才跑**）
- 关键 HAI 表（见对应 migration 文件名）：`hai_work_*` `hai_chat_skills` `hai_work_skills` `hai_orchestrator_prompt_configs` `hai_quality_*` `hai_optimization_log` 等

### 6.6 运维脚本 `scripts/`

迁移应用 `apply-migration.mjs` · R2 上传 `upload-r2.mjs` `batch-upload-r2.mjs` `upload-*-videos.mjs` · 数据导出 `export-data.mjs` `export-insert-sql.mjs` · HAI 评测 `run-hai-*-eval.mjs` `run-hai-prompt-ab-test.mjs` · HAI 每日导出 `hai-daily-export.mjs` · SEO `generate-seo-html.mjs` · 教材/思政 skill 构建 `build-*.mjs` `render-*.mjs`。

---

## 7. 关键机制速查

- **表单渲染**：HAI Work 表单**硬编码**在 `HaiWorkPage.tsx`（非 schema 驱动），加字段需同步改：前端 JSX + `initialForm` + `validateForm` + 后端 `validateWorkInput` + `fieldLabel`。
- **Work 产物格式**：AI 返回 JSON → `parseWorkJson` 解析 → `validateWorkOutput` 校验 → `renderWorkMarkdown` 渲染成 Markdown 展示 / 导出（Word 由 `hai-docx.ts` 生成）。
- **Work Skill 匹配**：`selectWorkSkill` 按 `match_criteria`（stages/subjects/lesson_types/teaching_modes/design_types）匹配候选 Skill；思政公开课按 `teaching_mode` 加载对应 V3 模板 reference。
- **鉴权**：`src/contexts/AuthContext.tsx`；RLS 在数据库层；前端 `src/lib/access-control.ts`。
- **流式**：`src/lib/sse.ts` 解析 SSE，Work 通过 `streamHaiWork`（`src/db/hai-api.ts`）流式输出。
- **测试**：`src/test/*.test.ts(x)`，与源文件同名；改 HAI Work 时跑 `HaiWorkPage.test.tsx` `HaiWorkTaskPage.test.tsx` `hai-docx.test.ts`。

## 8. 相关文档索引

- 接手与进展：`docs/项目需求与开发进展.md`（动手前必读）
- HAI 机制：`docs/HAI_当前功能实现机制说明.md`、`docs/HAI_WORK_MODE_IMPLEMENTATION.md`
- 部署：`docs/HAI_DEPLOYMENT_CHECKLIST.md`、`docs/内容运营后台-部署与使用.md`
- CodeX 入口：`AGENTS.md`

---

## 9. 部署、迁移与推送流程

> 这些操作都改远端/线上，**必须用户明确授权**才能执行（见 §4 红线）。部署前先本地验证：`pnpm exec tsgo -p tsconfig.check.json` + `pnpm exec vitest run` + `deno test` + `pnpm exec biome check` 全绿。

### 9.1 DB 迁移（migration）

1. **新建** `supabase/migrations/YYYYMMDDHHMMSS_描述.sql`，**只增不改**（不改写已发布的历史 migration）。
2. **dry-run 核对**：`supabase db push --dry-run`。确认只推新 migration、无 schema 漂移（本仓库约定远端为唯一真相）。
3. **应用**：`yes | supabase db push`（`yes` 自动确认交互提示）。失败的 migration 不记为 applied，可改文件重推。
4. **查远端数据**：`supabase db query "SQL"` 默认连**本地** Postgres（常未启动，报 54322 拒绝连接）；查远端用 Dashboard SQL Editor 或带 linked 连接。

> ⚠️ **Work Skill 版本化约束（已踩坑）**：触发器 `hai_protect_work_skill_version_snapshot` 禁止 UPDATE 已 `published`/`archived` 版本的 `prompt_template / input_contract / output_contract / snapshot_hash / source_metadata`（报 `已发布或归档的 Work Skill 版本快照不可修改`）；`status` 本身可改。另有 partial unique index「每 skill 只一个 published」、`unique(skill_id, version_label)`。
> **更新已发布 Work Skill prompt 的正确方式**：① 把旧 published 版本 `status` 改成 `archived`（`where status='published' and version_label <> '新标签'`）；② INSERT 新版本（新 `version_label`，如 `markdown-v2`，`status='published'`，`on conflict (skill_id, version_label) do nothing` 保幂等）。范例：`20260727100000_hai_segment_optimization_markdown_prompt.sql`。

### 9.2 Edge Function 部署

- `supabase functions deploy <name>`（如 `supabase functions deploy hai-work`），部署到 linked project，自动打包 `supabase/functions/_shared/` 下被引用的依赖。
- `WARNING: Docker is not running` 只是警告，deploy 不需要 Docker。
- **改了 `_shared/` 下文件（如 `hai_work.ts`）后，必须重新部署引用它的 function**（hai-work / hai-chat 等），否则线上不生效。
- 部署后可在 Supabase Dashboard > Functions 查看版本与日志。

### 9.3 前端（Cloudflare Pages）

- 推 GitHub 后，若 Cloudflare Pages 绑了 GitHub 自动部署，会自动构建上线；否则手动在 Dashboard 触发。本地预览构建：`pnpm build`。

### 9.4 代码推送 GitHub

- 本仓库工作流：**直接在 `master` 提交并推送**（单人运营项目，git 历史均在 master）。
- commit 风格：中文 + 类型前缀，如 `feat(hai-work): ...`、`docs: ...`、`fix: ...`。
- **精确 `git add` 指定文件**，不要 `git add -A`——避免纳入工作树里 pre-existing 的无关改动（如 `.claude/skills/...`）。
- `git push origin master`；可按语义分多个 commit（docs / feat 分开）。

### 9.5 改 HAI Work 后端的推荐顺序

1. 本地验证全绿（tsgo + vitest + deno + biome）
2. DB migration：`db push --dry-run` → `db push`
3. Edge Function：`supabase functions deploy hai-work`（若改了 `_shared/hai_work.ts`）
4. 代码推 GitHub：精确 `git add` → `commit` → `push origin master`
5. 前端：若 Cloudflare Pages 自动部署则等待，否则手动触发
6. 真实账号端到端复核 + 把变更登记进 `docs/项目需求与开发进展.md` §2.x

---

## 给 Claude 的工作准则

1. **动手前**：读本文件定位 → 读 `docs/项目需求与开发进展.md` 看状态 → `git status` 看工作树。
2. **改功能**：先用本文件 §6 的「功能定位地图」锁定文件，不要遍历全部目录。
3. **完成后**：按实际证据更新 `docs/项目需求与开发进展.md`（区分已合并/已部署/线上已验收），不在本文件记状态。
4. **遵守 §4 红线**：不部署、不应用远端迁移、不新建并行管理文档。
