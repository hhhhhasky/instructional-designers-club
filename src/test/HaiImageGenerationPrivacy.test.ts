import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260918065440_course_type_and_image_task_privacy.sql'),
  'utf8',
);

describe('HAI image generation privacy migration', () => {
  it('limits both recent tasks and runs to the signed-in owner', () => {
    const taskPolicy = migration.match(/create policy "hai image tasks owner read"[\s\S]*?;/)?.[0] ?? '';
    const runPolicy = migration.match(/create policy "hai image runs owner read"[\s\S]*?;/)?.[0] ?? '';

    expect(taskPolicy).toContain('user_id = (select auth.uid())');
    expect(runPolicy).toContain('user_id = (select auth.uid())');
    expect(taskPolicy).not.toContain('is_admin');
    expect(runPolicy).not.toContain('is_admin');
  });
});
