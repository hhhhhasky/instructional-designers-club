# Git 核心概念入门：仓库、分支与 Worktree

> 基于俱乐部官网项目的实际操作经验整理。面向一个人或小团队开发者的实用指南。

---

## 一、仓库（Repository）

### 是什么

仓库 = **整个项目文件夹**。你在 GitHub 上看到的 `instructional-designers-club` 是一个仓库，你电脑上的 `俱乐部官网/` 文件夹也是一个仓库。两个仓库的内容是一样的，只是一个在 GitHub 服务器上（远程），一个在你电脑上（本地）。

```
你的电脑:  俱乐部官网/              ← 本地仓库
               ↕  git push / git pull
GitHub:    instructional-designers-club  ← 远程仓库
```

### .git 目录是什么

项目文件夹里有一个 `.git/` 隐藏目录，它是仓库的**引擎**——Git 靠它来追踪版本历史。没有 `.git/`，这个文件夹就只是普通文件夹，不是 Git 仓库。

```
俱乐部官网/              ← 整个文件夹就是"本地仓库"
  ├── src/              ← 源码（你能看到的文件）
  ├── docs/             ← 文档
  ├── package.json
  └── .git/             ← Git 的版本历史存储在这里（隐藏目录）
```

### 核心理解

- 本地仓库和远程仓库（GitHub）是**同一份项目的两个副本**，通过 `push`/`pull` 同步
- 每次提交（commit）相当于给项目拍了一张**完整快照**，记录了"这一刻所有文件长什么样"

### Git 到底存了什么：快照，不是日志

Git 的每次提交**不是只记"改了什么"**，而是把当时所有文件的完整内容都存一份。

假设 `config.js` 改了三次：

```js
// 版本1（第一次提交）
const version = "1.0";
```
```js
// 版本2（第二次提交）
const version = "1.1";
const author = "哈老师";
```
```js
// 版本3（第三次提交）
const version = "1.2";
const author = "哈老师";
const theme = "dark";
```

Git 在 `.git/` 里的存储：

```
提交1 的快照: { "config.js": "const version = \"1.0\";" }
提交2 的快照: { "config.js": "const version = \"1.1\";\nconst author = \"哈老师\";" }
提交3 的快照: { "config.js": "const version = \"1.2\";\nconst author = \"哈老师\";\nconst theme = \"dark\";" }
```

回退到版本 1 时，Git 不需要反向推算——直接把快照 1 里的文件内容取出来还原。就像拍了三张照片，想回到第一张的样子，直接拿出第一张照片就行。

### 为什么不会占太多空间

直觉上每次都存完整快照很占空间，但 Git 用了两个技巧：

**技巧1：内容相同的文件只存一次**

假设你有 100 个文件，某次提交只改了其中 1 个。Git 不会重新存另外 99 个，而是让新快照**指向**之前已经存过的那 99 个文件：

```
提交1 的快照: [文件A(v1)] [文件B(v1)] [文件C(v1)]
提交2 的快照: [文件A(v2)] [文件B(v1)] [文件C(v1)]
                          ↑ 没改过，直接指向提交1存的版本
```

**技巧2：用哈希值给每个文件内容生成唯一指纹**

```
"const version = \"1.0\""  -> 存储为对象 a1b2c3
"const version = \"1.1\"\nconst author = \"哈老师\""  -> 存储为对象 d4e5f6
```

内容一模一样的文件，指纹就一样，Git 就知道"这个我已经存过了，不用再存"。

### 回退时发生了什么

```bash
git checkout 提交1
```

Git 做的事情：

1. 找到提交 1 的快照
2. 看快照里记录的每个文件对应哪个指纹
3. 把这些文件的内容从 `.git/` 里取出来
4. 覆盖你工作目录里的文件

不是"反向计算"，而是"直接取出来用"。这就是为什么回退能 100% 准确——存的就是当时的原始内容。

---

## 二、分支（Branch）

### 是什么

分支**不是复制了一份文件**，而是一个**指向某次提交的指针/标签**。

```
master:  A -> B -> C -> D  <- 你在这里（HEAD）
                \
design:  A -> B -> E      <- 另一个分支
```

- `master` 指向提交 D，`design-system-refactor` 指向提交 E
- 你在哪个分支，你看到的文件就是那个分支指向的版本
- `git checkout master` / `git checkout design` 就是切换"当前显示哪个版本"

### 常见误解

**误解**：分支 = 复制一份文件夹，改完再合并回去。

**实际**：分支只是一个轻量的指针（几十字节），切换分支时 Git 会自动把你的工作目录里的文件切换成那个分支的版本。你的文件夹还是同一个，但里面的文件内容会变。

### 基本操作

```bash
# 查看所有分支
git branch

# 创建并切换到新分支
git checkout -b feature/new-feature

# 切换回 master
git checkout master

# 合并分支到当前分支
git merge feature/new-feature

# 删除已合并的分支
git branch -d feature/new-feature
```

---

## 三、分支如何减少多人协作冲突

### 问题场景

假设没有分支，三个人都直接改 master：

```
程序员 A：改了 CourseDetailPage.tsx，push 成功
哈老师：  也改了 CourseDetailPage.tsx，push 被拒绝（A 已经推了新版本）
程序员 B：改了 PricingSection.tsx，push 也被拒绝
```

结果：频繁冲突、互相阻塞、谁也推不上去。

### 分支的解决方案

以俱乐部官网项目为例，三个人同时开发：

**第一步：各建各的分支**

```
小李的任务：给课程详情页加"笔记"功能
  -> 创建分支 feature/notes

小王的任务：重构首页会员方案区域
  -> 创建分支 feature/pricing

哈老师：继续在 master 上改其他东西
```

Git 的状态：

```
master:          bd22782 <- 三人从这里分头出发
                  |
feature/notes:   bd22782 <- 小李（还没改）
feature/pricing: bd22782 <- 小王（还没改）
```

**第二步：各自在自己电脑上独立开发**

```
小李改了 CourseDetailPage.tsx（加笔记组件）
  -> 提交 2 次：A1 "添加笔记输入框" -> A2 "笔记保存到数据库"

小王改了 PricingSection.tsx（重构布局）
  -> 提交 3 次：B1 "重构布局" -> B2 "添加对比表格" -> B3 "移动端适配"

哈老师修了页脚样式
  -> 提交 1 次：E1 "修复页脚样式"
```

Git 历史变成：

```
master:          bd22782 -> E1（哈老师修了页脚）
                  |
feature/notes:   bd22782 -> A1 -> A2（小李加了笔记）
                  |
feature/pricing: bd22782 -> B1 -> B2 -> B3（小王重构定价）
```

**关键点：三个人改的是不同的文件或同一文件的不同区域，互相完全看不到对方的修改，互不干扰。**

**第三步：合并回来**

```bash
# 先合并小李的（因为他先做完）
git checkout master
git merge feature/notes    # 自动合并，无冲突

# 再合并小王的
git merge feature/pricing  # 自动合并，无冲突
```

最终结果：

```
master: bd22782 -> E1 -> M1(合并小李) -> M2(合并小王)
```

### 为什么还是可能冲突

如果小李和小王**碰巧改了同一个文件的同一行**（比如都改了 `CourseDetailPage.tsx` 第 50 行），合并时 Git 不知道该听谁的，就会报冲突：

```
CONFLICT (content): Merge conflict in src/pages/CourseDetailPage.tsx
```

这时需要手动打开文件，选择保留哪个版本。但这种情况比"三个人直接改 master"少得多，因为分支天然把不同功能的改动隔开了。

### 核心原则

> Git 不防止冲突，但它让冲突**可被发现、可被解决**。分支是降低冲突频率的工具，不是消除冲突的魔法。

---

## 四、Worktree（工作树）

### 是什么

正常情况下，一个仓库**同一时刻只能在一个分支上工作**。`git checkout` 到哪个分支，文件夹里的文件就变成那个分支的版本。

Worktree 是 Git 的高级功能，允许同一个仓库在**另一个文件夹**里同时检出另一个分支。

### 实际遇到的场景

在操作过程中，因为 master 分支被占用了，我创建了临时 worktree：

```
俱乐部官网/                    -> feature/course-video-player 分支
/private/tmp/club-master/     -> master 分支（临时创建的）
```

这导致后续操作出现报错：

```
fatal: 'master' is already checked out at '/private/tmp/club-master'
```

意思是 Git 不允许两个地方同时修改同一个分支。

### 解决方式

```bash
# 清理不再需要的 worktree
git worktree prune

# 然后就可以正常切换分支了
git checkout master
```

### 建议

对于一个人开发的项目，**不需要用 worktree**。这是多人协作或需要同时查看多个分支时才用的高级功能。

---

## 五、一个人开发的最佳实践

### 推荐：直接在 master 上改

你一个人开发、不需要审核，最简单的方式：

```bash
# 直接在 master 上改代码
# 改完后
git add .
git commit -m "描述改动内容"
git push origin master
```

**不需要创建分支**，不需要走 PR 流程。创建分支反而增加复杂度（worktree 冲突、合并步骤等）。

### 什么时候该用分支

- 尝试一个不确定能不能成功的大改动（改坏了直接删分支，不影响 master）
- 需要暂时放下当前工作去修一个紧急 bug（开个分支修 bug，修完合并回来）

### 常用命令速查

```bash
# 查看当前状态
git status

# 查看改了什么
git diff

# 提交改动
git add 文件名
git commit -m "改动说明"

# 推送到 GitHub
git push origin master

# 查看提交历史
git log --oneline -10
```

---

## 六、项目当前状态

| 项目 | 状态 |
|------|------|
| 当前分支 | `master` |
| 本地分支 | `master` + `design-system-refactor`（旧分支，可删） |
| Worktree | 无（已清理） |
| 远程同步 | master 已推送到 GitHub，远程无多余分支 |
| 视频状态 | 53 个视频全部正常链接，0 断裂，0 孤儿 |
