# 访问统计显示为0 - 快速排查指南

## 🔍 快速诊断（3分钟）

### 第1步：打开浏览器控制台

**Windows/Linux:** 按 `F12` 或 `Ctrl+Shift+I`  
**Mac:** 按 `Cmd+Option+I`

### 第2步：查看日志

刷新页面，在 **Console（控制台）** 标签中查看日志：

**✅ 正常情况（有数据）：**
```
[访问统计] 开始记录访问，用户ID: xxx
[API] 成功获取访问统计: {unique_visitors: 3377, total_visits: 9031}
[访问统计] 统计数据更新成功
```

**❌ 异常情况（显示0）：**
```
[API] 记录访问失败 - Supabase错误: {...}
[访问统计] 记录访问失败: Error: ...
```

### 第3步：根据错误类型解决

---

## 🔧 常见问题快速修复

### 问题1: "Failed to fetch" 或 "Network Error"

**原因：** 新域名未添加到 Supabase 允许列表

**解决方法：**
1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 进入 **Authentication → URL Configuration**
4. 在 **Site URL** 中设置您的新域名：`https://www.hasky.top`
5. 在 **Redirect URLs** 中添加您的新域名
6. 保存并等待5分钟
7. 刷新网站测试

---

### 问题2: "Invalid API key" 或 "Unauthorized"

**原因：** 环境变量未配置或配置错误

**解决方法：**

#### Vercel 部署
1. 进入项目 **Settings → Environment Variables**
2. 添加两个变量：
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key
   ```
3. 点击 **Redeploy** 重新部署

#### Netlify 部署
1. 进入 **Site settings → Environment variables**
2. 添加相同的两个变量
3. 触发重新部署

**获取正确的值：**
1. 登录 Supabase Dashboard
2. 进入 **Settings → API**
3. 复制 **Project URL** 和 **anon public** key

---

### 问题3: 没有错误，但就是显示0

**可能原因：** 浏览器缓存或 localStorage 问题

**解决方法：**

在浏览器控制台运行：
```javascript
// 清除访问记录
localStorage.removeItem('visitor_uuid');
// 刷新页面
location.reload();
```

或者：
1. 按 `Ctrl+Shift+Delete`（Windows）或 `Cmd+Shift+Delete`（Mac）
2. 选择清除缓存和 Cookie
3. 刷新页面

---

### 问题4: 本地开发正常，部署后显示0

**原因：** 生产环境的环境变量未配置

**解决方法：** 参考"问题2"的解决方法

---

## 🧪 手动测试（高级）

如果以上方法都不行，在浏览器控制台运行以下代码测试：

```javascript
const testStats = async () => {
  const testUuid = crypto.randomUUID();
  console.log('测试UUID:', testUuid);
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/record_visit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ p_visitor_uuid: testUuid })
    }
  );
  
  const data = await response.json();
  console.log('测试结果:', data);
  
  if (response.ok) {
    console.log('✅ 测试成功！访问统计:', data);
  } else {
    console.error('❌ 测试失败:', data);
  }
};

testStats();
```

**预期结果：**
```
测试UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
测试结果: {unique_visitors: 3377, total_visits: 9031}
✅ 测试成功！访问统计: {unique_visitors: 3377, total_visits: 9031}
```

---

## 📞 仍然无法解决？

如果按照以上步骤仍然无法解决，请提供以下信息：

1. **浏览器控制台的完整日志**（截图）
2. **使用的域名**
3. **部署平台**（Vercel/Netlify/其他）
4. **手动测试的结果**

---

## 📚 详细文档

查看完整的排查指南：[VISITOR_STATS_TROUBLESHOOTING.md](./VISITOR_STATS_TROUBLESHOOTING.md)

---

**更新时间：** 2026-01-29  
**版本：** v1.0
