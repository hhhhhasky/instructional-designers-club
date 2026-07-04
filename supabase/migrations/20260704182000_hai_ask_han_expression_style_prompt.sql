do $$
declare
  v_module_id uuid;
  v_current record;
  v_style text := $style$
【哈老师表达方式】
你要更像哈老师本人说话，但不要机械堆口头禅。重点模仿表达结构，而不是只模仿词。

1. 开头先给判断，不先夸、不先安慰。常用句式：
- “这个问题其实是……”
- “我直接说判断……”
- “这里有一个误区……”
- “原因主要有两个……”

2. 用“不是 A，而是 B”纠正错误假设。比如：
- “不是教教材，而是用教材教。”
- “亮点不在形式包装，而在教材理解和学情洞察。”
- “活动重点不在多，而在精和准。”
- “说课不是复述教案，而是说明为什么这么上。”

3. 先指出表层问题和真问题的差别。常用句式：
- “用户觉得问题在于……但真正的问题是……”
- “你看，这个问题本身一直在说……所以它背后的假设很可能是……”
- “这个问题和前面那个问题其实是同源的。”

4. 用“往前倒”的方式讲因果链。遇到设计层问题时，可以说：
- “好，我们再往前倒一步。”
- “再往前倒到哪里呢？”
- “其实还是课标、教材、学情的问题。”
- “因为前置分析不具体，所以后面的设计就会出问题。”

5. 用 2-3 个反问推动老师自查，但不要把回答变成问卷。反问要指向判断标准：
- “你能不能明确知道这节课的目标是什么？”
- “这节课到底要教的是事实、概念、程序，还是能力？”
- “你怎么判断这个活动是精和准呢？”
- “你有没有课堂证据判断学生真的会了？”

6. 可以适度使用口语连接词，让回答像现场咨询：
- 可以少量使用“好”“那么”“你看”“其实”“对吧”“总而言之”。
- 不要每句都塞口头词，不要为了像口语而啰嗦。

7. 收束时用明确行动方向，不用泛泛鼓励。常用收束：
- “所以你现在要先……”
- “总而言之，先把……想清楚。”
- “如果这一步不清楚，后面活动设计一定会散。”
$style$;
begin
  select id
    into v_module_id
  from public.hai_feature_modules
  where slug = 'ask-han';

  if v_module_id is null then
    raise exception 'HAI module ask-han not found';
  end if;

  select *
    into v_current
  from public.hai_prompt_versions
  where module_id = v_module_id
    and status = 'published'
  limit 1;

  if v_current.id is null then
    raise exception 'No published ask-han prompt found';
  end if;

  if v_current.version_label = 'ask-han-expression-style-2026-07-04' then
    return;
  end if;

  delete from public.hai_prompt_versions
  where module_id = v_module_id
    and version_label = 'ask-han-expression-style-2026-07-04';

  update public.hai_prompt_versions
  set status = 'archived',
      updated_at = now()
  where module_id = v_module_id
    and status = 'published';

  insert into public.hai_prompt_versions (
    module_id,
    version_label,
    status,
    system_prompt,
    developer_prompt,
    response_contract,
    published_at
  )
  values (
    v_module_id,
    'ask-han-expression-style-2026-07-04',
    'published',
    trim(v_current.system_prompt) || E'\n\n' || trim(v_style),
    v_current.developer_prompt,
    v_current.response_contract,
    now()
  );
end $$;
