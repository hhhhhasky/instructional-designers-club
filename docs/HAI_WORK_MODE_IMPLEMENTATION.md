# HAI Chat + Work 双模式实施说明

## 已实现范围

- Chat 保持原执行链，入口为 `/hai/chat`；`/hai` 仅作默认跳转。
- Work 入口为 `/hai/work`，三个首发工具为教案诊断、环节优化、学科定制设计。
- Work 使用独立的 `hai-work` Edge Function，不经过 Chat 的语义路由、编排器或完整教案边界。
- 每次工作保存为任务、运行和版本化产物。追改产生新的 artifact，失败运行不占版本号。
- 支持粘贴材料以及 TXT、Markdown、HTML、JSON、CSV、DOCX、文字型 PDF；扫描 PDF 暂不支持 OCR。
- 首版导出支持复制全文、Markdown 下载和浏览器打印/另存 PDF。

## 数据与安全边界

迁移文件：`supabase/migrations/20260721150000_hai_work_mode.sql`；浏览器授权收紧迁移：`supabase/migrations/20260721161000_hai_work_privilege_hardening.sql`。

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

教案诊断规范已从 `isd_project/public/js/data/prompt.js` 固化到迁移中，不产生运行时目录依赖。输出必须包含固定顺序的七要素、四项系统关系和 3–6 条优先建议；不合格结构会进行一次修复，仍不合格则记录失败运行。

## 发布与回滚

建议顺序：

1. 应用 `20260721150000_hai_work_mode.sql`。
2. 部署 `hai-work` Edge Function。
3. 发布前端。
4. 使用真实匿名材料完成三条端到端验收。
5. 在后台 HAI 功能配置中启用三个 Work 模块。

迁移故意让三个 Work 模块保持关闭。验收完成后可在后台开启，或执行：

```sql
update public.hai_feature_modules
set is_enabled = true
where surface_mode = 'work'
  and slug in ('lesson-diagnosis', 'segment-optimization', 'subject-lesson-design');
```

紧急回滚只需关闭 Work，不影响 Chat：

```sql
update public.hai_feature_modules
set is_enabled = false
where surface_mode = 'work';
```

## 本地验证命令

```bash
deno check supabase/functions/hai-work/index.ts
deno test supabase/functions/_shared/hai_work_test.ts
pnpm exec vitest run
pnpm run build
```

`pnpm run lint` 的 TypeScript 与 Biome 阶段可通过；当前机器未安装项目脚本引用的 `ast-grep` 命令，因此完整 lint 脚本会在最后一步退出。

## 2026-07-21 远端部署记录

- `20260721150000_hai_work_mode.sql` 已精确应用并登记迁移历史。
- `20260721161000_hai_work_privilege_hardening.sql` 已应用，显式撤销 Supabase 默认的浏览器宽泛写权限。
- `hai-work` 已部署为远端版本 2，并启用平台 JWT 校验；CORS 预检返回 200，未登录 POST 在网关返回 401。
- 远端存在 6 张 Work 表，6 张表全部启用 RLS；3 个通用 Skill 版本已发布，1 个“思政课公开课”占位 Skill 保持停用。
- 三个 Work 功能模块均保持 `is_enabled=false`，待真实匿名材料验收后再开放。
- `authenticated` 对任务、运行、产物只具有 SELECT；只允许更新任务的 `status` 与 `archived_at`。`anon` 对 Work 表无任何表权限。
