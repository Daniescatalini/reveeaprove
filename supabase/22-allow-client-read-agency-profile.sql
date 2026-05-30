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

notify pgrst, 'reload schema';
