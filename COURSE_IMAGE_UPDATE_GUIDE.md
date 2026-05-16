# 课程卡片配图修改指南

## 概述

本文档详细说明如何修改课程中心的课程卡片配图，包括修改方法、图片要求、最佳实践等。

## 课程数据位置

**文件路径：** `src/data/courses.ts`

这个文件包含了所有课程的数据，包括课程名称、分类、链接、配图等信息。

## 课程数据结构

### Course接口定义

```typescript
export interface Course {
  id: string;              // 课程唯一标识
  title: string;           // 课程名称
  category: string;        // 学习营名称/分类
  link: string;            // 课程链接
  image: string;           // 课程配图URL
  level: '初级' | '中级' | '高级';  // 难度级别
  description?: string;    // 课程描述（可选）
}
```

### 课程数据示例

```typescript
{
  id: 'constructivism-knowledge',
  title: '知识是被发现的，还是被发明的？',
  category: '建构主义',
  link: 'https://meeting.tencent.com/crm/lRoWvwPD77',
  image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_74ce143f-53ab-407b-a8b4-2142497fe875.jpg',
  level: '中级',
  description: '探讨建构主义的知识观'
}
```

## 修改方法

### 方法一：修改单个课程配图

**步骤：**

1. 打开文件 `src/data/courses.ts`
2. 找到要修改的课程对象
3. 修改 `image` 字段的URL
4. 保存文件

**示例：**

```typescript
// 修改前
{
  id: 'constructivism-knowledge',
  title: '知识是被发现的，还是被发明的？',
  category: '建构主义',
  link: 'https://meeting.tencent.com/crm/lRoWvwPD77',
  image: 'https://old-image-url.jpg',  // 旧图片URL
  level: '中级',
  description: '探讨建构主义的知识观'
}

// 修改后
{
  id: 'constructivism-knowledge',
  title: '知识是被发现的，还是被发明的？',
  category: '建构主义',
  link: 'https://meeting.tencent.com/crm/lRoWvwPD77',
  image: 'https://new-image-url.jpg',  // 新图片URL
  level: '中级',
  description: '探讨建构主义的知识观'
}
```

### 方法二：批量修改多个课程配图

**步骤：**

1. 打开文件 `src/data/courses.ts`
2. 使用查找替换功能（Ctrl+H 或 Cmd+H）
3. 查找旧的图片URL模式
4. 替换为新的图片URL
5. 保存文件

**示例：**

```typescript
// 批量替换某个域名下的所有图片
// 查找：https://old-domain.com/images/
// 替换：https://new-domain.com/images/
```

### 方法三：使用脚本批量更新

如果需要批量更新大量图片，可以编写脚本：

```typescript
// update-images.ts
import { courses } from './src/data/courses';

// 定义新的图片URL映射
const imageMap: Record<string, string> = {
  'constructivism-knowledge': 'https://new-image-1.jpg',
  'constructivism-learning': 'https://new-image-2.jpg',
  // ... 更多映射
};

// 更新图片URL
courses.forEach(course => {
  if (imageMap[course.id]) {
    course.image = imageMap[course.id];
  }
});
```

## 图片要求

### 尺寸规格

**推荐尺寸：**
- 宽度：800px - 1200px
- 高度：450px - 675px
- 宽高比：16:9 或 4:3

**最小尺寸：**
- 宽度：600px
- 高度：400px

**最大尺寸：**
- 宽度：2000px
- 高度：1500px

### 文件格式

**支持格式：**
- JPG/JPEG（推荐）
- PNG
- WebP（现代浏览器）

**不推荐：**
- GIF（动图）
- BMP（文件过大）
- SVG（矢量图，不适合照片）

### 文件大小

**推荐大小：**
- 100KB - 500KB

**最大大小：**
- 1MB

**优化建议：**
- 使用图片压缩工具（如TinyPNG、ImageOptim）
- 选择合适的压缩质量（80-90%）
- 使用WebP格式可以减小30-50%的文件大小

### 图片内容

**推荐内容：**
- 与课程主题相关的插图
- 抽象概念的视觉化表达
- 教育场景的照片
- 图标和符号的组合

**避免内容：**
- 低分辨率或模糊的图片
- 带有水印的图片
- 版权受限的图片
- 与课程主题无关的图片

## 图片来源

### 免费图片网站

**推荐网站：**

1. **Unsplash**
   - 网址：https://unsplash.com
   - 特点：高质量免费图片，无需署名
   - 适合：教育、科技、抽象概念

2. **Pexels**
   - 网址：https://www.pexels.com
   - 特点：免费图片和视频，无需署名
   - 适合：教育场景、人物、办公

3. **Pixabay**
   - 网址：https://pixabay.com
   - 特点：免费图片、插图、矢量图
   - 适合：教育插图、图标、背景

4. **Freepik**
   - 网址：https://www.freepik.com
   - 特点：免费和付费图片、矢量图
   - 适合：教育插图、图标、模板

5. **百度图片搜索**
   - 网址：https://image.baidu.com
   - 特点：中文搜索，图片丰富
   - 注意：需要检查版权

### AI生成图片

**推荐工具：**

1. **Midjourney**
   - 特点：高质量AI生成图片
   - 适合：抽象概念、艺术风格

2. **DALL-E**
   - 特点：OpenAI的AI图片生成
   - 适合：创意概念、教育插图

3. **Stable Diffusion**
   - 特点：开源AI图片生成
   - 适合：自定义风格、批量生成

### 自定义设计

**设计工具：**

1. **Canva**
   - 网址：https://www.canva.com
   - 特点：在线设计工具，模板丰富
   - 适合：快速设计、非专业设计师

2. **Figma**
   - 网址：https://www.figma.com
   - 特点：专业设计工具，协作方便
   - 适合：专业设计、团队协作

3. **Adobe Photoshop**
   - 特点：专业图片编辑软件
   - 适合：高级编辑、专业设计

## 图片上传

### 方法一：使用CDN服务

**推荐CDN：**

1. **百度云CDN**
   - 当前使用的CDN
   - 域名：miaoda-site-img.cdn.bcebos.com
   - 上传后获取URL

2. **阿里云OSS**
   - 网址：https://www.aliyun.com/product/oss
   - 特点：稳定、快速、便宜

3. **腾讯云COS**
   - 网址：https://cloud.tencent.com/product/cos
   - 特点：与腾讯会议集成方便

4. **七牛云**
   - 网址：https://www.qiniu.com
   - 特点：免费额度大，速度快

### 方法二：使用图床服务

**推荐图床：**

1. **SM.MS**
   - 网址：https://sm.ms
   - 特点：免费、无需注册、稳定

2. **ImgBB**
   - 网址：https://imgbb.com
   - 特点：免费、支持API、稳定

3. **路过图床**
   - 网址：https://imgtu.com
   - 特点：国内访问快、免费

### 方法三：使用GitHub

**步骤：**

1. 在GitHub仓库中创建 `public/images` 目录
2. 上传图片到该目录
3. 使用相对路径引用：`/images/course-1.jpg`
4. 或使用GitHub CDN：`https://raw.githubusercontent.com/username/repo/main/public/images/course-1.jpg`

**优势：**
- 免费
- 版本控制
- 与代码一起管理

**劣势：**
- 国内访问可能较慢
- 有文件大小限制

## 修改流程

### 完整流程

```
1. 准备新图片
   ↓
2. 优化图片（压缩、调整尺寸）
   ↓
3. 上传图片到CDN/图床
   ↓
4. 获取图片URL
   ↓
5. 打开 src/data/courses.ts
   ↓
6. 找到要修改的课程
   ↓
7. 修改 image 字段
   ↓
8. 保存文件
   ↓
9. 在浏览器中查看效果
   ↓
10. 提交代码（如果满意）
```

### 详细步骤

#### 步骤1：准备新图片

**选择图片：**
- 从免费图片网站下载
- 使用AI生成
- 自己设计

**检查图片：**
- 分辨率是否足够
- 内容是否相关
- 是否有版权问题

#### 步骤2：优化图片

**使用在线工具：**

1. **TinyPNG**
   - 网址：https://tinypng.com
   - 功能：压缩PNG和JPG
   - 效果：减小50-80%文件大小

2. **Squoosh**
   - 网址：https://squoosh.app
   - 功能：在线图片压缩和格式转换
   - 效果：多种压缩算法可选

3. **ImageOptim**（Mac）
   - 功能：批量压缩图片
   - 效果：无损压缩

**调整尺寸：**
```bash
# 使用ImageMagick命令行工具
convert input.jpg -resize 1200x675 output.jpg

# 使用在线工具
# 访问 https://www.iloveimg.com/resize-image
```

#### 步骤3：上传图片

**使用百度云CDN：**

1. 登录百度云控制台
2. 进入对象存储BOS
3. 选择存储桶
4. 上传图片
5. 设置公开读权限
6. 获取CDN URL

**使用图床：**

1. 访问图床网站（如SM.MS）
2. 点击上传按钮
3. 选择图片文件
4. 等待上传完成
5. 复制图片URL

#### 步骤4：修改代码

**打开文件：**
```bash
# 使用VS Code
code src/data/courses.ts

# 或使用其他编辑器
vim src/data/courses.ts
```

**找到课程：**
```typescript
// 使用Ctrl+F搜索课程ID或标题
// 例如搜索：constructivism-knowledge
```

**修改URL：**
```typescript
// 修改前
image: 'https://old-url.jpg',

// 修改后
image: 'https://new-url.jpg',
```

**保存文件：**
```bash
# Ctrl+S 或 Cmd+S
```

#### 步骤5：查看效果

**启动开发服务器：**
```bash
npm run dev
```

**打开浏览器：**
```
http://localhost:5173/courses
```

**检查效果：**
- 图片是否正常显示
- 图片是否清晰
- 图片是否与课程主题相关
- 图片加载速度是否正常

#### 步骤6：提交代码

**Git操作：**
```bash
# 查看修改
git diff src/data/courses.ts

# 添加到暂存区
git add src/data/courses.ts

# 提交
git commit -m "更新课程配图：[课程名称]"

# 推送到远程
git push origin main
```

## 常见问题

### Q1: 图片不显示怎么办？

**可能原因：**
1. URL错误
2. 图片被删除
3. CDN访问限制
4. 网络问题

**解决方法：**
1. 检查URL是否正确
2. 在浏览器中直接访问图片URL
3. 检查CDN设置
4. 尝试使用其他CDN

### Q2: 图片显示模糊怎么办？

**可能原因：**
1. 图片分辨率太低
2. 图片被过度压缩
3. 浏览器缩放问题

**解决方法：**
1. 使用更高分辨率的图片
2. 减少压缩率
3. 检查浏览器缩放设置

### Q3: 图片加载很慢怎么办？

**可能原因：**
1. 图片文件太大
2. CDN速度慢
3. 网络问题

**解决方法：**
1. 压缩图片
2. 使用更快的CDN
3. 使用WebP格式
4. 启用CDN缓存

### Q4: 如何批量修改所有课程配图？

**方法一：使用查找替换**
```
1. 打开 src/data/courses.ts
2. 按 Ctrl+H（或 Cmd+H）
3. 查找：https://old-domain.com/
4. 替换：https://new-domain.com/
5. 点击"全部替换"
```

**方法二：使用脚本**
```typescript
// 创建 update-images.ts
import fs from 'fs';

const filePath = './src/data/courses.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 替换所有图片URL
content = content.replace(
  /https:\/\/old-domain\.com\//g,
  'https://new-domain.com/'
);

fs.writeFileSync(filePath, content);
console.log('图片URL已更新');
```

### Q5: 如何保持图片风格统一？

**建议：**

1. **使用同一来源**
   - 从同一个网站下载
   - 使用同一个AI工具生成
   - 使用同一个设计师设计

2. **统一色调**
   - 使用相同的滤镜
   - 保持相似的色彩饱和度
   - 统一明暗对比

3. **统一构图**
   - 使用相似的构图方式
   - 保持相同的视角
   - 统一元素位置

4. **统一风格**
   - 写实风格 vs 插画风格
   - 简约风格 vs 复杂风格
   - 现代风格 vs 复古风格

### Q6: 如何选择合适的图片？

**选择标准：**

1. **相关性**
   - 与课程主题相关
   - 能够传达课程内容
   - 符合课程定位

2. **质量**
   - 分辨率足够高
   - 构图合理
   - 色彩和谐

3. **美观性**
   - 视觉吸引力强
   - 符合审美标准
   - 与网站风格一致

4. **版权**
   - 无版权问题
   - 可以商用
   - 无需署名（或已署名）

## 最佳实践

### 1. 图片命名规范

**推荐命名：**
```
course-[category]-[id]-[version].jpg

示例：
course-constructivism-knowledge-v1.jpg
course-rosenshine-module1-v2.jpg
```

**优势：**
- 易于识别
- 便于管理
- 支持版本控制

### 2. 图片版本管理

**建议：**
- 保留原始图片
- 使用版本号（v1, v2, v3）
- 记录修改历史

**示例：**
```
images/
  ├── originals/           # 原始图片
  │   └── course-1.jpg
  ├── optimized/           # 优化后的图片
  │   └── course-1-v1.jpg
  └── archive/             # 归档的旧图片
      └── course-1-old.jpg
```

### 3. 图片备份

**建议：**
- 定期备份图片
- 使用多个CDN
- 保留本地副本

**备份方案：**
```
主CDN：百度云CDN
备用CDN：阿里云OSS
本地备份：GitHub仓库
```

### 4. 图片优化流程

**标准流程：**
```
1. 下载/生成原始图片
   ↓
2. 调整尺寸（1200x675）
   ↓
3. 压缩图片（质量85%）
   ↓
4. 转换为WebP（可选）
   ↓
5. 上传到CDN
   ↓
6. 测试加载速度
   ↓
7. 更新代码
```

### 5. 图片性能优化

**优化技巧：**

1. **懒加载**
   - 使用 `loading="lazy"` 属性
   - 只加载可见区域的图片

2. **响应式图片**
   - 使用 `srcset` 属性
   - 根据屏幕大小加载不同尺寸

3. **WebP格式**
   - 使用WebP格式
   - 提供JPG作为后备

4. **CDN加速**
   - 使用CDN分发
   - 启用CDN缓存

**示例代码：**
```tsx
<img
  src="course-1.jpg"
  srcset="course-1-small.jpg 600w, course-1-medium.jpg 1200w, course-1-large.jpg 2000w"
  sizes="(max-width: 600px) 600px, (max-width: 1200px) 1200px, 2000px"
  loading="lazy"
  alt="课程配图"
/>
```

## 快速参考

### 修改单个课程配图

```typescript
// 1. 打开文件
// src/data/courses.ts

// 2. 找到课程
{
  id: 'course-id',
  title: '课程名称',
  category: '分类',
  link: 'https://...',
  image: 'https://old-image.jpg',  // 修改这里
  level: '中级',
}

// 3. 修改URL
image: 'https://new-image.jpg',

// 4. 保存文件
```

### 图片要求速查

| 项目 | 推荐值 | 最小值 | 最大值 |
|-----|--------|--------|--------|
| 宽度 | 1200px | 600px | 2000px |
| 高度 | 675px | 400px | 1500px |
| 宽高比 | 16:9 | - | - |
| 文件大小 | 300KB | 50KB | 1MB |
| 格式 | JPG | - | - |

### 常用工具速查

| 工具 | 用途 | 网址 |
|-----|------|------|
| TinyPNG | 图片压缩 | https://tinypng.com |
| Unsplash | 免费图片 | https://unsplash.com |
| Canva | 在线设计 | https://www.canva.com |
| SM.MS | 图床服务 | https://sm.ms |

## 总结

修改课程卡片配图的核心步骤：

1. **准备图片**：选择或生成合适的图片
2. **优化图片**：调整尺寸、压缩文件
3. **上传图片**：上传到CDN或图床
4. **获取URL**：复制图片的访问URL
5. **修改代码**：在 `src/data/courses.ts` 中修改 `image` 字段
6. **查看效果**：在浏览器中检查显示效果
7. **提交代码**：使用Git提交修改

**关键文件：** `src/data/courses.ts`

**关键字段：** `image`

**图片要求：** 1200x675px, JPG格式, 300KB左右

**推荐工具：** TinyPNG（压缩）、Unsplash（图片）、SM.MS（图床）

如有任何问题，请参考本文档的常见问题部分或联系技术支持。
