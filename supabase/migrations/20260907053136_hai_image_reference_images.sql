begin;

alter table public.hai_image_generation_runs
  add column if not exists reference_images jsonb not null default '[]'::jsonb;

comment on column public.hai_image_generation_runs.reference_images is '本轮上传到 Cloudflare R2 并传给生图服务的参考图片元数据与 URL';

commit;
