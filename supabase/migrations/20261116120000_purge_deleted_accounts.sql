-- Accounts are deleted permanently 30 days after DELETE /v0/me. Memberships do
-- not cascade from auth.users, so they are deleted first. The profile and the
-- auth rows are deleted by cascade. Invitations store only an email and stay.
-- FOR UPDATE waits for a concurrent cancel and then rechecks deleted_at, so a
-- cancelled deletion is not purged.
create function public.purge_deleted_accounts()
returns void
language sql
security definer
set search_path = ''
as $$
  with purged as (
    select profiles.id from public.profiles as profiles
    where profiles.deleted_at < now() - interval '30 days'
    for update
  ), removed_memberships as (
    delete from public.members as members where members.user_id in (select id from purged)
  )
  delete from auth.users as users where users.id in (select id from purged);
$$;

revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

select cron.schedule('purge-deleted-accounts', '0 3 * * *', 'select public.purge_deleted_accounts()');
