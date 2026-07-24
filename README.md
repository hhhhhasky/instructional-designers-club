# 教学设计师俱乐部官网

教学设计师俱乐部的官网与会员学习平台。项目集成了课程展示、会员权限、学习记录、教学设计学习地图、资源中心和运营管理后台。

线上站点：[https://idclub.hasky.top](https://idclub.hasky.top)

## 核心功能

- **课程体系**：免费课程、教学通识课 Plus 和教师 AI 课 Pro，支持按篇章、系列和单课组织内容。
- **多形态课程内容**：视频、音频、Markdown 长文、图片集、课程精华和会议回放链接。
- **会员与权限**：基于 Supabase Auth 的手机号形式登录，按 `free < plus < pro` 控制课程访问。
- **学习系统**：继续学习、完成进度、系列进度、成就积分、学员排行榜和教学设计学习地图。
- **运营后台**：课程、学员、首页内容、公告、活动、FAQ 和资源文章管理。
- **数据看板**：会员概览、课程排行、沉默学员和学员排行榜。
- **SEO 与移动端**：响应式布局、移动端导航、路由级 Meta 信息及构建后静态 SEO HTML。

## 技术栈

- React 18 + TypeScript + Vite 5
- React Router 7
- Tailwind CSS + Radix UI
- Supabase（Auth、Postgres、RLS、Storage、Edge Functions）
- Cloudflare R2（课程视频和课程图片）
- Vitest + Testing Library
- Biome + tsgo

## 快速开始

### 1. 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 一个已完成数据库迁移的 Supabase 项目

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

然后填写 `.env`：

```dotenv
VITE_SITE_URL=http://localhost:5173
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

`VITE_SUPABASE_PUBLISHABLE_KEY` 会发送到浏览器，值应填写 `sb_publishable_...`。代码仍兼容旧变量名 `VITE_SUPABASE_ANON_KEY`，但新部署应改用前者。不要将 `sb_secret_...` 或旧 Service Role Key 写入任何 `VITE_*` 变量或提交到仓库。

### 4. 启动开发服务器

```bash
npm run dev
```

默认访问地址为 [http://127.0.0.1:5173](http://127.0.0.1:5173)。

## 常用命令

```bash
# 开发服务器
npm run dev

# 类型检查
npx tsgo -p tsconfig.check.json

# 运行测试
npx vitest run

# 生产构建，并为公开路由生成 SEO HTML
npm run build

# 启动本地生产预览
npx vite preview --host 127.0.0.1 --port 4173

# 完整静态检查（需要系统已安装 ast-grep）
npm run lint
```

## 项目结构

```text
├── docs/                       # 部署、课程结构和需求文档
├── public/                     # 静态资源、SEO 文件和 SPA 部署规则
├── scripts/                    # 数据迁移、R2 上传、校验与 SEO 生成脚本
├── src/
│   ├── components/             # 通用、课程、学习、首页和后台组件
│   ├── contexts/               # 认证与会员上下文
│   ├── db/                     # Supabase 客户端和数据访问层
│   ├── hooks/                  # 首页内容、公告等数据 Hooks
│   ├── lib/                    # 权限、内容渲染、课程结构和游戏化逻辑
│   ├── pages/                  # 页面级路由组件
│   ├── test/                   # Vitest 测试
│   ├── types/                  # 业务类型
│   ├── App.tsx
│   └── routes.tsx
├── supabase/
│   ├── functions/              # 需要管理员身份的 Edge Functions
│   └── migrations/             # 表、RLS、RPC 和业务数据迁移
├── package.json
└── vite.config.ts
```

## 数据与权限设计

前端通过 Supabase Anon Key 访问数据，实际读写权限由数据库 RLS 决定：

- 访客可读取已发布的公开内容。
- 登录会员可按 `profiles.access_level` 访问对应课程，并维护自己的学习记录。
- 管理员身份由 `profiles.role = 'admin'` 判定，可使用 `/admin` 和 `/admin/manage`。
- 课程正文和结构化信息存在 Supabase Postgres；头像存在 Supabase Storage；大体积视频与课程图片存在 Cloudflare R2，数据库只保存 URL。

迁移文件位于 `supabase/migrations/`。内容运营后台的部署、RLS 验证和使用方法见 [docs/内容运营后台-部署与使用.md](docs/内容运营后台-部署与使用.md)。

## 媒体上传

课程编辑器中的图片会调用 `upload-course-image` Edge Function，由服务端校验管理员身份后上传到 R2。该 Function 需要配置：

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

`scripts/upload-*.mjs` 用于批量媒体迁移，还需要 `SUPABASE_SECRET_KEY`（`sb_secret_...`）。这些密钥只应存在本地 `.env.upload` 或部署平台的服务端密钥中。

Plus / Pro 课程正文与附件由 `course-content` Edge Function 在服务端复核会员或单课密码后返回；R2 文件地址使用短时签名 URL。生产环境必须同时满足：

- 受保护的视频、音频、正文图片和附件不能再通过 `r2.dev` 或公开自定义域名直接访问；应放入私有 R2 存储桶，或在公开入口拒绝这些对象前缀。
- 课程封面等确需公开的资源可放在独立公开存储桶/CDN；当前同桶封面由公开的 `course-cover` Function 仅按已发布课程签发短时读取地址，不恢复桶级公开访问。
- 私有 R2 存储桶需配置 CORS，允许正式站点对签名 URL 发起 `GET` / `HEAD` 和视频 `Range` 请求，并暴露 `Content-Length`、`Content-Range`、`Accept-Ranges` 与 `ETag` 响应头。

只部署前端和数据库、但继续保留受保护 R2 对象的公开直链，会关闭 Supabase API 的越权读取，却仍无法阻止已知媒体直链被永久转发。

## 构建与部署

```bash
npm run build
```

构建产物位于 `dist/`。构建脚本会在 Vite 打包后，为首页、教学通识课、教师 AI 课和资源中心生成独立的 SEO HTML。

部署平台需要：

- 将发布目录设为 `dist`。
- 配置 `VITE_SITE_URL`、`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。
- 对静态文件不存在的路径回退到 `/index.html`，以支持 SPA 路由。仓库已提供 `public/_redirects` 和 `public/_headers` 作为兼容规则。

## 相关文档

- [项目需求与开发进展（唯一管理文档）](docs/项目需求与开发进展.md)
- [内容运营后台部署与使用](docs/内容运营后台-部署与使用.md)
- [教学通识课 Plus 课程大纲](docs/教学通识课Plus-课程大纲.md)
- [HAI 当前功能实现机制说明](docs/HAI_当前功能实现机制说明.md)
- [课程分类整理脚本说明](scripts/README_COURSE_CATEGORIES.md)
