# Plus 课程场景筛选功能说明

## 功能概述

Plus 课程页面提供 4 个场景入口，帮助用户快速找到符合自己需求的课程。每个场景根据不同的维度（适用场景或适用人群）筛选课程分类。

## 场景配置

### 1. 我要准备公开课/赛课

- **筛选类型**: 场景筛选（scenario）
- **筛选字段**: `applicable_scenarios`
- **筛选值**: `公开课`
- **图标**: 演示文稿图标（Presentation）
- **颜色**: 青色渐变（from-teal-500 to-cyan-500）
- **描述**: 精选适合公开展示的优质课程

**筛选结果**：显示所有 `applicable_scenarios` 数组中包含 `公开课` 的课程分类。

**示例分类**：
- 任务情境设计
- 学情分析
- 建构主义
- 教学目标
- 认知负荷理论

### 2. 我要准备日常课

- **筛选类型**: 场景筛选（scenario）
- **筛选字段**: `applicable_scenarios`
- **筛选值**: `日常课`
- **图标**: 文件图标（FileText）
- **颜色**: 靛蓝渐变（from-indigo-500 to-blue-500）
- **描述**: 日常教学实用技巧与方法

**筛选结果**：显示所有 `applicable_scenarios` 数组中包含 `日常课` 的课程分类。

**示例分类**：
- 任务情境设计
- 学情分析
- 教学目标
- 概念教学
- 罗森海因教学原理
- 认知负荷理论
- 讲授法

### 3. 我是创新教育老师

- **筛选类型**: 人群筛选（audience）
- **筛选字段**: `applicable_audience`
- **筛选值**: `创新教育老师`
- **图标**: 火箭图标（Rocket）
- **颜色**: 紫色渐变（from-purple-500 to-pink-500）
- **描述**: 探索前沿教育理念与技术

**筛选结果**：显示所有 `applicable_audience` 数组中包含 `创新教育老师` 的课程分类。

**筛选到的分类（8 个）**：
1. **任务情境设计**
   - 适用人群: 一线老师、创新教育老师
   - 适用场景: 公开课、日常课
   - 内容类型: 备课核心要素

2. **学习科学入门**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 无
   - 内容类型: 理论

3. **学情分析**
   - 适用人群: 一线老师、创新教育老师
   - 适用场景: 公开课、日常课
   - 内容类型: 备课核心要素

4. **建构主义**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 公开课
   - 内容类型: 学习理论

5. **教学目标**
   - 适用人群: 一线老师、创新教育老师
   - 适用场景: 公开课、日常课
   - 内容类型: 备课核心要素

6. **概念教学**
   - 适用人群: 一线老师、创新教育老师
   - 适用场景: 日常课
   - 内容类型: 无

7. **罗森海因教学原理**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 日常课
   - 内容类型: 教学理论

8. **认知负荷理论**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 公开课、日常课
   - 内容类型: 教学理论

### 4. 我是家长

- **筛选类型**: 人群筛选（audience）
- **筛选字段**: `applicable_audience`
- **筛选值**: `家长`
- **图标**: 用户组图标（Users）
- **颜色**: 橙色渐变（from-orange-500 to-amber-500）
- **描述**: 了解孩子学习与成长

**筛选结果**：显示所有 `applicable_audience` 数组中包含 `家长` 的课程分类。

**筛选到的分类（4 个）**：
1. **学习科学入门**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 无
   - 内容类型: 理论

2. **建构主义**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 公开课
   - 内容类型: 学习理论

3. **罗森海因教学原理**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 日常课
   - 内容类型: 教学理论

4. **认知负荷理论**
   - 适用人群: 一线老师、创新教育老师、家长
   - 适用场景: 公开课、日常课
   - 内容类型: 教学理论

## 技术实现

### 数据结构

#### ScenarioConfig 接口

```typescript
interface ScenarioConfig {
  id: string;                          // 场景唯一标识
  name: string;                        // 场景名称
  description: string;                 // 场景描述
  icon: LucideIcon;                    // 场景图标
  color: string;                       // 场景颜色（渐变）
  bgGradient: string;                  // 背景渐变
  filterType: 'scenario' | 'audience'; // 筛选类型
  filterValue: string;                 // 筛选值
}
```

#### 筛选类型说明

| filterType | 说明 | 筛选字段 | 示例值 |
|-----------|------|---------|--------|
| **scenario** | 场景筛选 | `applicable_scenarios` | '公开课', '日常课' |
| **audience** | 人群筛选 | `applicable_audience` | '创新教育老师', '家长' |

### 筛选逻辑

#### getFilteredCategories() 函数

```typescript
const getFilteredCategories = (): string[] => {
  // 如果不是 Plus 会员，或者没有选中场景，返回全部分类
  if (selectedMembershipType !== 'plus' || !selectedScenario) {
    return categories;
  }

  const scenario = scenarioConfigs.find(s => s.id === selectedScenario);
  if (!scenario) {
    return categories;
  }

  // 根据筛选类型选择不同的字段进行筛选
  return categories.filter(category => {
    const tags = categoryTags[category];
    if (!tags) return false;
    
    // 根据筛选类型选择对应的数组字段
    if (scenario.filterType === 'scenario') {
      // 场景筛选：检查 applicable_scenarios 数组
      return tags.applicable_scenarios.includes(scenario.filterValue);
    } else if (scenario.filterType === 'audience') {
      // 人群筛选：检查 applicable_audience 数组
      return tags.applicable_audience.includes(scenario.filterValue);
    }
    
    return false;
  });
};
```

#### 场景统计逻辑

```typescript
// 统计该场景下有多少个课程系列
const scenarioCategoriesCount = categories.filter(category => {
  const tags = categoryTags[category];
  if (!tags) return false;
  
  // 根据筛选类型选择对应的数组字段
  if (scenario.filterType === 'scenario') {
    return tags.applicable_scenarios.includes(scenario.filterValue);
  } else if (scenario.filterType === 'audience') {
    return tags.applicable_audience.includes(scenario.filterValue);
  }
  
  return false;
}).length;

// 如果该场景没有对应的课程，显示"即将推出"
const isComingSoon = scenarioCategoriesCount === 0;
```

### 数据库查询

#### 查询"创新教育老师"相关课程

```sql
SELECT 
  name,
  applicable_audience,
  applicable_scenarios,
  content_types
FROM course_categories
WHERE '创新教育老师' = ANY(applicable_audience)
ORDER BY name;
```

#### 查询"家长"相关课程

```sql
SELECT 
  name,
  applicable_audience,
  applicable_scenarios,
  content_types
FROM course_categories
WHERE '家长' = ANY(applicable_audience)
ORDER BY name;
```

## 用户体验

### 场景卡片显示

每个场景卡片显示以下信息：
- **场景图标**：直观展示场景类型
- **场景名称**：清晰的场景描述
- **场景描述**：简短的说明文字
- **课程数量**：该场景下的课程系列数量（如"8 个系列"）
- **即将推出**：如果该场景没有对应的课程，显示"即将推出"标签

### 交互效果

- **悬停效果**：鼠标悬停时，卡片放大并显示阴影
- **选中状态**：选中的场景卡片显示边框和背景色
- **禁用状态**：没有课程的场景卡片显示为禁用状态，无法点击
- **动画效果**：所有状态变化都有平滑的过渡动画

### 筛选结果展示

- **分类列表**：只显示符合筛选条件的课程分类
- **课程卡片**：每个分类显示课程数量和标签
- **标签显示**：按类型分组显示标签
  - 适用场景标签：青色（teal）
  - 内容类型标签：蓝色（blue）
  - 适用人群标签：紫色（purple）

### 取消筛选

- **再次点击**：再次点击已选中的场景卡片，取消筛选，显示全部分类
- **切换会员类型**：切换到其他会员类型（Free 或 Pro），自动取消场景筛选

## 优势

### 1. 精准推荐

- **场景筛选**：根据用户的使用场景（公开课、日常课）推荐课程
- **人群筛选**：根据用户的身份（创新教育老师、家长）推荐课程
- **减少选择成本**：用户无需浏览全部课程，快速找到符合需求的课程

### 2. 灵活扩展

- **统一接口**：filterType 和 filterValue 字段支持多种筛选类型
- **易于添加**：添加新场景只需在 scenarioConfigs 数组中添加配置
- **易于维护**：筛选逻辑统一，代码简洁

### 3. 数据驱动

- **数据库驱动**：筛选逻辑完全基于数据库字段，无需硬编码
- **动态更新**：数据库更新后，前端自动更新筛选结果
- **数据一致性**：前端和后端使用相同的数据源

### 4. 用户体验

- **直观易用**：场景卡片设计清晰，用户一目了然
- **即时反馈**：点击场景卡片后，立即显示筛选结果
- **智能提示**：没有课程的场景显示"即将推出"，避免用户困惑

## 未来优化

### 1. 多维度筛选

- **组合筛选**：支持同时选择多个场景（如"公开课 + 创新教育老师"）
- **高级筛选**：支持更多筛选维度（如课程难度、课程时长）

### 2. 个性化推荐

- **用户画像**：根据用户的历史行为，自动推荐场景
- **智能排序**：根据用户偏好，调整课程分类的排序

### 3. 数据分析

- **场景统计**：统计每个场景的点击率和转化率
- **课程热度**：统计每个课程分类的浏览量和学习量
- **优化建议**：根据数据分析，优化场景配置和课程推荐

## 相关文档

- [数据库重构总结](./database_refactoring_summary.md)
- [场景筛选机制详解](./scenario_filtering_mechanism.md)
- [场景筛选流程图](./scenario_filtering_flowchart.md)
