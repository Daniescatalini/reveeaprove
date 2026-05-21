alter table public.posts
add column if not exists content_format text default 'static'
check (content_format in ('static', 'carousel', 'video'));

alter table public.post_media
add column if not exists thumbnail_url text;

update public.posts p
set content_format = case
  when exists (
    select 1 from public.post_media pm
    where pm.post_id = p.id and pm.media_type = 'video'
  ) then 'video'
  when (
    select count(*) from public.post_media pm
    where pm.post_id = p.id
  ) > 1 then 'carousel'
  else 'static'
end
where p.content_format is null;
