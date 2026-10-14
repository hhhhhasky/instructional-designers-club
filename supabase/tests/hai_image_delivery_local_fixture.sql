-- Minimal local database dependencies for exercising the production migrations.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.hai_image_generation_tasks(id uuid primary key,user_id uuid,title text,updated_at timestamptz default now());
create table public.hai_image_generation_runs(
 id uuid primary key default gen_random_uuid(),task_id uuid,user_id uuid,client_request_id text unique,status text default 'running',
 prompt text,composed_prompt text,image_size text,art_style text,image_type text,provider_task_id text,source_url text,r2_key text,image_url text,error_message text,
 metadata jsonb default '{}'::jsonb,provider_response jsonb default '{}'::jsonb,duration_ms integer,started_at timestamptz default now(),created_at timestamptz default now(),completed_at timestamptz
);
create table public.hai_request_reservations(id bigserial primary key,request_id text unique,user_id uuid,route text,status text default 'active',metadata jsonb default '{}'::jsonb,actual_input_tokens integer,actual_output_tokens integer,completed_at timestamptz,expires_at timestamptz default now()+interval '5 minutes');
create table public.hai_point_wallets(user_id uuid primary key,balance_tokens bigint,total_consumed_tokens bigint default 0);
create table public.hai_point_transactions(id bigserial primary key,user_id uuid,transaction_type text,token_delta bigint,points_delta numeric,tokens_per_point integer,request_id text unique,reason text,metadata jsonb);
create table public.hai_usage_events(id bigserial primary key,user_id uuid,request_id text,event_type text,route text,status text,entity_type text,entity_id uuid,input_tokens integer,output_tokens integer,total_tokens integer,duration_ms integer,metadata jsonb);
create function public.hai_runtime_numeric(text,numeric) returns numeric language sql as $$ select $2 $$;
create function public.hai_ensure_points_wallet(uuid) returns public.hai_point_wallets language sql as $$ select * from public.hai_point_wallets where user_id=$1 $$;
