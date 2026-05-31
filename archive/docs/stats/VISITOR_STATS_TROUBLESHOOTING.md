# 访问统计显示为0的问题排查指南

## 问题描述

绑定自定义域名后，网站底部的访问人数和访问人次统计都显示为0。

## 问题原因分析

### 1. 数据库中有数据，但前端显示为0

**可能原因：**
- Supabase配置问题（URL或Key不正确）
- CORS跨域问题（新域名未配置）
- RPC函数调用失败
- 前端错误被捕获但未正确处理

### 2. 数据库确认

通过SQL查询确认，数据库中实际有数据：
- 独立访客数：3377人
- 总访问次数：9031次

这说明问题不在数据库层面，而在前端调用或配置层面。

---

## 排查步骤

### 步骤1：检查浏览器控制台

1. **打开浏览器开发者工具**
   - Chrome/Edge: 按 `F12` 或 `Ctrl+Shift+I`
   - Firefox: 按 `F12`
   - Safari: 按 `Cmd+Option+I`

2. **切换到 Console（控制台）标签**

3. **刷新页面，查看日志输出**

**正常情况应该看到：**
```
[访问统计] 开始记录访问，用户ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[API] 调用 record_visit RPC，参数: {p_visitor_uuid: "..."}
[API] RPC 调用结果: {data: {unique_visitors: 3377, total_visits: 9031}, error: null}
[API] 成功获取访问统计: {unique_visitors: 3377, total_visits: 9031}
[访问统计] 获取到统计数据: {unique_visitors: 3377, total_visits: 9031}
[访问统计] 统计数据更新成功
```

**如果出现错误，会看到：**
```
[API] 记录访问失败 - Supabase错误: {...}
[访问统计] 记录访问失败: Error: ...
```

### 步骤2：检查网络请求

1. **切换到 Network（网络）标签**

2. **刷新页面**

3. **查找 `record_visit` 请求**
   - 在过滤框中输入 `record_visit`
   - 或查找发送到 Supabase 的请求

4. **检查请求状态**
   - ✅ 状态码 200：请求成功
   - ❌ 状态码 4xx/5xx：请求失败

5. **查看响应内容**
   - 点击请求 → Response 标签
   - 应该看到类似：`{"unique_visitors":3377,"total_visits":9031}`

### 步骤3：检查 Supabase 配置

**检查环境变量：**

1. **查看 `.env` 文件**（如果是本地开发）
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **检查部署平台的环境变量**（如果是生产环境）
   - Vercel: Settings → Environment Variables
   - Netlify: Site settings → Environment variables
   - 确保两个变量都已正确配置

**验证配置是否生效：**

在浏览器控制台运行：
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
```

### 步骤4：检查 Supabase CORS 配置

**问题：** 新域名可能未添加到 Supabase 的允许域名列表中

**解决方法：**

1. **登录 Supabase Dashboard**
   - 访问 https://app.supabase.com

2. **选择您的项目**

3. **进入 Authentication → URL Configuration**

4. **检查 Site URL 和 Redirect URLs**
   - Site URL: 设置为您的新域名（如 `https://www.hasky.top`）
   - Redirect URLs: 添加您的新域名

5. **保存配置**

6. **等待几分钟让配置生效**

7. **刷新网站测试**

### 步骤5：手动测试 RPC 调用

在浏览器控制台运行以下代码：

```javascript
// 导入 supabase 客户端（如果可以访问）
// 或者直接测试
const testVisitorStats = async () => {
  try {
    // 生成测试UUID
    const testUuid = crypto.randomUUID();
    console.log('测试UUID:', testUuid);
    
    // 调用RPC
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
    console.log('RPC响应:', data);
    
    if (response.ok) {
      console.log('✅ RPC调用成功！');
      console.log('独立访客:', data.unique_visitors);
      console.log('总访问次数:', data.total_visits);
    } else {
      console.error('❌ RPC调用失败:', data);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
};

testVisitorStats();
```

---

## 常见问题和解决方案

### Q1: 控制台显示 "Failed to fetch" 或 "Network Error"

**原因：** CORS跨域问题或网络连接问题

**解决方案：**
1. 检查 Supabase 的 URL Configuration（见步骤4）
2. 确认新域名已添加到允许列表
3. 检查网络连接是否正常
4. 尝试清除浏览器缓存

### Q2: 控制台显示 "Invalid API key"

**原因：** Supabase API Key 配置错误

**解决方案：**
1. 检查环境变量中的 `VITE_SUPABASE_ANON_KEY`
2. 确认使用的是 `anon` key，不是 `service_role` key
3. 重新从 Supabase Dashboard 复制正确的 key
4. 重新部署应用

### Q3: 控制台显示 "Function not found"

**原因：** RPC函数不存在或名称错误

**解决方案：**
1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 运行以下查询检查函数是否存在：
   ```sql
   SELECT proname 
   FROM pg_proc 
   WHERE proname = 'record_visit';
   ```
4. 如果不存在，需要重新创建函数（见下方）

### Q4: 数据显示为0，但没有任何错误日志

**原因：** 错误被捕获但返回了默认值0

**解决方案：**
1. 检查浏览器控制台的所有日志（包括警告）
2. 查看 Network 标签中的请求详情
3. 检查响应数据格式是否正确
4. 尝试清除 localStorage：
   ```javascript
   localStorage.removeItem('visitor_uuid');
   location.reload();
   ```

### Q5: 本地开发正常，部署后显示0

**原因：** 生产环境的环境变量未配置

**解决方案：**

**Vercel：**
1. 进入项目 Settings → Environment Variables
2. 添加：
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
3. 重新部署

**Netlify：**
1. 进入 Site settings → Environment variables
2. 添加相同的环境变量
3. 触发重新部署

---

## 重新创建 RPC 函数（如果需要）

如果 RPC 函数丢失或损坏，可以通过以下 SQL 重新创建：

```sql
-- 创建或替换 record_visit 函数
CREATE OR REPLACE FUNCTION public.record_visit(p_visitor_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_unique_visitors integer;
  v_total_visits bigint;
BEGIN
  -- 插入或更新访问记录
  INSERT INTO visitor_stats (visitor_uuid, visit_count, first_visit_at, last_visit_at)
  VALUES (p_visitor_uuid, 1, now(), now())
  ON CONFLICT (visitor_uuid) 
  DO UPDATE SET 
    visit_count = visitor_stats.visit_count + 1,
    last_visit_at = now();
  
  -- 计算统计数据
  SELECT 
    COUNT(DISTINCT visitor_uuid)::integer,
    SUM(visit_count)::bigint
  INTO v_unique_visitors, v_total_visits
  FROM visitor_stats;
  
  -- 返回统计数据
  RETURN json_build_object(
    'unique_visitors', v_unique_visitors,
    'total_visits', v_total_visits
  );
END;
$function$;
```

---

## 验证修复

修复后，应该能看到：

1. **浏览器控制台**
   - ✅ 没有错误日志
   - ✅ 看到成功的日志输出
   - ✅ 显示正确的访问统计数据

2. **网站底部**
   - ✅ 访问人数显示正确（不是0）
   - ✅ 访问人次显示正确（不是0）
   - ✅ 数字有动画效果（从0增长到实际值）

3. **Network 标签**
   - ✅ `record_visit` 请求状态码为 200
   - ✅ 响应包含正确的统计数据

---

## 联系支持

如果按照以上步骤仍然无法解决问题，请提供以下信息：

1. **浏览器控制台的完整日志**（截图或复制文本）
2. **Network 标签中 `record_visit` 请求的详情**
3. **使用的域名**
4. **部署平台**（Vercel/Netlify/其他）
5. **是否配置了环境变量**

---

## 更新日志

**2026-01-29**
- 添加详细的调试日志
- 改进错误处理和提示
- 创建完整的排查指南

---

**文档版本：** v1.0

**创建时间：** 2026-01-29

**适用版本：** 教学设计师俱乐部网站 v1.0+
