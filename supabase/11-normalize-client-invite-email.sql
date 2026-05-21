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
  where regexp_replace(upper(c.invite_code), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(invite_code_input), '[^A-Z0-9]', '', 'g')
    and lower(regexp_replace(coalesce(c.email, ''), '\s+', '', 'g')) = lower(regexp_replace(coalesce(email_input, ''), '\s+', '', 'g'))
  limit 1;
$$;

grant execute on function public.get_client_invite(text, text) to anon, authenticated;
