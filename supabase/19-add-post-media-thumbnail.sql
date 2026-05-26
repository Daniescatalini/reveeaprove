alter table public.post_media
add column if not exists thumbnail_url text;

notify pgrst, 'reload schema';
