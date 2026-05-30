# 更新日志

## 2025-05-30 课程密码验证迁移至后端

**问题**：Pro/Plus 课程的密码门控（`PasswordGate`）采用纯前端验证——密码通过 `VITE_` 前缀环境变量编译进 JS bundle，用户打开浏览器 DevTools 即可搜到明文密码。

**改动**：
- 新增 `functions/api/verify-course-password.ts`（Cloudflare Pages Function），密码从服务端环境变量读取，前端无法获取
- 重构 `src/lib/course-auth.ts`，`verifyCoursePassword` 改为 async，调用后端 API `/api/verify-course-password`
- 更新 `src/components/common/PasswordGate.tsx`，适配异步验证，增加 loading 状态和错误处理
- 移除 `.env` / `.env.example` 中的 `VITE_PRO_COURSE_PASSWORD` 和 `VITE_PLUS_COURSE_PASSWORD`

**部署配置**：在 Cloudflare Pages 环境变量中设置 `PRO_COURSE_PASSWORD` 和 `PLUS_COURSE_PASSWORD`。

**涉及文件**：
- `functions/api/verify-course-password.ts`（新增）
- `functions/env.d.ts`（新增）
- `src/lib/course-auth.ts`
- `src/components/common/PasswordGate.tsx`
- `.env.example`
