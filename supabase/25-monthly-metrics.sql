create table if not exists public.monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  instagram_followers integer,
  instagram_reach integer,
  instagram_impressions integer,
  instagram_link_clicks integer,
  instagram_engagement integer,
  paid_investment numeric(12,2),
  paid_reach integer,
  paid_impressions integer,
  paid_clicks integer,
  paid_leads integer,
  status text not null default 'filling' check (status in ('filling','sent_to_client','reviewed','closed')),
  client_feedback text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, year, month)
);

create index if not exists monthly_metrics_agency_client_month_idx
on public.monthly_metrics(agency_id, client_id, year, month);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'followers')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'instagram_followers') then
    alter table public.monthly_metrics rename column followers to instagram_followers;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'reach')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'instagram_reach') then
    alter table public.monthly_metrics rename column reach to instagram_reach;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'impressions')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'instagram_impressions') then
    alter table public.monthly_metrics rename column impressions to instagram_impressions;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'link_clicks')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'instagram_link_clicks') then
    alter table public.monthly_metrics rename column link_clicks to instagram_link_clicks;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'engagement_total')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'instagram_engagement') then
    alter table public.monthly_metrics rename column engagement_total to instagram_engagement;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'leads')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'paid_leads') then
    alter table public.monthly_metrics rename column leads to paid_leads;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'report_status')
    and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_metrics' and column_name = 'status') then
    alter table public.monthly_metrics rename column report_status to status;
  end if;
end $$;

alter table public.monthly_metrics
  add column if not exists instagram_followers integer,
  add column if not exists instagram_reach integer,
  add column if not exists instagram_impressions integer,
  add column if not exists instagram_link_clicks integer,
  add column if not exists instagram_engagement integer,
  add column if not exists paid_investment numeric(12,2),
  add column if not exists paid_reach integer,
  add column if not exists paid_impressions integer,
  add column if not exists paid_clicks integer,
  add column if not exists paid_leads integer,
  add column if not exists status text not null default 'filling',
  add column if not exists client_feedback text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_metrics_status_check'
      and conrelid = 'public.monthly_metrics'::regclass
  ) then
    alter table public.monthly_metrics
      add constraint monthly_metrics_status_check
      check (status in ('filling','sent_to_client','reviewed','closed'));
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'activity_history_item_type_check' and conrelid = 'public.activity_history'::regclass) then
    alter table public.activity_history drop constraint activity_history_item_type_check;
  end if;
  alter table public.activity_history
    add constraint activity_history_item_type_check
    check (item_type in ('post','campaign','monthly_goal','monthly_metric'));

  if exists (select 1 from pg_constraint where conname = 'notifications_item_type_check' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications drop constraint notifications_item_type_check;
  end if;
  alter table public.notifications
    add constraint notifications_item_type_check
    check (item_type in ('post','campaign','monthly_goal','monthly_metric','billing','referral'));
end $$;

alter table public.monthly_metrics enable row level security;

drop policy if exists "monthly metrics read scoped" on public.monthly_metrics;
create policy "monthly metrics read scoped"
on public.monthly_metrics for select
using (public.can_access_client(client_id));

drop policy if exists "monthly metrics agency insert" on public.monthly_metrics;
create policy "monthly metrics agency insert"
on public.monthly_metrics for insert
with check (
  public.can_manage_agency(agency_id)
  and exists (
    select 1
    from public.clients c
    where c.id = monthly_metrics.client_id
      and c.agency_id = monthly_metrics.agency_id
  )
);

drop policy if exists "monthly metrics agency update" on public.monthly_metrics;
create policy "monthly metrics agency update"
on public.monthly_metrics for update
using (public.can_manage_agency(agency_id))
with check (
  public.can_manage_agency(agency_id)
  and exists (
    select 1
    from public.clients c
    where c.id = monthly_metrics.client_id
      and c.agency_id = monthly_metrics.agency_id
  )
);

drop policy if exists "monthly metrics agency delete" on public.monthly_metrics;
create policy "monthly metrics agency delete"
on public.monthly_metrics for delete
using (public.can_manage_agency(agency_id));

drop policy if exists "monthly metrics client feedback update" on public.monthly_metrics;

create or replace function public.save_monthly_metric_feedback(
  metric_id_input uuid,
  feedback_input text
)
returns public.monthly_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
  target_metric public.monthly_metrics;
begin
  select * into target_metric
  from public.monthly_metrics
  where id = metric_id_input;

  if target_metric.id is null then
    raise exception 'Relatório de métricas nao encontrado.';
  end if;

  if not public.can_access_client(target_metric.client_id) then
    raise exception 'Sem permissao para enviar feedback deste relatório.';
  end if;

  update public.monthly_metrics
  set client_feedback = feedback_input,
      updated_at = now()
  where id = metric_id_input
  returning * into target_metric;

  return target_metric;
end;
$$;

notify pgrst, 'reload schema';
