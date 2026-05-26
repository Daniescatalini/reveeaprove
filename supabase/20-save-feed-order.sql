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

create or replace function public.reorder_feed_posts(post_ids_input uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client_id uuid;
  target_agency_id uuid;
begin
  if post_ids_input is null or array_length(post_ids_input, 1) is null then
    return true;
  end if;

  select p.client_id, c.agency_id
  into target_client_id, target_agency_id
  from public.posts p
  join public.clients c on c.id = p.client_id
  where p.id = post_ids_input[1];

  if target_client_id is null or target_agency_id is null then
    raise exception 'Conteudo nao encontrado.';
  end if;

  if not public.can_manage_agency(target_agency_id) then
    raise exception 'Sem permissao para organizar este preview.';
  end if;

  if exists (
    select 1
    from public.posts p
    where p.id = any(post_ids_input)
      and p.client_id <> target_client_id
  ) then
    raise exception 'A ordem precisa ser salva por cliente.';
  end if;

  update public.posts p
  set
    feed_order = ordered.order_index - 1,
    updated_at = now()
  from unnest(post_ids_input) with ordinality as ordered(id, order_index)
  where p.id = ordered.id;

  return true;
end;
$$;

grant execute on function public.reorder_feed_posts(uuid[]) to authenticated;
