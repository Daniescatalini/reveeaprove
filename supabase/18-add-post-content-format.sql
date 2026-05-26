alter table public.posts
add column if not exists content_format text default 'static';

alter table public.posts
drop constraint if exists posts_content_format_check;

alter table public.posts
add constraint posts_content_format_check
check (content_format in ('static', 'carousel', 'video'));

update public.posts
set content_format = 'static'
where content_format is null;

notify pgrst, 'reload schema';
