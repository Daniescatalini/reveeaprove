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

drop policy if exists "clients agency write" on public.clients;
create policy "clients agency write"
on public.clients for all
using (public.is_agency_admin(agency_id))
with check (public.is_agency_admin(agency_id));

drop policy if exists "team members agency write" on public.team_members;
create policy "team members agency write"
on public.team_members for all
using (public.is_agency_admin(agency_id))
with check (public.is_agency_admin(agency_id));

notify pgrst, 'reload schema';
