alter table public.agencies
add column if not exists workspace_settings jsonb;
