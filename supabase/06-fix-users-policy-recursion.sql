drop policy if exists "users read own agency/client scope" on public.users;
create policy "users read own agency/client scope"
on public.users for select
using (
  id = auth.uid()
  or agency_id = (public.current_profile()).agency_id
  or client_id = (public.current_profile()).client_id
);

drop policy if exists "team members update self" on public.team_members;
create policy "team members update self"
on public.team_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

notify pgrst, 'reload schema';
