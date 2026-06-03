alter table public.users
  add column if not exists profile_banner text,
  add column if not exists profile_description text,
  add column if not exists profile_banner_position numeric default 50;

notify pgrst, 'reload schema';
