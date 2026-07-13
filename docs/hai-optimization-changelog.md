# HAI 每日自我优化日志

本文件记录 HAI 每日自我优化闭环的运行结果。由 `hai-daily-optimization` skill 每日产出，**顶部最新**。

- 触发：每天 22:13 本地（cron，仅 Claude Code 会话存活时生效），或 `/hai-daily-optimization` 手动触发，或补跑指定日期。
- 数据源：`hai_messages.metadata.hai_context_trace`，导出件存 `docs/hai-optimization-runs/<date>.json`。
- 结构化留痕另存于 DB 表 `hai_optimization_log`（需先应用 migration `20260705220000`；未应用前 apply 脚本优雅降级，本文件仍是真实记录）。
- 无用户活动当天不写新条目（按需跳过）。

---

<!-- 新条目追加在本分隔线之下，最新在上 -->

## 2026-07-06（常规日评估：质量健康，无改动）

### 评估范围
- 120 条用户提问（约为昨日 37 条的 3.2 倍，使用量上升）。数据见 `docs/hai-optimization-runs/2026-07-06.json`。
- 意图分布：teaching_design 44、public_lesson 32、teacher_growth 14、assessment_feedback 11、classroom_management 7、lesson_plan_diagnosis 6、pbl_crossdisciplinary 4、learning_motivation 2、general_question **0**。

### 发现问题

- **[安全] 0 硬违规**（120/120）。无提示词/模型/key 泄露、无套话自暴、无绝对化承诺。
- **[意图] 0 误路由**。昨日 #1/#2/#5 的 general_question 误兜底今日未复现（general_question 归零）。注：昨日记的代码层修复（`intent_classifier.ts:148` / 路由 prompt）尚未应用，今日未复现可能是当日提问更清晰而非根因消失，**继续观察**。
- **[诊断] 0 模板兜底**。deeper_problem 无一例「缺少足够教学场景」模板；抽样 teacher_growth / pbl / assessment_feedback 三条，重新归因准确（如 #54「讲得越多越没用直觉对、归因要调整」→ 缺形成性评价检测），并自然引用了 core_axioms 的评价证据公理。
- **[风格] 真性讨好 ~2-3/120（≈2%，昨日 10.8%）**。
  - 正则命中"要不要" 8 条，但人工核查 **5 条是合法诊断式**（"不是'要不要'的问题,而是…"、"不要先问'要不要'"——正是 style_pack 规则 2/4 的正确用法）。
  - 真违规仅 #35「你要不要试一下…」、#56「你再决定要不要接着往下看」等少数把判断权推回用户的协商句。
  - 结论：style_pack 第 11 条已生效；进一步收敛靠 07-05 entry 记的 composer 硬模板（待主人 deploy），**今日不再加规则**——盲目扩规则会误伤"不是要不要"这一合法诊断句式。

### 已落地改动
- 无。今日质量健康，按 skill「不要为改而改」原则不动 prompt。

### 待确认改动（沿用昨日，未自动写）
- LLM 语义路由器误兜底修复（候选 A/B，见 2026-07-05 entry），代码层需 redeploy。
- composer 硬模板 + core_axioms/formula_bank（07-05 阶段1+2 entry）待 `db push` + apply + `functions deploy`。

### 次日复查
- 继续看 general_question 是否仍为 0（确认路由根因是否真的修好或只是当日没触发）。
- 待 composer 硬模板上线后，复查真性讨好句式是否归零。
- 关注使用量上升后是否出现新的边界/安全 case。

---

## 2026-07-05（产品封装升级 阶段1+2：公理层 + 公式库 + 硬模板）

### 背景
对齐 dbs skill 的产品封装设计：dbs 之所以好用，核心是"专家判断逻辑不仅内化进 AI，还显性地亮给用户"——公理可见、模板可见、公式可见。HAI 架构（编排/配置化/每日闭环）已强于 dbs，但缺公理锚点、强模板、公式库。本次补阶段 1+2。

### 已完成改动

1. **新增 `core_axioms`（第 0 层，8 条教学公理）** — `supabase/migrations/20260706090000_hai_axioms_and_formula_bank.sql`
   - 目标是终点非起点 / 学情决定方法 / 评价是证据非排名 / 活动服务理解 / 先诊断后方案 / 赋能不替决策 / 理念落课堂动作 / 趣味≠必要感。
   - 每条诊断判断必须能追溯到其中至少一条。
   - 对齐 dbs 的"公理锚定"。

2. **新增 `formula_bank`（第 5 层，18 条教学设计公式）** — 同一 migration
   - 6 类：导入 / 提问 / 认知入口 / 反馈 / 评价证据 / 任务链迁移。
   - 生成时按需取 1-3 条，不全部铺开，不暴露编号。
   - 对齐 dbs 的"公式库"形态。

3. **TS 接线**（让公理/公式真正进 system prompt）
   - `types.ts`：`HAIContextPackage` 加 `core_axioms?` / `formula_bank?`。
   - `context_orchestrator.ts`：从 `promptConfig` 读取这两层。
   - `response_composer.ts`：公理紧跟安全边界注入，公式库紧跟案例库注入。
   - `deno check` 全绿（含 hai-chat/index.ts）。

4. **升级 `response_composer_prompt` 为填空式硬模板** — `docs/hai-optimization-runs/2026-07-05-composer-template.md`（dry-run 164→616 字符通过，待实写）
   - 6 段必填结构：一句话判断 / 真正的问题 / 常见误区 / 可以这样看 / 这样做（步骤）/ 你的下一步。
   - 强制收尾：「你接下来第一件可以做的事是：____」。
   - 硬禁讨好语气："你觉得呢/要不要/你看这样行吗/是不是可以"。
   - 软场景兜底：概念问答可省中段，但判断/真正的问题/下一步三段必出。

5. **golden 回归样本 +2** — `evals/golden_questions.json`（golden_011/012）
   - 专测硬模板合规 + 讨好语气消除：`must_include ["你接下来第一件可以做的事是"]`，`must_avoid` 覆盖 4 类讨好句式。

6. **顺手修一个预先存在的语法 bug**：`response_evaluator.ts:57-58` 字符串内嵌 ASCII 双引号未转义，整个 edge function parse 不过（被本次 deno check 暴露）。改为反引号字符串，语义不变。注意：这是上一轮"精简为安全兜底"留下的，与本次封装升级无关，但部署前必须随本次一起上线。

### 待主人执行（动生产库，未自动跑）

```bash
# 1) 应用 migration（新增 core_axioms / formula_bank 两个 key）
supabase db push
# 或只跑这条：
# supabase migration up

# 2) 实写硬模板到 response_composer_prompt（热生效）
node scripts/hai-apply-prompt-config.mjs \
  --key response_composer_prompt \
  --reason "产品封装阶段1：硬模板+强制收尾+讨好语气禁令" \
  --file docs/hai-optimization-runs/2026-07-05-composer-template.md

# 3) redeploy edge function（response_composer/types/context_orchestrator 改了 TS）
supabase functions deploy hai-chat
```

注：步骤 1 必须先于步骤 2 之前完成吗？不必——`response_composer_prompt` 是已存在 key，与新增的两个 key 无依赖。但公理/公式真正生效需要 1+3 都完成（migration 插入 + TS 读取），硬模板生效只需 2。

### 次日复查
- 跑 golden benchmark（含新增 011/012），看「你接下来第一件可以做的事是」命中率与讨好句式命中率。
- 看每日导出中讨好语气命中数是否进一步下降（07-05 首次闭环后已有 style_pack 第 11 条打底，本次硬模板是第二道闸）。
- 评估公理是否被回答真实引用（抽样看 trace 里的 final_answer 是否能追溯到公理），若模型只是被动接收而无判断锚定迹象，下一步考虑让 problem_rewriter 显式输出"命中公理编号"。

### 阶段 3+4（未做，待后续）
- 给用户的"工具箱心智"（前端暴露 diagnostic_module 能力标签）。
- 技能链/条件触发（诊断完推荐下一步能力）。
- 节奏改造（信息不足先反问再给方案）。
- 方法论透明化（回答中适度暴露判断依据）。

---

## 2026-07-05（闭环上线 + 首次评估）

### 评估范围
- 37 条用户提问（多个会话），数据见 `docs/hai-optimization-runs/2026-07-05.json`。
- 意图分布：teaching_design 15、public_lesson 11、assessment_feedback 4、general_question 3、pbl_crossdisciplinary 3、lesson_plan_diagnosis 1。

### 发现问题

- **[意图/重大] #1 #2 #5 被误路由到 `general_question`（conf 0.55）**
  - #1「数学课讲完学生会点头但做题错」实际是评价证据/假懂问题；#2「三年级语文《富饶的西沙群岛》教材很散不知从哪切入」实际是 teaching_design；#5「目标写'让学生理解分数意义、掌握基本性质'可以吗」实际是 teaching_design 目标诊断。
  - 三条都吐了**同一句模板化** deeper_problem「当前问题缺少足够教学场景，需要先做假设性诊断」。
  - 根因：`intent_classifier.ts:148` 的 `fallbackIntent.implicit_need` 模板，被 `problem_rewriter` 当 deeper_problem 复用；LLM 语义路由器（`hai-chat/index.ts:400-477`，当前主路由）在低把握时默认落到 general_question。
  - 注：尽管意图误路由，最终回答的诊断与风格质量其实不错（LLM 生成层兜住了），但意图层误判会让检索/诊断模块选错，长期需修。

- **[风格/一般] #6 #23 #33 #35 出现讨好/协商语气**
  - 命中「要不要」「你觉得呢」，与 `HAI_CONSULTANT_STANDARD_CALIBRATION.md` 金标（"不够直接克制"）冲突。

- **[安全] 0 硬违规**：无提示词/模型/API key 泄露、无套话自暴、无绝对化承诺。`#35` 用户索要完整公开课教案（边界测试）→ HAI 正确拒绝并重构为最小框架，符合 `safety_boundaries` 规则 1。

### 已落地改动（已写 `hai_orchestrator_prompt_configs`，热生效）

- `style_pack`：新增第 11 条「避免讨好或协商语气：不要用"你觉得呢""要不要""你看这样行吗""是不是可以"等把判断权推回给用户的句式」。
  - 验证：dry-run 182 → 256 字符，实写成功，下一条 HAI 请求即生效。

### 待确认改动（高风险，未自动写）

- **LLM 语义路由器误兜底到 general_question**（影响 #1/#2/#5 及未来类似提问）：
  - 候选修复 A（代码层，需 redeploy）：`intent_classifier.ts:148` 的模板兜底文案改为更具体的不确定表达，不要复用到 deeper_problem。
  - 候选修复 B（代码层，需 redeploy）：`hai-chat/index.ts` 的 LLM 路由 prompt 增加few-shot，降低对 teaching_design/assessment 类清晰教学情境问题的误判率。
  - 待主人确认走哪条 + 是否 redeploy。

### 次日复查
- 看 2026-07-06 导出中「讨好语气」命中数是否下降（验证 style_pack 改动）。
- 继续观察 general_question 路由占比是否仍偏高。

### 上线组件清单（本次搭建）
- `scripts/hai-daily-export.mjs`、`scripts/hai-apply-prompt-config.mjs`
- `supabase/migrations/20260705220000_hai_optimization_log.sql`（**待应用**，应用后 apply 脚本留痕才生效）
- `supabase/functions/_shared/hai_orchestrator/response_evaluator.ts` 精简为安全兜底（去掉 8 维打分 + 日常重写，省 token/延迟）
- `.claude/skills/hai-daily-optimization/SKILL.md`
- cron `c5b80751`：每天 22:13 本地触发（session 内存活时生效，7 天后到期需重建）
