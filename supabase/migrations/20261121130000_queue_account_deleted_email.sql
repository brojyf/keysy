create or replace function public.purge_deleted_accounts()
returns void
language sql
security definer
set search_path = ''
as $$
  select from public.profiles as profiles
  where profiles.deleted_at < now() - interval '30 days'
  for update;

  select from public.orgs as orgs
  where orgs.id in (
    select members.org_id from public.members as members
    join public.profiles as profiles on profiles.id = members.user_id
    where profiles.deleted_at < now() - interval '30 days'
  )
  order by orgs.id
  for key share;

  -- Capture only deleted memberships and copy the profile email before the user is purged.
  with removed_memberships as (
    delete from public.members as members
    using public.profiles as profiles
    where profiles.id = members.user_id and profiles.deleted_at < now() - interval '30 days'
    returning members.org_id, members.user_id, profiles.email
  )
  insert into public.outbox (type, payload)
  select 'audit', jsonb_build_object(
    'action', 'member_removed',
    'org_id', org_id,
    'user_id', user_id,
    'email', email,
    'reason', 'account_deleted'
  )
  from removed_memberships;

  -- Keep the contact details before the profile is removed by cascade.
  with purged_accounts as (
    delete from auth.users as users
    using public.profiles as profiles
    where profiles.id = users.id and profiles.deleted_at < now() - interval '30 days'
    returning profiles.email, profiles.display_name
  )
  insert into public.outbox (type, payload)
  select 'email', jsonb_build_object(
    'to', email,
    'template', jsonb_build_object(
      'id', 'account-deleted',
      'variables', jsonb_build_object('DISPLAY_NAME', display_name)
    )
  )
  from purged_accounts;
$$;
