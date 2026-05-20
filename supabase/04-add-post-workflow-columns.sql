alter table public.posts add column if not exists submitted_at timestamptz;
alter table public.posts add column if not exists approved_at timestamptz;
alter table public.posts add column if not exists revision_requested_at timestamptz;
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
