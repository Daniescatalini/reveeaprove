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

create index if not exists team_members_agency_id_idx on public.team_members(agency_id);
create unique index if not exists team_members_access_code_idx on public.team_members(access_code);

alter table public.team_members enable row level security;

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
    insert into public.agencies (name, owner_id)
    values (coalesce(new.raw_user_meta_data ->> 'agency_name', new.raw_user_meta_data ->> 'name', 'Minha agência'), new.id)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

drop policy if exists "team members read agency" on public.team_members;
create policy "team members read agency"
on public.team_members for select
using (public.is_agency_member(agency_id));

drop policy if exists "team members agency write" on public.team_members;
create policy "team members agency write"
on public.team_members for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

notify pgrst, 'reload schema';
