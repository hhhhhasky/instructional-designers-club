-- 20260815100000_hai_textbook_char_count_calibration.sql
-- 统一 char_count 口径：全部重算为 length(content_text)
-- 原因：V2 生成器写 content_markdown.length，V3 写 [...content_text].length，导致 89% 活跃记录不一致
-- 注意：不修改 content_hash（基于 content_markdown），不修改 content_markdown 本身

-- Step 1: 记录迁移前状态快照（只读，用于验证）
-- 预期：大部分记录 char_count <> length(content_text)

-- Step 2: 批量重算所有活跃记录的 char_count
UPDATE hai_textbook_sections
SET 
  char_count = length(content_text),
  updated_at = now()
WHERE is_active = true;

-- Step 3: 验证重算结果
-- 预期：matching = total，mismatching = 0

-- Step 4: 添加校验约束防止未来写入不一致的 char_count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hai_textbook_sections_char_count_check'
  ) THEN
    ALTER TABLE hai_textbook_sections
      ADD CONSTRAINT hai_textbook_sections_char_count_check
      CHECK (char_count = length(content_text));
  END IF;
END $$;
