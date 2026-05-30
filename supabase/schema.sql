create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('agency', 'member', 'client');
exception when duplicate_object then null; end $$;

alter type public.user_role add value if not exists 'member';

do $$ begin
  create type public.content_status as enum (
    'draft',
    'creating',
    'awaiting_approval',
    'approved',
    'revision_requested',
    'scheduled',
    'published'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_stage as enum (
    'needs_recording',
    'needs_design',
    'needs_caption',
    'waiting_client',
    'revision',
    'approved',
    'published'
  );
exception when duplicate_object then null; end $$;

alter type public.pipeline_stage add value if not exists 'revision';
alter type public.pipeline_stage add value if not exists 'scheduled';

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  billing_document text,
  workspace_settings jsonb,
  created_at timestamptz not null default now()
);

alter table public.agencies add column if not exists billing_document text;
alter table public.agencies add column if not exists workspace_settings jsonb;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  instagram_handle text,
  phone text,
  avatar text,
  brand_color text default '#170b43',
  invite_code text unique,
  created_at timestamptz not null default now()
);

alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists invite_code text;
create unique index if not exists clients_invite_code_key on public.clients(invite_code) where invite_code is not null;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'agency',
  avatar text,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  caption text,
  instructions text,
  status public.content_status not null default 'draft',
  pipeline_stage public.pipeline_stage not null default 'needs_design',
  content_format text default 'static' check (content_format in ('static', 'carousel', 'video')),
  scheduled_date date not null,
  scheduled_time time,
  feed_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  revision_requested_at timestamptz,
  scheduled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists submitted_at timestamptz;
alter table public.posts add column if not exists approved_at timestamptz;
alter table public.posts add column if not exists revision_requested_at timestamptz;
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists updated_at timestamptz not null default now();
alter table public.posts add column if not exists content_format text default 'static' check (content_format in ('static', 'carousel', 'video'));

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  thumbnail_url text,
  order_index integer not null default 0
);

alter table public.post_media add column if not exists thumbnail_url text;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  name text not null,
  email text not null,
  role_title text not null,
  avatar text,
  access_code text not null unique,
  status text not null default 'invited' check (status in ('active','invited','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_agency_id_idx on public.clients(agency_id);
create index if not exists users_agency_id_idx on public.users(agency_id);
create index if not exists users_client_id_idx on public.users(client_id);
create index if not exists posts_client_id_date_idx on public.posts(client_id, scheduled_date);
create index if not exists post_media_post_id_idx on public.post_media(post_id);
create index if not exists comments_post_id_created_at_idx on public.comments(post_id, created_at);
create index if not exists team_members_agency_id_idx on public.team_members(agency_id);
create unique index if not exists team_members_access_code_idx on public.team_members(access_code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  agency_row public.agencies;
begin
  requested_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'agency');

  if requested_role = 'agency' then
    insert into public.agencies (name, owner_id, billing_document)
    values (
      coalesce(new.raw_user_meta_data ->> 'agency_name', new.raw_user_meta_data ->> 'name', 'Minha agência'),
      new.id,
      nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'billing_document', ''), '\D', '', 'g'), '')
    )
    returning * into agency_row;

    insert into public.users (id, name, email, role, agency_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      'agency',
      agency_row.id
    );
  elsif requested_role = 'member' then
    insert into public.users (id, name, email, role, agency_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      'member',
      (new.raw_user_meta_data ->> 'agency_id')::uuid
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      agency_id = excluded.agency_id,
      client_id = null;

    update public.team_members
    set user_id = new.id, status = 'active', updated_at = now()
    where id = (new.raw_user_meta_data ->> 'team_member_id')::uuid;
  else
    insert into public.users (id, name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      'client'
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      agency_id = (new.raw_user_meta_data ->> 'agency_id')::uuid,
      client_id = (new.raw_user_meta_data ->> 'client_id')::uuid;

    update public.users
    set
      agency_id = (new.raw_user_meta_data ->> 'agency_id')::uuid,
      client_id = (new.raw_user_meta_data ->> 'client_id')::uuid
    where id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.get_client_invite(invite_code_input text, email_input text)
returns table (
  id uuid,
  name text,
  avatar text,
  agency_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.avatar, c.agency_id
  from public.clients c
  where regexp_replace(upper(coalesce(c.invite_code, '')), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(coalesce(invite_code_input, '')), '[^A-Z0-9]', '', 'g')
  limit 1;
$$;

grant execute on function public.get_client_invite(text, text) to anon, authenticated;

create or replace function public.get_member_invite(access_code_input text, email_input text)
returns table (
  id uuid,
  name text,
  avatar text,
  agency_id uuid,
  role_title text
)
language sql
security definer
set search_path = public
stable
as $$
  select tm.id, tm.name, tm.avatar, tm.agency_id, tm.role_title
  from public.team_members tm
  where regexp_replace(upper(tm.access_code), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(access_code_input), '[^A-Z0-9]', '', 'g')
    and lower(trim(tm.email)) = lower(trim(email_input))
    and tm.status <> 'inactive'
  limit 1;
$$;

grant execute on function public.get_member_invite(text, text) to anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.agencies enable row level security;
alter table public.clients enable row level security;
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.team_members enable row level security;

create or replace function public.current_profile()
returns public.users
language sql
security definer
set search_path = public
stable
as $$
  select * from public.users where id = auth.uid();
$$;

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('agency', 'member')
      and u.agency_id = target_agency_id
  );
$$;

create or replace function public.is_agency_admin(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'agency'
      and u.agency_id = target_agency_id
  );
$$;

create or replace function public.can_manage_agency(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('agency', 'member')
      and u.agency_id = target_agency_id
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = target_agency_id
      and a.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    join public.clients c on c.id = target_client_id
    where u.id = auth.uid()
      and (
        (u.role in ('agency', 'member') and u.agency_id = c.agency_id)
        or
        (u.role = 'client' and u.client_id = c.id)
      )
  );
$$;

drop policy if exists "users read own agency/client scope" on public.users;
create policy "users read own agency/client scope"
on public.users for select
using (
  id = auth.uid()
  or agency_id = (public.current_profile()).agency_id
  or client_id = (public.current_profile()).client_id
);

drop policy if exists "users update self" on public.users;
create policy "users update self"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "agencies read own" on public.agencies;
create policy "agencies read own"
on public.agencies for select
using (
  owner_id = auth.uid()
  or public.is_agency_member(id)
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'client'
      and u.agency_id = agencies.id
  )
);

drop policy if exists "agencies insert owner" on public.agencies;
create policy "agencies insert owner"
on public.agencies for insert
with check (owner_id = auth.uid());

drop policy if exists "agencies update owner" on public.agencies;
create policy "agencies update owner"
on public.agencies for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "clients read scoped" on public.clients;
create policy "clients read scoped"
on public.clients for select
using (public.can_access_client(id));

drop policy if exists "clients agency write" on public.clients;
create policy "clients agency write"
on public.clients for all
using (public.is_agency_admin(agency_id))
with check (public.is_agency_admin(agency_id));

drop policy if exists "posts read scoped" on public.posts;
create policy "posts read scoped"
on public.posts for select
using (public.can_access_client(client_id));

drop policy if exists "posts agency write" on public.posts;
create policy "posts agency write"
on public.posts for all
using (
  exists (
    select 1 from public.clients c
    where c.id = posts.client_id and public.is_agency_member(c.agency_id)
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = posts.client_id and public.is_agency_member(c.agency_id)
  )
);

drop policy if exists "posts client approval update" on public.posts;
create policy "posts client approval update"
on public.posts for update
using (public.can_access_client(client_id))
with check (public.can_access_client(client_id));

create or replace function public.enforce_client_post_approval_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.users;
begin
  select * into actor from public.users where id = auth.uid();

  if actor.role = 'client' then
    if new.client_id is distinct from old.client_id
      or new.title is distinct from old.title
      or new.caption is distinct from old.caption
      or new.instructions is distinct from old.instructions
      or new.scheduled_date is distinct from old.scheduled_date
      or new.scheduled_time is distinct from old.scheduled_time
      or new.feed_order is distinct from old.feed_order
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Clientes só podem aprovar ou solicitar revisão de conteúdos.';
    end if;

    if not (
      (new.status = 'approved' and new.pipeline_stage = 'approved')
      or
      (new.status = 'revision_requested' and new.pipeline_stage = 'revision')
    ) then
      raise exception 'Ação de aprovação do cliente inválida.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_client_post_approval_update on public.posts;
create trigger enforce_client_post_approval_update
  before update on public.posts
  for each row execute function public.enforce_client_post_approval_update();

drop policy if exists "media read scoped" on public.post_media;
create policy "media read scoped"
on public.post_media for select
using (
  exists (
    select 1 from public.posts p
    where p.id = post_media.post_id and public.can_access_client(p.client_id)
  )
);

drop policy if exists "media agency write" on public.post_media;
create policy "media agency write"
on public.post_media for all
using (
  exists (
    select 1 from public.posts p
    join public.clients c on c.id = p.client_id
    where p.id = post_media.post_id and public.is_agency_member(c.agency_id)
  )
)
with check (
  exists (
    select 1 from public.posts p
    join public.clients c on c.id = p.client_id
    where p.id = post_media.post_id and public.is_agency_member(c.agency_id)
  )
);

drop policy if exists "comments read scoped" on public.comments;
create policy "comments read scoped"
on public.comments for select
using (
  exists (
    select 1 from public.posts p
    where p.id = comments.post_id and public.can_access_client(p.client_id)
  )
);

drop policy if exists "comments insert scoped" on public.comments;
create policy "comments insert scoped"
on public.comments for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = comments.post_id and public.can_access_client(p.client_id)
  )
);

drop policy if exists "comments delete own scoped" on public.comments;
create policy "comments delete own scoped"
on public.comments for delete
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = comments.post_id and public.can_access_client(p.client_id)
  )
);

drop policy if exists "team members read agency" on public.team_members;
create policy "team members read agency"
on public.team_members for select
using (public.is_agency_member(agency_id));

drop policy if exists "team members agency write" on public.team_members;
create policy "team members agency write"
on public.team_members for all
using (public.is_agency_admin(agency_id))
with check (public.is_agency_admin(agency_id));

drop policy if exists "team members update self" on public.team_members;
create policy "team members update self"
on public.team_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  262144000,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post media public read" on storage.objects;
create policy "post media public read"
on storage.objects for select
using (bucket_id = 'post-media');

drop policy if exists "agency upload post media" on storage.objects;
create policy "agency upload post media"
on storage.objects for insert
with check (
  bucket_id = 'post-media'
  and auth.role() = 'authenticated'
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  objective text,
  platform text not null default 'Meta Ads',
  audience text,
  daily_budget numeric(12,2),
  total_budget numeric(12,2),
  start_date date not null,
  end_date date,
  status text not null default 'creating' check (status in ('creating','awaiting_approval','approved','active','paused','finished','revision_requested')),
  responsible_user_id uuid references public.users(id) on delete set null,
  responsible_name text,
  copy text,
  internal_notes text,
  client_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_media (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image','video')),
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  title text not null,
  description text,
  planned_actions text,
  responsible_user_id uuid references public.users(id) on delete set null,
  responsible_name text,
  status text not null default 'planned' check (status in ('planned','in_progress','done','paused','cancelled')),
  client_feedback text,
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  item_type text not null check (item_type in ('post','campaign','monthly_goal')),
  item_id uuid not null,
  action text not null,
  user_id uuid references public.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete cascade,
  item_type text not null check (item_type in ('post','campaign','monthly_goal','billing','referral')),
  item_id uuid,
  title text not null,
  detail text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_agency_client_start_idx on public.campaigns(agency_id, client_id, start_date);
create index if not exists campaign_media_campaign_id_idx on public.campaign_media(campaign_id);
create index if not exists monthly_goals_agency_client_month_idx on public.monthly_goals(agency_id, client_id, year, month);
create index if not exists activity_history_item_idx on public.activity_history(item_type, item_id, created_at desc);
create index if not exists activity_history_client_idx on public.activity_history(client_id, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_item_idx on public.notifications(item_type, item_id, created_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_media enable row level security;
alter table public.monthly_goals enable row level security;
alter table public.activity_history enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "campaigns read scoped" on public.campaigns;
create policy "campaigns read scoped" on public.campaigns for select using (public.can_access_client(client_id));

drop policy if exists "campaigns agency write" on public.campaigns;
create policy "campaigns agency write" on public.campaigns for all using (public.can_manage_agency(agency_id)) with check (
  public.can_manage_agency(agency_id)
  and exists (select 1 from public.clients c where c.id = campaigns.client_id and c.agency_id = campaigns.agency_id)
);

drop policy if exists "campaigns client approval update" on public.campaigns;
create policy "campaigns client approval update" on public.campaigns for update using (public.can_access_client(client_id)) with check (public.can_access_client(client_id));

drop policy if exists "campaign media read scoped" on public.campaign_media;
create policy "campaign media read scoped" on public.campaign_media for select using (
  exists (select 1 from public.campaigns c where c.id = campaign_media.campaign_id and public.can_access_client(c.client_id))
);

drop policy if exists "campaign media agency write" on public.campaign_media;
create policy "campaign media agency write" on public.campaign_media for all using (
  exists (select 1 from public.campaigns c where c.id = campaign_media.campaign_id and public.is_agency_member(c.agency_id))
) with check (
  exists (select 1 from public.campaigns c where c.id = campaign_media.campaign_id and public.is_agency_member(c.agency_id))
);

drop policy if exists "monthly goals read scoped" on public.monthly_goals;
create policy "monthly goals read scoped" on public.monthly_goals for select using (public.can_access_client(client_id));

drop policy if exists "monthly goals agency write" on public.monthly_goals;
drop policy if exists "monthly goals agency insert" on public.monthly_goals;
drop policy if exists "monthly goals agency update" on public.monthly_goals;
drop policy if exists "monthly goals agency delete" on public.monthly_goals;

create policy "monthly goals agency insert" on public.monthly_goals for insert with check (
  public.can_manage_agency(agency_id)
  and exists (select 1 from public.clients c where c.id = monthly_goals.client_id and c.agency_id = monthly_goals.agency_id)
);

create policy "monthly goals agency update" on public.monthly_goals for update using (public.can_manage_agency(agency_id)) with check (
  public.can_manage_agency(agency_id)
  and exists (select 1 from public.clients c where c.id = monthly_goals.client_id and c.agency_id = monthly_goals.agency_id)
);

create policy "monthly goals agency delete" on public.monthly_goals for delete using (public.can_manage_agency(agency_id));

drop policy if exists "monthly goals client feedback update" on public.monthly_goals;
create policy "monthly goals client feedback update" on public.monthly_goals for update using (public.can_access_client(client_id)) with check (public.can_access_client(client_id));

drop policy if exists "activity history read scoped" on public.activity_history;
create policy "activity history read scoped" on public.activity_history for select using (
  public.is_agency_member(agency_id) or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "activity history insert scoped" on public.activity_history;
create policy "activity history insert scoped" on public.activity_history for insert with check (
  public.can_manage_agency(agency_id) or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications read scoped" on public.notifications;
create policy "notifications read scoped" on public.notifications for select using (
  recipient_user_id = auth.uid() or public.is_agency_member(agency_id) or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications insert scoped" on public.notifications;
create policy "notifications insert scoped" on public.notifications for insert with check (
  public.can_manage_agency(agency_id) or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications update own read" on public.notifications;
create policy "notifications update own read" on public.notifications for update using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create or replace function public.can_manage_agency(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.agencies a
    where a.id = target_agency_id
      and a.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.agency_id = target_agency_id
      and u.role in ('agency', 'member')
  );
$$;

create or replace function public.save_monthly_goal(
  goal_id_input uuid default null,
  agency_id_input uuid default null,
  client_id_input uuid default null,
  month_input integer default null,
  year_input integer default null,
  title_input text default null,
  description_input text default null,
  planned_actions_input text default null,
  responsible_user_id_input uuid default null,
  responsible_name_input text default null,
  status_input text default 'planned',
  client_feedback_input text default null,
  result_notes_input text default null
)
returns public.monthly_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal public.monthly_goals;
  target_agency_id uuid;
begin
  if goal_id_input is not null then
    select * into target_goal
    from public.monthly_goals
    where id = goal_id_input;

    if target_goal.id is null then
      raise exception 'Objetivo nao encontrado.';
    end if;

    target_agency_id := target_goal.agency_id;
  else
    target_agency_id := agency_id_input;
  end if;

  if target_agency_id is null or not public.can_manage_agency(target_agency_id) then
    raise exception 'Sem permissao para salvar objetivo.';
  end if;

  if client_id_input is null or not exists (
    select 1
    from public.clients c
    where c.id = client_id_input
      and c.agency_id = target_agency_id
  ) then
    raise exception 'Cliente invalido para esta agencia.';
  end if;

  if goal_id_input is null then
    insert into public.monthly_goals (
      agency_id,
      client_id,
      month,
      year,
      title,
      description,
      planned_actions,
      responsible_user_id,
      responsible_name,
      status,
      client_feedback,
      result_notes,
      created_at,
      updated_at
    )
    values (
      target_agency_id,
      client_id_input,
      month_input,
      year_input,
      title_input,
      description_input,
      planned_actions_input,
      responsible_user_id_input,
      responsible_name_input,
      status_input,
      client_feedback_input,
      result_notes_input,
      now(),
      now()
    )
    returning * into target_goal;
  else
    update public.monthly_goals
    set
      client_id = client_id_input,
      month = month_input,
      year = year_input,
      title = title_input,
      description = description_input,
      planned_actions = planned_actions_input,
      responsible_user_id = responsible_user_id_input,
      responsible_name = responsible_name_input,
      status = status_input,
      client_feedback = client_feedback_input,
      result_notes = result_notes_input,
      updated_at = now()
    where id = goal_id_input
    returning * into target_goal;
  end if;

  return target_goal;
end;
$$;

grant execute on function public.save_monthly_goal(
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.delete_monthly_goal(goal_id_input uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal public.monthly_goals;
begin
  select * into target_goal
  from public.monthly_goals
  where id = goal_id_input;

  if target_goal.id is null then
    raise exception 'Objetivo nao encontrado.';
  end if;

  if not public.can_manage_agency(target_goal.agency_id) then
    raise exception 'Sem permissao para excluir objetivo.';
  end if;

  delete from public.monthly_goals
  where id = goal_id_input;

  return true;
end;
$$;

grant execute on function public.delete_monthly_goal(uuid) to authenticated;

create or replace function public.reorder_feed_posts(post_ids_input uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client_id uuid;
  target_agency_id uuid;
begin
  if post_ids_input is null or array_length(post_ids_input, 1) is null then
    return true;
  end if;

  select p.client_id, c.agency_id
  into target_client_id, target_agency_id
  from public.posts p
  join public.clients c on c.id = p.client_id
  where p.id = post_ids_input[1];

  if target_client_id is null or target_agency_id is null then
    raise exception 'Conteudo nao encontrado.';
  end if;

  if not public.can_manage_agency(target_agency_id) then
    raise exception 'Sem permissao para organizar este preview.';
  end if;

  if exists (
    select 1
    from public.posts p
    where p.id = any(post_ids_input)
      and p.client_id <> target_client_id
  ) then
    raise exception 'A ordem precisa ser salva por cliente.';
  end if;

  update public.posts p
  set
    feed_order = ordered.order_index - 1,
    updated_at = now()
  from unnest(post_ids_input) with ordinality as ordered(id, order_index)
  where p.id = ordered.id;

  return true;
end;
$$;

grant execute on function public.reorder_feed_posts(uuid[]) to authenticated;
