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
create policy "campaigns read scoped"
on public.campaigns for select
using (public.can_access_client(client_id));

drop policy if exists "campaigns agency write" on public.campaigns;
create policy "campaigns agency write"
on public.campaigns for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "campaigns client approval update" on public.campaigns;
create policy "campaigns client approval update"
on public.campaigns for update
using (public.can_access_client(client_id))
with check (public.can_access_client(client_id));

drop policy if exists "campaign media read scoped" on public.campaign_media;
create policy "campaign media read scoped"
on public.campaign_media for select
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_media.campaign_id
      and public.can_access_client(c.client_id)
  )
);

drop policy if exists "campaign media agency write" on public.campaign_media;
create policy "campaign media agency write"
on public.campaign_media for all
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_media.campaign_id
      and public.is_agency_member(c.agency_id)
  )
)
with check (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_media.campaign_id
      and public.is_agency_member(c.agency_id)
  )
);

drop policy if exists "monthly goals read scoped" on public.monthly_goals;
create policy "monthly goals read scoped"
on public.monthly_goals for select
using (public.can_access_client(client_id));

drop policy if exists "monthly goals agency write" on public.monthly_goals;
create policy "monthly goals agency write"
on public.monthly_goals for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "monthly goals client feedback update" on public.monthly_goals;
create policy "monthly goals client feedback update"
on public.monthly_goals for update
using (public.can_access_client(client_id))
with check (public.can_access_client(client_id));

drop policy if exists "activity history read scoped" on public.activity_history;
create policy "activity history read scoped"
on public.activity_history for select
using (
  public.is_agency_member(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "activity history insert scoped" on public.activity_history;
create policy "activity history insert scoped"
on public.activity_history for insert
with check (
  public.is_agency_member(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications read scoped" on public.notifications;
create policy "notifications read scoped"
on public.notifications for select
using (
  recipient_user_id = auth.uid()
  or public.is_agency_member(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications insert scoped" on public.notifications;
create policy "notifications insert scoped"
on public.notifications for insert
with check (
  public.is_agency_member(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications update own read" on public.notifications;
create policy "notifications update own read"
on public.notifications for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
