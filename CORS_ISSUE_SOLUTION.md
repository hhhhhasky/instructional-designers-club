# 自定义域名访问统计显示0的解决方案

## 问题确认

**症状：**
- ✅ 通过 `https://app-7iwdhpt0pypt.appmiaoda.com` 访问：显示正常（3377人）
- ❌ 通过 `https://www.hasky.top` 访问：显示0人

**原因：**
这是典型的 **CORS（跨域资源共享）问题**。Supabase 默认只允许特定域名访问 API，您的新域名 `www.hasky.top` 还没有添加到允许列表中，所以 API 调用被浏览器阻止了。

---

## 解决方案（5分钟）

### 步骤1：登录 Supabase Dashboard

1. 访问 https://app.supabase.com
2. 使用您的账号登录
3. 选择您的项目（教学设计师俱乐部项目）

### 步骤2：配置允许的域名

1. **进入认证设置**
   - 在左侧菜单中点击 **Authentication**（认证）
   - 点击 **URL Configuration**（URL配置）

2. **添加 Site URL**
   - 找到 **Site URL** 字段
   - 将值改为：`https://www.hasky.top`
   - 或者保持原值，在下一步添加到 Redirect URLs

3. **添加 Redirect URLs**
   - 找到 **Redirect URLs** 字段
   - 点击 **Add URL** 按钮
   - 添加以下URL（每个一行）：
     ```
     https://www.hasky.top
     https://www.hasky.top/*
     https://hasky.top
     https://hasky.top/*
     https://app-7iwdhpt0pypt.appmiaoda.com
     https://app-7iwdhpt0pypt.appmiaoda.com/*
     ```

4. **保存配置**
   - 点击页面底部的 **Save** 按钮
   - 等待保存成功的提示

### 步骤3：等待生效

- ⏱️ 配置通常在 **1-5分钟** 内生效
- 🔄 建议等待 5 分钟后再测试

### 步骤4：清除缓存并测试

1. **清除浏览器缓存**
   - 按 `Ctrl+Shift+Delete`（Windows）或 `Cmd+Shift+Delete`（Mac）
   - 选择清除"缓存"和"Cookie"
   - 时间范围选择"全部时间"
   - 点击"清除数据"

2. **或者使用无痕模式**
   - Chrome: `Ctrl+Shift+N`（Windows）或 `Cmd+Shift+N`（Mac）
   - Firefox: `Ctrl+Shift+P`（Windows）或 `Cmd+Shift+P`（Mac）

3. **访问您的网站**
   - 打开 https://www.hasky.top
   - 按 `F12` 打开开发者工具
   - 切换到 Console 标签
   - 刷新页面

4. **查看结果**
   - 如果看到成功日志，访问统计应该显示正常数字
   - 如果仍然显示0，查看是否有错误日志

---

## 验证配置是否成功

### 方法1：查看浏览器控制台

**成功的日志：**
```
[访问统计] 开始记录访问，用户ID: xxx
[API] 调用 record_visit RPC，参数: {...}
[API] RPC 调用结果: {data: {unique_visitors: 3377, total_visits: 9031}, error: null}
[API] 成功获取访问统计: {unique_visitors: 3377, total_visits: 9031}
[访问统计] 统计数据更新成功
```

**失败的日志（CORS错误）：**
```
Access to fetch at 'https://xxx.supabase.co/rest/v1/rpc/record_visit' from origin 'https://www.hasky.top' has been blocked by CORS policy
```

### 方法2：查看网络请求

1. 打开开发者工具（F12）
2. 切换到 **Network**（网络）标签
3. 刷新页面
4. 查找 `record_visit` 请求
5. 检查状态码：
   - ✅ **200**：成功
   - ❌ **0** 或 **CORS error**：CORS问题未解决

---

## 常见问题

### Q1: 我添加了域名，但还是显示0

**可能原因：**
1. 配置还没生效（等待5-10分钟）
2. 浏览器缓存了旧的CORS策略（清除缓存）
3. 域名格式不正确（检查是否包含 https://）

**解决方法：**
- 等待更长时间（最多15分钟）
- 使用无痕模式测试
- 检查 Supabase Dashboard 中的配置是否保存成功

### Q2: 我应该添加带 www 还是不带 www 的域名？

**建议：** 两个都添加

```
https://www.hasky.top
https://www.hasky.top/*
https://hasky.top
https://hasky.top/*
```

这样无论用户访问哪个版本，都能正常工作。

### Q3: 为什么默认域名可以正常访问？

**原因：** 默认域名 `app-7iwdhpt0pypt.appmiaoda.com` 在项目创建时就已经添加到 Supabase 的允许列表中了。

### Q4: 配置后多久生效？

**通常：** 1-5分钟  
**最长：** 15分钟  
**建议：** 等待5分钟后，清除浏览器缓存再测试

---

## 截图指南

如果您不确定如何操作，以下是详细的截图位置：

### 1. Supabase Dashboard 首页
- 左侧菜单找到 **Authentication**（有一个钥匙图标🔑）

### 2. Authentication 页面
- 顶部标签找到 **URL Configuration**

### 3. URL Configuration 页面
- **Site URL** 字段：输入主域名
- **Redirect URLs** 字段：点击 Add URL 添加多个域名
- 底部有 **Save** 按钮

---

## 技术说明

### 什么是 CORS？

CORS（Cross-Origin Resource Sharing，跨域资源共享）是浏览器的一种安全机制。当网页（如 www.hasky.top）尝试访问不同域名的 API（如 xxx.supabase.co）时，浏览器会检查 API 服务器是否允许这个域名访问。

### 为什么需要配置？

Supabase 为了安全，默认只允许特定域名访问。当您绑定新域名后，需要手动将新域名添加到允许列表中。

### 配置的作用

添加域名到 Supabase 的允许列表后，Supabase 会在 API 响应中添加特殊的 HTTP 头（Access-Control-Allow-Origin），告诉浏览器"这个域名是被允许访问的"，浏览器就会放行请求。

---

## 完成后的效果

配置成功后，通过 `https://www.hasky.top` 访问网站：

1. ✅ 底部访问统计显示正常数字（不是0）
2. ✅ 浏览器控制台没有 CORS 错误
3. ✅ Network 标签中 `record_visit` 请求状态码为 200
4. ✅ 每次访问都会正确记录和更新统计数据

---

## 需要帮助？

如果按照以上步骤操作后仍然无法解决，请提供：

1. **Supabase Dashboard 的截图**（URL Configuration 页面）
2. **浏览器控制台的完整日志**（Console 标签）
3. **Network 标签中 record_visit 请求的详情**
4. **您添加的具体域名列表**

---

**更新时间：** 2026-01-29  
**问题类型：** CORS跨域配置  
**预计解决时间：** 5-10分钟  
**难度：** ⭐⭐☆☆☆（简单）
