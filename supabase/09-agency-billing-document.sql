alter table public.agencies
add column if not exists billing_document text;

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
      where r.referral_code = referral_input
      limit 1;

      if referrer_agency_id is not null and referrer_agency_id <> new_agency_id then
        insert into public.referrals (agency_id, referral_code, referred_agency_id, referred_email, status, discount_percent, reward_amount)
        values (
          referrer_agency_id,
          referral_input || '-' || upper(substr(replace(new_agency_id::text, '-', ''), 1, 4)),
          new_agency_id,
          new.email,
          'pending',
          0,
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
    set
      user_id = new.id,
      status = 'active',
      updated_at = now()
    where id = (new.raw_user_meta_data ->> 'team_member_id')::uuid
      and agency_id = (new.raw_user_meta_data ->> 'agency_id')::uuid;
  else
    insert into public.users (id, name, email, role, agency_id, client_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      'client',
      (new.raw_user_meta_data ->> 'agency_id')::uuid,
      (new.raw_user_meta_data ->> 'client_id')::uuid
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      agency_id = excluded.agency_id,
      client_id = excluded.client_id;

    update public.clients
    set invite_code = null
    where id = (new.raw_user_meta_data ->> 'client_id')::uuid
      and agency_id = (new.raw_user_meta_data ->> 'agency_id')::uuid;
  end if;

  return new;
end;
$$;
