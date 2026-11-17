-- Org deletion locks the org row and then cascades to its member rows in the
-- planner's order. The purge deleted the same member rows in its own order, so
-- the two could deadlock. The purge now locks the org rows of its memberships
-- first, in id order, so it waits for an org deletion or makes it wait before
-- either locks a member row. FOR KEY SHARE does not block org renames.
-- FOR UPDATE on profiles waits for a concurrent cancel and then rechecks
-- deleted_at, so a cancelled deletion is not purged. now() is fixed for the
-- transaction, so every statement selects the same accounts.
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

  delete from public.members as members
  using public.profiles as profiles
  where profiles.id = members.user_id and profiles.deleted_at < now() - interval '30 days';

  delete from auth.users as users
  using public.profiles as profiles
  where profiles.id = users.id and profiles.deleted_at < now() - interval '30 days';
$$;
