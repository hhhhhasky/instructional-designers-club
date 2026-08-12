begin;

-- Fixed catalog selections no longer use fuzzy textbook retrieval. Remove the
-- old service-role-only search function so no runtime path can accidentally
-- reintroduce score-based matching for built-in textbook routes.
drop function if exists public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer);
drop function if exists public.hai_get_textbook_sections_by_key(text, text, text, text);

commit;
