-- 把 segment-optimization 的提示词从旧的「只输出 JSON」改为 Markdown 直出。
--
-- 背景：代码层（a800abe 提交）已把 HAI Work 改成 Markdown 直出——hai-work/index.ts 把模型输出
-- 直接当 Markdown 存，不再走 parseWorkJson/validateWorkOutput。但 DB 种子（20260721150000）里
-- segment-optimization-general 的 prompt 仍要求「只输出合法 JSON」，与代码层矛盾。
--
-- 约束：published/archived 版本的 prompt_template 等快照字段不可 UPDATE（触发器
-- hai_protect_work_skill_version_snapshot 保护，见 20260723090000）。因此采用版本化方式：
-- 归档当前 published 版本 + 新建一个 Markdown 直出的 published 版本（version_label=markdown-v2）。
--
-- 设计分工：本 prompt 只负责角色、工作步骤与边界；输出格式（Markdown 章节结构、「直接输出
-- Markdown、不要输出 JSON」）由代码层 hai_work.ts 的 MARKDOWN_DIRECTIVE 统一注入；
-- 环节专属方法论由代码层按 input.segment_type 注入（SEGMENT_METHODOLOGY）。
-- 幂等：可重复执行（语句 1 排除 markdown-v2；语句 2 on conflict do nothing）。

-- 1. 归档当前 published 版本（status 不在快照保护字段内，可改；排除即将新建的 markdown-v2）
update public.hai_work_skill_versions
set status = 'archived'
where skill_id = (
        select id from public.hai_work_skills
        where slug = 'segment-optimization-general'
        limit 1
      )
  and status = 'published'
  and version_label <> 'markdown-v2';

-- 2. 新建 Markdown 直出的 published 版本
insert into public.hai_work_skill_versions
  (skill_id, version_label, status, prompt_template, default_prompt_template, input_contract, output_contract, published_at)
select
  s.id,
  'markdown-v2',
  'published',
  np.p,
  np.p,
  '{}'::jsonb,
  '{"format":"markdown"}'::jsonb,
  now()
from (select id from public.hai_work_skills where slug = 'segment-optimization-general' limit 1) s
cross join (
  select $prompt$
你是一名教学环节优化编辑。你的任务是把用户给出的「单个教学环节」改得真正服务于学习，而不是热闹。

工作步骤：
1. 先诊断：对照「教学目标—学生行动—学习证据」三者，找到这个环节里最早、最关键的结构断点（例如活动不指向目标、学生没有真实思考、缺少学习证据、时间错配、提问碎片化等）。断点要具体到环节原文，不要笼统说"不够好"。
2. 再改写：给出一个可以直接替换使用的优化版本——保留原环节的意图与现实约束（课时、人数、资源），只重构它的内部结构与师生活动。
3. 给出理由与提醒：说明为什么这样改、改前后的关键差异，以及使用时需要注意或可能踩坑的地方。

边界：
- 不要为了"热闹"堆活动；任何活动都必须服务目标并产生可观察的学习证据。
- 未知教材事实不得补写；教材内容以用户提供的原文为准，缺失时明确标注。
- 优化版本要落地到一线课堂可执行，避免空泛口号。
- 输出格式（Markdown 章节结构与「直接输出 Markdown、不要输出 JSON」的要求）由系统指令统一规定，按该格式输出即可，不要自行改成 JSON 或其他格式。
$prompt$ as p
) np
on conflict (skill_id, version_label) do nothing;
