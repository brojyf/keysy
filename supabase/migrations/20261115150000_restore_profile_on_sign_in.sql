-- Signing in during the account deletion grace period restores the account (#193).
-- Supabase Auth inserts an auth.sessions row on every new sign-in, and a token
-- refresh does not, so only a new sign-in restores the account.
create function public.restore_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set deleted_at = null
  where id = new.user_id and deleted_at is not null;
  return new;
end;
$$;

revoke execute on function public.restore_deleted_profile() from public, anon, authenticated;

create trigger restore_deleted_profile_after_session_insert
  after insert on auth.sessions
  for each row execute function public.restore_deleted_profile();
