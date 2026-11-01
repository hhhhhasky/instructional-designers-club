-- Apply only after every active Edge Function caller uses the trusted entry
-- point and existing in-flight requests from older deployments have drained.
-- SECURITY DEFINER background completion functions retain owner access.
revoke execute on function public.hai_finalize_usage(text,text,integer,integer,text,text,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.hai_finalize_usage(text,text,integer,integer,text,text,uuid,integer,jsonb) to service_role;
