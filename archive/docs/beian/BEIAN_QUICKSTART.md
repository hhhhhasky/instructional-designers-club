# 备案号快速配置指南

## 🎯 快速开始

### 当前状态

✅ 备案号显示功能已添加到页面底部

⏳ 需要替换为您的实际备案号

---

## 📝 配置步骤（3分钟完成）

### 步骤1：打开文件

```bash
打开文件：src/components/common/Footer.tsx
```

### 步骤2：找到备案号位置

**搜索关键词：** `京ICP备XXXXXXXX号`

**找到这两处代码：**

```tsx
// 第1处：ICP备案号（第26行左右）
京ICP备XXXXXXXX号

// 第2处：公安备案号（第40行左右）
京公网安备 XXXXXXXXXXXXX号
```

### 步骤3：替换为实际备案号

**ICP备案号：**
```tsx
// 原代码
京ICP备XXXXXXXX号

// 改为（示例）
京ICP备12345678号
```

**公安备案号：**
```tsx
// 原代码
京公网安备 XXXXXXXXXXXXX号

// 改为（示例）
京公网安备 11010802012345号
```

### 步骤4：保存并测试

```bash
# 保存文件
Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)

# 查看效果
npm run dev
```

---

## 📊 显示效果

### 桌面端

```
© 2025 教学设计师俱乐部. 保留所有权利。

京ICP备12345678号  |  🛡️ 京公网安备 11010802012345号
```

### 移动端

```
© 2025 教学设计师俱乐部. 保留所有权利。

京ICP备12345678号

🛡️ 京公网安备 11010802012345号
```

---

## 🔗 官方链接

### ICP备案查询

**网址：** https://beian.miit.gov.cn/

**说明：** 点击备案号会跳转到此网站

### 公安备案查询

**网址：** http://www.beian.gov.cn/portal/registerSystemInfo

**说明：** 点击公安备案号会跳转到此网站

---

## ⚠️ 常见情况处理

### 情况1：只有ICP备案号

**修改方法：**

打开 `src/components/common/Footer.tsx`，删除公安备案号部分：

```tsx
{/* 备案号 */}
<div className="flex items-center justify-center text-sm text-foreground/60">
  {/* ICP备案号 */}
  <a 
    href="https://beian.miit.gov.cn/" 
    target="_blank" 
    rel="noopener noreferrer"
    className="hover:text-primary transition-colors duration-200"
  >
    京ICP备12345678号
  </a>
</div>
```

### 情况2：公安备案审核中

**修改方法：**

```tsx
{/* 备案号 */}
<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-foreground/60">
  {/* ICP备案号 */}
  <a 
    href="https://beian.miit.gov.cn/" 
    target="_blank" 
    rel="noopener noreferrer"
    className="hover:text-primary transition-colors duration-200"
  >
    京ICP备12345678号
  </a>
  
  <span className="hidden md:inline text-foreground/40">|</span>
  
  {/* 公安备案审核中 */}
  <span className="text-foreground/50">
    公安备案审核中
  </span>
</div>
```

### 情况3：暂无备案号

**修改方法：**

如果网站还没有备案，可以暂时不显示备案号，只保留版权信息：

```tsx
{/* 版权信息 */}
<div className="py-8 text-center">
  <p className="text-base text-foreground/70 font-medium">
    © {currentYear} 教学设计师俱乐部. 保留所有权利。
  </p>
</div>
```

---

## ✅ 验证清单

配置完成后，请检查：

- [ ] 备案号已替换为实际备案号
- [ ] 备案号格式正确（包含"号"字）
- [ ] 页面底部正确显示
- [ ] 点击备案号可以跳转
- [ ] 移动端和桌面端显示正常

---

## 📞 需要帮助？

### 详细文档

**完整配置指南：** BEIAN_SETUP_GUIDE.md

**包含内容：**
- 详细的配置步骤
- 样式自定义方法
- 常见问题解答
- 最佳实践建议

### 文件位置

**Footer组件：** `src/components/common/Footer.tsx`

**修改位置：** 第26行和第40行左右

---

## 🎉 完成

配置完成后，您的网站底部将显示：

✅ 版权信息

✅ ICP备案号（可点击）

✅ 公安备案号（可点击，带图标）

✅ 响应式布局（自动适配移动端和桌面端）

---

**创建时间：** 2025-12-30

**预计配置时间：** 3分钟

**难度：** ⭐ 简单
