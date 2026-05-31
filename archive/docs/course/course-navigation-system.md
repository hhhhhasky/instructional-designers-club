# 课程中心三级导航系统 - 技术文档

## 📋 目录

1. [系统概述](#系统概述)
2. [页面结构图](#页面结构图)
3. [交互逻辑说明](#交互逻辑说明)
4. [数据字段定义](#数据字段定义)
5. [API 接口说明](#api-接口说明)
6. [前端组件说明](#前端组件说明)
7. [使用示例](#使用示例)

---

## 系统概述

课程中心采用**三级导航结构**，为用户提供清晰的课程组织和筛选功能：

```
一级导航（会员类型）
  ├── Pro会员专属课程
  ├── Plus会员专属课程
  └── 免费课
      ↓
二级导航（课程分类）
  ├── 全部
  ├── 建构主义
  ├── 教学目标
  ├── 认知负荷理论
  └── ...（动态加载）
      ↓
三级内容（课程列表）
  └── 课程卡片网格
```

### 核心特性

- ✅ **默认展示 Pro 课程**：打开页面默认显示 Pro 会员专属课程
- ✅ **动态分类加载**：根据选中的会员类型动态加载对应的课程分类
- ✅ **平滑切换**：无需刷新页面，所有切换都是平滑过渡
- ✅ **清晰标识**：每个课程卡片都清晰标注会员类型和试看标识
- ✅ **响应式设计**：完美适配移动端和桌面端

---

## 页面结构图

### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│                         Header                               │
├─────────────────────────────────────────────────────────────┤
│                      页面标题区域                             │
│                      "课程中心"                               │
├─────────────────────────────────────────────────────────────┤
│              一级导航：会员类型（默认选中Pro）                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │👑 Pro专属│  │✨ Plus专属│  │🎁 免费课 │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
├─────────────────────────────────────────────────────────────┤
│              二级导航：课程分类（动态加载）                     │
│  ┌────┐ ┌────────┐ ┌────────┐ ┌──────────┐                │
│  │全部│ │建构主义│ │教学目标│ │认知负荷...│                │
│  └────┘ └────────┘ └────────┘ └──────────┘                │
├─────────────────────────────────────────────────────────────┤
│                    三级内容：课程列表                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │课程1│ │课程2│ │课程3│ │课程4│ │课程5│                  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │课程6│ │课程7│ │课程8│ │课程9│ │课程10│                 │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │
├─────────────────────────────────────────────────────────────┤
│                         Footer                               │
└─────────────────────────────────────────────────────────────┘
```

### 课程卡片结构

```
┌─────────────────────────────┐
│  ┌─────────┐      ┌──────┐  │  ← 课程配图区域
│  │👑Pro专属│      │试看  │  │    - 左上：会员类型标签
│  └─────────┘      └──────┘  │    - 右上：试看标签（可选）
│                              │    - 左下：分类标签
│  ┌──────────┐    ┌──────┐   │    - 右下：难度标签
│  │建构主义   │    │中级  │   │
│  └──────────┘    └──────┘   │
├─────────────────────────────┤
│  课程标题（最多2行）          │  ← 课程信息区域
│  ⏱ 60分钟  ⭐ 2学分         │    - 标题
│  ┌─────────────────────┐    │    - 时长和学分
│  │    查看详情          │    │    - 查看详情按钮
│  └─────────────────────┘    │
└─────────────────────────────┘
```

---

## 交互逻辑说明

### 1. 页面初始化

```typescript
// 页面加载流程
1. 进入课程中心页面
2. 默认选中 "Pro会员专属课程"
3. 加载 Pro 类型下的所有分类
4. 加载 Pro 类型下的所有课程（分类="全部"）
5. 显示课程列表
```

**代码实现：**
```typescript
const [selectedMembershipType, setSelectedMembershipType] = useState<MembershipType>('pro');
const [selectedCategory, setSelectedCategory] = useState('全部');

useEffect(() => {
  // 加载分类和课程
  const [categoriesData, coursesData] = await Promise.all([
    getCategoriesByMembershipType('pro'),
    getCoursesByMembershipAndCategory('pro', '全部')
  ]);
}, []);
```

### 2. 一级导航切换（会员类型）

```typescript
// 用户点击会员类型按钮
用户点击 "Plus会员专属课程"
  ↓
1. 更新选中的会员类型：selectedMembershipType = 'plus'
  ↓
2. 重置二级分类选择：selectedCategory = '全部'
  ↓
3. 显示加载状态：isLoading = true
  ↓
4. 并行加载数据：
   - 加载 Plus 类型下的所有分类
   - 加载 Plus 类型下的所有课程
  ↓
5. 更新状态：
   - setCategories(categoriesData)
   - setCourses(coursesData)
  ↓
6. 隐藏加载状态：isLoading = false
  ↓
7. 显示新的课程列表
```

**代码实现：**
```typescript
useEffect(() => {
  const loadData = async () => {
    setIsLoading(true);
    setSelectedCategory('全部'); // 重置分类

    const [categoriesData, coursesData] = await Promise.all([
      getCategoriesByMembershipType(selectedMembershipType),
      getCoursesByMembershipAndCategory(selectedMembershipType, '全部')
    ]);

    setCategories(categoriesData);
    setCourses(coursesData);
    setIsLoading(false);
  };

  loadData();
}, [selectedMembershipType]); // 依赖会员类型
```

### 3. 二级导航切换（课程分类）

```typescript
// 用户点击课程分类按钮
用户点击 "建构主义"
  ↓
1. 更新选中的分类：selectedCategory = '建构主义'
  ↓
2. 保持会员类型不变：selectedMembershipType 不变
  ↓
3. 显示加载状态：isLoading = true
  ↓
4. 加载数据：
   - 加载当前会员类型下"建构主义"分类的课程
  ↓
5. 更新状态：setCourses(coursesData)
  ↓
6. 隐藏加载状态：isLoading = false
  ↓
7. 显示筛选后的课程列表
```

**代码实现：**
```typescript
useEffect(() => {
  const loadCourses = async () => {
    setIsLoading(true);

    const coursesData = await getCoursesByMembershipAndCategory(
      selectedMembershipType,
      selectedCategory
    );

    setCourses(coursesData);
    setIsLoading(false);
  };

  loadCourses();
}, [selectedMembershipType, selectedCategory]); // 依赖会员类型和分类
```

### 4. 课程卡片点击

```typescript
// 用户点击课程卡片
用户点击课程卡片
  ↓
1. 防止重复点击：if (isNavigating) return
  ↓
2. 记录点击的卡片：setClickedCardId(courseId)
  ↓
3. 显示导航遮罩：setIsNavigating(true)
  ↓
4. 添加点击动画：course-card-active class
  ↓
5. 延迟 200ms（显示动画）
  ↓
6. 跳转到课程详情页：navigate(`/courses/${courseId}`)
```

**代码实现：**
```typescript
const handleCourseClick = (courseId: string) => {
  if (isNavigating) return;

  setClickedCardId(courseId);
  setIsNavigating(true);

  setTimeout(() => {
    navigate(`/courses/${courseId}`);
  }, 200);
};
```

### 5. 状态管理流程图

```
┌─────────────────────────────────────────────────────────┐
│                    用户操作                              │
└────────────┬────────────────────────────────────────────┘
             │
             ├─ 点击会员类型 ─────────────────────────┐
             │                                        │
             │  1. setSelectedMembershipType()       │
             │  2. setSelectedCategory('全部')       │
             │  3. setIsLoading(true)                │
             │  4. 加载分类和课程                     │
             │  5. setCategories() + setCourses()    │
             │  6. setIsLoading(false)               │
             │                                        │
             ├─ 点击课程分类 ─────────────────────────┤
             │                                        │
             │  1. setSelectedCategory()             │
             │  2. setIsLoading(true)                │
             │  3. 加载课程                           │
             │  4. setCourses()                      │
             │  5. setIsLoading(false)               │
             │                                        │
             └─ 点击课程卡片 ─────────────────────────┤
                                                      │
                1. setClickedCardId()                │
                2. setIsNavigating(true)             │
                3. 延迟 200ms                         │
                4. navigate()                        │
                                                      │
┌─────────────────────────────────────────────────────────┐
│                    UI 更新                               │
└─────────────────────────────────────────────────────────┘
```

---

## 数据字段定义

### 1. 数据库表结构

#### courses 表（课程表）

```sql
CREATE TABLE courses (
  -- 基础字段
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructor TEXT,
  
  -- 分类字段
  category_id TEXT,
  category TEXT,
  
  -- 会员类型字段（新增）
  membership_type TEXT NOT NULL DEFAULT 'plus' 
    CHECK (membership_type IN ('free', 'plus', 'pro')),
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- 课程属性
  level TEXT CHECK (level IN ('entry', 'beginner', 'intermediate', 'advanced', '入门', '初级', '中级', '高级')),
  semester TEXT,
  duration INTEGER,
  credits TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- 媒体资源
  image_url TEXT,
  video_url TEXT,
  meeting_url TEXT,
  
  -- 元数据
  sort_order INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_courses_membership_type ON courses(membership_type);
CREATE INDEX idx_courses_is_trial ON courses(is_trial);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_status ON courses(status);
```

### 2. 字段说明

#### 会员类型相关字段

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `membership_type` | TEXT | 是 | 'plus' | 会员类型：'free'（免费）、'plus'（Plus会员）、'pro'（Pro会员） |
| `is_trial` | BOOLEAN | 是 | false | 是否为试看课程（免费试看） |

#### 字段约束

```sql
-- membership_type 约束
CHECK (membership_type IN ('free', 'plus', 'pro'))

-- 字段注释
COMMENT ON COLUMN courses.membership_type IS '会员类型：free-免费课程，plus-Plus会员课程，pro-Pro会员课程';
COMMENT ON COLUMN courses.is_trial IS '是否为试看课程（免费试看）';
```

### 3. 数据分类规则

#### Pro会员专属课程
```sql
-- 筛选条件
WHERE membership_type = 'pro'

-- 特点
- 仅Pro会员可访问
- 高级课程内容
- 完整的学习路径
```

#### Plus会员专属课程
```sql
-- 筛选条件
WHERE membership_type = 'plus'

-- 特点
- Plus会员和Pro会员可访问
- 标准课程内容
- 系统化学习
```

#### 免费课
```sql
-- 筛选条件
WHERE membership_type = 'free' OR is_trial = true

-- 特点
- 所有用户可访问
- 包含免费课程和试看课程
- 入门级内容
```

### 4. TypeScript 类型定义

```typescript
// 会员类型
export type MembershipType = 'free' | 'plus' | 'pro';

// 课程接口
export interface Course {
  // 基础信息
  id: string;
  title: string;
  description: string | null;
  instructor: string | null;
  
  // 分类信息
  category_id: string | null;
  category: string | null;
  
  // 会员类型（新增）
  membership_type: MembershipType;
  is_trial: boolean;
  
  // 课程属性
  level: 'entry' | 'beginner' | 'intermediate' | 'advanced' | '入门' | '初级' | '中级' | '高级';
  semester: string | null;
  duration: number | null;
  credits: string | null;
  status: 'draft' | 'published' | 'archived';
  
  // 媒体资源
  image_url: string | null;
  video_url: string | null;
  meeting_url: string | null;
  
  // 元数据
  sort_order: number | null;
  view_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}
```

### 5. 数据示例

```sql
-- Pro会员专属课程
INSERT INTO courses (id, title, category, membership_type, is_trial, level, duration, image_url)
VALUES (
  'pro-course-1',
  'AI时代的教学设计高级课程',
  'AI 通识课',
  'pro',
  false,
  '高级',
  120,
  'https://example.com/image.jpg'
);

-- Plus会员专属课程
INSERT INTO courses (id, title, category, membership_type, is_trial, level, duration, image_url)
VALUES (
  'plus-course-1',
  '建构主义教学设计',
  '建构主义',
  'plus',
  false,
  '中级',
  90,
  'https://example.com/image.jpg'
);

-- 免费课程
INSERT INTO courses (id, title, category, membership_type, is_trial, level, duration, image_url)
VALUES (
  'free-course-1',
  '教学设计入门',
  '教学目标',
  'free',
  false,
  '入门',
  60,
  'https://example.com/image.jpg'
);

-- 试看课程（也属于免费课）
INSERT INTO courses (id, title, category, membership_type, is_trial, level, duration, image_url)
VALUES (
  'trial-course-1',
  '认知负荷理论试看',
  '认知负荷理论',
  'plus',
  true,
  '中级',
  30,
  'https://example.com/image.jpg'
);
```

---

## API 接口说明

### 1. 根据会员类型获取课程列表

```typescript
/**
 * 根据会员类型获取课程列表
 * @param membershipType 会员类型
 * @returns 课程列表
 */
export async function getCoursesByMembershipType(
  membershipType: MembershipType
): Promise<Course[]>
```

**参数：**
- `membershipType`: 'free' | 'plus' | 'pro'

**返回：**
- `Course[]`: 课程数组

**SQL 查询：**
```sql
-- Pro 或 Plus 课程
SELECT * FROM courses
WHERE status = 'published'
  AND membership_type = 'pro'  -- 或 'plus'
ORDER BY sort_order ASC;

-- 免费课程（包含试看）
SELECT * FROM courses
WHERE status = 'published'
  AND (membership_type = 'free' OR is_trial = true)
ORDER BY sort_order ASC;
```

### 2. 根据会员类型和分类获取课程列表

```typescript
/**
 * 根据会员类型和分类获取课程列表
 * @param membershipType 会员类型
 * @param category 分类名称
 * @returns 课程列表
 */
export async function getCoursesByMembershipAndCategory(
  membershipType: MembershipType,
  category: string
): Promise<Course[]>
```

**参数：**
- `membershipType`: 'free' | 'plus' | 'pro'
- `category`: 分类名称（'全部' 表示不筛选分类）

**返回：**
- `Course[]`: 课程数组

**SQL 查询：**
```sql
-- 示例：Plus会员 + 建构主义分类
SELECT * FROM courses
WHERE status = 'published'
  AND membership_type = 'plus'
  AND category = '建构主义'
ORDER BY sort_order ASC;

-- 示例：免费课 + 全部分类
SELECT * FROM courses
WHERE status = 'published'
  AND (membership_type = 'free' OR is_trial = true)
ORDER BY sort_order ASC;
```

### 3. 获取指定会员类型下的所有分类

```typescript
/**
 * 获取指定会员类型下的所有分类
 * @param membershipType 会员类型
 * @returns 分类列表
 */
export async function getCategoriesByMembershipType(
  membershipType: MembershipType
): Promise<string[]>
```

**参数：**
- `membershipType`: 'free' | 'plus' | 'pro'

**返回：**
- `string[]`: 分类名称数组（包含"全部"）

**SQL 查询：**
```sql
-- 示例：Pro会员的所有分类
SELECT DISTINCT category
FROM courses
WHERE status = 'published'
  AND membership_type = 'pro'
  AND category IS NOT NULL
ORDER BY category ASC;

-- 返回示例
['全部', 'AI 通识课', '建构主义', '教学目标']
```

---

## 前端组件说明

### 1. 会员类型配置

```typescript
const membershipTypes = [
  {
    id: 'pro' as MembershipType,
    name: 'Pro会员专属课程',
    shortName: 'Pro专属',
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
  },
  {
    id: 'plus' as MembershipType,
    name: 'Plus会员专属课程',
    shortName: 'Plus专属',
    icon: Sparkles,
    color: 'from-blue-500 to-purple-500',
    badgeColor: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
  },
  {
    id: 'free' as MembershipType,
    name: '免费课',
    shortName: '免费',
    icon: Gift,
    color: 'from-green-500 to-emerald-500',
    badgeColor: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
  }
];
```

**字段说明：**
- `id`: 会员类型标识
- `name`: 完整名称（桌面端显示）
- `shortName`: 短名称（移动端显示）
- `icon`: 图标组件（lucide-react）
- `color`: 渐变色（用于按钮背景）
- `badgeColor`: 徽章颜色（用于课程卡片标签）

### 2. 状态管理

```typescript
// 一级导航：会员类型
const [selectedMembershipType, setSelectedMembershipType] = useState<MembershipType>('pro');

// 二级导航：课程分类
const [selectedCategory, setSelectedCategory] = useState('全部');
const [categories, setCategories] = useState<string[]>(['全部']);

// 课程数据
const [courses, setCourses] = useState<Course[]>([]);

// UI状态
const [isNavigating, setIsNavigating] = useState(false);
const [clickedCardId, setClickedCardId] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### 3. 一级导航渲染

```tsx
{/* 一级导航：会员类型 */}
<div className="max-w-7xl mx-auto px-4 py-6 border-b border-border">
  <div className="flex flex-wrap gap-3 justify-center">
    {membershipTypes.map((type) => {
      const isActive = selectedMembershipType === type.id;
      const Icon = type.icon;
      return (
        <button
          key={type.id}
          onClick={() => setSelectedMembershipType(type.id)}
          className={cn(
            "px-5 py-2.5 md:px-6 md:py-3 rounded-xl text-sm md:text-base font-bold transition-all duration-300",
            "border-2 flex items-center gap-2",
            isActive
              ? `bg-gradient-to-r ${type.color} text-white border-transparent shadow-lg scale-105`
              : "bg-background text-foreground border-border hover:border-primary/30 hover:scale-102"
          )}
        >
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden md:inline">{type.name}</span>
          <span className="md:hidden">{type.shortName}</span>
        </button>
      );
    })}
  </div>
</div>
```

### 4. 二级导航渲染

```tsx
{/* 二级导航：课程分类 */}
<div className="max-w-7xl mx-auto px-4 py-6">
  <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
    {categories.map((category) => {
      const isActive = selectedCategory === category;
      return (
        <button
          key={category}
          onClick={() => setSelectedCategory(category)}
          className={cn(
            "px-4 py-1.5 md:px-5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300",
            "border-2 relative overflow-hidden",
            isActive
              ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_16px_rgba(var(--primary),0.4)] scale-110 ring-2 ring-primary/30 ring-offset-2"
              : "bg-black text-white border-black hover:bg-black/90 hover:scale-105 hover:border-primary/30"
          )}
        >
          {isActive && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
          <span className="relative z-10">{category}</span>
        </button>
      );
    })}
  </div>
</div>
```

### 5. 课程卡片渲染

```tsx
<Card onClick={() => handleCourseClick(course.id)}>
  {/* 课程配图 */}
  <div className="relative h-32 overflow-hidden bg-muted">
    <img src={course.image_url} alt={course.title} />
    
    {/* 会员类型标签 */}
    <div className="absolute top-1.5 left-1.5">
      <Badge className={membershipConfig.badgeColor}>
        <MembershipIcon className="w-3 h-3" />
        <span>{membershipConfig.shortName}</span>
      </Badge>
    </div>
    
    {/* 试看标签 */}
    {course.is_trial && (
      <div className="absolute top-1.5 right-1.5">
        <Badge className="bg-green-500 text-white">试看</Badge>
      </div>
    )}
    
    {/* 分类标签 */}
    <div className="absolute bottom-1.5 left-1.5">
      <Badge variant="secondary">{course.category}</Badge>
    </div>
    
    {/* 难度标签 */}
    <div className="absolute bottom-1.5 right-1.5">
      <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
    </div>
  </div>
  
  {/* 课程信息 */}
  <CardContent className="p-3">
    <h3>{course.title}</h3>
    <div>
      <Clock /> {course.duration}分钟
      <Star /> {course.credits}学分
    </div>
    <Button>查看详情</Button>
  </CardContent>
</Card>
```

---

## 使用示例

### 1. 数据库操作示例

#### 插入新课程

```sql
-- 插入Pro会员专属课程
INSERT INTO courses (
  id, title, category, membership_type, is_trial, 
  level, duration, credits, status, image_url
) VALUES (
  'pro-ai-course-1',
  'AI工具深度测评与应用',
  'AI 通识课',
  'pro',
  false,
  '高级',
  120,
  '3',
  'published',
  'https://example.com/ai-course.jpg'
);

-- 插入Plus会员专属课程
INSERT INTO courses (
  id, title, category, membership_type, is_trial,
  level, duration, credits, status, image_url
) VALUES (
  'plus-constructivism-1',
  '建构主义教学设计实践',
  '建构主义',
  'plus',
  false,
  '中级',
  90,
  '2',
  'published',
  'https://example.com/constructivism.jpg'
);

-- 插入免费课程
INSERT INTO courses (
  id, title, category, membership_type, is_trial,
  level, duration, status, image_url
) VALUES (
  'free-intro-1',
  '教学设计入门指南',
  '教学目标',
  'free',
  false,
  '入门',
  60,
  'published',
  'https://example.com/intro.jpg'
);

-- 插入试看课程
INSERT INTO courses (
  id, title, category, membership_type, is_trial,
  level, duration, status, image_url
) VALUES (
  'trial-clt-1',
  '认知负荷理论试看课',
  '认知负荷理论',
  'plus',
  true,
  '中级',
  30,
  'published',
  'https://example.com/clt-trial.jpg'
);
```

#### 批量更新课程类型

```sql
-- 将特定分类的课程设置为Pro专属
UPDATE courses 
SET membership_type = 'pro' 
WHERE category = 'AI 通识课' 
  AND status = 'published';

-- 将特定课程设置为试看
UPDATE courses 
SET is_trial = true 
WHERE id IN (
  'course-id-1',
  'course-id-2',
  'course-id-3'
);

-- 将所有入门级课程设置为免费
UPDATE courses 
SET membership_type = 'free' 
WHERE level = '入门' 
  AND status = 'published';
```

#### 查询统计

```sql
-- 统计各会员类型的课程数量
SELECT 
  membership_type,
  COUNT(*) as course_count
FROM courses
WHERE status = 'published'
GROUP BY membership_type;

-- 统计各分类下各会员类型的课程数量
SELECT 
  category,
  membership_type,
  COUNT(*) as course_count
FROM courses
WHERE status = 'published'
GROUP BY category, membership_type
ORDER BY category, membership_type;

-- 查询试看课程列表
SELECT 
  id, title, category, membership_type
FROM courses
WHERE is_trial = true 
  AND status = 'published'
ORDER BY sort_order;
```

### 2. 前端使用示例

#### 获取Pro会员的所有课程

```typescript
import { getCoursesByMembershipType } from '@/db/api';

// 获取Pro会员的所有课程
const proCourses = await getCoursesByMembershipType('pro');
console.log('Pro课程数量:', proCourses.length);
```

#### 获取Plus会员的建构主义课程

```typescript
import { getCoursesByMembershipAndCategory } from '@/db/api';

// 获取Plus会员的建构主义课程
const plusConstructivismCourses = await getCoursesByMembershipAndCategory(
  'plus',
  '建构主义'
);
console.log('Plus建构主义课程:', plusConstructivismCourses);
```

#### 获取免费课的所有分类

```typescript
import { getCategoriesByMembershipType } from '@/db/api';

// 获取免费课的所有分类
const freeCategories = await getCategoriesByMembershipType('free');
console.log('免费课分类:', freeCategories);
// 输出: ['全部', '教学目标', '学习科学入门', ...]
```

### 3. 组件使用示例

#### 在其他页面使用会员类型筛选

```typescript
import { useState, useEffect } from 'react';
import { getCoursesByMembershipType } from '@/db/api';
import type { Course, MembershipType } from '@/types/types';

function MyCoursesPage() {
  const [membershipType, setMembershipType] = useState<MembershipType>('plus');
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const loadCourses = async () => {
      const data = await getCoursesByMembershipType(membershipType);
      setCourses(data);
    };
    loadCourses();
  }, [membershipType]);

  return (
    <div>
      <select onChange={(e) => setMembershipType(e.target.value as MembershipType)}>
        <option value="pro">Pro会员</option>
        <option value="plus">Plus会员</option>
        <option value="free">免费课</option>
      </select>
      
      <div>
        {courses.map(course => (
          <div key={course.id}>
            <h3>{course.title}</h3>
            <p>会员类型: {course.membership_type}</p>
            {course.is_trial && <span>试看</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 总结

本文档详细说明了课程中心三级导航系统的：

1. ✅ **页面结构**：清晰的三级导航布局
2. ✅ **交互逻辑**：完整的用户操作流程
3. ✅ **数据字段**：详细的数据库表结构和字段定义
4. ✅ **API 接口**：完整的接口说明和使用示例
5. ✅ **前端组件**：详细的组件实现和代码示例
6. ✅ **使用示例**：实际的数据库操作和前端使用案例

通过本文档，开发人员可以：
- 理解系统的整体架构
- 掌握数据库表结构和字段定义
- 了解前端组件的实现细节
- 快速上手使用 API 接口
- 进行数据维护和扩展开发
