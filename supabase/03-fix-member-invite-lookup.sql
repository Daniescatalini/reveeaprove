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

notify pgrst, 'reload schema';
