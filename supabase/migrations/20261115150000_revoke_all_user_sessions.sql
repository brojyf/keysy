-- Refresh tokens and MFA claims are deleted by cascade.
create function public.revoke_all_user_sessions(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions as sessions where sessions.user_id = target_user_id;
$$;
revoke execute on function public.revoke_all_user_sessions(uuid) from public, anon, authenticated;
