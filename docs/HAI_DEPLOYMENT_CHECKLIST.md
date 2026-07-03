# HAI Deployment Checklist

## Scope

HAI is integrated into the club website Supabase project. Data is stored in the same database as the club site, isolated by `hai_` table prefixes and HAI-specific Edge Functions.

## Required Supabase Steps

1. Apply `supabase/migrations/20260703090000_hai_workspace.sql`.
2. Deploy these Edge Functions:
   - `hai-access-status`
   - `hai-redeem-invite`
   - `hai-chat`
   - `hai-roundtable-chat`
   - `hai-ingest-material`
3. Configure Supabase secrets:
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL` if the default `https://api.deepseek.com` is not correct.
   - `DEEPSEEK_MODEL` if the default model should be overridden.
4. Confirm the storage bucket `hai-user-materials` exists after migration.
5. Create at least one invite code or grant access in `/admin/manage` -> `HAI 配置`.
6. Publish or update module prompts in `/admin/manage` -> `HAI 配置` before wider rollout.

## Smoke Test

1. Open `/hai` as a logged-in user without HAI access and confirm the invite gate appears.
2. Redeem an invite code.
3. Send one message in single-chat mode.
4. Send one message in roundtable mode.
5. Upload a `.txt`, `.md`, `.docx`, or text-layer `.pdf` material and confirm it becomes `可用`.
6. Add one knowledge entry in the admin HAI panel and ask a related question.
7. Confirm `/admin/manage` shows recent HAI usage events.

## Current Limits

- Material parsing supports text, Markdown, HTML, JSON, CSV, DOCX, and text-layer PDFs. Scanned PDF OCR is not implemented.
- Knowledge and material retrieval currently uses text similarity fallback. Vector embedding columns exist, but embedding backfill is not wired yet.
- Automatic user memory is conservative and only stores explicit teacher facts such as subject/class, student description, direct preferences, and stated constraints.
- `supabase db lint` cannot run in this repo until `supabase/config.toml` has a valid `project_id`.
