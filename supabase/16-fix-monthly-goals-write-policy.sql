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

drop policy if exists "monthly goals agency write" on public.monthly_goals;
drop policy if exists "monthly goals agency insert" on public.monthly_goals;
drop policy if exists "monthly goals agency update" on public.monthly_goals;
drop policy if exists "monthly goals agency delete" on public.monthly_goals;

create policy "monthly goals agency insert"
on public.monthly_goals for insert
with check (
  public.can_manage_agency(agency_id)
  and exists (
    select 1
    from public.clients c
    where c.id = monthly_goals.client_id
      and c.agency_id = monthly_goals.agency_id
  )
);

create policy "monthly goals agency update"
on public.monthly_goals for update
using (public.can_manage_agency(agency_id))
with check (
  public.can_manage_agency(agency_id)
  and exists (
    select 1
    from public.clients c
    where c.id = monthly_goals.client_id
      and c.agency_id = monthly_goals.agency_id
  )
);

create policy "monthly goals agency delete"
on public.monthly_goals for delete
using (public.can_manage_agency(agency_id));

drop policy if exists "activity history insert scoped" on public.activity_history;
create policy "activity history insert scoped"
on public.activity_history for insert
with check (
  public.can_manage_agency(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);

drop policy if exists "notifications insert scoped" on public.notifications;
create policy "notifications insert scoped"
on public.notifications for insert
with check (
  public.can_manage_agency(agency_id)
  or (client_id is not null and public.can_access_client(client_id))
);
