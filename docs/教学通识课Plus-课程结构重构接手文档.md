# 教学通识课 Plus 课程结构重构接手文档

> 用途：供后续 session 接手课程平台信息架构与前端开发。  
> 当前状态：只完成讨论与产品结构规划，尚未改代码。  
> 数据参考：`docs/教学通识课Plus-课程大纲.md`，现有 Plus 课程共 14 个系列、69 节子课。

---

## 1. 背景

当前 Plus 课程主要按教学设计要素和专题平铺，例如教学目标、学情分析、任务情境、教学评价、概念教学、讲授法、学习科学、认知负荷、罗森海因、说课等。

用户希望对 Plus 课程体系做一次较大的翻新。这个翻新不受现有视频形态约束，未来可能重录视频、改写成图文、图文视频结合，甚至删除旧视频重构整套课。

本次讨论确认：新结构不是简单给现有 69 节课换分类，而是用现有内容作为可复用素材，重建一套更清晰、更适合长期扩展的课程体系。

---

## 2. 核心结构决策

最初讨论过“原理 + 场景”的总分结构：

- 原理：讲教学设计的共性框架。
- 场景：讲原理如何应用到日常课、说课、公开课等真实任务。

用户进一步修正：教学设计本身更像一套实践层面的设计方法，不等同于底层科学理论。因此需要增加一个更底层的“理论篇”。

最终确定 Plus 课程采用三层主干：

1. **理论篇**
2. **教学设计原理篇**
3. **场景篇**

其中场景篇下先放三个核心场景：

1. 日常课篇
2. 说课篇
3. 公开课篇

未来可扩展：

- 复习课篇
- 试卷讲评课篇
- 家庭教育篇
- 教育机构篇
- 教育产品篇

---

## 3. 三大篇章定位

### 3.1 理论篇

定位：解释教学设计背后的底层依据。

它回答的问题是：

- 学习如何发生？
- 教学为什么有效？
- 什么样的方法有研究依据？
- 教学设计为什么要这样做？

适合放入：

- 学习科学
- 教学科学
- 评估科学
- 建构主义
- 认知负荷理论
- 罗森海因教学原理
- 教育哲学
- 系统论
- 《教学幻象》相关内容

注意：理论篇不是直接教老师怎么备课，而是给教学设计方法提供底层支撑。

### 3.2 教学设计原理篇

定位：把底层理论转化为教师可操作的教学设计方法。

它回答的问题是：

- 我设计一节课时，应该怎样分析教材？
- 怎样分析学生？
- 怎样确定目标？
- 怎样设计任务、活动、讲授、评价？
- 怎样形成一节课的设计闭环？

适合放入：

- 教学目标篇
- 学情分析篇
- 任务情境篇
- 教学评价篇
- 概念教学篇
- 讲授法篇

注意：这里的“原理”不是教育科学理论，而是教学设计实践原理，也就是教师可以用来设计课程的方法框架。

### 3.3 场景篇

定位：把理论和教学设计原理应用到真实教师任务中。

它回答的问题是：

- 我明天要备一节日常课，该怎么做？
- 我马上要说课，该怎么组织内容？
- 我要打磨公开课，该怎么从选题到呈现？

首批场景：

- 日常课篇
- 说课篇
- 公开课篇

重要边界：分类依据不是“这节课里面讲了什么知识点”，而是“这节课帮助老师完成什么任务”。

因此，原有 `说课篇01-08` 虽然也包含教材分析、学情分析、教学目标、重难点、教学过程、板书总结等教学设计要素，但录制目的本来就是解决说课问题，所以应整体保留在“场景篇 / 说课篇”，不要拆到教学设计原理篇。

---

## 4. 现有 69 节课程的重构归属

### 4.1 理论篇

现有可复用系列：

- 学习科学篇
  - 学习科学导论
  - 初识学习科学
  - 初识教学科学
  - 初识评估科学
- 建构主义
  - 建构主义的知识观
  - 建构主义的学习观
  - 建构主义的教学观
  - 建构主义的教学设计
- 认知负荷理论
  - 初识认知负荷理论
  - 认知负荷理论基本原理
  - 优化内部认知负荷的教学策略
  - 降低外部认知负荷：安排任务
  - 降低外部认知负荷：优化知识呈现
- 罗森海因篇
  - 初识罗森海因教学原理
  - 教学原理01：调扶放
  - 教学原理02：善提问
  - 教学原理03：勤复习
  - 教学原理04：精练习
- 选修课中的《教学幻象》新书分享

建议处理：

- 可保留为理论支撑课，但建议重排顺序。
- 理论篇不必全部放在用户入门路径最前面，避免新用户觉得过重。
- 可设计为“底层理论库”，在原理篇和场景篇中交叉引用。

### 4.2 教学设计原理篇

现有可复用系列：

- 教学目标篇
  - 初识布鲁姆教育目标分类学框架
  - 深入布鲁姆的知识分类
  - 深入布鲁姆的认知分类
  - 初识马扎诺+SOLO分类理论
  - 分析12个优质课教案的教学目标
  - 教学目标设计三步法
- 学情分析篇
  - 为什么需要用户洞察？
  - 洞察三维度
  - 质量光谱
  - 用户洞察工具箱
- 任务情境篇
  - AI时代为什么需要任务教学？
  - 深入理解任务
  - KMR设计法：如何改造课后习题？
  - 任务脚本：如何从0到1原创任务？
  - 任务情境工具箱：5个任务公式设计好任务
  - 单课任务驱动：任务串与子任务拆解
  - 单元大任务设计：任务链与子任务拆解
- 教学评价篇
  - 为什么现在这么看重评价？
  - 三个评估层次
  - 评价方法1：逆向设计
  - 评价方法2：提问互动
  - 评价方法3：评价量规
  - 评价方法4+5：共建规则+课堂小结
- 概念教学篇
  - 为什么你需要掌握概念教学？
  - 重新理解概念
  - 如何从教教材到教概念？
  - 如何教概念：归纳策略
  - 如何教概念：演绎策略
- 讲授法篇
  - 重新认识讲授法
  - 如何设计60分钟纯粹讲授？
  - 如何设计互动讲授？
  - 如何设计讲授的形式？

注意：

- `公开课任务情境导入` 虽然现在属于任务情境篇，但更适合在场景篇 / 公开课篇中作为重点复用。
- 教学设计原理篇未来可重录成更紧凑的主干课程，不必机械保留现在所有长课。

### 4.3 场景篇 / 说课篇

现有可复用系列：

- 说课篇01：整体结构
- 说课篇02：教材分析
- 说课篇03：学情分析
- 说课篇04：教学目标
- 说课篇05：教学重难点
- 说课篇06：教法与学法
- 说课篇07：教学过程
- 说课篇08：板书+总结

用户明确要求：

- 这 8 节课整体放入说课篇。
- 不要因为其中涉及教材分析、学情分析、目标、重难点等内容，就拆到教学设计原理篇。
- 这些课当初录制目标就是解决说课问题，因此应按场景归类。

后续建议新增课题：

- 说课不是背稿，是解释教学设计逻辑
- 说课评分标准怎么看
- 说课稿怎么写成 8-10 分钟
- 说课 PPT 怎么做
- 限时说课怎么压缩表达
- 无生试讲和说课的区别
- 说课答辩如何回应评委追问
- 学科案例版说课拆解

### 4.4 场景篇 / 日常课篇

现有可复用素材：

- KMR设计法：如何改造课后习题？
- 单课任务驱动：任务串与子任务拆解
- 单元大任务设计：任务链与子任务拆解
- 讲授法篇
- 教学评价篇
- 罗森海因篇
- 认知负荷理论
- 概念教学篇
- 教学目标篇
- 学情分析篇

建议未来新结构：

1. 日常备课的最小闭环：教材-学情-目标-活动-评价
2. 如何快速读教材，找出本课核心概念
3. 如何把课标和教材变成可执行目标
4. 如何判断重难点，不再凭感觉
5. 如何用 KMR 改造教材习题
6. 如何设计一节课的任务串
7. 如何设计讲授、示范、练习的小循环
8. 如何用提问和小结做即时评价
9. 如何安排作业、复习和错题反馈
10. 如何复盘一节普通课

缺口课题：

- 作业设计
- 试卷讲评课
- 复习课
- 分层教学
- 课堂管理
- 低参与课堂怎么激活
- 45分钟课时节奏
- 不同学科日常课模板

### 4.5 场景篇 / 公开课篇

现有可复用素材：

- 公开课任务情境导入
- 初中思政同课异构《历久弥新的思想理念》
- 任务情境篇
- 概念教学篇
- 教学评价篇中的评价量规
- 建构主义的教学设计
- 讲授法篇
- 认知负荷理论

建议未来新结构：

1. 公开课和日常课的本质差异
2. 如何选题：选有价值、有张力、有展示度的课
3. 如何深挖教材，找到公开课的核心立意
4. 如何设计有真实感的任务情境导入
5. 如何设计主问题和任务链
6. 如何让学生的学习过程被看见
7. 如何设计课堂生成和教师追问
8. 如何用评价量规呈现学习证据
9. 如何打磨板书、课件、材料包
10. 如何磨课：听评课、改课、定稿
11. 如何准备公开课说课/答辩
12. 公开课案例拆解

缺口课题：

- 公开课选题
- 教材深挖
- 课堂亮点设计
- 磨课流程
- 学生展示设计
- 课堂生成处理
- 听评课记录表
- 公开课材料包
- 评委视角
- 同课异构

### 4.6 AI/工具类内容

现有内容：

- AI 通识课
- Gemini/NotebookLM 生成图片/PPT
- 拆解“得到”的教学设计
- 部分 Pro 工具课

当前建议：

- 不作为 Plus 主干里的一级核心篇章。
- 可作为横向增强入口、选修课、工具箱，或与 Pro 课程形成衔接。
- 首页可弱露出，但不要让它干扰“理论-原理-场景”的主线。

---

## 5. 课程平台主页设计方案

### 5.1 设计问题

新结构在内容层面变成：

`篇章 -> 模块 -> 单课`

这比原平台的两级结构更深。原平台大致是：

`一级分类 -> 单课`

如果照搬成页面跳转：

`课程首页 -> 篇章页 -> 模块页 -> 单课页`

用户会感觉层级过深、点击过多。

但如果首页只展示三个一级入口：

- 理论篇
- 教学设计原理篇
- 场景篇

又会显得空，而且用户无法判断每个入口里面具体有什么。

### 5.2 核心原则

后台内容结构可以是三层：

`篇章 -> 模块 -> 单课`

但前台用户体验不要做成三次点击的目录树。

推荐前台体验：

`课程首页 -> 篇章详情页 -> 单课页`

其中“模块”作为篇章详情页内部导航，不单独成为必经页面。

### 5.3 首页定位

课程主页不应只是分类页，而应做成“课程地图页”。

首页要同时解决三个问题：

1. 用户看懂 Plus 的整体课程体系。
2. 用户知道每个篇章下面有什么模块。
3. 用户能根据自己的问题快速进入对应内容。

### 5.4 首页结构建议

#### 第一屏：Plus 总定位

建议文案：

> 教学设计师俱乐部 Plus：从底层理论，到教学设计方法，再到真实教学场景。

展示路径：

`理论基石 -> 设计原理 -> 场景应用`

不要只做三个空卡片，而要做成三条学习主线。

#### 第二屏：三大主线区

每个主线区展示：

- 篇章名
- 一句话定位
- 适合谁学
- 模块标签
- 代表课程 2-3 节
- 主按钮：进入本篇
- 模块标签可直接跳到篇章页对应模块锚点

示例 1：理论篇

- 标题：理论篇
- 说明：理解学习、教学和认知的底层规律。
- 模块标签：
  - 学习科学
  - 建构主义
  - 认知负荷理论
  - 罗森海因教学原理
  - 评估科学
  - 教学幻象
- 代表课程：
  - 学习科学导论
  - 初识认知负荷理论
  - 初识罗森海因教学原理

示例 2：教学设计原理篇

- 标题：教学设计原理篇
- 说明：从教材、学情、目标、活动到评价，掌握设计一节好课的核心方法。
- 模块标签：
  - 学情分析
  - 教学目标
  - 任务情境
  - 教学评价
  - 概念教学
  - 讲授法
- 代表课程：
  - 教学目标设计三步法
  - 用户洞察工具箱
  - 任务脚本：如何从0到1原创任务？

示例 3：场景篇

- 标题：场景篇
- 说明：把教学设计原理应用到老师真实任务里。
- 模块标签：
  - 日常课
  - 说课
  - 公开课
  - 复习课（未来）
  - 试卷讲评课（未来）
- 代表课程：
  - 说课篇01：整体结构
  - 公开课任务情境导入
  - 单课任务驱动：任务串与子任务拆解

#### 第三屏：按问题找课

这是首页最重要的转化区之一。

建议标题：

> 我现在想解决什么问题？

问题入口：

- 我想系统提升教学设计能力 -> 教学设计原理篇
- 我想理解教学背后的科学依据 -> 理论篇
- 我明天就要备一节课 -> 日常课篇
- 我最近要参加说课 -> 说课篇
- 我要打磨一节公开课 -> 公开课篇
- 我想提升课堂讲授效果 -> 讲授法 / 认知负荷
- 我想设计真实任务 -> 任务情境
- 我想写好教学目标 -> 教学目标
- 我想让课堂评价更有效 -> 教学评价
- 我想教会学生真正理解概念 -> 概念教学

#### 第四屏：推荐学习路径

可选，但建议保留。

示例路径：

- 新老师入门路径
  - 学情分析 -> 教学目标 -> 讲授法 -> 教学评价 -> 日常课篇
- 公开课备赛路径
  - 教材深挖 -> 任务情境导入 -> 主问题与任务链 -> 评价量规 -> 公开课案例拆解
- 说课备赛路径
  - 说课整体结构 -> 教材分析 -> 学情分析 -> 教学目标 -> 教学过程 -> 板书总结
- 教学理论进阶路径
  - 学习科学 -> 建构主义 -> 认知负荷 -> 罗森海因 -> 教学幻象

#### 第五屏：最近更新 / 推荐内容

可展示：

- 最近新增课程
- 最近更新图文
- 推荐学习
- 继续学习

如果平台已有学习记录，可以把“继续学习”放到更靠前位置。

---

## 6. 篇章详情页设计方案

### 6.1 页面原则

点开某个篇章后，不要再进入一个“模块列表页”，而是进入“篇章详情页”。

页面内部展示：

- 篇章介绍
- 模块导航
- 当前模块下的单课列表
- 学习建议
- 代表路径

### 6.2 桌面端布局

推荐：

- 左侧：模块导航
- 右侧：单课列表

以“教学设计原理篇”为例：

左侧模块：

- 学情分析
- 教学目标
- 任务情境
- 教学评价
- 概念教学
- 讲授法

右侧展示当前模块下的课程卡片：

- 01 初识布鲁姆教育目标分类学框架
- 02 深入布鲁姆的知识分类
- 03 深入布鲁姆的认知分类
- 04 初识马扎诺+SOLO分类理论
- 05 分析12个优质课教案的教学目标
- 06 教学目标设计三步法

模块切换可以是同页切换或锚点滚动，不需要跳转到独立模块页。

### 6.3 移动端布局

移动端不要做左侧栏。

推荐使用折叠面板 accordion：

- 教学目标
  - 01 初识布鲁姆教育目标分类学框架
  - 02 深入布鲁姆的知识分类
  - ...
- 学情分析
  - 01 为什么需要用户洞察？
  - 02 洞察三维度
  - ...

### 6.4 单课页

单课页保持现有基本结构即可，但未来可扩展多形态内容：

- 视频
- 图文讲义
- 课程精华
- 案例材料
- 作业/练习
- 相关理论
- 相关场景
- 上一课/下一课

---

## 7. 信息架构建议

建议最终数据模型或前端结构支持：

- `track`：篇章，例如 theory / design-principles / scenarios
- `module`：模块，例如 learning-science / goals / daily-lesson / shuoke / open-class
- `course`：单课
- `scenario`：场景，可选，用于跨模块筛选
- `recommendedPath`：推荐学习路径
- `problemEntry`：按问题找课入口

示例：

```ts
type CourseTrack = {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
};

type CourseModule = {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
};

type ProblemEntry = {
  label: string;
  targetTrackId: string;
  targetModuleId?: string;
  targetCourseId?: string;
};
```

注意：这只是产品结构建议，不代表必须新增数据库表。后续开发前需要先检查现有 `courses` 与 `course_categories` 数据结构，再决定是数据库字段改造，还是先用前端配置映射实现。

---

## 8. 开发落地建议

### 8.1 建议分阶段

第一阶段：前端信息架构重构，不动数据库。

- 新增一份前端配置，将现有分类映射到新结构。
- 课程主页改成课程地图页。
- 篇章详情页支持模块导航和单课列表。
- 保持现有课程详情页不变。

第二阶段：后台/数据库支持新结构。

- 评估是否需要增加 `track`、`module`、`content_type`、`scenario` 等字段。
- 评估后台课程管理是否要支持篇章、模块、学习路径配置。

第三阶段：内容翻新。

- 根据新结构重录或改写课程。
- 为每个模块补充图文、讲义、工具表、案例库。
- 增加推荐路径和问题入口。

### 8.2 第一阶段优先验收标准

- 课程首页能清晰展示三条主线：理论篇、教学设计原理篇、场景篇。
- 首页不空，能看到二级模块预览和代表课程。
- 用户可通过“按问题找课”进入对应篇章/模块。
- 点开篇章后，可以同屏看到模块和单课，不需要再进入模块页。
- 移动端可以通过折叠面板浏览模块和课程。
- 原有课程详情页访问不受影响。

---

## 9. 关键产品判断

1. 首页不要展示完整 69 节单课，否则会变成课程仓库。
2. 首页也不要只展示 3 个篇章入口，否则显得空，用户无法判断内容。
3. 最优解是“3 条主线 + 二级模块预览 + 代表课程 + 按问题找课”。
4. 内容结构可以是三层，但用户体验应压缩成两次主要点击：
   - 首页 -> 篇章页 -> 单课页
5. 模块是篇章页内部导航，不建议做成独立必经页面。
6. 说课篇 01-08 保留在说课场景篇，不拆分到原理篇。
7. 理论篇提供专业深度，教学设计原理篇提供设计方法，场景篇提供真实任务解决方案。

---

## 10. 本 session 研发进展同步（2026-06-15）

> 本节记录 2026-06-15 当前 session 已经完成的研发结果，供下个 session 接手。  
> 之前“尚未改代码 / 先不动数据库”的状态已经过期；本 session 已完成前端、后台和远端 Supabase 的第一轮落地。

### 10.0 研发功能进度表

| 研发功能 | 当前进展 | 完成 / 更新时间 | 证据位置 | 下一步 |
| --- | --- | --- | --- | --- |
| Plus 三层课程结构产品决策 | 已完成 | 2026-06-15 | 本文第 2-7 节 | 后续内容精修时继续沿用“理论篇 / 教学设计原理篇 / 场景篇”主干 |
| `/courses` 课程地图页 | 已完成 | 2026-06-15 | `src/pages/CoursesPage.tsx`、本文 10.1.1 | 继续避免开发者视角文案，按用户任务优化入口文案 |
| Plus 信息架构前端配置 | 已完成 | 2026-06-15 | `src/lib/plusCourseStructure.ts`、本文 10.1.3 | 持续补充模块介绍、代表课程和复用规则 |
| Plus 篇章详情页 | 已完成 | 2026-06-15 | `src/pages/PlusTrackPage.tsx`、`src/routes.tsx`、本文 10.1.2 | 增加继续学习、模块流转和内容形态提示 |
| 说课篇 01-08 归属修正 | 已完成 | 2026-06-15 | `resolvePlusCoursePlacement()`、远端回填结果、本文 10.1.4 | 新增说课内容时继续按“场景任务”归类 |
| Supabase Plus 结构字段与回填 | 已完成 | 2026-06-15 | `supabase/migrations/20260615_plus_course_structure.sql`、本文 10.1.6 | 若运营需要配置学习路径，再评估独立表 |
| Plus 篇章 / 模块定义后台动态化 | 已完成 | 2026-06-16 | `supabase/migrations/20260616024859_dynamic_plus_course_structure.sql`、`src/db/api.ts`、`src/lib/plusCourseStructure.ts` | 后续可加后台表单管理这两张结构表 |
| 管理后台 Plus 字段编辑与数据库同步 | 已完成 | 2026-06-16 | `src/components/admin/CourseManagementSection.tsx`、`src/db/admin-api.ts`、本文 10.1.5 / 10.1.8 | 继续做篇章 / 模块筛选、批量调整和结构预览 |
| 单课页多载体内容与课程精华 | 已完成 | 2026-06-15 | `src/components/course/CourseContentStack.tsx`、`src/pages/CourseDetailPage.tsx`、`supabase/migrations/20260615_course_multiformat.sql`、`supabase/migrations/20260615_course_essence.sql` | 在课程列表卡片上显示视频 / 图文 / 音频 / 精华等形态 |
| Plus 单课页目录接入新模块结构 | 已完成 | 2026-06-16 | `src/pages/CourseDetailPage.tsx`、`src/test/CourseDetailPage.test.tsx` | 可继续补“上一个模块 / 下一个模块”跨模块流转 |
| 后台 Plus 篇章 / 模块筛选 | 已完成 | 2026-06-16 | `src/components/admin/CourseManagementSection.tsx`、`src/test/CourseManagementSection.test.tsx`、本文 10.1.9 | 继续做批量调整和结构预览入口 |
| 后台批量调整 Plus 模块归属与排序 | 已完成 | 2026-06-16 | `src/components/admin/CourseManagementSection.tsx`、`src/test/CourseManagementSection.test.tsx`、本文 10.1.10 | 后续如需更强事务一致性，可评估批量 RPC |
| 后台 Plus 结构预览入口 | 已完成 | 2026-06-16 | `src/components/admin/CourseManagementSection.tsx`、`src/test/CourseManagementSection.test.tsx`、本文 10.1.10 | 后续可在结构表单管理页增加更细预览 |
| 70 门 Plus 课程归属人工复核 | 未完成 | 暂无 | 本文 10.4 优先级 2 | 重点检查公开课、选修课、AI 工具类内容 |
| 推荐路径 / 问题入口后台化 | 暂缓 | 暂无 | 本文 10.4 优先级 4 | 运营配置需求稳定后再做，当前继续放前端配置 |

### 10.1 已完成范围

#### 10.1.1 前台课程中心

已将 `/courses` 中的 Plus 课程入口改为“课程地图页”：

- 默认进入教学通识课 Plus。
- 展示三条主线：
  - 理论篇
  - 教学设计原理篇
  - 场景篇
- 每个篇章优先展示具体系列课 / 模块，而不是优先展示单课。
- 模块使用圆角矩形框、图标、课程数量和模块说明突出展示。
- “可以先看”的课程入口被弱化为辅助提示。
- 已删除开发者视角文案，例如：
  - “Plus 课程已重构为三条学习主线”
  - “Pro 与 Free 课程仍保留原有系列浏览方式”
  - “首页不铺满全部单课”
  - “开发者视角”等类似说明
- Pro 和 Free 课程仍走原有系列列表逻辑，不进入 Plus 三主线结构。

涉及文件：

- `src/pages/CoursesPage.tsx`
- `src/lib/plusCourseStructure.ts`

#### 10.1.2 Plus 篇章详情页

新增 Plus 篇章详情路由：

```txt
/courses/plus/:trackId
```

当前支持：

- `/courses/plus/theory`
- `/courses/plus/design-principles`
- `/courses/plus/scenarios`

页面结构：

- 桌面端：左侧模块导航，右侧模块下单课列表。
- 移动端：accordion 折叠面板。
- URL hash 可直达模块，例如：
  - `/courses/plus/scenarios#shuoke`
  - `/courses/plus/design-principles#goals`
- 移动端如果 URL 带 hash，会默认展开对应模块。

涉及文件：

- `src/pages/PlusTrackPage.tsx`
- `src/routes.tsx`
- `src/lib/plusCourseStructure.ts`

#### 10.1.3 Plus 信息架构配置

新增前端结构配置文件：

```txt
src/lib/plusCourseStructure.ts
```

核心内容：

- `PLUS_TRACKS`：三大篇章配置。
- `PLUS_PROBLEM_ENTRIES`：按问题找课入口。
- `PLUS_RECOMMENDED_PATHS`：推荐学习路径。
- `PLUS_TOOLBOX_MODULE`：AI 与工具箱横向增强内容。
- `resolvePlusCoursePlacement()`：Plus 课程归属解析。
- `getCoursesForModule()`：获取模块课程，支持场景模块复用相关课程。
- `getTrackCourseCount()`：按篇章可见课程去重统计。

当前模块结构：

理论篇：

- 学习科学
- 建构主义
- 认知负荷理论
- 罗森海因教学原理
- 教学幻象

教学设计原理篇：

- 设计总论
- 学情分析
- 教学目标
- 任务情境
- 教学评价
- 概念教学
- 讲授法

场景篇：

- 日常课篇
- 说课篇
- 公开课篇
- 未来场景

注意：`getCoursesForModule()` 允许场景篇复用其他模块课程。例如“日常课篇”会复用讲授法、罗森海因等课程，但不改变这些课在数据库中的主归属。

#### 10.1.4 说课篇 01-08 归属已修正

本 session 查明：

- 说课篇 01-08 的旧 `category` 实际是 `教学原理篇`。
- 远端数据库一开始因此把它们回填到了 `design-principles / design-foundation`。
- 这不符合产品决策：说课 01-08 应整体保留在“场景篇 / 说课篇”。

已完成修正：

- 前端 `resolvePlusCoursePlacement()` 增加标题优先规则：
  - 标题匹配 `说课篇01` 到 `说课篇08` 时，优先归入 `scenarios / shuoke`。
- 远端 Supabase 已回填：
  - `plus_track_id = 'scenarios'`
  - `plus_module_id = 'shuoke'`
  - `plus_module_order = 20`
  - `plus_lesson_order = sort_order`

远端验证结果：

```txt
说课篇01 ：整体结构        scenarios / shuoke / 1
说课篇02 ：教材分析        scenarios / shuoke / 2
说课篇03 ：学情分析        scenarios / shuoke / 3
说课篇04：教学目标         scenarios / shuoke / 4
说课篇05 ：教学重难点      scenarios / shuoke / 5
说课篇06：教法与学法       scenarios / shuoke / 6
说课篇07：教学过程         scenarios / shuoke / 7
说课篇08 ：板书+总结       scenarios / shuoke / 8
```

浏览器验证：

- `/courses/plus/scenarios#shuoke` 中说课篇显示 8 节。
- 01 到 08 均可见。

#### 10.1.5 管理后台

课程管理后台已增加 Plus 结构字段，只在课程类型为 Plus 时显示：

- 篇章
- 模块
- 篇章 ID（`plus_track_id`）
- 模块 ID（`plus_module_id`）
- 模块排序
- 模块内单课排序
- 是否作为 Plus 首页代表课程候选

其中“篇章 / 模块”下拉使用 `plus_course_tracks` 和 `plus_course_modules` 的动态结构；“篇章 ID / 模块 ID”允许直接写入新 ID。只要两个 ID 同时填写，保存后会通过 `adminUpdateCourse()` 更新到 `courses.plus_track_id` 和 `courses.plus_module_id`。

如果课程类型切回 Pro / Free，后台保存时会清空这些 Plus 字段，避免污染非 Plus 课程。

涉及文件：

- `src/components/admin/CourseManagementSection.tsx`
- `src/types/types.ts`
- `src/db/admin-api.ts` 仍沿用原有更新方式

#### 10.1.6 Supabase 数据库

新增迁移文件：

```txt
supabase/migrations/20260615_plus_course_structure.sql
```

新增字段：

```sql
plus_track_id text
plus_module_id text
plus_module_order integer
plus_lesson_order integer
plus_representative boolean default false
```

历史约束与索引：

- `courses_plus_track_id_check`
  - 早期允许值：`theory` / `design-principles` / `scenarios`
  - 已在 2026-06-16 的动态结构迁移中移除，当前允许后端新增篇章 ID
- `idx_courses_plus_structure`
- `idx_courses_plus_representative`

远端数据库已执行该迁移。

远端验证结果：

```txt
free: 4 门课，0 门写入 Plus 字段
plus: 70 门课，70 门已写入 Plus 结构字段
pro: 31 门课，0 门写入 Plus 字段
```

这说明 Pro 和 Free 没有被 Plus 结构字段污染。

#### 10.1.7 Plus 篇章 / 模块定义已改为数据库动态配置

新增迁移文件：

```txt
supabase/migrations/20260616024859_dynamic_plus_course_structure.sql
```

新增结构表：

```sql
public.plus_course_tracks
public.plus_course_modules
```

当前职责：

- `plus_course_tracks` 维护篇章定义，例如 `theory` / `design-principles` / `scenarios` 的标题、说明、图标、排序。
- `plus_course_modules` 维护模块定义，例如 `learning-science` / `goals` / `shuoke` 的标题、说明、排序、旧分类映射和代表课程标题。
- `courses.plus_track_id` / `courses.plus_module_id` 仍维护每门课的归属。

前端读取方式：

- `/courses` 课程地图页优先读取 `plus_course_tracks` 和 `plus_course_modules`。
- `/courses/plus/:trackId` 篇章页优先读取数据库模块定义。
- 单课详情页的同模块目录也读取同一套动态结构。
- 如果数据库结构表读取失败，前端会回退到 `src/lib/plusCourseStructure.ts` 里的默认结构，避免页面不可用。
- 如果某门 Plus 课程写入了新的 `plus_module_id`，但 `plus_course_modules` 里还没有对应定义，前端会自动生成一个临时模块组块，标题暂用 module id。

新增模块推荐操作：

```sql
insert into public.plus_course_modules (
  track_id,
  id,
  title,
  description,
  sort_order,
  category_names,
  representative_titles,
  icon_key,
  is_active
) values (
  'scenarios',
  'review-lesson',
  '复习课篇',
  '帮助老师设计期末复习、单元复习和专题复习课。',
  40,
  array['复习课篇'],
  array[]::text[],
  'refresh-ccw',
  true
) on conflict (track_id, id) do update set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  category_names = excluded.category_names,
  representative_titles = excluded.representative_titles,
  icon_key = excluded.icon_key,
  is_active = excluded.is_active;

update public.courses
set
  plus_track_id = 'scenarios',
  plus_module_id = 'review-lesson',
  plus_module_order = 40,
  plus_lesson_order = 1
where id = '课程ID'
  and membership_type = 'plus';
```

注意：

- 新增模块不再需要改前端代码，但需要数据库迁移已部署到远端 Supabase。
- 新增全新篇章时，先插入 `plus_course_tracks`，再插入对应 `plus_course_modules`，最后更新课程的 `plus_track_id` / `plus_module_id`。
- 旧的 `courses_plus_track_id_check` 固定篇章约束已在新迁移中移除，以支持后端动态扩展篇章。

#### 10.1.8 管理后台课程编辑已支持直接同步 Plus 字段

后台课程编辑弹窗已支持两种修改路径：

- 从动态下拉中选择已配置的篇章 / 模块。
- 直接填写 `plus_track_id` 和 `plus_module_id`，用于先创建课程归属、后补模块定义的场景。

保存路径：

```txt
CourseManagementSection -> adminUpdateCourse() -> Supabase public.courses
```

保存校验：

- Plus 课程必须同时填写篇章 ID 和模块 ID，或者同时留空走旧分类自动归属。
- Pro / Free 课程保存时会自动清空 Plus 字段。
- 保存成功后，本页课程列表会立即用最新课程数据重新推导 Plus 结构；如果新模块还没有在 `plus_course_modules` 中定义，列表仍会显示临时模块 ID。

远端数据库核对：

- `courses.plus_track_id` / `courses.plus_module_id` / `plus_module_order` / `plus_lesson_order` / `plus_representative` 字段均存在。
- `courses` 表已有 authenticated 管理员 UPDATE policy：`Admin can update courses`。
- `adminUpdateCourse()` 继续走 PostgREST 更新，不需要额外新增 RPC。

#### 10.1.9 管理后台课程列表已支持 Plus 篇章 / 模块筛选

课程管理列表工具栏已新增两个筛选器：

- Plus 篇章筛选：读取当前动态 Plus 结构，显示全部已配置篇章。
- Plus 模块筛选：选择篇章后联动显示该篇章下的模块。

筛选规则：

- 默认展示全部课程，Pro / Free 不受影响。
- 选择某个 Plus 篇章后，只显示归属于该篇章的 Plus 课程，Pro / Free 会被排除。
- 再选择模块后，只显示该模块下的 Plus 课程。
- 筛选使用 `resolvePlusCoursePlacement(course, plusTracks)`，所以兼容显式数据库归属、旧分类自动归属和动态结构中的临时模块。
- 搜索、状态筛选和 Plus 结构筛选可以组合使用；切换筛选条件会重置分页到第 1 页。

涉及文件：

- `src/components/admin/CourseManagementSection.tsx`
- `src/test/CourseManagementSection.test.tsx`

#### 10.1.10 管理后台已支持批量调整与结构预览

课程管理列表新增 Plus 批量操作能力：

- 表格左侧增加选择列，只有 Plus 课程可以被选择；Pro / Free 课程不可被批量写入 Plus 结构字段。
- 工具栏下方增加批量操作面板，显示当前已选择的 Plus 课程数量。
- 支持选择批量目标篇章、目标模块、模块排序、模块内单课起始序号。
- 点击“批量保存”后，按当前列表顺序逐门调用 `adminUpdateCourse()` 写回：
  - `plus_track_id`
  - `plus_module_id`
  - `plus_module_order`
  - `plus_lesson_order`
- 如果填写了单课起始序号，会按所选课程顺序递增写入；如果留空，则保留原来的 `plus_lesson_order`。
- 保存成功后本地列表立即用返回数据刷新，并清空选择。

课程管理列表也新增“预览结构”入口：

- 未选择 Plus 篇章筛选时，打开 `/courses`。
- 已选择篇章时，打开 `/courses/plus/:trackId`。
- 已选择篇章和模块时，打开 `/courses/plus/:trackId#moduleId`。

当前设计边界：

- 批量保存复用现有 `adminUpdateCourse()`，不新增 RPC。
- 批量更新不是数据库事务；如果后续运营一次性调整大量课程并要求全成全败，再评估新增批量 RPC。
- 结构预览走新标签页，不改变后台当前筛选和编辑状态。

### 10.2 当前验证结果

已通过：

- `./node_modules/.bin/tsgo -p tsconfig.check.json`
- `./node_modules/.bin/vitest run src/test/CourseManagementSection.test.tsx src/test/CourseDetailPage.test.tsx src/test/plusCourseStructure.test.ts`
- `./node_modules/.bin/biome lint --only=correctness/noUndeclaredDependencies src/components/admin/CourseManagementSection.tsx src/test/CourseManagementSection.test.tsx`
- `npm run build`
- Supabase 远端 SQL 回填验证
- Supabase 远端 `courses` Plus 字段与管理员更新策略核对
- 浏览器烟测：
  - `/courses` 无开发者视角文案
  - Plus 三条主线正常显示
  - 每个篇章突出显示系列课模块
  - 理论篇不再错误露出说课课
  - `/courses/plus/scenarios#shuoke` 显示说课篇 8 节
  - Pro tab 仍走原有系列列表

验证边界：

- `npm run lint` 的 `tsgo` 和 `biome lint --only=correctness/noUndeclaredDependencies` 已执行通过，但最后一步 `ast-grep scan` 失败，原因是当前项目没有安装 `ast-grep` 可执行命令，`node_modules/.bin` 中也没有对应二进制。
- 当前本次功能有效验证以 `tsgo`、目标 Vitest、生产构建和既有 Supabase / 浏览器验证记录为准。

### 10.3 当前已知产品 / 技术判断

1. Plus 已经不是简单旧分类列表，而是“篇章 -> 模块 -> 单课”的结构。
2. 前台用户体验仍然压缩为：
   - 课程中心 -> 篇章页 -> 单课页
3. 模块不是独立页面，而是篇章页内部导航。
4. 场景篇允许复用理论篇或原理篇课程，但这类复用不一定改变数据库主归属。
5. 说课篇 01-08 是明确例外：它们的主归属应为“场景篇 / 说课篇”，因为录制目的就是解决说课任务。
6. Pro / Free 不进入 Plus 结构，不要把 Plus 字段用于它们的展示逻辑。
7. 首页卡片应重点展示“具体系列课”，代表课程只做弱提示。
8. 面向用户的页面不要出现“重构”“保留原有方式”“首页不铺满”等开发者语言。

### 10.4 下个 session 建议继续推进的事项

优先级 1：管理后台体验完善

已完成：

- 在课程列表中增加 Plus 篇章 / 模块筛选。
- 允许后台批量调整 Plus 模块归属和排序。
- 增加“按当前 Plus 结构预览”的后台入口。

优先级 2：内容结构精修

- 继续检查所有 70 门 Plus 课程的模块归属是否符合产品判断。
- 特别检查：
  - `任务情境篇` 中是否有公开课内容应复用到 `open-class`
  - `选修课` 中哪些是理论篇，哪些只是工具箱
  - `AI 通识课` 是否继续作为横向工具箱，还是迁到 Pro / 资源中心
- 为每个模块补一段更像用户语言的模块介绍。

优先级 3：篇章详情页体验

- 增加“继续学习 / 最近学习”入口。
- 增加上一个模块 / 下一个模块的流转。
- 课程卡片可显示内容形态：
  - 视频
  - 图文
  - 音频
  - 课程精华
- 对规划中模块提供更具体的待上线说明。

优先级 4：学习路径与问题入口

- 目前 `PLUS_PROBLEM_ENTRIES` 和 `PLUS_RECOMMENDED_PATHS` 是前端配置。
- 后续可考虑迁移到数据库或内容后台配置。
- 但在没有稳定运营需求前，建议继续放在前端配置，减少后台复杂度。

### 10.5 下个开发 session 建议任务提示词

可以直接使用：

> 请阅读 `docs/教学通识课Plus-课程结构重构接手文档.md`。  
> 当前 Plus 课程结构第一轮和管理后台优先级 1 已经完成：前台课程地图页、篇章详情页、后台 Plus 字段编辑、列表筛选、批量调整、结构预览入口、远端 Supabase 字段和说课篇 01-08 归属修正均已落地。  
> 请不要重复做第一阶段和后台优先级 1。下一步优先做内容结构精修：检查 70 门 Plus 课程的模块归属，重点核对公开课、选修课和 AI 工具类内容，并为每个模块补更像用户语言的模块介绍。  
> 保持 Pro / Free 课程展示逻辑不受影响。  
> 修改后继续用 `tsgo`、Supabase 远端查询和浏览器烟测验证。

---

## 11. 历史建议给下个开发 session 的任务提示词（已过期，仅留档）

可以直接使用：

> 请阅读 `docs/教学通识课Plus-课程结构重构接手文档.md` 和 `docs/教学通识课Plus-课程大纲.md`。  
> 先不要改数据库，优先用前端配置映射实现 Plus 课程的新信息架构。  
> 目标是把课程首页改成“课程地图页”：展示理论篇、教学设计原理篇、场景篇三条主线，同时露出二级模块、代表课程和按问题找课入口。  
> 篇章详情页采用“模块导航 + 单课列表”的结构，桌面端左右布局，移动端 accordion。  
> 保持现有课程详情页可访问，不破坏已有课程数据。
