# Live 实时互动功能 V1 开发规格文档

> 用途：交给 Coding Agent 进行数据库、前端、Realtime 与权限功能开发。
> 版本：V1
> 核心原则：先实现稳定的“直播互动闭环”，不提前开发排行榜、闯关、历史学习档案、复杂统计等未来功能。

---

# 一、功能目标

现有官网主要承担课程内容承载，包括图文、音频、视频和课程回放。

本功能新增一个 **Live 实时互动模块**，用于直播授课过程中让学员：

1. 进入当前直播房间；
2. 接收主持人发布的互动题目；
3. 在线提交或修改答案；
4. 在主持人停止作答后不能继续修改；
5. 在主持人公布答案后查看正确答案；
6. 主持人实时查看答题人数、答案分布和正确率；
7. 主持人可以提前创建题目，也可以直播过程中临时新增题目。

V1 的核心不是游戏化，而是：

**主持人发布问题 → 学员作答 → 数据实时汇总 → 主持人根据结果调整教学。**

---

# 二、明确不做的功能

为了避免过度开发，V1 不开发以下功能：

- 排行榜；
- 积分；
- 团队 PK；
- 闯关系统；
- 学员历史 Live 学习档案；
- Live 内容归档中心；
- response_history；
- question_versions；
- live_events；
- participants / attendance 历史表；
- 设备/IP/浏览器记录；
- 难度、标签、分值等题目属性；
- is_temporary；
- is_correct；
- 单独的 question_status 字段；
- 单独保存 responses.live_id；
- 复杂直播预约、预热、报名等状态；
- 复杂题库系统。

后续只有在出现明确业务需求后再扩展。

---

# 三、总体技术架构

技术基础：

- Supabase Postgres：持久化业务数据；
- Supabase Auth：确认当前用户身份；
- Supabase RLS：控制读写权限；
- Supabase Realtime Broadcast：同步课堂实时事件；
- Supabase Presence：同步当前在线用户；
- 官网现有前端技术栈：继续复用，不引入新的前端框架。

整体原则：

```text
Database = 保存“事实”
Broadcast = 通知“刚刚发生了什么”
Presence  = 表示“现在谁在线”
```

数据库是唯一 Source of Truth。

Broadcast 不能替代数据库状态。

例如：

```text
发布 Q3
```

不能只发送一条 Broadcast。

必须：

```text
1. 更新数据库：
   current_question_id = Q3
   question_state = answering

2. 再 Broadcast：
   question_opened(Q3)
```

这样即使学员掉线、刷新、晚进入，也可以重新读取数据库恢复状态。

---

# 四、核心数据库

V1 只新增 4 张业务表：

```text
live_sessions
questions
question_keys
responses
```

已有用户系统直接复用。

如果项目使用 Supabase Auth：

```text
auth.users
```

就是用户身份来源，不重新建立 users 表。

---

# 五、表一：live_sessions

## 5.1 作用

一行代表一场 Live 互动。

它同时承担：

- 房间身份；
- 房间当前生命周期；
- 当前正在互动哪一道题；
- 当前题目处于什么状态。

## 5.2 字段

| 字段 | 类型 | 约束 | 用途 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | Live 唯一内部 ID |
| room_code | text | UNIQUE，可 NULL | 用户看到的房间号 |
| title | text | NOT NULL | Live 标题 |
| status | text | NOT NULL | 整个房间状态 |
| current_question_id | uuid | FK，可 NULL | 当前正在互动的题 |
| question_state | text | NOT NULL | 当前互动状态 |

## 5.3 status

只允许：

```text
draft
live
ended
```

含义：

```text
draft
= 已创建直播记录，但房间尚未开放

live
= 房间已开放，用户可以进入

ended
= 本场 Live 已结束
```

不要新增：

```text
scheduled
preparing
paused
archived
closed
```

等状态。

## 5.4 question_state

只允许：

```text
waiting
answering
closed
revealed
```

含义：

```text
waiting
= 房间已开启，但当前没有正在作答的题

answering
= 当前题正在开放作答

closed
= 已停止作答

revealed
= 已公布正确答案
```

## 5.5 room_code

创建直播时：

```text
room_code = NULL
```

点击：

```text
开启房间
```

时才生成房间号。

建议：

```text
6 位数字字符串
例如：837261
```

数据库通过 UNIQUE 防止重复。

如果随机生成发生冲突，重新生成。

## 5.6 外键

```text
current_question_id
→ questions.id
```

删除 question 时如果它当前正在使用，应由应用层阻止。

---

# 六、表二：questions

## 6.1 作用

一行代表一道题。

预设题与直播现场临时添加的题，在数据库结构上完全相同。

不要建立：

```text
is_temporary
```

## 6.2 字段

| 字段 | 类型 | 约束 | 用途 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 题目 ID |
| live_id | uuid | FK, NOT NULL | 属于哪个 Live |
| position | integer | NOT NULL | 题目顺序 |
| title | text | NOT NULL | 后台列表中的短标题 |
| type | text | NOT NULL | 题型 |
| content | text | NOT NULL | 完整题干 |
| options | jsonb | NOT NULL | 题目选项 |

约束：

```text
UNIQUE(live_id, position)
```

## 6.3 type

V1 支持：

```text
single_choice
multiple_choice
true_false
```

分别对应：

```text
单选题
多选题
判断题
```

不要提前添加：

```text
填空题
排序题
匹配题
词云
量表
开放题
```

## 6.4 options

单选 / 多选示例：

```json
[
  {
    "id": "A",
    "text": "知识目标"
  },
  {
    "id": "B",
    "text": "学习活动"
  },
  {
    "id": "C",
    "text": "学习结果"
  }
]
```

V1 默认支持 A—D 四个选项即可。

判断题可以：

```json
[]
```

由前端按照题型直接呈现：

```text
正确
错误
```

不要把：

```text
is_correct
```

存到 options 中。

---

# 七、表三：question_keys

## 7.1 作用

单独保存正确答案。

目的是防止学员在题目尚未公布时，通过浏览器请求直接看到正确答案。

## 7.2 字段

| 字段 | 类型 | 约束 |
|---|---|---|
| question_id | uuid | PRIMARY KEY + FK |
| correct_answer | jsonb | NOT NULL |

不需要额外 id。

## 7.3 数据示例

单选：

```json
"B"
```

多选：

```json
["A", "C"]
```

判断：

```json
true
```

## 7.4 外键

```text
question_id
→ questions.id
ON DELETE CASCADE
```

---

# 八、表四：responses

## 8.1 作用

保存某用户对某一道题的“当前答案”。

不要保存答题历史。

## 8.2 字段

| 字段 | 类型 | 约束 |
|---|---|---|
| question_id | uuid | 联合主键 + FK |
| user_id | uuid | 联合主键 + FK |
| answer | jsonb | NOT NULL |
| answered_at | timestamptz | NOT NULL，DEFAULT now() |

联合主键：

```text
PRIMARY KEY(question_id, user_id)
```

因此：

```text
一个用户
+
一道题
=
最多一条 response
```

## 8.3 修改答案

第一次提交：

```text
INSERT
```

再次提交：

```text
UPSERT / UPDATE
```

例如：

```text
B → C
```

直接修改同一行。

不要新增：

```text
attempt
attempt_count
first_answer
response_history
```

## 8.4 不存 live_id

因为：

```text
response.question_id
→ question.live_id
```

可以唯一推导。

## 8.5 不存 is_correct

正确与否通过：

```text
responses.answer
+
question_keys.correct_answer
```

实时计算。

---

# 九、表关系

```text
auth.users
     │
     │ user_id
     ▼
responses
     │
     │ question_id
     ▼
questions ─────────── question_keys
     │
     │ live_id
     ▼
live_sessions
     │
     └── current_question_id → questions.id
```

---

# 十、RLS 权限设计

所有 public schema 业务表启用 RLS。

管理员权限复用项目现有管理员系统。

如果管理员身份基于 Supabase Auth JWT：

授权信息必须使用：

```text
app_metadata
```

不要使用用户可自行修改的：

```text
user_metadata
```

---

# 十一、live_sessions RLS

普通登录用户：

只允许读取：

```text
status = 'live'
```

用户不能读取：

```text
draft
ended
```

因为 V1 不提供 Live 历史内容中心。

普通用户：

```text
INSERT ❌
UPDATE ❌
DELETE ❌
```

管理员：

```text
SELECT ✅
INSERT ✅
UPDATE ✅
DELETE 根据现有后台规则决定
```

---

# 十二、questions RLS

管理员：

可以管理所选 Live 下所有题目。

普通学员：

不能读取全部题库。

只能读取：

```text
当前直播
+
current_question_id 对应的题
```

逻辑：

```text
live.status = live

AND

live.current_question_id = questions.id
```

因此学员不能提前通过浏览器读取：

```text
Q4
Q5
Q6
```

---

# 十三、question_keys RLS

管理员：

```text
SELECT
INSERT
UPDATE
DELETE
```

均允许。

普通用户：

只有满足：

```text
live.status = live
AND
live.current_question_id = question_id
AND
live.question_state = revealed
```

才允许 SELECT。

也就是说：

```text
作答中 → 看不到答案
停止作答 → 仍看不到答案
公布答案 → 才能读取正确答案
```

这样用户刷新页面以后仍然可以恢复“答案已公布”的状态。

---

# 十四、responses RLS

普通用户只能：

```text
SELECT 自己的 response
INSERT 自己的 response
UPDATE 自己的 response
```

必须满足：

```text
user_id = auth.uid()
```

并且 INSERT / UPDATE 还必须满足：

```text
对应直播 status = live
AND
current_question_id = question_id
AND
question_state = answering
```

因此数据库层面禁止：

```text
提前回答未来题目
回答已经结束的问题
停止作答后修改答案
冒充其他用户提交
```

普通用户：

```text
DELETE ❌
```

管理员：

至少需要：

```text
SELECT 全部 responses
```

用于实时统计。

---

# 十五、Realtime Channel

一场直播对应一个 Channel。

topic：

```text
live:<live_id>
```

例如：

```text
live:a83f9320-xxxx-xxxx
```

Channel 使用：

```text
private: true
```

不要使用：

```text
room_code
```

作为 Channel 主 ID。

room_code 只是用户进入房间时使用的短码。

真正的系统身份使用 UUID live_id。

---

# 十六、Realtime 权限

普通登录用户：

```text
接收 Broadcast ✅
发送 Broadcast ❌

接收 Presence ✅
发送 Presence ✅
```

管理员：

```text
接收 Broadcast ✅
发送 Broadcast ✅

接收 Presence ✅
发送 Presence ✅
```

学员提交答案不是 Broadcast。

正确流程是：

```text
学员
↓
responses
↓
数据库
```

---

# 十七、Broadcast 事件定义

V1 只定义以下事件。

## 17.1 question_opened

主持人发布题目：

```json
{
  "event": "question_opened",
  "payload": {
    "question_id": "uuid"
  }
}
```

## 17.2 question_closed

```json
{
  "event": "question_closed",
  "payload": {
    "question_id": "uuid"
  }
}
```

## 17.3 answer_revealed

```json
{
  "event": "answer_revealed",
  "payload": {
    "question_id": "uuid"
  }
}
```

不必把正确答案直接 Broadcast。

客户端收到事件后重新读取：

```text
question_keys
```

RLS 此时已经允许访问。

## 17.4 session_ended

```json
{
  "event": "session_ended",
  "payload": {
    "live_id": "uuid"
  }
}
```

## 17.5 response_changed

用户 response INSERT / UPDATE 后，由数据库触发实时通知。

建议 Broadcast 内容只包含：

```json
{
  "event": "response_changed",
  "payload": {
    "question_id": "uuid"
  }
}
```

不要把：

```text
user_id
answer
```

广播给整个房间。

主持后台收到：

```text
response_changed
```

以后重新读取当前 question 的 responses 并更新统计。

---

# 十八、Presence

Presence 只负责回答：

```text
现在谁在线？
```

例如：

```text
user_id
display_name
```

即可。

不要建立：

```text
participants
```

表。

管理员实时可以得到：

```text
在线人数
在线用户集合
```

如果需要计算：

```text
未作答用户
```

使用：

```text
Presence 在线用户
-
responses 已答用户
```

即可。

Presence 不负责保存历史出勤。

---

# 十九、完整生命周期

整个 Live 生命周期：

```text
创建直播
    ↓
draft
    ↓
编辑题目
    ↓
开启房间
    ↓
live + waiting
    ↓
选择题目
    ↓
发布题目
    ↓
answering
    ↓
停止作答
    ↓
closed
    ↓
公布答案
    ↓
revealed
    ↓
发布下一题
    ↓
answering
    ↓
……
    ↓
结束房间
    ↓
ended
```

---

# 二十、步骤一：创建直播

管理员点击：

```text
+ 创建直播
```

输入最少信息：

```text
直播标题
```

数据库：

```text
INSERT live_sessions

id = UUID
title = 输入标题
room_code = NULL
status = draft
current_question_id = NULL
question_state = waiting
```

这里的“创建直播”已经生成：

```text
live_id
```

因此从这一刻开始，题目就可以归属于这个 Live。

---

# 二十一、步骤二：创建题目

创建 Live 后，可以添加题目。

管理员进入当前 Live。

点击：

```text
+ 新建题目
```

弹出：

```text
题目编辑器 Modal
```

而不是在主页面长期占用固定编辑区域。

---

# 二十二、题目编辑 Modal

Modal 包含：

```text
题目标题
题目类型
题干
选项
正确答案
```

题型选择：

```text
单选题
多选题
判断题
```

---

## 单选题 UI

显示：

```text
题目标题

题型：
○ 单选题
○ 多选题
○ 判断题

题干

选项 A
选项 B
选项 C
选项 D

正确答案：
A / B / C / D

[保存] [取消]
```

---

## 多选题 UI

正确答案允许：

```text
☑ A
☐ B
☑ C
☐ D
```

---

## 判断题 UI

不显示 A—D 编辑框。

直接显示：

```text
正确答案：

○ 正确
○ 错误
```

---

# 二十三、临时加题

直播过程中允许：

```text
+ 临时加题
```

它仍然打开同一个 Question Editor Modal。

数据库仍然只是：

```text
INSERT questions
INSERT question_keys
```

不要增加：

```text
is_temporary
```

区别只是发生时间不同。

建议：

临时题保存后自动成为 D 区“选择要发布的题目”的当前选项。

但是：

**保存临时题不能自动 Broadcast。**

仍必须由管理员在互动控制区点击：

```text
发布题目
```

才正式发布。

---

# 二十四、步骤三：开启房间

管理员点击：

```text
开启房间
```

系统：

```text
生成 6 位 room_code

UPDATE live_sessions

room_code = xxxx
status = live
current_question_id = NULL
question_state = waiting
```

此时：

```text
房间已经开放
≠
题目已经发布
```

用户可以提前进入。

页面显示：

```text
已进入互动课堂

等待主持人发布问题……
```

---

# 二十五、步骤四：用户进入 Live

用户入口：

```text
/live
```

`/live` 页面只呈现：

```text
当前 status = live 的房间
```

不展示：

```text
draft
ended
历史直播
历史答题记录
```

用户可以：

```text
点击当前 Live
```

或：

```text
输入 room_code
```

进入动态页面，例如：

```text
/live/837261
```

所有直播共用同一套页面组件。

不是每场直播创建独立网页。

---

# 二十六、进入房间流程

用户通过 room_code：

```text
837261
```

查询：

```text
live_sessions
WHERE
room_code = 837261
AND
status = live
```

获取：

```text
live_id
```

然后订阅：

```text
live:<live_id>
```

同时启动 Presence。

建议客户端完成 Channel subscribe 后，再读取一次数据库当前状态：

```text
status
current_question_id
question_state
```

用于处理：

- 晚进入；
- 页面刷新；
- 断线重连；
- Broadcast 漏收。

---

# 二十七、步骤五：发布题目

所有题目 Broadcast 操作只能发生在后台：

```text
D. 互动控制 / 实时结果
```

不能在 B 题目内容管理区发布。

管理员在 D 区：

```text
选择要发布的题目：
[ Q3 ▼ ]
```

点击：

```text
发布题目
```

先更新数据库：

```text
current_question_id = Q3
question_state = answering
```

然后 Broadcast：

```text
question_opened(Q3)
```

学员页面收到事件后读取 Q3。

---

# 二十八、步骤六：提交答案

用户点击答案：

```text
B
```

客户端执行：

```text
UPSERT responses
```

例如：

```text
question_id = Q3
user_id = 当前 auth.uid()
answer = "B"
```

数据库 RLS 再次确认：

```text
是不是本人
是不是当前题
是不是 answering
```

成功后数据库触发：

```text
response_changed
```

主持后台收到后重新统计。

---

# 二十九、实时统计

管理员只针对：

```text
current_question_id
```

读取 responses。

第一版直接在浏览器统计即可。

例如：

```text
参与人数：60

A = 12
B = 35
C = 8
D = 5

正确答案 = B

正确率：
35 / 60 = 58.3%
```

展示：

```text
条形图
答题人数
每个选项人数
每个选项比例
正确率
```

暂时不建立：

```text
question_stats
```

表。

如果未来规模明显增加，再迁移为服务器聚合。

---

# 三十、步骤七：停止作答

管理员点击：

```text
停止作答
```

数据库：

```text
question_state = closed
```

然后 Broadcast：

```text
question_closed
```

学员页面立即：

```text
禁用提交按钮
```

即使学员绕过前端按钮直接请求数据库，RLS 也必须拒绝。

---

# 三十一、步骤八：公布答案

管理员点击：

```text
公布答案
```

数据库：

```text
question_state = revealed
```

Broadcast：

```text
answer_revealed
```

客户端重新读取：

```text
question_keys
```

此时 RLS 才允许当前学员读取标准答案。

---

# 三十二、步骤九：发布下一题

有两种方式。

方式一：

管理员从：

```text
选择要发布的题目 ▼
```

选择任意已有题目，再点：

```text
发布题目
```

方式二：

点击：

```text
发布下一题
```

系统按照：

```text
questions.position
```

选择下一题。

执行：

```text
current_question_id = next_question_id
question_state = answering
```

Broadcast：

```text
question_opened
```

---

# 三十三、步骤十：结束直播

管理员点击：

```text
结束房间
```

数据库：

```text
status = ended
```

Broadcast：

```text
session_ended
```

客户端：

```text
停止作答
显示“本场互动已结束”
```

用户重新访问 `/live` 时：

这场直播不再展示。

V1 不提供历史回看入口。

---

# 三十四、后台信息架构

现有后台：

```text
数据管理
数据看板
```

原则：

```text
数据管理 = 可以改变数据库
数据看板 = 只读
```

Live 功能放到：

```text
数据管理
→ Live互动
```

---

# 三十五、后台主页面布局

页面：

```text
Live房间与互动管理
```

总体结构：

```text
┌─────────────────────────────────────┐
│ 顶部操作栏                           │
├──────────┬──────────────────────────┤
│ 房间列表 │ A 房间信息与控制          │
│          ├──────────────────────────┤
│          │ B 题目内容管理            │
│          ├──────────────────────────┤
│          │ D 互动控制 / 实时结果     │
└──────────┴──────────────────────────┘
```

---

# 三十六、顶部操作栏

包含：

```text
+ 创建直播
搜索标题 / 房间号

状态筛选：
全部 / 草稿 / 进行中 / 已结束
```

注意：

这里的：

```text
草稿
进行中
已结束
```

只是：

```text
筛选条件
```

不是修改 Live 状态的按钮。

---

# 三十七、房间列表

房间列表应保持紧凑。

页面宽度约：

```text
20%—25%
```

不要占据 1/3 或更多页面。

显示：

| 标题 | 房间号 | 状态 | 操作 |
|---|---|---|---|
| 教学目标设计直播 | 837261 | 进行中 | 进入管理 |
| 概念教学拆解 | — | 草稿 | 进入管理 |
| 做中学公开课复盘 | 721883 | 已结束 | 查看 |

状态为只读标签。

点击某一行后：

右侧加载对应：

```text
live_id
```

的数据。

---

# 三十八、A 区：房间信息与控制

展示：

```text
直播标题

房间号
（draft 时为空）

直播状态（只读）
```

状态显示例如：

```text
[草稿]
[进行中]
[已结束]
```

这些必须表现为：

```text
Status Badge
```

而不是可点击 Button。

实际修改状态的操作单独使用：

```text
开启房间
结束房间
复制房间号
显示二维码
```

---

# 三十九、A 区按钮状态

## draft

可用：

```text
保存
开启房间
```

不可用：

```text
复制房间号
显示二维码
结束房间
```

## live

可用：

```text
复制房间号
显示二维码
结束房间
```

## ended

房间控制全部只读。

---

# 四十、B 区：题目内容管理

B 区只负责：

```text
创建题目
查看题目
修改题目
复制题目
删除题目
```

**绝对不要出现：**

```text
发布题目
停止作答
公布答案
发布下一题
```

这些全部属于 D 区。

---

# 四十一、B 区列表

显示：

| 序号 | 题目标题 | 题目类型 | 操作 |
|---|---|---|---|
| Q1 | 教学目标的关键结构 | 单选题 | 编辑 / 复制 / 删除 |
| Q2 | 哪个目标符合分类？ | 多选题 | 编辑 / 复制 / 删除 |
| Q3 | 以下是否属于表现性任务？ | 判断题 | 编辑 / 复制 / 删除 |

不要显示：

```text
题目状态
发布时间
作答状态
```

因为题目本身没有状态。

当前课堂状态统一存储在：

```text
live_sessions
```

---

# 四十二、B 区按钮

```text
+ 新建题目
```

点击后：

```text
打开 Question Editor Modal
```

直播过程中可以同时提供：

```text
+ 临时加题
```

两个按钮使用同一个 Modal 与数据库结构。

---

# 四十三、题目编辑器必须使用 Modal

不要在主页面固定摆放题目编辑器。

正确交互：

```text
点击新建题目
    ↓
弹出 Modal
    ↓
填写题目
    ↓
保存
    ↓
关闭 Modal
    ↓
刷新 B 题目列表
```

编辑题目：

```text
点击编辑
    ↓
弹出同一个 Modal
    ↓
加载已有内容
```

---

# 四十四、题目编辑前提

只有已经创建：

```text
live_sessions.id
```

后才能创建题目。

如果没有选中 Live：

```text
+ 新建题目
```

不可用。

这保证每一道题一定存在：

```text
live_id
```

归属。

注意：

不需要“开启房间”以后才能创建题目。

正确逻辑：

```text
创建直播（draft）
↓
已经获得 live_id
↓
可以创建题目
↓
之后再开启房间
```

---

# 四十五、直播中的题目编辑限制

当前题一旦已经：

```text
answering
closed
revealed
```

不允许修改：

```text
题干
选项
正确答案
```

避免已经有人作答以后题目内容发生变化。

未来题目仍然可以修改。

已经 ended 的 Live：

题目全部只读。

---

# 四十六、D 区：互动控制 / 实时结果

D 是整个系统：

**唯一允许发布 Broadcast 控制事件的 UI 区域。**

D 区包括：

```text
选择要发布的题目 ▼

当前题目状态（只读）

发布题目

停止作答

公布答案

发布下一题
```

以及：

```text
实时回答结果
```

---

# 四十七、D 区题目选择

使用 Dropdown：

```text
选择要发布的题目

[ Q2 哪个目标符合布鲁姆分类？ ▼ ]
```

下拉数据来源：

```text
questions
WHERE live_id = 当前 live
ORDER BY position
```

用户可以选择任意已有题目。

选择本身：

```text
不改变数据库状态
不发送 Broadcast
```

只有点击：

```text
发布题目
```

才真正发布。

---

# 四十八、D 区状态和按钮逻辑

## waiting

允许：

```text
发布题目
```

禁止：

```text
停止作答
公布答案
发布下一题
```

---

## answering

允许：

```text
停止作答
```

其他广播操作禁用。

---

## closed

允许：

```text
公布答案
发布下一题
```

---

## revealed

允许：

```text
发布下一题
```

---

## ended

全部互动按钮禁用。

---

# 四十九、D 区实时结果

显示：

```text
当前题目

当前状态

在线人数

已答人数

A %
B %
C %
D %

正确答案

正确率
```

主要使用：

```text
水平条形图
```

即可。

V1 不需要复杂图表库效果。

---

# 五十、用户前端页面

用户入口：

```text
/live
```

页面不要形成：

```text
直播课程库
历史直播列表
个人答题档案
```

这里只服务：

```text
“现在正在发生什么”
```

---

# 五十一、用户端主要状态

## 没有 Live

```text
当前暂无互动
```

## 房间已进入但 waiting

```text
已进入互动课堂

等待主持人发布问题……
```

## answering

显示：

```text
题干

A
B
C
D

[提交答案]
```

## 已提交但仍 answering

允许用户修改答案。

## closed

```text
作答已结束
```

不能再修改。

## revealed

显示：

```text
你的答案
正确答案
```

## ended

```text
本场互动已结束
```

---

# 五十二、掉线与刷新恢复

不能依赖 Broadcast Replay 作为主要恢复方案。

重新加载页面以后：

先恢复：

```text
live_sessions.status
live_sessions.current_question_id
live_sessions.question_state
```

再获取：

```text
当前 question
自己的 response
必要时 question_key
```

然后继续正常订阅 Realtime。

---

# 五十三、前端组件建议

具体文件结构根据现有项目调整，不要求改变框架。

逻辑上建议至少拆成：

```text
AdminLivePage

LiveRoomList
LiveRoomControl

QuestionList
QuestionEditorModal

LiveInteractionControl
LiveRealtimeResults

LiveEntryPage
LiveParticipantPage
```

组件命名可以按照现有项目规范修改。

不要为了本功能重新设计整个前端架构。

---

# 五十四、关键数据流

## 主持人发布题目

```text
D区选择 Q3
↓
点击发布题目
↓
UPDATE live_sessions
↓
current_question_id = Q3
question_state = answering
↓
Broadcast question_opened
↓
学员客户端收到
↓
读取 Q3
↓
显示题目
```

---

## 用户答题

```text
用户点击 B
↓
UPSERT responses
↓
RLS 校验
↓
数据库写入
↓
response_changed
↓
管理员后台收到
↓
重新读取 Q3 responses
↓
本地统计
↓
更新条形图
```

---

## 停止作答

```text
管理员点击停止作答
↓
question_state = closed
↓
Broadcast question_closed
↓
学员按钮禁用
↓
数据库 RLS 同时禁止 UPDATE
```

---

## 公布答案

```text
管理员点击公布答案
↓
question_state = revealed
↓
Broadcast answer_revealed
↓
学员读取 question_keys
↓
显示正确答案
```

---

# 五十五、开发顺序

建议 Agent 按以下顺序开发：

1. 检查现有项目的 Supabase、Auth、管理员权限和路由结构；
2. 创建 4 张数据库表；
3. 创建 PK / FK / UNIQUE / CHECK；
4. 配置 RLS；
5. 配置 Realtime private channel；
6. 配置 Presence；
7. 完成 responses 数据变化的 Realtime 通知；
8. 完成管理员 Live 页面；
9. 完成创建 Live；
10. 完成 Question Editor Modal；
11. 完成 B 题目管理；
12. 完成 A 房间状态控制；
13. 完成 D Broadcast 控制；
14. 完成 `/live` 用户入口；
15. 完成学员答题页面；
16. 完成实时统计；
17. 完成掉线/刷新恢复；
18. 完成权限和生命周期测试。

---

# 五十六、验收场景

必须完整通过以下流程。

## 场景 A：提前出题

```text
创建 Live
↓
状态 draft
↓
创建 Q1、Q2、Q3
↓
开启房间
↓
生成 room_code
↓
用户进入
↓
等待
↓
主持人选择 Q1
↓
发布
↓
所有用户看到 Q1
```

## 场景 B：回答与统计

```text
用户 A 选 B
用户 B 选 C
用户 C 选 B
↓
responses 正确保存
↓
后台实时看到：
B = 2
C = 1
```

## 场景 C：修改答案

```text
用户 A：
B → C
```

数据库仍然只有一条 response。

统计同步变化。

## 场景 D：停止作答

```text
主持人点击停止
```

用户：

```text
UI 不可提交
直接请求数据库同样被拒绝
```

## 场景 E：公布答案

主持人点击：

```text
公布答案
```

用户才能读取正确答案。

## 场景 F：临时加题

直播中：

```text
临时加题
↓
Modal
↓
保存
↓
questions 新增
↓
D 下拉菜单出现新题
```

此时：

```text
不能自动发布
```

必须：

```text
D → 发布题目
```

才 Broadcast。

## 场景 G：刷新恢复

Q3 正在 answering。

用户刷新浏览器。

重新进入后仍然：

```text
自动恢复 Q3
```

不用等待新的 Broadcast。

## 场景 H：结束直播

主持人：

```text
结束房间
```

用户：

```text
立即收到结束通知
不能继续提交
```

刷新 `/live`：

不再显示该 Live。

---

# 五十七、Agent 必须遵守的开发约束

本功能特别强调避免过度开发。

Agent 不得自行增加：

```text
额外业务表
额外状态
额外题型
历史记录系统
缓存系统
统计表
复杂事件总线
Redis
Queue
排行榜
积分
游戏化功能
```

也不要给每张表机械添加：

```text
二十多个“可能以后会用”的字段
```

原则：

```text
能计算的数据，不存。

能从已有关系唯一推导的数据，不重复存。

没有当前产品用途的数据，不采集。
```

尤其不要增加：

```text
responses.live_id
responses.is_correct

questions.is_current
questions.is_published
questions.is_temporary

live_sessions.metadata
live_sessions.settings

question_stats

live_participants

live_events
```

如 Agent 在实现过程中发现确实必须新增字段或表，应先说明：

```text
为什么现有模型无法实现
新增数据解决什么当前问题
```

再决定是否增加。

---

# 五十八、最终系统边界

最终 V1 应形成四层：

```text
第一层：内容
questions
question_keys

第二层：课堂状态
live_sessions

第三层：学习行为
responses

第四层：实时通信
Broadcast
Presence
```

后台：

```text
B = 管题

D = 控课
```

这是 UI 和业务逻辑最重要的边界。

具体来说：

```text
B 题目内容管理
= 创建、编辑题

D 互动控制
= 选择题、发布、停止、公布、下一题
```

不要把两者重新混合。

---

# 五十九、一句话架构

整个功能可以概括为：

> **管理员先创建一个 Live 数据记录和题目；开启房间后，学员通过 room_code 找到 live_id 并进入对应 private Realtime Channel；数据库保存当前课堂状态和所有答案，Broadcast 只负责同步状态变化，Presence 负责在线状态；管理员在唯一的互动控制区选择题目并控制发布、停止和公布，实时根据 responses 形成统计结果。**

这就是 V1 的完整产品与技术边界。
