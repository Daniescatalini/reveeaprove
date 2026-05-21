do $$
begin
  alter table if exists public.subscriptions drop constraint if exists subscriptions_plan_check;
  alter table if exists public.referrals drop constraint if exists referrals_status_check;
exception when undefined_table then
  null;
end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan text not null default 'studio' check (plan in ('start', 'studio', 'premium')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'exempt')),
  asaas_customer_id text,
  asaas_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  past_due_since timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  trial_ends_at timestamptz,
  payment_method text,
  next_invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id)
);

create table if not exists public.billing_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  asaas_payment_id text unique,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  payment_method text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete set null,
  event_type text not null,
  description text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exempt_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  email text,
  reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  referral_code text not null,
  referred_agency_id uuid references public.agencies(id) on delete set null,
  referred_email text,
  discount_percent numeric(5,2) not null default 10,
  reward_amount numeric(10,2) not null default 3,
  status text not null default 'pending' check (status in ('pending', 'active', 'converted', 'credited', 'cancelled')),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  unique (referral_code),
  unique (agency_id, referred_agency_id)
);

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('start', 'studio', 'premium'));
alter table public.referrals add column if not exists referred_email text;
alter table public.referrals add column if not exists reward_amount numeric(10,2) not null default 3;
alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals add constraint referrals_status_check check (status in ('pending', 'active', 'converted', 'credited', 'cancelled'));

create index if not exists subscriptions_agency_id_idx on public.subscriptions(agency_id);
create index if not exists subscriptions_asaas_subscription_id_idx on public.subscriptions(asaas_subscription_id);
create index if not exists billing_history_agency_created_idx on public.billing_history(agency_id, created_at desc);
create index if not exists billing_history_asaas_payment_id_idx on public.billing_history(asaas_payment_id);
create index if not exists referrals_agency_id_idx on public.referrals(agency_id);
create index if not exists referrals_referred_agency_id_idx on public.referrals(referred_agency_id);
create index if not exists exempt_accounts_email_idx on public.exempt_accounts(lower(email));

alter table public.subscriptions enable row level security;
alter table public.billing_history enable row level security;
alter table public.billing_events enable row level security;
alter table public.exempt_accounts enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "subscriptions read agency" on public.subscriptions;
create policy "subscriptions read agency"
on public.subscriptions for select
using (public.is_agency_member(agency_id));

drop policy if exists "billing history read agency" on public.billing_history;
create policy "billing history read agency"
on public.billing_history for select
using (public.is_agency_member(agency_id));

drop policy if exists "billing events read agency" on public.billing_events;
create policy "billing events read agency"
on public.billing_events for select
using (agency_id is not null and public.is_agency_member(agency_id));

drop policy if exists "referrals read agency" on public.referrals;
create policy "referrals read agency"
on public.referrals for select
using (public.is_agency_member(agency_id) or (referred_agency_id is not null and public.is_agency_member(referred_agency_id)));

drop policy if exists "exempt accounts read owner" on public.exempt_accounts;
create policy "exempt accounts read owner"
on public.exempt_accounts for select
using (agency_id is not null and public.is_agency_admin(agency_id));

create or replace function public.mark_agency_exempt(target_agency_id uuid, exemption_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (agency_id, plan, billing_cycle, status, updated_at)
  values (target_agency_id, 'premium', 'monthly', 'exempt', now())
  on conflict (agency_id)
  do update set status = 'exempt', updated_at = now();

  insert into public.exempt_accounts (agency_id, reason, created_by)
  values (target_agency_id, exemption_reason, auth.uid());
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
  requested_role public.user_role;
  referral_input text;
  referrer_agency_id uuid;
  is_exempt_email boolean;
begin
  requested_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'agency');
  referral_input := nullif(regexp_replace(upper(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), '[^A-Z0-9]', '', 'g'), '');

  if requested_role = 'agency' then
    insert into public.agencies (name, owner_id, billing_document)
    values (
      coalesce(new.raw_user_meta_data ->> 'agency_name', new.raw_user_meta_data ->> 'name', 'Minha agência'),
      new.id,
      nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'billing_document', ''), '\D', '', 'g'), '')
    )
    returning id into new_agency_id;

    insert into public.users (id, name, email, role, agency_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      'agency',
      new_agency_id
    );

    select exists (
      select 1 from public.exempt_accounts ea
      where lower(ea.email) = lower(new.email)
    ) into is_exempt_email;

    insert into public.subscriptions (agency_id, plan, billing_cycle, status, trial_ends_at)
    values (
      new_agency_id,
      'studio',
      'monthly',
      case when is_exempt_email then 'exempt' else 'trial' end,
      now() + interval '7 days'
    )
    on conflict (agency_id) do nothing;

    insert into public.referrals (agency_id, referral_code)
    values (new_agency_id, upper(substr(replace(new_agency_id::text, '-', ''), 1, 8)))
    on conflict (referral_code) do nothing;

    if referral_input is not null then
      select r.agency_id into referrer_agency_id
      from public.referrals r
      where regexp_replace(upper(r.referral_code), '[^A-Z0-9]', '', 'g') = referral_input
      limit 1;

      if referrer_agency_id is not null and referrer_agency_id <> new_agency_id then
        insert into public.referrals (agency_id, referral_code, referred_agency_id, referred_email, status, discount_percent, reward_amount)
        values (
          referrer_agency_id,
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
          new_agency_id,
          new.email,
          'pending',
          10,
          3
        )
        on conflict do nothing;
      end if;
    end if;

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
      agency_id = excluded.agency_id;

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

notify pgrst, 'reload schema';
