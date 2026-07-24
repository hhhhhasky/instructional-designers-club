# HAI Chat + Work 双模式实施说明

> 文档性质：机制、部署与验收说明，不单独维护项目进展；当前状态与下一步统一见 `docs/项目需求与开发进展.md`。

## 已实现范围

- Chat 保持原执行链，入口为 `/hai/chat`；`/hai` 仅作默认跳转。
- Work 入口为 `/hai/work`，三个首发工具为教案诊断、环节优化、思政公开课设计。
- Work 使用独立的 `hai-work` Edge Function，不经过 Chat 的语义路由、编排器或完整教案边界。
- 每次工作保存为任务、运行和版本化产物。追改产生新的 artifact，失败运行不占版本号。
- 支持粘贴材料以及 TXT、Markdown、HTML、JSON、CSV、DOCX、文字型 PDF；扫描 PDF 暂不支持 OCR。
- 首版导出支持复制全文、Markdown 下载和浏览器打印/另存 PDF。

## 数据与安全边界

迁移文件按顺序为：

1. `supabase/migrations/20260721150000_hai_work_mode.sql`
2. `supabase/migrations/20260721161000_hai_work_privilege_hardening.sql`
3. `supabase/migrations/20260721200000_hai_politics_public_lesson_tool.sql`
4. `supabase/migrations/20260721203000_hai_skill_controls_tool_visibility.sql`

新增数据表：

- `hai_work_skills`：Skill 匹配条件、优先级和通用降级标记。
- `hai_work_skill_versions`：草稿、已发布、归档版本及输入输出契约。
- `hai_work_tasks`：用户任务容器。
- `hai_work_runs`：幂等请求、输入和 Skill 快照、状态、Token 与错误。
- `hai_work_artifacts`：JSON 与 Markdown 产物及父版本关系。
- `hai_work_task_materials`：任务和用户私有素材的关联。

用户只能读取自己的任务、运行和产物，并只能归档自己的任务。运行与产物由 Edge Function 写入，浏览器不能伪造版本或 Token 数据。Skill 提示词对普通用户不可见，仅管理员可管理。

`hai_match_selected_material_chunks` 只检索调用者明确选中的材料 ID，并再次校验素材所有权。`hai_mark_stale_work_runs` 会把超过 10 分钟仍处于 queued/running 的运行转为可重试失败。

## Skill 与诊断标准

初始种子包括三个可发布的通用 Skill，以及一个停用的“思政课公开课”专属 Skill 空位。匹配顺序为：条件更具体的专属 Skill → 优先级 → 该功能通用降级 Skill。

前端工具入口仍由 `hai_feature_modules` 提供名称、说明和排序，但启停状态由 Skill 自动控制：所属模块存在至少一个“已发布且已启用”的 Skill 时，工具显示；停用最后一个可用 Skill 后，工具隐藏。新增 Skill 会参与所属工具的能力匹配，但不会自动创建一套缺少表单和输出契约的新工具入口。

教案诊断规范已从 `isd_project/public/js/data/prompt.js` 固化到迁移中，不产生运行时目录依赖。输出必须包含固定顺序的七要素、四项系统关系和 3–6 条优先建议；不合格结构会进行一次修复，仍不合格则记录失败运行。

## 发布与回滚

建议顺序：

1. 按“数据与安全边界”列出的顺序应用四个迁移。
2. 部署 `hai-work` Edge Function。
3. 发布前端。
4. 使用真实匿名材料完成三条端到端验收。
5. 在后台为每个 Work 工具发布并启用至少一个 Skill；模块可见性会由数据库函数自动重算。

不要再直接编辑 `hai_feature_modules.is_enabled` 作为日常启停方式；`20260721203000_hai_skill_controls_tool_visibility.sql` 之后，Work 工具的可见性以已发布且启用的 Skill 为准。

紧急回滚可在后台逐个停用 Skill；需要一次性关闭全部 Work 工具时执行：

```sql
begin;
update public.hai_work_skills
set is_enabled = false, updated_at = now();
select public.hai_recompute_work_module_enabled(slug)
from public.hai_feature_modules
where surface_mode = 'work';
commit;
```

该回滚不影响 Chat；恢复时应在后台重新启用已经发布且审核通过的 Skill。

## 本地验证命令

```bash
deno check supabase/functions/hai-work/index.ts
deno test supabase/functions/_shared/hai_work_test.ts
pnpm exec vitest run
pnpm run build
```

2026-07-22 本地复核：前端全量 95 项测试、生产构建、完整 lint、Deno 7 项 Work 测试与 `hai-work` 类型检查均通过。构建仍有单个主 JS chunk 超过 500 kB 和 Browserslist 数据较旧的受控 warning。

## 2026-07-21 远端部署记录

- `20260721150000_hai_work_mode.sql` 已精确应用并登记迁移历史。
- `20260721161000_hai_work_privilege_hardening.sql` 已应用，显式撤销 Supabase 默认的浏览器宽泛写权限。
- `hai-work` 已部署为远端版本 2，并启用平台 JWT 校验；CORS 预检返回 200，未登录 POST 在网关返回 401。
- 远端存在 6 张 Work 表，6 张表全部启用 RLS；3 个通用 Skill 版本已发布，1 个“思政课公开课”占位 Skill 保持停用。
- 三个 Work 功能模块均保持 `is_enabled=false`，待真实匿名材料验收后再开放。
- `authenticated` 对任务、运行、产物只具有 SELECT；只允许更新任务的 `status` 与 `archived_at`。`anon` 对 Work 表无任何表权限。

2026-07-22 复核补充：`20260721200000` 与 `20260721203000` 也已在远端迁移历史中，`hai-work` 仍为 ACTIVE v2；正式站 `/hai/work` 返回 200，公开 bundle 已包含“思政公开课设计”和 Skill 启用约束。当前未提交的任务详情页 DB 元数据与服务端默认文案修补不在该线上构建中；三个工具的实时启停状态与真实账号端到端流程仍待复验。
