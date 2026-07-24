# 项目说明

教学设计师俱乐部官网是面向既有会员的课程学习、运营管理与 HAI 教研工作平台。

## 本地运行与验证

- 安装依赖：`pnpm install`
- 开发服务器：`pnpm dev`（默认 `http://127.0.0.1:5173`）
- 类型检查：`pnpm exec tsgo -p tsconfig.check.json`
- 测试：`pnpm exec vitest run`
- 生产构建：`pnpm build`
- Edge Function：按改动范围运行 `deno check` 和对应的 `deno test`

## 技术栈

React 18、TypeScript、Vite、React Router、Tailwind、Supabase（Auth/Postgres/RLS/Edge Functions）与 Cloudflare R2/Pages。

## 目录与约定

- `src/`：前端页面、组件、数据访问与测试。
- `supabase/migrations/`：数据库结构、RLS、RPC 与种子配置；不要改写已经发布的历史迁移来伪装新迁移。
- `supabase/functions/`：Edge Functions 与共享 HAI 运行逻辑。
- `docs/项目需求与开发进展.md`：唯一的需求、进展与接手入口；不要新建并行的接手文档、需求池或 session 进展文档。
- `docs/` 其他文件只保存机制、部署、课程内容和测试证据；状态变化同步回唯一管理文档。
- 密钥只放在已忽略的本地环境文件或部署平台；浏览器端只允许 publishable key。
- 未经用户明确要求，不发布代码、不应用远端迁移、不部署 Edge Function，也不清理分支、工作树或本地证据。

## 当前状态与下一步

当前代码基线、线上核验边界、开放需求和下一切片以 `docs/项目需求与开发进展.md` 为准。开始工作前先读该文档并检查 `git status`；完成后按实际证据更新同一文档，明确区分已合并、已部署和线上已验收。
