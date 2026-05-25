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

create or replace function public.save_monthly_goal(
  goal_id_input uuid default null,
  agency_id_input uuid default null,
  client_id_input uuid default null,
  month_input integer default null,
  year_input integer default null,
  title_input text default null,
  description_input text default null,
  planned_actions_input text default null,
  responsible_user_id_input uuid default null,
  responsible_name_input text default null,
  status_input text default 'planned',
  client_feedback_input text default null,
  result_notes_input text default null
)
returns public.monthly_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal public.monthly_goals;
  target_agency_id uuid;
begin
  if goal_id_input is not null then
    select * into target_goal
    from public.monthly_goals
    where id = goal_id_input;

    if target_goal.id is null then
      raise exception 'Objetivo nao encontrado.';
    end if;

    target_agency_id := target_goal.agency_id;
  else
    target_agency_id := agency_id_input;
  end if;

  if target_agency_id is null or not public.can_manage_agency(target_agency_id) then
    raise exception 'Sem permissao para salvar objetivo.';
  end if;

  if client_id_input is null or not exists (
    select 1
    from public.clients c
    where c.id = client_id_input
      and c.agency_id = target_agency_id
  ) then
    raise exception 'Cliente invalido para esta agencia.';
  end if;

  if goal_id_input is null then
    insert into public.monthly_goals (
      agency_id,
      client_id,
      month,
      year,
      title,
      description,
      planned_actions,
      responsible_user_id,
      responsible_name,
      status,
      client_feedback,
      result_notes,
      created_at,
      updated_at
    )
    values (
      target_agency_id,
      client_id_input,
      month_input,
      year_input,
      title_input,
      description_input,
      planned_actions_input,
      responsible_user_id_input,
      responsible_name_input,
      status_input,
      client_feedback_input,
      result_notes_input,
      now(),
      now()
    )
    returning * into target_goal;
  else
    update public.monthly_goals
    set
      client_id = client_id_input,
      month = month_input,
      year = year_input,
      title = title_input,
      description = description_input,
      planned_actions = planned_actions_input,
      responsible_user_id = responsible_user_id_input,
      responsible_name = responsible_name_input,
      status = status_input,
      client_feedback = client_feedback_input,
      result_notes = result_notes_input,
      updated_at = now()
    where id = goal_id_input
    returning * into target_goal;
  end if;

  return target_goal;
end;
$$;

grant execute on function public.save_monthly_goal(
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) to authenticated;
