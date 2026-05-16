# 需求文档

## 1. 应用概述

### 1.1 应用名称
教学设计师俱乐部

### 1.2 应用描述
基于教学设计师俱乐部飞书文档内容制作的多页面网站，采用现代化设计展示俱乐部信息、活动安排、学习资源和会员服务，主要用于会员信息展示、新会员引导和资源分享。

---

## 2. 页面结构与核心功能

### 2.1 全站页面总览

```
教学设计师俱乐部网站
├── 首页
│   ├── 欢迎区域
│   ├── 主理人介绍
│   ├── 课程试看
│   ├── 俱乐部数据
│   ├── 俱乐部介绍
│   ├── 课程介绍
│   ├── 部分会员简介
│   ├── 会员反馈
│   ├── FAQ
│   └── CTA报名
├── 新会员必读页
│   ├── 近期活动汇总
│   ├── 新手村教程
│   └── 专业进阶地图
├── 资源页
│   ├── 公众号文章板块
│   └── 翻译文章板块
├── 课程中心页
│   ├── 一级标签导航（免费课 / Plus会员专属课程 / Pro会员专属课程）
│   ├── 二级分类导航（动态显示）
│   ├── 课程卡片列表
│   └── 课程详情页
└── 管理后台
    ├── 课程管理
    ├── 数据统计
    └── 用户管理
```

### 2.2 全站导航
- 顶部导航栏：首页、课程中心、新会员必读、资源中心、立即加入
- 导航栏样式：半透明背景，滚动时变为实色背景
- 锚点导航：支持页面间跳转和页面内快速定位

### 2.3 页面内快速定位导航

**首页快速定位导航：**
- 欢迎区域
- 主理人介绍
- 课程试看
- 俱乐部数据
- 课程介绍
- 会员简介
- 会员反馈
- FAQ
- 立即加入

**新会员必读页快速定位导航：**
- 近期活动
- 新手教程
- 进阶地图

**课程中心页快速定位导航：**
- 全部课程
- 教学设计
- 教育技术
- 课堂管理

**管理后台导航：**
- 课程管理
- 数据统计
- 用户管理

导航样式：侧边固定悬浮或顶部横向布局，点击后平滑滚动至对应版块

---

## 3. 首页设计

### 3.1 欢迎区域
- 标题：「Hi，欢迎来到教学设计师俱乐部！」
- 说明文字：以「AI时代的教学设计」为学习主题的专业俱乐部，致力于教师专业发展和创新教育实践
- 版权声明：这些内容仅供俱乐部内部学习使用，禁止商用，大家一起守护版权

### 3.2 俱乐部主理人介绍
- 主理人照片：使用用户提供的图片 形象照.png 作为主理人头像
- 主理人姓名：哈老师
- 个人介绍：
  - 10年教育从业经验、教育创业者、课程设计师、培训师
  - 致力于创新教育导向的教学设计，多平台拥有数万名教师粉丝
  - 深度支持500+教师专业发展，主理千人教育者社群
  - 研发过教学目标、PBL、真实任务设计、学习动力、建构主义等主题师培课程

### 3.3 课程试看
- 试看介绍：想知道教学设计和日常备课有什么不同吗？试看我们的第一节课「什么是教学设计」，你会发现教学设计远比写教案复杂，它是一门融合理论与实践的科学。通过试看，你将了解我们俱乐部的课程风格——既有深厚的理论基础，又注重实用落地，每节课60分钟信息量极大，让你的教学从经验驱动转向科学驱动。
- 试看按键：点击跳转至 https://meeting.tencent.com/crm/KPYg55RW1f

### 3.4 俱乐部相关数据
- 会员人数：300人
- 学习营数量：6个
- 课程节数：31节
- 课程累计时长：2000分钟
- 运行时长：自2025年3月31日起，页面自动计算并实时展示已运行天数
- UI设计：采用大号数字突出显示，配合醒目的渐变色背景，营造强烈的视觉冲击力

### 3.5 俱乐部介绍
- 俱乐部定位：以「AI时代的教学设计」为学习主题的俱乐部
- 课程分类：
  - 必修课：教学设计相关课程和学习营，包括每周一课和每月一营
  - 选修课：会员自发的学习活动，包括案例讨论、交流、求助、再课等

### 3.6 俱乐部课程介绍
- 课程全景图展示：使用用户提供的图片 教学设计全景图v20250913.png 作为核心视觉元素，展示完整的教学设计知识体系和课程架构
- 课程宣传图展示：
  - 使用用户提供的图片 建构主义学习营海报.png：展示建构主义学习营的课程内容和报名信息
  - 使用用户提供的图片 公众号配图1.png：展示真实任务设计实操营的课程框架和学习内容
  - 使用用户提供的图片 公众号配图2.png：展示教学目标学习营的课程体系和核心知识点
- UI互动动效：
  - 课程全景图采用鼠标悬停放大效果，点击后可查看高清大图
  - 三张课程宣传图采用卡片式轮播展示，支持左右切换浏览
  - 卡片悬停时产生轻微上浮和阴影加深效果，增强交互感
  - 图片加载时使用淡入动画，提升视觉流畅度
- 课程体系说明：
  - 教学设计101Course（科普入门）
  - 罗森海因共读（高效能教学：罗森海因教学原理实践）
  - 认知负荷理论共读（学习的门道：探秘认知负荷理论）
  - 应用学习科学共读
  - 教学目标学习营
  - 真实任务设计实操营
  - 建构主义学习营
  - 「教学幻象」分享

### 3.7 俱乐部部分会员简介
- 某高校幼儿教育L老师：专注幼儿教育理论与实践研究
- 独立人文思辨教育Z老师：致力于培养学生批判性思维能力
- 某小学数学教研员M老师：小学数学教学方法创新实践者
- 某高中物理L老师：物理教学与科学思维培养专家
- 某中学政治R老师：思政课程设计与价值观教育研究者
- 某高中英语M老师：英语教学与跨文化交流推广者
- 广州一土数学老师：创新数学教育理念践行者
- 青少年创新PBL课程L老师：项目式学习设计与实施专家
- 厌学青少年疗愈导师J老师：专注学习动力激发与心理疏导
- 某IB学校L老师：国际教育课程设计与实施专家
- 某大学教学设计在读博士：教学设计理论研究与应用探索者

### 3.8 会员老师们这样说
- 使用用户提供的图片 a4f655b6997b894a0a8872f1ec29e292.png 展示会员真实反馈
- 展示会员老师的学习体验和收获感言，增强新会员的信任感和参与意愿

### 3.9 FAQ常见问题解答
- Q1：俱乐部就是讲书吗？和我自己看有啥区别？
- 详细解答内容，说明俱乐部的价值和特色

### 3.10 CTA报名邀请
- 报名邀请文案，鼓励新会员加入
- 强化版报名按键，采用醒目的渐变色彩和动态效果，点击后跳转至麦客表单：http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb

---

## 4. 新会员必读页设计

### 4.1 页面标题
新会员必读指南

### 4.2 近期活动汇总

**建构主义学习营**
- 时间：2025年11月4日—11月24日
- 活动海报：使用用户提供的图片 建构主义学习营海报.png
- 报名方式：微信企业号二维码

**拆解得到活动**
- 主题：他山之石可以攻玉，拆解得到做课方法论，获取可迁移的设计策略
- 报名条件：能够自行拆解一节得到课程，并组织一次小组内公开分享讨论会

### 4.3 新手村教程
- 新手村教程链接：https://meeting.tencent.com/crm/KPzWZZLZ52（标注为新会员必看）
- 教程说明：帮助新会员快速了解俱乐部运作方式和学习方法

### 4.4 专业进阶地图

**小白期**
- 老师痛点：缺乏系统的教学设计知识，不知道如何科学备课
- 推荐课程：教学设计101Course、教学目标学习营

**成长期**
- 老师痛点：有一定基础但缺乏实践经验，理论与实践脱节
- 推荐课程：真实任务设计实操营、认知负荷理论共读

**成熟期**
- 老师痛点：需要更深层次的理论指导和创新方法
- 推荐课程：建构主义学习营、应用学习科学共读

**专家期**
- 老师痛点：追求教学艺术与科学的完美结合
- 推荐课程：「教学幻象」分享、罗森海因共读

地图呈现：阶梯状视觉设计，清晰展示进阶路径

---

## 5. 资源页设计

### 5.1 页面标题
学习资源中心

### 5.2 页面布局
采用blog列表形式，分为两个主要板块

### 5.3 公众号文章板块

文章列表：
- 我最近发现，新老师们普遍对教学存在几种误解，以至于在备课上课上走了弯路 - https://mp.weixin.qq.com/s/OTmKerjMYGR3kQWrq14IfQ
- 建构主义的知识观：知识是被发现的，还是被发明的？ - https://mp.weixin.qq.com/s/9wywvx0kUnEIq3dOilpJDA
- 为什么要搞合作学习？我自己学，自己建构知识，不可以吗？ - https://mp.weixin.qq.com/s/n7lNKnQ2jSv9ucRPhs7-zw
- 建构主义十问十答：一篇文章回应你对建构主义所有的误解和困惑 - https://mp.weixin.qq.com/s/Q6qTMj5nyxIYcgfJdhbonA
- 从技术的角度，重新理解建构主义，老师们需要重构自己的「技术观」 - https://mp.weixin.qq.com/s/g2Yvt_VkEWKLY7_1UAOzAQ
- 教学设计思考：为什么很多老师最终不得不选择传统的教学方式？ - https://mp.weixin.qq.com/s/nuzdiXCV7nWT3H9l4Vl2rQ
- 地图不等于疆界：老师们，别被理论框死了，它只是你的「工具箱」 - https://mp.weixin.qq.com/s/s8PBVW3dLBiatMWD66Dzhw
- 教学培训就好像AI调优，数据、算法、算力，三者缺一不可 - https://mp.weixin.qq.com/s/Z13o4InxO10IuTDfjkOiSw
- 追求「花样教学」，不如追求「系统化」的教学设计 - https://mp.weixin.qq.com/s/Zz8gtYIUNVP--QdgoMPFJQ
- 反思布卢姆：为何同一知识点的题目难度天壤之别？以2023年北京数学中考试卷为例 - https://mp.weixin.qq.com/s/wwh0fNVK5BwpQfteIhC8Dg
- 一篇课文，四种上法：语文课的教学设计可能性远比你想的多 - https://mp.weixin.qq.com/s/qqlgh1lIalemF8wYaYdLnQ
- 写好教学目标，既是教学设计的第一步，也是教学设计进阶的第一步 | 教学设计101Course第2课：教学目标分析 - https://mp.weixin.qq.com/s/_g_JG90QM0dRibkDcyMkog
- 建构主义教学的迷思：为何主动探索不等于有效学习？ - https://mp.weixin.qq.com/s/rmPkbLdEZ8nAHkSXnczE_g
- 教学设计101 Course：01 什么是教学设计？ - https://mp.weixin.qq.com/s/Nxs9nmR3vLMpv92Ys7W3HQ
- 你为什么要这么上这节课？为什么你要用游戏化/项目式/探究式学习？ - https://mp.weixin.qq.com/s/UmpJwXMRkNfKJireMAbkCA
- 专家和新手到底差在哪里？| 浅聊认知负荷理论 - https://mp.weixin.qq.com/s/29pgYZzyNrXKLgMkG5rMAg
- 为了理解科学的教学：学生概念研究，以及学习视角的改变（2002年） - https://mp.weixin.qq.com/s/p37J_2_eMw-SPfKSRb-LDg
- 编程入门阶段学生的误解以及其他困难：一篇文献综述 - https://mp.weixin.qq.com/s/jR-a0sV3_RH5JY27p9ukbw
- 聊聊学习体验设计 | Learning Experience Design | LXD - https://mp.weixin.qq.com/s/o12J8wiZ8uMDyw96ZOTE0w
- 建构主义：从哲学到实践（1997年） - https://mp.weixin.qq.com/s/lDqnO7C6PnJmuLbItnZBWw
- 拒绝假情境 | 浅谈情境教学 - https://mp.weixin.qq.com/s/9YQcdDYtQwoInTHwgUMR6g
- 抽象的儿童与具体的儿童 | 浅谈理解儿童 - https://mp.weixin.qq.com/s/Lfrc68i0OWOrNRwuTib-FQ
- 放纵儿童？教训儿童？| 面对儿童行为问题的三个核心原则 - https://mp.weixin.qq.com/s/SkC3ZD8WyUYuoRSefouiBQ
- 拉出教室就是真实性的学习吗？| 浅谈真实性 - https://mp.weixin.qq.com/s/u7fkmfZBxQBPgCc5Uia1ug
- 如何观察和分析幼儿行为？ - https://mp.weixin.qq.com/s/wGz3R8LhV-gku-DJSB2Y_A
- PBL、克伯屈与杜威 | PBL利弊谈 - https://mp.weixin.qq.com/s/iVYaR_Z8rloPwmv5lA4VUQ
- 大概念、学科结构与布鲁纳 | 大概念利弊谈 - https://mp.weixin.qq.com/s/j5FVHKFEEeIyacoArLB0Pg
- 儿童中心是普世价值吗？| 进步主义教育利弊谈 - https://mp.weixin.qq.com/s/MllntU-Wwz3jiDfnwLL91A
- 如何激发学习者的学习兴趣？ - https://mp.weixin.qq.com/s/Xb7cib0N5iLstGZuHvJveg

### 5.4 翻译文章板块

文章列表：
- 教师主导的教学与以学生为中心的学习是对立的？ - 译文链接：http://xhslink.com/a/aL5Cg6BXMF7cb | 原文链接：https://teacherhead.com/2019/12/08/myth-teacher-led-instruction-and-student-centred-learning-are-opposites/?share=jetpack-whatsapp&nb=1
- 哈佛大学大脑认知科学：为什么学过的记不住 - https://www.xiaohongshu.com/discovery/item/685d07c80000000012022d14?source=webshare&xhsshare=pc_web&xsec_token=ABsZgc9w6jQ0yuv0zZ8PoeOkDl3Bz3EDL8SNQ4OUKS8mU=&xsec_source=pc_share
- 高手这么设计教学PPT：教师省事，提分有效 - https://www.xiaohongshu.com/discovery/item/6853c1b5000000001703031b?source=webshare&xhsshare=pc_web&xsec_token=ABVSBtFpDGGndecfFYD5z68eQzjSGX7_k-uMKwiU1rGNg=&xsec_source=pc_share
- 教学设计经典论文 | 少教不教为什么不管用？ - https://www.xiaohongshu.com/discovery/item/684012a3000000000f033939?source=webshare&xhsshare=pc_web&xsec_token=ABYXRtvREUSM0kJqXqBCZCV3EM0FFqsvakrjZF-TTsiwM=&xsec_source=pc_share
- 教师的班级管理课：比尔·罗杰斯的十大理念 - https://www.xiaohongshu.com/discovery/item/68355815000000000303f973?source=webshare&xhsshare=pc_web&xsec_token=AB-aN-giAQbPX0LHBh5OvM50uFVzMcpAQ5uGBEFGZ0A8g=&xsec_source=pc_share
- 教学策略：让学生越学越会的10种记忆练习 - https://www.xiaohongshu.com/discovery/item/683083dd0000000012004bbf?source=webshare&xhsshare=pc_web&xsec_token=ABJNuh8xyKtjI1g38S30CEuARO00MQBeK5KAe7hKYnDSA=&xsec_source=pc_share
- 翻译 | Cold Call：老师必备的课堂提问五步 - https://www.xiaohongshu.com/discovery/item/6829ce39000000000c03a8b8?source=webshare&xhsshare=pc_web&xsec_token=ABengL3LNW0KAwHmZ6syZUqs-9XyWYttTQb24-86hqOWU=&xsec_source=pc_share
- 教知识，还是教思维？ - https://www.xiaohongshu.com/discovery/item/68258eac000000001101c37c?source=webshare&xhsshare=pc_web&xsec_token=ABzKtIsm0pTXWghDEkIMA-V7zCytpARAmQnQgy84Yaqfk=&xsec_source=pc_share
- 学科知识与教学技巧：哪个更重要 - https://www.xiaohongshu.com/discovery/item/682357ea000000001101eb9d?source=webshare&xhsshare=pc_web&xsec_token=ABxvfLOf_EH8wfRlEVXwWZ2_rBrNqKKyOQmYvTZoSgiqQ=&xsec_source=pc_share
- 新书精华翻译 | 显性教学被老师们大大低估 - https://www.xiaohongshu.com/discovery/item/68216133000000000c03a549?source=webshare&xhsshare=pc_web&xsec_token=ABqbdMizcWKCZto7a5gh1Dc-DXk-dk-tH23kOAK-J-sS0=&xsec_source=pc_share
- 优质教育博客 | 教学到底是艺术还是技术？ - https://www.xiaohongshu.com/discovery/item/681d73bf000000000f030791?source=webshare&xhsshare=pc_web&xsec_token=ABWFmMIkceyw72NOeVCYOOcOC2jE9Bu_efUuYOVYL3c4M=&xsec_source=pc_share
- 外文翻译 | 这样培养成长型思维，效果微弱 - https://www.xiaohongshu.com/discovery/item/681c3b680000000012007b1a?source=webshare&xhsshare=pc_web&xsec_token=ABcsaZIlSCsq9ksgDXpye5i8nXhdtSm7DgYf1y3tYTA3Q=&xsec_source=pc_share

---

## 6. 课程中心页设计

### 6.1 页面标题
课程中心

### 6.2 页面整体布局
- 整体布局参考截屏2025-12-19 11.47.46.png，采用卡片式网格布局
- 顶部设置一级标签导航，下方动态显示二级分类导航
- 课程卡片按网格排列，每行展示3-4个卡片，响应式适配不同屏幕尺寸

### 6.3 一级标签导航

**标签列表（三个并列标签）：**
- 免费课
- Plus会员专属课程
- Pro会员专属课程

**默认展示规则：**
- 页面加载时默认激活并展示「Pro会员专属课程」标签下的课程列表

**交互规则：**
- 点击标签后，课程列表区域平滑切换至对应内容，无需刷新页面（前端状态切换）
- 当前激活标签高亮显示，与未激活标签有明显视觉区分

**课程归属规则：**
- Pro会员专属课程：仅包含标识为 Pro 类型的课程
- 免费课：包含所有免费课程及免费试看课程
- Plus会员专属课程：包含除 Pro 课程与免费试看课程之外的全部课程

### 6.4 二级分类导航

**动态显示规则：**
- 二级分类在对应一级标签下动态渲染，仅展示该标签下实际存在课程的分类
- 各标签下的二级分类来源于 Course Categories 数据库中各分类记录的属性字段值（适用人群、适用场景、内容类型），前端根据这些字段值进行筛选渲染

**交互规则：**
- 支持展开/收起操作
- 点击二级分类标签后，课程列表筛选至对应分类

### 6.5 课程卡片设计

每个课程卡片包含以下元素：
- 课程配图：由AI技术生成的原创图片，尺寸统一，具体生成规范见6.9节
- 会员类型标识：在卡片显眼位置标注课程所属类型（免费 / Plus / Pro）
- 课程分类标签：显示课程所属类别（如「教学设计」「教育技术」等）
- 课程难度标签：显示课程难度级别（如「初级」「中级」「高级」）
- 课程名称：清晰展示课程标题
- 讲师信息：显示主讲教师姓名
- 课程时长：显示课程总时长（如「12小时」）
- 学习人数：显示已学习人数（如「3,280人」）
- 课程评分：显示课程评分（如「4.9分」）
- 课程价格：显示课程价格（如「¥399」），免费课程显示「免费」
- 报名按钮：「立即报名」按钮，点击后跳转至对应课程详情页

### 6.6 课程卡片交互效果
- 鼠标悬停时卡片产生轻微上浮效果，阴影加深
- 点击卡片任意位置均可跳转至课程详情页
- 卡片加载时使用淡入动画

### 6.7 课程详情页设计

每个课程详情页包含以下内容（内容格式参考截屏2025-12-19 11.48.43.png）：
- 课程名称：大标题展示课程完整名称
- 学习营名称：显示课程所属学习营（如适用）
- 课程链接：提供腾讯会议或百度网盘等课程回放链接，点击后跳转至指定链接
- 课程介绍：详细说明课程内容、学习目标、适用人群等
- 课程大纲：列出课程章节和主要知识点
- 讲师介绍：展示主讲教师的背景和专业领域
- 报名按钮：页面底部设置醒目的「立即报名」按钮，点击后跳转至报名表单或支付页面

### 6.8 课程信息来源

课程具体信息根据用户提供的课程信息文档（截屏2025-12-19 11.48.43.png）进行填充，包括但不限于：
- 重新认识讲授法 - 建构主义 - https://meeting.tencent.com/crm/2V8mvVXP6a
- 知识是被发现的，还是被发明的？建构主义的知识观 - 建构主义 - https://meeting.tencent.com/crm/lRoWvwPD77
- 人是如何学习的？建构主义的学习观 - 建构主义 - https://meeting.tencent.com/crm/KePA55pPef
- 讲授还是探究？建构主义的教学观 - 建构主义 - https://meeting.tencent.com/crm/KePV87vPc6
- 建构主义的教学设计

### 6.9 后端数据字段定义

**课程卡片数据表（Courses）**

在原有字段基础上，保留以下字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| course_id | 主键 | 课程ID |
| title | 字符串 | 课程标题 |
| instructor | 字符串 | 讲师姓名 |
| duration | 字符串 | 课程时长 |
| cover_image | 字符串 | 封面图片链接 |
| rating | 浮点数 | 课程评分 |
| course_type | 枚举字符串 | 课程类型，取值范围：free（免费）、plus（Plus会员专属）、pro（Pro会员专属） |
| is_free_preview | 布尔值 | 是否为免费试看课程，true 时归入「免费课」标签 |
| category_id | 外键 | 关联 Course Categories 数据库的分类ID |

**Course Categories 数据库（课程分类表）**

原 course_series_tags 数据库废弃，相关标签信息统一合并至 Course Categories 数据库。Course Categories 数据库在原有字段基础上新增以下属性字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| category_id | 主键 | 分类ID |
| category_name | 字符串 | 分类名称（如「教学设计」「教育技术」「课堂管理」等） |
| target_audience | 字符串 | 适用人群（如「新手教师」「有经验教师」「教研员」等） |
| applicable_scenario | 字符串 | 适用场景（如「课堂教学」「培训设计」「课程开发」等） |
| content_type | 字符串 | 内容类型（如「理论共读」「实操营」「案例分析」等） |

**字段说明：**
- 原 course_series_tags 数据库中的系列标签信息，统一迁移至 Course Categories 的对应属性字段中维护
- 前端课程中心页的二级分类筛选逻辑，基于 Course Categories 数据库中 target_audience、applicable_scenario、content_type 字段的实际值进行动态渲染与筛选
- 课程卡片通过 category_id 外键关联至对应分类，获取分类属性用于前端展示与筛选
- 管理后台课程编辑界面中，课程类型字段提供下拉选择（free / plus / pro），分类字段通过关联 Course Categories 表进行选择

---

## 7. 管理后台设计

### 7.1 数据库架构设计

**课程卡片数据表（Courses）**
- 课程ID（主键）
- 课程标题
- 讲师姓名
- 课程时长
- 封面图片链接
- 评分
- 课程类型（course_type）：枚举值 free / plus / pro
- 是否免费试看（is_free_preview）：布尔值
- 分类ID（category_id）：外键，关联 Course Categories 数据库

**Course Categories 数据库（课程分类表）**
- 分类ID（主键）
- 分类名称
- 适用人群（target_audience）
- 适用场景（applicable_scenario）
- 内容类型（content_type）

**课程详情页数据表**
- 详情ID（外键关联课程ID）
- 课程简介
- 本课目标
- 本课重点（JSON格式存储章节信息）
- 学员评价数据

### 7.2 管理后台功能需求

**批量编辑界面**
- 支持同时修改多个课程的基础信息
- 批量导入导出功能
- 批量状态更新

**单个课程详情编辑器**
- 富文本格式编辑器
- 实时预览功能，可查看修改后的页面效果
- 版本控制功能，支持数据回滚到历史版本

**课程管理功能**
- 课程分类管理（基于 Course Categories 数据库，支持对分类的适用人群、适用场景、内容类型字段进行增删改）
- 课程状态管理
- 课程排序设置
- 课程类型管理（支持设置 free / plus / pro 及免费试看标识）

### 7.3 数据同步机制

**实时数据绑定**
- 建立数据库与前端页面的实时数据绑定
- 修改保存后自动触发页面内容更新
- 支持增量更新，仅同步变更数据字段

**缓存管理**
- 数据缓存策略
- 缓存刷新机制
- 数据一致性保障

### 7.4 权限管理

**分级管理员权限**
- 超级管理员权限
- 普通管理员权限
- 编辑人员权限

**操作日志记录**
- 记录所有数据修改历史
- 用户操作审计追踪
- 权限访问控制

### 7.5 界面布局

**管理后台整体布局**
- 左侧固定导航菜单
- 顶部工具栏
- 主内容区域
- 响应式设计

**课程列表页面**
- 表格展示课程数据，包含课程类型列
- 搜索筛选功能（支持按课程类型、分类属性筛选）
- 批量操作工具栏

**课程编辑页面**
- 选项卡式布局
- 字段分组展示，课程类型字段提供下拉选择，分类字段关联 Course Categories 表
- 预览窗口集成

**分类管理页面**
- 展示 Course Categories 数据库中所有分类记录
- 支持对每条分类记录的适用人群、适用场景、内容类型字段进行增删改查
- 表格形式展示，支持内联编辑或弹窗编辑

**统计报表页面**
- 数据可视化图表
- 导出报表功能
- 时间维度筛选

---

## 8. 设计风格

### 8.1 配色方案
- 主色调：深蓝色（#1E3A8A）体现专业性
- 辅助色：橙色（#F97316）用于重要按钮和强调元素
- 背景色：浅灰白色（#F8FAFC）保持清爽感
- 文字色：深灰色（#374151）确保可读性

### 8.2 视觉细节
- 圆角设计：统一使用8px圆角，营造现代感
- 阴影效果：卡片采用轻微阴影（0 2px 8px rgba(0,0,0,0.1)）增加层次
- 图标风格：线性图标风格，保持简洁统一
- 动画效果：使用CSS3过渡动画，时长300ms

### 8.3 整体布局
- 采用卡片式布局，内容区域左右留白适中
- 网格系统：12列布局，间距协调
- 响应式设计，适配不同屏幕尺寸

---

## 9. 业务规则与逻辑

### 9.1 课程中心一级标签切换逻辑
- 标签切换为纯前端状态管理，不触发页面刷新
- 切换时课程列表区域执行平滑过渡动画
- 二级分类导航随一级标签切换同步更新，仅展示当前标签下有课程的分类
- 若某一级标签下暂无课程，显示空状态提示文案

### 9.2 课程归属判断优先级
- 优先判断 is_free_preview 字段：为 true 时，无论 course_type 取值，均归入「免费课」
- 其次判断 course_type：pro → Pro会员专属；plus → Plus会员专属；free → 免费课

### 9.3 前端筛选逻辑（基于 Course Categories 字段）
- 前端课程中心页的二级分类筛选，通过读取 Course Categories 数据库中各分类记录的 target_audience、applicable_scenario、content_type 字段值进行动态渲染
- 筛选时，前端根据用户选择的筛选条件，匹配课程所关联分类的对应字段值，过滤并展示符合条件的课程卡片
- 原 course_series_tags 相关的筛选逻辑全部废弃，统一由 Course Categories 字段驱动

### 9.4 运行天数自动计算
- 运行时长基于起始日期2025年3月31日，由前端根据当前日期实时计算并展示已运行天数

---

## 10. 异常与边界情况

| 场景 | 处理方式 |
|---|---|
| 某一级标签下暂无课程 | 显示空状态提示，如「该分类暂无课程，敬请期待」 |
| 课程封面图加载失败 | 显示默认占位图，保持卡片布局不变 |
| 课程链接失效 | 跳转后由目标平台处理，前端不做额外拦截 |
| 管理后台课程类型字段未填写 | 前端表单校验提示必填，不允许保存空值 |
| 二级分类下无课程 | 该二级分类标签不显示，或显示空状态提示 |
| Course Categories 分类属性字段为空 | 该字段对应的筛选维度不在前端渲染，不影响其他筛选项正常展示 |

---

## 11. 验收标准

- 课程中心页顶部正确展示三个一级标签：免费课、Plus会员专属课程、Pro会员专属课程
- 页面加载时默认激活「Pro会员专属课程」标签，并展示对应课程列表
- 点击不同一级标签后，课程列表平滑切换，无页面刷新
- 二级分类导航随一级标签切换动态更新，仅展示当前标签下有课程的分类
- 每个课程卡片清晰标注会员类型标识（免费 / Plus / Pro）
- 课程归属逻辑符合规则：Pro课程仅出现在Pro标签；免费及免费试看课程出现在免费课标签；其余课程出现在Plus标签
- 管理后台课程编辑界面包含课程类型下拉字段（free / plus / pro）及免费试看布尔字段
- 数据库课程表包含 course_type、is_free_preview、category_id 字段
- Course Categories 数据库包含 target_audience、applicable_scenario、content_type 三个新增属性字段
- 原 course_series_tags 数据库已废弃，相关标签逻辑全部迁移至 Course Categories
- 前端课程中心页二级分类筛选逻辑基于 Course Categories 字段值驱动，运行正常
- 管理后台分类管理页面支持对 Course Categories 各属性字段进行增删改查
- 首页运行天数基于2025年3月31日自动计算并实时展示
- 所有原有页面内容、链接、图片引用均完整保留，无遗漏

---

## 12. 本期不实现功能

- 会员登录与身份验证（课程类型标识仅为展示，本期不做权限拦截）
- 课程购买与支付流程
- 用户学习进度记录
- 课程评论与评分提交功能
- 站内搜索功能
- 多语言支持