// Generate an import bundle without publishing or changing the remote database.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const base = new URL('supabase/skill-sources/retrieve-teaching-cases/', root);
const instructions = readFileSync(new URL('SKILL.md', base), 'utf8');
const content = readFileSync(new URL('references/sources.json', base), 'utf8');
const sources = JSON.parse(content);
if (sources.length !== new Set(sources.map(s => s.id)).size) throw new Error('Duplicate source ids');
for (const source of sources) {
  if (new URL(source.url).protocol !== 'https:') throw new Error('Invalid source URL');
}
// These fields are required by the existing Skill import RPC; no new hash or
// publication mechanism is introduced.
const hash = value => createHash('sha256').update(value).digest('hex');
const references = ['sources', 'topics'].map((key, index) => {
  const body = readFileSync(new URL(`references/${key}.json`, base), 'utf8');
  return { path: `references/${key}.json`, name: key === 'sources' ? '分类优先信源' : '教学主题与检索指引', description: '根据已确认的教学重点选择对应主题及来源',
    media_type: 'application/json', content: body, content_hash: hash(body), load_mode: 'always', max_chars: body.length, sort_order: (index + 1) * 10, metadata: {} };
});
const topics = JSON.parse(references[1].content);
if (sources.some(source => !source.categories?.length || source.categories.some(id => !topics.some(topic => topic.id === id)))) throw new Error('Missing topic membership');
const payload = { skill_slug: 'retrieve-teaching-cases', version_label: 'v1.1.0-topics', instructions, references,
  input_contract: { internal_only: true, searches: 2, pages: 3, topic_routing: true }, output_contract: { format: 'teaching_case_evidence' },
  snapshot_hash: hash(JSON.stringify({ instructions, references })), source_metadata: { source_package: 'retrieve-teaching-cases', source_origin: '用户提供清单', source_links_live_verified: false } };
writeFileSync(new URL('supabase/seed-data/case-retrieval-work-skill.json', root), JSON.stringify(payload, null, 2) + '\n');
console.log(`Prepared case retrieval Skill with ${sources.length} sources in ${topics.length} topics; not published.`);
